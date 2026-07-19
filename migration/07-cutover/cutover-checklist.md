# Checklist de corte (cutover) — YOKTO Cloud → Supabase externo

## T-7 días

- [ ] Crear proyecto Supabase externo en cuenta del cliente (región y plan).
- [ ] Aplicar `01-schema/*.sql` (esquema vacío).
- [ ] Aplicar `02-role-model-migration/10..12` (enums, tablas, funciones v2).
- [ ] Crear buckets Storage (`01-schema/08_storage_buckets_and_policies.sql`).
- [ ] Configurar Auth:
  - [ ] Site URL = `https://<hosting-yokto>`
  - [ ] Redirect URLs = `https://<hosting-yokto>/**`
  - [ ] Email provider: Confirm email ON, HIBP check ON.
  - [ ] Google provider: pegar Client ID/Secret propios.
  - [ ] MFA: TOTP habilitado, obligatorio para acciones sensibles.
- [ ] Habilitar `pg_cron` y `pg_net`; setear `app.settings.cron_secret`.
- [ ] Generar S3 Access Keys en Supabase Studio → Storage.
- [ ] Crear secretos runtime en Vault del proyecto externo (Nubarium, Verificamex, Copomex, Stripe, Bank hash).
- [ ] `bun add @supabase/supabase-js` (si no está); ejecutar `supabase gen types` contra el nuevo proyecto.

## T-3 días — dry run en staging

- [ ] Dump inicial de datos (`03-data-migration/README.md` pasos 1-2).
- [ ] Restore en proyecto de staging duplicado.
- [ ] Correr `13_role_data_backfill.sql` + `14_new_rls_policies.sql`.
- [ ] Mirror de buckets (`04-storage-migration/README.md`).
- [ ] Correr `07-cutover/verification-suite.sql` (todo `ok`).
- [ ] Correr `07-cutover/rls-tests.sql` (todos los asserts pasan).
- [ ] Deploy frontend con `.env.staging` apuntando al nuevo backend.
- [ ] QA end-to-end: signup, login, transacción completa, disputa, ticket soporte.

## T-1 día

- [ ] Confirmar ventana de mantenimiento con stakeholders.
- [ ] Preparar comunicado a usuarios (banner in-app + email).
- [ ] Revisar rollback plan (dejar Cloud en modo lectura, no borrar 30 días).

## T-0 — Corte (ventana ~30 min)

### 1. Congelar Cloud (T-0 +0min)
- [ ] En Lovable Cloud: `REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM authenticated;`
- [ ] Publicar banner "Mantenimiento en curso".

### 2. Delta incremental (T-0 +5min)
- [ ] Exportar filas modificadas después del dump inicial:
  ```bash
  for t in transactions audit_events notifications fiscal_documents ...; do
    PGPASSWORD=$SRC_PASSWORD psql -h $SRC_HOST -c \
      "COPY (SELECT * FROM public.$t WHERE updated_at > '<timestamp dump>') TO STDOUT WITH CSV HEADER" \
      > delta/$t.csv
  done
  ```
- [ ] Cargar deltas en destino:
  ```bash
  for t in transactions audit_events notifications fiscal_documents ...; do
    PGPASSWORD=$DST_PASSWORD psql -h $DST_HOST -c \
      "\\COPY public.$t FROM 'delta/$t.csv' WITH CSV HEADER"
  done
  ```
- [ ] Mirror final de buckets con `mc mirror --overwrite`.

### 3. Cambio de configuración (T-0 +15min)
- [ ] En Lovable → Settings → Environment: reemplazar todas las `VITE_SUPABASE_*` y `SUPABASE_*` con los valores del proyecto externo (usar `.env.template`).
- [ ] Copiar `migration/06-frontend-portable/*.ts` sobre `src/integrations/supabase/`.
- [ ] Regenerar `types.ts`: `supabase gen types typescript --project-id <ref-nuevo> > src/integrations/supabase/types.ts`.
- [ ] `bun remove @lovable.dev/cloud-auth-js`.
- [ ] Buscar y reemplazar `lovable.auth.signInWithOAuth('google'` → `supabase.auth.signInWithOAuth({ provider: 'google'`.
- [ ] Eliminar `src/integrations/lovable/index.ts` y `src/lib/lovable-error-reporting.ts`.
- [ ] Reemplazar en `src/lib/ai-gateway.server.ts` la URL de Lovable AI por endpoint Gemini directo.
- [ ] Reemplazar en `src/routes/api/public/hooks/support-sla.ts` el email endpoint por Resend.
- [ ] Actualizar `og:image` en `src/routes/__root.tsx`.
- [ ] Reemplazar URL preview en `src/lib/bank-verification.functions.ts` y `support-sla.ts` por `process.env.APP_URL`.
- [ ] `bun install && bun run build` — verificar compilación limpia.

### 4. Finalización SQL (T-0 +20min)
- [ ] Ejecutar `02-role-model-migration/15_finalize_role_rename.sql` en destino.
- [ ] Correr `07-cutover/verification-suite.sql` — confirmar 3 tipos oficiales.
- [ ] Actualizar webhooks en dashboards externos:
  - [ ] Stripe → nuevo URL
  - [ ] Verificamex → nuevo URL
- [ ] Recrear jobs en `pg_cron` del nuevo proyecto (ver `05-edge-functions/README.md`).

### 5. Descongelar y smoke test (T-0 +25min)
- [ ] Deploy del frontend actualizado.
- [ ] Smoke test end-to-end: login, dashboard, crear operación, subir CFDI, notificación.
- [ ] Revisar logs del hosting: no errores 401/403/500 durante 5 min.
- [ ] Quitar banner de mantenimiento; enviar comunicado "Migración completa".

## T+1 día

- [ ] Revisar `supabase--linter` y arreglar warnings.
- [ ] Confirmar métricas de uso normales; comparar volumen vs. día anterior.
- [ ] Mantener Cloud como cold-standby (sin escrituras).

## T+30 días

- [ ] Ejecutar borrado seguro del proyecto Cloud viejo (previa confirmación firmada del cliente).

## Rollback (si algo falla en T-0)

1. Restaurar variables de entorno originales del proyecto Cloud en Lovable.
2. `git revert` del commit del cutover (los archivos `src/integrations/supabase/*` vuelven al auto-gen).
3. `bun add @lovable.dev/cloud-auth-js` para reinstalar el SDK.
4. Ejecutar en Cloud: `GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;`
5. Comunicar "corte pospuesto" y planificar segunda ventana.

El proyecto externo con datos parciales queda en pausa; se re-usa en el siguiente intento con delta actualizado.
