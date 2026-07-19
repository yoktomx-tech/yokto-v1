# Frontend portable — checklist de validación

Los 4 archivos en `06-frontend-portable/` (`client.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`) reemplazan a los auto-generados por Lovable Cloud cuando el frontend apunta al Supabase externo. Antes de aplicarlos al corte, verificar cada punto.

## Contrato de API keys (POST-MIGRACIÓN)

**Configuración principal (obligatoria)** — cliente browser:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_APP_ENV`
- `VITE_APP_URL`

Ejemplo canónico del cliente:

```ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
```

**Compatibilidad legacy (transición)**:

- `VITE_SUPABASE_ANON_KEY` sólo se acepta como fallback temporal durante el
  primer despliegue. El código nuevo debe preferir `VITE_SUPABASE_PUBLISHABLE_KEY`.
  Retirarla en Fase 1.

**Prohibidas en el frontend (jamás en `VITE_*` ni en el bundle browser):**

- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `sb_secret_*`
- `service_role`
- Contraseña de la base PostgreSQL
- Personal Access Token de Supabase
- Claves de proveedores externos (Stripe secret, Nubarium, Verificamex, Copomex, AI providers)
- Claves productivas de cualquier proyecto (incluyendo `diqdpygummlrajsugotv`)
- `LOVABLE_API_KEY`

## Grep obligatorio

Ejecutar sobre `src/` (bundle browser) y `migration/06-frontend-portable/`.

```bash
# URLs / project refs hardcodeados
grep -rnE "https?://[a-z0-9-]+\.supabase\.(co|in|cloud)" src/ migration/06-frontend-portable/
grep -rnE "\.lovable\.(cloud|app|dev)"                    src/ migration/06-frontend-portable/

# Claves reales (JWT firmadas, sb_publishable_, sb_secret_)
grep -rnE "eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\."           src/ migration/06-frontend-portable/
grep -rnE "\bsb_secret_[A-Za-z0-9]+"                       src/ migration/06-frontend-portable/
grep -rnE "\bsb_publishable_[A-Za-z0-9]+"                  src/ migration/06-frontend-portable/

# service_role NUNCA en cliente browser
grep -rnE "SERVICE_ROLE|service_role"                      src/ migration/06-frontend-portable/client.ts migration/06-frontend-portable/auth-attacher.ts

# Contraseñas PostgreSQL y tokens en frontend
grep -rnE "SUPABASE_DB_PASSWORD|postgres://[^ ]+:[^@]+@"   src/
grep -rnE "\bsbp_[A-Za-z0-9]+"                             src/

# Claves de proveedores en frontend
grep -rnE "\bsk_(test|live)_[A-Za-z0-9]+"                  src/    # Stripe secret
grep -rnE "NUBARIUM_(USER|PASSWORD)|VERIFICAMEX_API_KEY|COPOMEX_TOKEN" src/

# Referencias productivas
grep -rn  "diqdpygummlrajsugotv"                           src/ migration/06-frontend-portable/

# Helpers Lovable / AI Gateway administrado
grep -rn  "@lovable.dev\|lovable\.auth\|lovable-cloud\|ai.gateway.lovable.dev\|LOVABLE_API_KEY" \
                                                            src/ migration/06-frontend-portable/
```

Resultado esperado en todos los greps: **0 coincidencias**.

| Chequeo | Resultado esperado |
| --- | --- |
| URLs Supabase hardcodeadas | 0 |
| Dominios Lovable | 0 |
| JWT firmados | 0 |
| `sb_secret_*` en frontend | 0 |
| `SERVICE_ROLE` / `service_role` en frontend | 0 |
| Password PostgreSQL en frontend | 0 |
| Personal Access Token (`sbp_*`) en frontend | 0 |
| Claves de proveedores en frontend | 0 |
| Referencias a proyecto productivo | 0 |
| `LOVABLE_API_KEY` / AI Gateway Lovable | 0 |

## Variables de entorno esperadas

`client.ts` (browser) — sólo lee `import.meta.env`:

- `import.meta.env.VITE_SUPABASE_URL`
- `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY` (principal)
- `import.meta.env.VITE_SUPABASE_ANON_KEY` (fallback legacy únicamente)

`client.server.ts` (server-only) — sólo lee `process.env`:

- `process.env.SUPABASE_URL`
- `process.env.SUPABASE_SERVICE_ROLE_KEY` — SÓLO aquí

`auth-middleware.ts`:

- `process.env.SUPABASE_URL`
- `process.env.SUPABASE_PUBLISHABLE_KEY`

`auth-attacher.ts`:

- Sin secretos; sólo lee sesión del cliente browser.

## Contrato funcional

| Archivo | Debe | No debe |
| --- | --- | --- |
| `client.ts` | Preferir `VITE_SUPABASE_PUBLISHABLE_KEY`, fallback a `VITE_SUPABASE_ANON_KEY`; crear cliente con `persistSession`, `autoRefreshToken`, `detectSessionInUrl` | Contener service_role; llamar `lovable.auth`; leer `LOVABLE_API_KEY` |
| `client.server.ts` | Crear `supabaseAdmin` con service_role; `auth: { persistSession: false, autoRefreshToken: false }` | Exportarse desde módulos que llegan al bundle browser |
| `auth-middleware.ts` | Extraer bearer del request, validar `getUser()`, poblar `context.supabase`, `context.userId`, `context.claims`; devolver 401 sin bearer | Depender de helpers Lovable |
| `auth-attacher.ts` | Leer `supabase.auth.getSession()` client-side y anexar `Authorization: Bearer <token>` a llamadas `createServerFn` | Anexar service_role; escribir logs con el token |

## Callbacks OAuth

- `redirect_uri` de Google: `${window.location.origin}` o `${window.location.origin}/auth/callback` (ruta pública). Nunca `/dashboard` ni `/_authenticated/*`.
- Tras el callback: `supabase.auth.getSession()` + navegación a la ruta destino guardada en `sessionStorage`.

## Renovación de tokens

- Confiar en `autoRefreshToken: true` del cliente browser.
- `auth-attacher.ts` debe reobtener la sesión antes de cada request (`getSession()`), no cachearla globalmente.

## Regeneración de tipos

Tras aplicar el schema en el proyecto externo:

```bash
supabase login
supabase gen types typescript --project-id <ref-nuevo> \
  > src/integrations/supabase/types.ts
```

Ejecutar `bun run build` y verificar 0 errores TS.

## Checklist antes del corte

- [ ] Grep completo → 0 coincidencias en cada categoría.
- [ ] `.env.staging.template` sólo declara variables permitidas.
- [ ] `bun run build` en local con `.env.staging` apuntando a staging → compila.
- [ ] Login con contraseña OK en staging usando estos 4 archivos.
- [ ] Login con Google OK en staging.
- [ ] Un serverFn autenticado (ej. `getUserProfile`) devuelve 200.
- [ ] Un serverFn sin bearer devuelve 401.
- [ ] Refresh de token tras 60 min sigue funcionando (dejar tab abierto y verificar).
