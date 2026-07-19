# Frontend externo — Paquete de configuración para `yoktobox`

Este paquete contiene todo lo necesario para desplegar el frontend en un
hosting externo (Vercel, Cloudflare Pages, Netlify, Fly.io) enlazado al
Supabase externo **`yoktobox`**.

> **Este trabajo se hace en el FORK del repo, fuera de Lovable.** Lovable no
> tiene acceso al hosting externo ni debe recibir sus credenciales.

---

## 1. Variables de entorno

### 1.1 Cliente (build-time, expuestas al navegador)

```
VITE_SUPABASE_URL=https://<ref-yoktobox>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key-yoktobox>
VITE_APP_ENV=production
```

Fuente de los valores: Supabase Dashboard → yoktobox → **Project Settings →
API**.

### 1.2 Servidor (runtime, TanStack server functions, NUNCA en cliente)

```
SUPABASE_URL=https://<ref-yoktobox>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable-key-yoktobox>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key-yoktobox>
```

### 1.3 Prohibidas en el bundle cliente

Nunca prefijar con `VITE_`:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `AI_PROVIDER_API_KEY`
- `NUBARIUM_PASSWORD`
- `VERIFICAMEX_API_KEY`
- `BANK_ACCOUNT_HASH_SECRET`
- Cualquier `OAUTH_CLIENT_SECRET`
- Cualquier DB password

Estas deben vivir SOLO como secretos del hosting (Vercel Env Vars, Cloudflare
Pages Env Vars, etc.), **sin** prefijo `VITE_`.

---

## 2. Plantillas .env

Se incluyen en este directorio:

- `.env.example` — plantilla comentada con todas las variables.
- `.env.hosting.example` — plantilla específica para hosting externo.

**Copia** a `.env.local` o configúralas en el panel del hosting. No commitear
valores reales.

---

## 3. Integración con yoktobox — pasos del operador

### 3.1 Preparar el fork

```bash
git clone <fork-repo>
cd <fork-repo>
```

### 3.2 Reemplazar cliente Lovable Cloud por Supabase estándar

```bash
# Eliminar dependencia Lovable
bun remove @lovable.dev/cloud-auth-js
rm -rf src/integrations/lovable

# Copiar cliente portable
cp migration/06-frontend-portable/client.ts           src/integrations/supabase/client.ts
cp migration/06-frontend-portable/client.server.ts    src/integrations/supabase/client.server.ts
cp migration/06-frontend-portable/auth-middleware.ts  src/integrations/supabase/auth-middleware.ts
cp migration/06-frontend-portable/auth-attacher.ts    src/integrations/supabase/auth-attacher.ts

# Regenerar types desde yoktobox
supabase gen types typescript \
  --project-id "$SUPABASE_PROJECT_REF" \
  --schema public \
  > src/integrations/supabase/types.ts
```

### 3.3 Cambios de código en frontend

Buscar y reemplazar cualquier uso de:

```ts
// Antes (Lovable Cloud)
import { lovable } from "@/integrations/lovable";
lovable.auth.signInWithOAuth("google", { redirect_uri: ... });
```

Por:

```ts
// Después (Supabase estándar)
import { supabase } from "@/integrations/supabase/client";
supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: `${window.location.origin}/auth/callback` }
});
```

Verificar `src/start.ts`: el `functionMiddleware` debe seguir apuntando al
attacher portable (`src/integrations/supabase/auth-attacher.ts`).

Neutralizar (o eliminar) reportes Lovable:

```ts
// src/lib/lovable-error-reporting.ts — dejar como no-op
export function captureError() {}
export function captureMessage() {}
```

### 3.4 Verificar que no quedan referencias a Lovable Cloud

```bash
rg -n "diqdpygummlrajsugotv|@lovable\.dev|LOVABLE_API_KEY|lovable\.auth" src
```

Debe devolver **0 matches** en el fork antes de desplegar.

---

## 4. Configuración por proveedor de hosting

### 4.1 Vercel

```bash
vercel link
vercel env add VITE_SUPABASE_URL          production
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production
vercel env add SUPABASE_URL               production
vercel env add SUPABASE_PUBLISHABLE_KEY   production
vercel env add SUPABASE_SERVICE_ROLE_KEY  production
vercel deploy --prod
```

### 4.2 Cloudflare Pages

- Dashboard → Pages → yoktobox-frontend → Settings → Environment Variables
- Añadir todas las variables de secciones 1.1 y 1.2.
- Marcar `SUPABASE_SERVICE_ROLE_KEY` como **encrypted**.

### 4.3 Netlify

```bash
netlify env:set VITE_SUPABASE_URL "https://<ref>.supabase.co"
netlify env:set VITE_SUPABASE_PUBLISHABLE_KEY "<key>"
netlify env:set SUPABASE_SERVICE_ROLE_KEY "<key>" --secret
```

---

## 5. Configuración de Auth en Dashboard yoktobox

Antes del primer deploy productivo:

- **Auth → URL Configuration**
  - Site URL = URL final del hosting.
  - Redirect URLs = URL final + `/**`.
- **Auth → Providers → Google**
  - Client ID/Secret propios (nuevos, no reutilizar Cloud).
- **Auth → Providers → Email**
  - Confirm email ON, HIBP ON, auto-confirm OFF.
- **Auth → Email Templates** con branding YOKTO.
- **Auth → SMTP** propio configurado.

---

## 6. Validación post-deploy

Desde el sitio deployado:

```js
// DevTools → Console
console.log(import.meta.env.VITE_SUPABASE_URL);
// Debe imprimir https://<ref-yoktobox>.supabase.co
// NUNCA debe imprimir diqdpygummlrajsugotv.supabase.co
```

Prueba end-to-end mínima:

1. Signup con email nuevo → llega correo de confirmación desde SMTP de yoktobox.
2. Confirmar → login OK → `supabase.auth.getUser()` devuelve el user.
3. Trigger `handle_new_user` crea `profiles`, `user_roles=buyer`, `organizations` (individual), `memberships` (owner).
4. Google OAuth → callback en URL correcta → sesión establecida.
5. Query RLS: `supabase.from('profiles').select()` devuelve solo el registro propio.

Documentar resultados en
`migration/07-cutover/reports/frontend-portable-test-report.md`.

---

## 7. Rollback del frontend

Si el frontend externo falla:

- **DNS aún no cambiado**: mantener DNS apuntando al hosting Lovable Cloud.
- **DNS ya cambiado**: revertir DNS al hosting Lovable Cloud (TTL bajo ayuda).
- Investigar en logs del hosting externo antes de reintentar.

---

## 8. Estado final esperado

Cuando este paquete queda aplicado en el fork externo:

- ✅ El frontend usa `VITE_SUPABASE_URL` de yoktobox.
- ✅ Cero referencias a `diqdpygummlrajsugotv` o Lovable Cloud en el bundle.
- ✅ Auth, OAuth, RLS, Storage, Edge Functions responden desde yoktobox.
- ✅ Lovable sigue siendo solo el generador de artefactos.
