# Inventario complementario de infraestructura Supabase

Documenta objetos y configuraciones **fuera del schema `public`** que también deben migrarse. La migración de sólo `public` deja el sistema roto.

## 1. Extensiones PostgreSQL

Extraer con:

```sql
SELECT extname, extversion FROM pg_extension WHERE extname NOT IN ('plpgsql') ORDER BY 1;
```

Presentes hoy (según `00_extensions.sql`):

- `pgcrypto` — hashing y `gen_random_uuid`.
- `pg_net` — llamadas HTTP desde SQL (cron).
- `pg_cron` — jobs programados.

En el proyecto externo:

1. Habilitar en Database → Extensions ANTES de aplicar `01-schema/*`.
2. `pg_cron` sólo está disponible en planes de pago — confirmar el plan del proyecto destino.

## 2. Funciones de extensiones invocadas

- `net.http_post(url, headers, body)` desde `pg_cron` jobs.
- `pgcrypto`: `crypt`, `gen_salt`, `digest`, `gen_random_uuid`.

Ningún cambio de sintaxis; sólo requerido que las extensiones estén habilitadas.

## 3. Secuencias

```
dispute_numero_seq
support_ticket_numero_seq
transaction_numero_seq
```

Se recrean por `01-schema/02_tables.sql`. **Ajustar `setval`** después del import para no reusar números:

```sql
SELECT setval('public.transaction_numero_seq',
              (SELECT COALESCE(MAX(SUBSTRING(numero FROM '\d+$')::int), 0) FROM public.transactions));
-- repetir para dispute y support
```

## 4. Vistas y vistas materializadas

Extraer:

```sql
SELECT schemaname, viewname, 'view' FROM pg_views WHERE schemaname='public'
UNION ALL
SELECT schemaname, matviewname, 'matview' FROM pg_matviews WHERE schemaname='public';
```

Estado actual: sin materialized views (ver `_views.txt`). Si al momento del corte existen, incluirlas en `01-schema/11_views.sql` y refrescar (`REFRESH MATERIALIZED VIEW`) tras el import.

## 5. Publicaciones Realtime

```sql
SELECT pubname, schemaname, tablename FROM pg_publication_tables WHERE pubname='supabase_realtime';
```

Tablas críticas actualmente publicadas (verificado):

- `disputes`, `dispute_messages`, `dispute_evidence`
- `support_tickets`, `support_messages`
- `fiscal_documents`
- `notifications`

En el proyecto externo, después de `01-schema/*`:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.disputes;
-- repetir para cada tabla listada
```

RLS controla la entrega — verificado en las 274 policies existentes.

## 6. pg_cron / Supabase Cron

Jobs actuales (documentar con `SELECT * FROM cron.job;`):

| Job | Schedule | Comando |
| --- | --- | --- |
| `dispute-deadlines` | `*/15 * * * *` | `net.http_post` → `/api/public/hooks/dispute-deadlines` |
| `support-sla` | `*/5 * * * *`  | `net.http_post` → `/api/public/hooks/support-sla` |
| `cleanup-abandoned-onboarding` | `0 3 * * *` | `SELECT public.cleanup_abandoned_onboarding();` |

En el proyecto externo:

1. Recrear jobs apuntando a las nuevas Edge Functions (`https://<ref>.functions.supabase.co/cron-*`).
2. Guardar `app.settings.cron_secret` en `ALTER DATABASE postgres SET app.settings.cron_secret = '...';` (NO permitido — usar tabla `vault` o variable en el header HTTP firmado con HMAC).
3. Documentar en `05-edge-functions/cron-jobs.md`.

## 7. Database Webhooks (Supabase → HTTP)

```sql
SELECT * FROM supabase_functions.hooks;
```

Estado actual: ninguno configurado (todo pasa por `pg_cron` + `pg_net`). Si se agregan, replicar en el proyecto destino desde el dashboard.

## 8. Vault / secretos de base de datos

```sql
SELECT name FROM vault.secrets;
```

Estado actual: sin secretos en Vault. Los secretos usados en Edge Functions vivirán en **Function Secrets** (`supabase secrets set`), no en Vault, salvo que se requiera acceder a ellos desde SQL puro.

## 9. Triggers en schemas `auth` y `storage`

```sql
SELECT event_object_schema, event_object_table, trigger_name, action_statement
FROM information_schema.triggers
WHERE event_object_schema IN ('auth','storage')
ORDER BY 1,2;
```

Presente:

- `auth.users` → trigger `on_auth_user_created` que ejecuta `public.handle_new_user()`.

Migración: incluido en `01-schema/04_triggers.sql`. Verificar que sigue existiendo tras `\COPY auth.users` (los triggers no se disparan con COPY, es la conducta deseada).

## 10. Configuración de correo

| Setting | Valor a documentar |
| --- | --- |
| Provider | Custom SMTP del cliente |
| Sender name | YOKTO |
| Sender email | `no-reply@<dominio-cliente>` |
| Reply-to | soporte |
| Rate limit | 100/hora inicial |
| Templates | 6 templates en español (confirm, invite, magic-link, recovery, email-change, reauth) |

Extraer templates actuales desde Cloud (dashboard → Authentication → Email Templates), guardar como HTML en `03-auth-migration/email-templates/`.

## 11. Configuración de Auth adicional

| Setting | Valor actual | Acción |
| --- | --- | --- |
| `disable_signup` | false | Configurar false |
| `external_anonymous_users_enabled` | false | Configurar false |
| `auto_confirm_email` | false | Confirmar false |
| `password_hibp_enabled` | true | Configurar true |
| `mailer_autoconfirm` | false | Confirmar false |
| `security_manual_linking_enabled` | false | Confirmar false |
| `security_captcha_enabled` | según plan | Documentar |

## 12. Storage — límites y MIME types

Por bucket:

```sql
SELECT id, name, public, file_size_limit, allowed_mime_types, avif_autodetection
FROM storage.buckets;
```

A replicar por bucket:

| Bucket | Público | Tamaño máx | MIME permitidos |
| --- | --- | --- | --- |
| `kyc-documents` | No | 15 MB | `application/pdf`, `image/jpeg`, `image/png` |
| `dispute-evidence` | No | 25 MB | `application/pdf`, `image/*`, `video/mp4` |
| `verification-evidence` | No | 15 MB | `application/pdf`, `image/*` |
| `biometric-captures` | No | 30 MB | `image/jpeg`, `image/png`, `video/webm`, `video/mp4` |
| `transaction-documents` | No | 25 MB | `application/pdf`, `image/*`, CFDI XML |
| `support-attachments` | No | 15 MB | `application/pdf`, `image/*`, `text/*` |

Extraer valores reales antes del corte y actualizar `01-schema/08_storage_buckets_and_policies.sql`.

## 13. Global Storage limits

- `storage.upload_size_limit` (project level) — leer en Settings → Storage.
- Egress mensual (info) — documentar plan del proyecto destino.

## 14. CORS y dominios permitidos

En el proyecto externo (Settings → API → CORS):

- Añadir dominio productivo YOKTO.
- Añadir dominios de preview de Lovable.
- Añadir `http://localhost:8080` para desarrollo local.

## 15. Rate limits

Documentar y replicar (Settings → Auth → Rate limits):

- Sign in per IP (default 30/5min)
- Sign up per IP (default 30/hour)
- Email sends per hour (100)
- SMS sends per hour (30) — si se usara SMS

## 16. JWT y firma

- JWT secret del proyecto externo → los tokens emitidos en Cloud viejo dejan de ser válidos automáticamente. Buena propiedad: fuerza reautenticación en el corte.
- Signing keys asimétricas: si el cliente prefiere JWKS público, activar `migrate_signing_keys` desde el dashboard antes del corte.

## 17. Roles Postgres a nivel base de datos

- `authenticated`, `anon`, `service_role` — creados por Supabase automáticamente, no requieren migración.
- No hay roles custom en el schema actual (verificar con `\du` en psql).

## Entregable de auditoría

Al terminar la Fase 0, generar `migration/00-inventory/supabase-infrastructure-report.md` con el resultado real (no plantilla) de cada consulta anterior contra Cloud actual, más los valores que se aplicarán en el destino.
