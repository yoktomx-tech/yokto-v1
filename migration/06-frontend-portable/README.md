# Frontend portable — archivos que reemplazan `src/integrations/supabase/*`

Al migrar al proyecto Supabase externo, los archivos auto-generados por Lovable Cloud dejan de ser aplicables (usan claves formato `sb_publishable_*`, wrappers específicos, atacher SDK propio). Aquí van los **archivos de reemplazo** listos para copiar sobre `src/integrations/supabase/` después del corte.

## Diferencias vs. Cloud

| Cloud auto-gen | Portable (aquí) |
|---|---|
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `VITE_SUPABASE_ANON_KEY` (nombre estándar) |
| `SUPABASE_PUBLISHABLE_KEY` server | `SUPABASE_ANON_KEY` server |
| Wrapper `createSupabaseFetch` para claves `sb_*` | Cliente Supabase estándar, sin wrapper |
| `attachSupabaseAuth` con lógica Cloud | Attacher estándar `getSession()` → `Authorization: Bearer` |

## Archivos incluidos

- `client.ts` — cliente browser (`@supabase/supabase-js`)
- `client.server.ts` — cliente admin server-only (`SUPABASE_SERVICE_ROLE_KEY`)
- `auth-middleware.ts` — middleware `requireSupabaseAuth` para `createServerFn`
- `auth-attacher.ts` — `functionMiddleware` que adjunta bearer al client
- `.env.template` — variables a configurar en Lovable (Settings → Environment)

Los tipos (`types.ts`) NO se copian — se regeneran con:
```bash
supabase gen types typescript --project-id <ref-nuevo> --schema public \
  > src/integrations/supabase/types.ts
```

## Post-copia

1. `bun remove @lovable.dev/cloud-auth-js`
2. Eliminar `src/integrations/lovable/index.ts`.
3. Reemplazar en el frontend cualquier `lovable.auth.signInWithOAuth('google', ...)` por:
   ```ts
   supabase.auth.signInWithOAuth({
     provider: 'google',
     options: { redirectTo: `${window.location.origin}/auth/callback` }
   });
   ```
4. Eliminar (o dejar como no-op) `src/lib/lovable-error-reporting.ts`.
5. En Supabase Studio del nuevo proyecto:
   - Auth → Providers → Google: activar y pegar Client ID/Secret propios.
   - Auth → URL Configuration → Site URL: `https://<hosting-yokto>`.
   - Auth → URL Configuration → Redirect URLs: agregar `https://<hosting-yokto>/**`.
   - Auth → Providers → Email: activar "Confirm email" + HIBP check.
