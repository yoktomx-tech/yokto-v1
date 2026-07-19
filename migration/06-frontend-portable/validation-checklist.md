# Frontend portable — checklist de validación

Los 4 archivos en `06-frontend-portable/` (`client.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`) reemplazan a los auto-generados por Lovable Cloud cuando el frontend apunta al Supabase externo. Antes de aplicarlos al corte, verificar cada punto.

## Grep obligatorio

```bash
# URLs / project refs hardcodeados
grep -nE "https?://[a-z0-9-]+\.supabase\.(co|in|cloud)" migration/06-frontend-portable/
grep -nE "\.lovable\.(cloud|app|dev)" migration/06-frontend-portable/

# Llaves reales (JWT o sb_)
grep -nE "eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\." migration/06-frontend-portable/
grep -nE "\bsb_(secret|publishable)_[A-Za-z0-9]+" migration/06-frontend-portable/

# service_role NUNCA en cliente browser
grep -n "SERVICE_ROLE\|service_role" migration/06-frontend-portable/client.ts migration/06-frontend-portable/auth-attacher.ts

# Helpers de Lovable
grep -n "@lovable.dev\|lovable\.auth\|lovable-cloud" migration/06-frontend-portable/
```

Resultado esperado:

| Chequeo | Resultado esperado |
| --- | --- |
| URLs hardcodeadas | 0 coincidencias |
| Dominios Lovable | 0 coincidencias |
| JWT / sb_ keys reales | 0 coincidencias |
| `SERVICE_ROLE` en `client.ts` o `auth-attacher.ts` | 0 coincidencias |
| Helpers Lovable | 0 coincidencias |

## Variables de entorno esperadas

`client.ts` (browser):

- `import.meta.env.VITE_SUPABASE_URL`
- `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY` (o `VITE_SUPABASE_ANON_KEY`)

`client.server.ts` (server-only):

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
| `client.ts` | Crear cliente con `auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }`; exponer `supabase` | Contener service_role; llamar `lovable.auth` |
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

- [ ] Grep de URLs/keys/service_role → 0 coincidencias.
- [ ] `.env.template` documenta cada variable y a qué apunta.
- [ ] `bun run build` en local con `.env` apuntando a staging → compila.
- [ ] Login con contraseña OK en staging usando estos 4 archivos.
- [ ] Login con Google OK en staging.
- [ ] Un serverFn autenticado (ej. `getUserProfile`) devuelve 200.
- [ ] Un serverFn sin bearer devuelve 401.
- [ ] Refresh de token tras 60 min sigue funcionando (dejar tab abierto y verificar).
