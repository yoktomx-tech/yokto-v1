# Fase 0 — Migración de Supabase Auth

Playbook completo para portar `auth.users`, `auth.identities`, proveedores, MFA, sesiones y configuración de correo al proyecto Supabase externo, preservando UUIDs y minimizando reautenticaciones.

## Objetivo

Al terminar el corte el usuario final:

- conserva su UUID (`auth.users.id` idéntico origen ↔ destino);
- conserva su correo, confirmación, MFA, avatar y `raw_user_meta_data`;
- puede iniciar sesión con la misma contraseña **o** con Google;
- será obligado a reautenticarse una única vez (las sesiones activas no se migran).

## 1. Inventario previo (ejecutar en Cloud actual)

Archivo: `03-auth-migration/01_inventory.sql` — se ejecuta con `psql` contra Cloud, exporta CSVs:

```sql
-- Conteos
SELECT 'users' AS obj, count(*) FROM auth.users
UNION ALL SELECT 'identities', count(*) FROM auth.identities
UNION ALL SELECT 'sessions', count(*) FROM auth.sessions
UNION ALL SELECT 'mfa_factors', count(*) FROM auth.mfa_factors
UNION ALL SELECT 'refresh_tokens', count(*) FROM auth.refresh_tokens;

-- Distribución por proveedor
SELECT provider, count(*) FROM auth.identities GROUP BY 1;

-- Usuarios sin confirmar / bloqueados / eliminados
SELECT count(*) FILTER (WHERE email_confirmed_at IS NULL) AS unconfirmed,
       count(*) FILTER (WHERE banned_until > now())        AS banned,
       count(*) FILTER (WHERE deleted_at IS NOT NULL)      AS soft_deleted
FROM auth.users;

-- MFA activo
SELECT factor_type, status, count(*) FROM auth.mfa_factors GROUP BY 1,2;

-- Export CSVs
\COPY (SELECT id, email, encrypted_password, email_confirmed_at, phone,
              phone_confirmed_at, confirmation_token, recovery_token,
              email_change, email_change_token_new, banned_until,
              raw_app_meta_data, raw_user_meta_data, is_sso_user,
              created_at, updated_at, last_sign_in_at, deleted_at
       FROM auth.users) TO 'auth_users.csv' CSV HEADER;

\COPY (SELECT id, user_id, identity_data, provider, provider_id,
              created_at, updated_at, last_sign_in_at, email
       FROM auth.identities) TO 'auth_identities.csv' CSV HEADER;

\COPY (SELECT id, user_id, friendly_name, factor_type, status,
              secret, phone, created_at, updated_at
       FROM auth.mfa_factors WHERE status='verified')
      TO 'auth_mfa_factors.csv' CSV HEADER;
```

Entregables esperados en `03-auth-migration/exports/`: `auth_users.csv`, `auth_identities.csv`, `auth_mfa_factors.csv`, `inventory-report.md` (conteos y proveedores).

## 2. Configuración del proyecto externo (antes de importar)

En el dashboard del Supabase externo:

| Sección | Valor exacto |
| --- | --- |
| Auth → URL Configuration → Site URL | `https://<dominio-productivo-yokto>` |
| Auth → Redirect URLs | `https://<dominio-productivo-yokto>/**`, `https://<preview>/**` |
| Auth → Email → Confirm email | ON |
| Auth → Email → HIBP check | ON |
| Auth → Email → Secure email change | ON |
| Auth → Email → Rate limit (hourly) | 100 (o el vigente) |
| Auth → Providers → Email | Enabled |
| Auth → Providers → Google | Enabled, Client ID/Secret propios del cliente |
| Auth → MFA → TOTP | Enabled |
| Auth → MFA → Enforcement | Requerido para acciones sensibles (backoffice, cierre de tickets escalados) |
| Auth → Sessions → JWT expiry | 3600 (default) |
| Auth → Sessions → Refresh token rotation | Enabled |
| Auth → Sessions → Reuse interval | 10s |
| Auth → OTP → Expiry | 3600s (bajar a 600s si el cliente lo requiere) |
| SMTP | Custom SMTP del cliente (SendGrid/Resend/SES) con dominio verificado |
| Email templates | Copiar los 6 templates desde Cloud (confirm signup, magic link, invite, recovery, email change, reauth) — versión español |

Documentar valores exactos en `03-auth-migration/target-auth-config.md`.

## 3. Importación de usuarios

Supabase soporta importación preservando UUID mediante la API de admin o SQL directo (recomendado para volumen).

### Opción SQL directa (recomendada — requiere superuser vía Studio > SQL Editor del proyecto destino)

Archivo `03-auth-migration/02_import_users.sql`:

```sql
BEGIN;

-- Bloquear signups mientras se importa
-- (Configurar disable_signup = true en el dashboard antes de correr)

-- 1. Users
\COPY auth.users (id, email, encrypted_password, email_confirmed_at, phone,
                  phone_confirmed_at, banned_until, raw_app_meta_data,
                  raw_user_meta_data, is_sso_user, created_at, updated_at,
                  last_sign_in_at)
      FROM 'auth_users.csv' CSV HEADER;

-- 2. Identities (correo + Google)
\COPY auth.identities (id, user_id, identity_data, provider, provider_id,
                       created_at, updated_at, last_sign_in_at, email)
      FROM 'auth_identities.csv' CSV HEADER;

-- 3. MFA factors verificados
\COPY auth.mfa_factors (id, user_id, friendly_name, factor_type, status,
                        secret, phone, created_at, updated_at)
      FROM 'auth_mfa_factors.csv' CSV HEADER;

-- 4. Conciliación
SELECT
  (SELECT count(*) FROM auth.users)      AS users_after,
  (SELECT count(*) FROM auth.identities) AS identities_after,
  (SELECT count(*) FROM auth.mfa_factors WHERE status='verified') AS mfa_after;

COMMIT;
```

Puntos críticos:

- `encrypted_password` se copia tal cual (bcrypt) — la contraseña sigue funcionando sin reset.
- `provider_id` de Google se preserva → siguiente sign-in con Google enlaza al mismo `auth.users.id`.
- **NO importar** `auth.sessions` ni `auth.refresh_tokens`: se descartan a propósito para forzar reautenticación (cierra sesiones anteriores en Cloud viejo).

### Post-import — trigger `handle_new_user`

El proyecto externo tendrá el trigger `on_auth_user_created` (definido en `01-schema/04_triggers.sql`) creando `profiles` y `user_roles` para signups **futuros**. Para los usuarios importados los `profiles`, `user_roles`, `organizations` y `memberships` provienen del dump de `public.*`; el trigger no se dispara en `\COPY`.

Verificar que cada `auth.users.id` importado tiene su fila en `public.profiles`. Query de conciliación:

```sql
SELECT u.id FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
```

## 4. Google OAuth — pre-corte

1. En Google Cloud Console: crear (o reutilizar) OAuth Client ID **del cliente**.
2. Authorized redirect URI: copiar exacto desde Auth → Providers → Google del proyecto externo (`https://<ref>.supabase.co/auth/v1/callback`).
3. Authorized domains: dominio productivo YOKTO + subdominios de preview.
4. Pegar Client ID/Secret en el proyecto externo antes del corte.
5. Probar con una cuenta de prueba **antes** de la ventana.

## 5. MFA

- Factores TOTP importados vía `auth.mfa_factors` conservan el `secret` cifrado y el usuario sigue usando el mismo authenticator app.
- Factores SMS no se migran (rara vez usados en YOKTO); si existen, forzar re-enrolamiento.
- El enforcement `aal2` para cierre de tickets sensibles se preserva a nivel aplicación (verificado en `admin/support.functions.ts`).

## 6. Conciliación post-import

Archivo `03-auth-migration/03_reconciliation.sql`:

```sql
WITH src AS (SELECT 15000 AS users, 15000 AS identities_email, 4200 AS identities_google, 320 AS mfa)
SELECT
  (SELECT count(*) FROM auth.users)                                       AS dst_users,
  src.users                                                                AS src_users,
  (SELECT count(*) FROM auth.identities WHERE provider='email')           AS dst_email,
  (SELECT count(*) FROM auth.identities WHERE provider='google')          AS dst_google,
  (SELECT count(*) FROM auth.mfa_factors WHERE status='verified')         AS dst_mfa,
  src.mfa                                                                  AS src_mfa
FROM src;
```

Sustituir los conteos hardcodeados por los medidos en el paso 1.

Adicionalmente:

- Todo `public.profiles.id` debe corresponder a un `auth.users.id`.
- Todo `public.memberships.user_id` debe corresponder a un `auth.users.id`.
- Ningún usuario debe quedar sin `profiles`.
- Ningún `raw_user_meta_data` puede perderse.

## 7. Comunicación al usuario

Debe indicarse claramente en el comunicado de corte:

> Por motivos de seguridad, tu sesión actual se cerrará durante la ventana de mantenimiento. Al volver, tu correo, contraseña, autenticador (Google Authenticator/Authy) y accesos con Google seguirán funcionando exactamente igual. No necesitas registrarte de nuevo.

## 8. Recuperación de contraseña post-corte

- Formulario existente `/forgot-password` → `supabase.auth.resetPasswordForEmail(email, { redirectTo: '<site-url>/reset-password' })` con la nueva URL.
- Ruta `/reset-password` inalterada.
- Verificar que el template "Recovery" del proyecto externo apunta a la nueva Site URL.

## 9. Checklist de aceptación de Auth

- [ ] Conteos src == dst para `auth.users`, `auth.identities`, `mfa_factors verified`.
- [ ] UUID preservados (query de diff = 0).
- [ ] Login con contraseña OK (3 usuarios de prueba).
- [ ] Login con Google OK enlazado al mismo UUID.
- [ ] MFA TOTP OK con authenticator existente.
- [ ] Recuperación de contraseña OK.
- [ ] Email de confirmación OK (usuario nuevo de prueba).
- [ ] Usuarios `banned_until` siguen bloqueados.
- [ ] Usuarios `deleted_at` **no** re-importados.
- [ ] Todos los `public.profiles` tienen `auth.users` correspondiente.

Sólo cuando este checklist pase al 100 % en el dry run puede iniciar la ventana de corte productivo.
