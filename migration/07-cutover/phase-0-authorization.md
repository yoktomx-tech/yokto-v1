# Fase 0 — Alcance autorizado y prohibiciones

Documento de gobierno. Cualquier acción sobre producción fuera de este alcance requiere autorización adicional por escrito del cliente.

## Autorizado (Fase 0)

- Crear proyecto Supabase externo (destino definitivo o staging previo).
- Habilitar extensiones (`pgcrypto`, `pg_net`, `pg_cron`).
- Aplicar `01-schema/*.sql` y `02-role-model-migration/10..14` en destino.
- Crear buckets y políticas de storage en destino.
- Configurar Auth (Site URL, Redirect URLs, proveedores, MFA, templates) en destino.
- Configurar variables de entorno y secretos en destino (Nubarium, Verificamex, Copomex, Stripe test, Bank hash, cron secret).
- Ejecutar `pg_dump` de Cloud (**operación de lectura**, no afecta producción).
- Restaurar dump en destino.
- Ejecutar mirror de Storage con `mc` (lectura en origen, escritura sólo en destino).
- Ejecutar `07-cutover/verification-suite.sql` y `rls-tests.sql` en destino.
- Ejecutar el dry run E2E de `07-cutover/dry-run-plan.md` en destino.
- Generar reportes de conciliación (tablas, auth, storage, roles).
- Preparar comunicado a usuarios (borrador, sin enviar).
- Auditar `06-frontend-portable/*` según su checklist.
- Producir el inventario final de funciones (`00-inventory/tss-server-functions-inventory.md`, `05-edge-functions/migration-plan.md`).

## NO autorizado en Fase 0

- Cambio de variables de entorno productivas en Lovable.
- Deploy productivo del frontend apuntando al externo.
- Cambio de URLs de webhooks productivos en Stripe / Verificamex / clientes B2B.
- `REVOKE` sobre tablas de Cloud (freeze operativo).
- Ejecución de `15_finalize_role_rename.sql` en Cloud actual.
- `DROP TABLE` de estructuras legacy en Cloud actual.
- Revocación de secretos anteriores.
- Desactivación de Lovable Cloud.
- Cualquier operación que modifique datos productivos en Cloud (INSERT/UPDATE/DELETE fuera del flujo normal de la aplicación).
- Cambio de correo de `no-reply` productivo.
- Rotación de JWT secret en producción.

## Condiciones para autorizar la Fase 1 (corte productivo)

Todos los siguientes entregables deben estar firmados:

1. Reporte de dry run completo con 100 % de escenarios en verde (`07-cutover/dry-run-report.md`).
2. Reporte de conciliación de tablas: `verification-suite.sql` `ok` en destino.
3. Reporte de conciliación de Auth: conteos src == dst para `auth.users`, `auth.identities`, `mfa_factors verified`; UUID preservados.
4. Reporte de conciliación de Storage: `missing_objects=0` y `hash_mismatches=0` en los 6 buckets.
5. Resultados de pruebas RLS: los 7 asserts base + los casos positivos/negativos por rol listados en `07-cutover/dry-run-plan.md`.
6. Inventario final de funciones: cada TSS server function tiene contraparte Edge Function desplegada en destino, o justificación técnica escrita para permanecer como servicio externo (`00-inventory/tss-server-functions-inventory.md`).
7. Confirmación explícita: **las TSS server functions no mantienen dependencia de Lovable Cloud** tras el corte (bearer del usuario apunta al externo, service_role del externo).
8. Rollback probado: ejecución simulada del procedimiento de rollback en staging documentada.
9. Checklist final de aprobación firmado por producto, ingeniería, cumplimiento y cliente (`07-cutover/final-approval-checklist.md`).

## Arquitectura objetivo (recordatorio)

```
Lovable
  └─ frontend TanStack + desarrollo visual + preview + deploys

GitHub
  └─ código, migraciones SQL, versionado, PRs, CI

Supabase externo (cuenta del cliente)
  ├─ Auth (email + Google + MFA)
  ├─ PostgreSQL (schema public + auth + storage + realtime)
  ├─ Storage (6 buckets privados)
  ├─ Edge Functions (backoffice, integraciones, webhooks, cron)
  ├─ RLS (274+ policies bajo el modelo oficial de roles)
  ├─ Realtime (tablas críticas publicadas)
  ├─ Webhooks entrantes (Stripe, Verificamex, API B2B)
  └─ Secretos backend (Nubarium, Verificamex, Copomex, Stripe, Gemini, Resend)
```

Post-corte, Lovable Cloud deja de operar como backend. Sólo el frontend continúa desarrollándose en Lovable.
