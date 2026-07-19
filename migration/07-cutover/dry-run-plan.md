# Dry run completo — Fase 0

Ejecutar sobre un proyecto Supabase **de staging** (no productivo, no Cloud), independiente del externo definitivo. Duplicar la aplicación de datos, roles y storage al 100 %.

## Preparación

1. Crear proyecto Supabase staging (`yokto-staging`), plan mínimo que soporte `pg_cron`.
2. Aplicar `01-schema/*.sql`.
3. Aplicar `02-role-model-migration/10..13` (crea v2 + backfill).
4. Crear buckets con `01-schema/08_storage_buckets_and_policies.sql`.
5. Configurar Auth según `03-auth-migration/README.md` §2.
6. Importar snapshot de `auth.users` y `public.*` con datos anonimizados o de sandbox.
7. Configurar 3 usuarios de prueba por rol externo + 1 por cada rol interno.
8. Configurar Stripe en modo `test` y llaves de sandbox Nubarium/Verificamex.

## Escenarios (todos deben pasar en verde)

### Esquema y funciones

- [ ] Las 51 tablas presentes con conteo esperado.
- [ ] Las 17 funciones `has_*` / `can_*` responden lo esperado en pruebas SQL directas.
- [ ] `07-cutover/verification-suite.sql` → todo `ok`.
- [ ] `07-cutover/rls-tests.sql` → 7/7 asserts + los adicionales listados abajo.

### Auth

- [ ] Registro de usuario nuevo (email/password) → recibe confirmación → confirma → login OK.
- [ ] Signup automáticamente asigna `buyer` en `user_roles`, crea `organizations` (tipo `individual`) y `memberships` con `owner`.
- [ ] Login con Google OAuth OK, enlaza al mismo UUID si el correo ya existía.
- [ ] Recuperación de contraseña OK (recibe correo, cambia, login OK).
- [ ] MFA TOTP: enroll, verify, cerrar y reabrir sesión → exige código.
- [ ] Usuarios importados con contraseña previa loguean sin reset.
- [ ] Usuarios `banned_until > now()` reciben rechazo.
- [ ] Rate limits vigentes (probar 31 intentos en 5 min desde una IP).

### Autorización — casos positivos y negativos

Para cada rol probar acceso permitido (positivo) y rechazo esperado (negativo):

| Actor | Acción | Resultado esperado |
| --- | --- | --- |
| `buyer` | Ver sus transacciones | ✔ |
| `buyer` | Ver transacciones de otro comprador | ✖ 401/vacío |
| `buyer` | Aprobar liberación de fondos como comprador | ✔ |
| `seller` | Ver dashboard vendedor | ✔ |
| `seller` | Modificar cuenta bancaria de otro seller | ✖ |
| `owner` | Invitar miembro a su org | ✔ |
| `owner` | Cambiar `org_role` a `admin` de otro miembro | ✔ |
| `admin` (org) | Gestionar operaciones de la org | ✔ |
| `admin` (org) | Acceder al backoffice interno | ✖ 403 |
| `finance` | Ver ledger de su org | ✔ |
| `finance` | Ver ledger de otra org | ✖ |
| `operator` | Crear operación en su org | ✔ |
| `viewer` | Modificar operación | ✖ |
| `auditor` | Descargar reporte auditoría | ✔ |
| `super_admin` (interno) | Acceso a `_backoffice/*` | ✔ |
| `kyc_reviewer` | Aprobar KYC pendiente | ✔ |
| `kyc_reviewer` | Cerrar ticket sin `aal2` | ✖ |
| `document_reviewer` | Firmar contrato | ✖ |
| `dispute_manager` | Asignar disputa | ✔ |
| `finance_ops` | Emitir payout | ✔ |
| `support_agent` | Cerrar ticket escalado sin MFA | ✖ |
| `app_role=admin` sin internal role | Acceder al backoffice | ✖ 403 |
| Usuario externo | Consulta directa a `internal_action_log` vía API | ✖ 403 |

### Organizaciones y memberships

- [ ] Alta de organización tipo `business` (Persona Moral).
- [ ] Invitación por email genera `invitations` con `token` único.
- [ ] Aceptación de invitación crea `memberships` correctamente.
- [ ] Invitee no puede modificar `org_id`, `org_role`, `email`, `token` (correr `tests/rls/invitations.test.sql`).

### Storage

- [ ] Upload de PDF a `kyc-documents` como usuario dueño ✔.
- [ ] Upload a `kyc-documents` con path de otro usuario ✖.
- [ ] Descarga vía signed URL válida durante 60 s.
- [ ] Signed URL de otro usuario devuelve 403 en RLS.
- [ ] MIME type no permitido rechazado (ej. `.exe` en `kyc-documents`).
- [ ] Tamaño > límite rechazado.
- [ ] Reconciliación por bucket coincide con reporte.

### Edge Functions / TSS migradas

- [ ] Cada función lista en `05-edge-functions/migration-plan.md` responde 200 en su happy path.
- [ ] Cada función rechaza sin bearer válido.
- [ ] Idempotencia probada (misma llave → mismo resultado, sin duplicar).

### Webhooks

- [ ] Enviar evento Stripe test (`payment_intent.succeeded`) → escribe en `stripe_webhook_events` sin duplicar.
- [ ] Verificamex sandbox callback → actualiza `bank_account_penny_tests`.
- [ ] Cron `dispute-deadlines` corre cada 15 min y actualiza fechas.
- [ ] Cron `support-sla` corre cada 5 min y envía correo de prueba.

### Auditoría

- [ ] Toda acción de backoffice genera fila en `internal_action_log` con snapshot antes/después.
- [ ] Descarga de adjunto de soporte registrada en `support_attachment_downloads`.
- [ ] Exportación PDF de auditoría descarga completa.

### Realtime

- [ ] Cambios en `disputes` llegan al cliente autorizado en tiempo real.
- [ ] Cambios en `dispute_messages` NO llegan a usuario ajeno a la disputa.
- [ ] Cambios en `support_messages` NO llegan a agente sin ticket asignado.
- [ ] Cambios en `notifications` llegan sólo al destinatario.

### Pagos (modo test)

- [ ] Fondeo SPEI (mock provider) genera CLABE ficticia y `payment_intents.status=requires_payment`.
- [ ] Fondeo Stripe test genera hosted URL, `succeeded` tras pago simulado.
- [ ] Liberación al seller crea `payouts` y actualiza ledger.
- [ ] Reembolso simulado revierte estado.
- [ ] Onboarding Stripe Connect sandbox completa `chargesEnabled`.

## Salida esperada

Reporte `07-cutover/dry-run-report.md` con:

- fecha/hora de ejecución;
- versión de commit del código y de los scripts SQL;
- tabla resumen con estado por escenario (OK / FAIL / BLOCKED);
- métricas de conciliación (Auth, Storage, roles);
- issues encontrados con owner y ETA de corrección.

Sin dry run reporte 100 % verde **NO** se autoriza el corte productivo.
