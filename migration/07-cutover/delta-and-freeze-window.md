# Estrategia de delta y ventana de corte

Documento operativo para la ventana T-0 (~30 min). Complementa `cutover-checklist.md`.

## Timeline

| Hito | Momento | Responsable |
| --- | --- | --- |
| Comunicado T-24 h a usuarios (email + banner) | T-24 h | Producto |
| Freeze code (main protegido) | T-2 h | Ingeniería |
| Última exportación completa `pg_dump` de Cloud | T-1 h | DBA |
| Restore completo en proyecto externo | T-1 h a T-30 min | DBA |
| Congelamiento operativo | T-0 | Ingeniería |
| Delta incremental + espejo storage | T-0 +5 min | DBA + SRE |
| Cambio de variables de entorno + deploy frontend | T-0 +15 min | Ingeniería |
| Actualización de webhooks en proveedores | T-0 +15 min | SRE |
| Finalización SQL (rename + verificación) | T-0 +20 min | DBA |
| Smoke test + reapertura | T-0 +25 min | QA |
| Reapertura pública | T-0 +30 min | Producto |

## Freeze — operaciones suspendidas durante el corte

Durante T-0 → T-0 +30 min bloquear las siguientes acciones a nivel base de datos (revocando privilegios) y a nivel UI (banner "Mantenimiento en curso"):

- Fondeos (`payment_intents INSERT`).
- Liberaciones de fondos.
- Reembolsos y payouts (`payouts INSERT/UPDATE`).
- Alta o modificación de disputas (`disputes INSERT/UPDATE`).
- Cambios de cuenta bancaria (`bank_accounts INSERT/UPDATE`).
- Cambios de roles (`user_roles`, `memberships`, `internal_role_assignments`).
- Cargas documentales críticas (KYC, contratos, CFDI): `kyc_documents`, `transaction_documents`, `fiscal_documents`.
- Aprobaciones de KYC/documental en backoffice.
- Escalamiento y cierre de tickets sensibles.

Aplicación técnica: en Cloud (origen) ejecutar

```sql
REVOKE INSERT, UPDATE, DELETE
ON public.payment_intents, public.payouts, public.disputes,
   public.bank_accounts, public.user_roles, public.memberships,
   public.internal_role_assignments, public.kyc_documents,
   public.transaction_documents, public.fiscal_documents,
   public.support_tickets
FROM authenticated;
```

Restablecer al final del corte:

```sql
GRANT INSERT, UPDATE, DELETE ON <mismas tablas> TO authenticated;
```

Operaciones de sólo lectura permanecen habilitadas para no interrumpir consultas.

## Delta incremental — mecanismo

### 1. Tablas con `updated_at`

Para cada tabla de alta rotación:

```bash
for t in transactions transaction_events transaction_hitos notifications \
         support_messages support_attachments dispute_messages fiscal_documents \
         audit_events; do
  PGPASSWORD=$SRC_PASSWORD psql -h $SRC_HOST -U postgres -c \
    "\COPY (SELECT * FROM public.$t WHERE updated_at > '$SNAPSHOT_TS') TO STDOUT WITH CSV HEADER" \
    > delta/$t.csv
done
```

Cargar en destino con `UPSERT` (para evitar duplicados si el registro ya existía):

```sql
CREATE TEMP TABLE tmp_delta (LIKE public.transactions INCLUDING ALL);
\COPY tmp_delta FROM 'delta/transactions.csv' CSV HEADER;
INSERT INTO public.transactions
SELECT * FROM tmp_delta
ON CONFLICT (id) DO UPDATE SET ... ; -- listar columnas != id
```

### 2. Tablas append-only sin `updated_at`

`stripe_webhook_events`, `internal_action_log`, `internal_access_log`, `audit_log`, `support_attachment_downloads`:

```bash
"\COPY (SELECT * FROM public.$t WHERE created_at > '$SNAPSHOT_TS') TO STDOUT WITH CSV HEADER"
```

Y `INSERT ... ON CONFLICT DO NOTHING`.

### 3. Orden de aplicación del delta

Respetar dependencias FK:

1. `auth.users` (si hubo signups durante el snapshot → delta a través de `auth.users` export incremental).
2. `profiles`, `user_roles`, `organizations`, `memberships`.
3. `transactions`, luego `transaction_hitos`, `transaction_events`, `transaction_documents`.
4. `payment_intents`, `payouts`.
5. `disputes`, luego `dispute_messages`, `dispute_evidence`.
6. `support_tickets`, `support_messages`, `support_attachments`.
7. `fiscal_documents`.
8. `notifications`, `audit_events`, logs internos.

### 4. Delta de storage

`mc mirror --overwrite --newer-than 2h` inmediatamente después del delta SQL. Volver a correr reconciliación (`04-storage-migration/README.md` §4).

### 5. Webhooks recibidos durante el corte

Aceptación posible por el proveedor entre "actualización de URL" y "confirmación de recepción". Manejo:

- **Stripe**: idempotente por `event_id`. Cloud viejo también los recibe → responder 200 pero descartar procesamiento (`REVOKE` bloquea escrituras). Al cambiar URL en Stripe dashboard, el nuevo endpoint recibe. Duplicados manejados por `stripe_webhook_events UNIQUE(event_id)`.
- **Verificamex**: mantener endpoint viejo respondiendo 302 → nuevo durante 48 h.
- **API B2B**: mismo tratamiento; documentar en `webhook-ack.md`.

### 6. Tratamiento de archivos cargados durante la transición

Ventana de bloqueo cubre `INSERT` en tablas KYC/documentos, por lo que no debería haber uploads nuevos. Cualquier upload que haya llegado al storage entre el snapshot y el bloqueo se captura con `mc mirror --newer-than`.

## Conciliación de pagos post-corte

Antes de reabrir:

```sql
-- Comparar montos comprometidos en origen y destino
SELECT status, count(*), sum(amount_cents)
FROM public.payment_intents GROUP BY 1 ORDER BY 1;
```

Ejecutar en origen (Cloud) y destino (externo) — los totales deben coincidir. Discrepancia > $0 = abortar apertura y reabrir investigación.

## Condiciones de rollback

Ejecutar rollback si:

- Cualquier verificación de `verification-suite.sql` falla.
- `rls-tests.sql` falla al menos 1 assert.
- Login de prueba con contraseña o Google falla.
- Reconciliación de pagos discrepa.
- Reconciliación de storage reporta `missing_objects > 0` en buckets críticos (KYC, documentos, evidencia).
- Cron jobs no confirman ejecución en la primera ventana.

Procedimiento de rollback:

1. `git revert` del commit de cutover.
2. `bun install && bun run build` para volver a `src/integrations/supabase/*` auto-generados.
3. Restaurar variables `VITE_SUPABASE_*` originales en Lovable.
4. `GRANT` de vuelta las operaciones bloqueadas en Cloud.
5. Restaurar URLs de webhooks a los endpoints Lovable.
6. Comunicar "corte pospuesto"; el proyecto externo queda en pausa con datos parciales para el segundo intento.

## Reapertura

- Retirar banner.
- Enviar comunicado "Migración completada" a usuarios.
- Publicar métricas de la ventana en `07-cutover/cutover-postmortem.md`.
- Iniciar monitoreo intensivo 72 h (Sentry, logs SSR, edge functions, cron).

## Fase T+30 días

- Cierre formal: eliminar Cloud viejo previa firma del cliente.
- `DROP TABLE` de estructuras legacy renombradas.
- Rotación de secretos en proveedores externos.
- Archivo de este documento como referencia histórica.
