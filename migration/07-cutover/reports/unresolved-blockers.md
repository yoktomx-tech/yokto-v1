# Unresolved Blockers — Fase 0

Blockers identificados durante la preparación de la Fase 0 (Opción B —
sin ejecución en staging). Se mantendrán y actualizarán tras el dry run.

## B-01 · `LOVABLE_API_KEY` en `ai-gateway.server.ts`

- **Categoría de origen:** función migration-matrix #24 (categoría C).
- **Descripción:** `src/lib/ai-gateway.server.ts` invoca
  `https://ai-gateway.lovable.dev` con `LOVABLE_API_KEY`. Es la única
  dependencia backend de Lovable Cloud identificada hasta ahora.
- **Impacto:** verificación documental con Gemini deja de funcionar si
  se desactiva Cloud sin migrar. Bloquea la afirmación "cero
  dependencia backend de Cloud".
- **Acción requerida:**
  1. Provisionar `GEMINI_API_KEY` en el Vault del Supabase staging.
  2. Reescribir el helper para llamar directamente a
     `https://generativelanguage.googleapis.com/v1beta/models/gemini-*:generateContent`.
  3. Retirar `LOVABLE_API_KEY` como secreto requerido.
- **Estado:** OPEN — acción se ejecuta durante el dry run en la rama
  `chore/staging-cutover-dryrun`.
- **Bloquea Fase 1:** SÍ hasta que se demuestre AI operando contra
  Gemini directo en staging.

## B-02 · Prerequisitos externos no provistos

- **Descripción:** el runbook `staging-runbook.md` requiere
  `TARGET_STAGING_PROJECT_REF`, credenciales sandbox de Nubarium,
  Verificamex, Copomex, Stripe test, SMTP staging, Google OAuth
  staging.
- **Impacto:** ningún reporte puede pasar a `PASS`; todos permanecen
  en `NOT TESTED`.
- **Acción requerida:** cliente crea proyecto staging + gestiona
  credenciales sandbox según `external-staging-prerequisites.md`.
- **Estado:** OPEN — a la espera del cliente.
- **Bloquea Fase 1:** SÍ.

## B-03 · Categoría A pendiente de sub-decisión A.1 vs A.2

- **Descripción:** 27 funciones marcadas como categoría A en
  `function-migration-matrix.md`. Falta decidir por función si se
  portan a Supabase Edge Function (A.1) o permanecen como TSS server
  function (A.2) apuntando al Supabase externo.
- **Impacto:** define alcance y tiempo de despliegue de Edge Functions
  durante el dry run.
- **Acción requerida:** revisar por función durante el dry run;
  registrar en `reports/edge-functions-inventory-final.md`.
- **Estado:** OPEN.
- **Bloquea Fase 1:** SÍ — cada A debe cerrar como A.1 (desplegada) o
  A.2 (justificada por no requerir service_role/secretos backend).

## B-04 · Frontend hosting durante Fase 1

- **Descripción:** el frontend seguirá desarrollándose en Lovable.
  Definir con el cliente si el hosting productivo también se mantiene
  en Lovable (donde corren las TSS server functions) o migra a Vercel /
  Cloudflare Pages / Netlify.
- **Impacto:** si hosting queda en Lovable, las TSS categoría A.2
  ejecutan en el runtime de Lovable pero consumen sólo el Supabase
  externo — cero Cloud como backend. Aceptable por la definición
  estricta. Si el cliente exige salir 100% de infraestructura Lovable,
  toda A.2 debe promoverse a A.1.
- **Acción requerida:** decisión explícita del cliente antes de Fase 1.
- **Estado:** OPEN.
- **Bloquea Fase 1:** condicional — sólo si el cliente exige salida
  total de Lovable.

## B-05 · Backfill de `auth.users`, `auth.identities`, MFA factors

- **Descripción:** el playbook `03-auth-migration/README.md` describe
  el export/import por SQL `COPY` preservando UUID y contraseñas
  cifradas. Requiere superusuario en destino (disponible en Supabase
  managed vía SQL Editor).
- **Impacto:** si el import falla, todos los UUID cambian y todas las
  FK a `auth.users(id)` quedan colgando.
- **Acción requerida:** validar en staging con snapshot pequeño de
  Cloud (10-20 usuarios) que UUIDs se preservan y login post-import
  funciona sin reset.
- **Estado:** OPEN — se prueba durante el dry run.
- **Bloquea Fase 1:** SÍ.

## B-06 · Reversibilidad del rename (Etapa D)

- **Descripción:** el rollback drill (`rollback-drill.sql`) revierte
  renames en staging. Debe demostrarse que un rollback ejecutado 5-30
  minutos después del rename final restaura tablas legacy sin pérdida
  de datos.
- **Impacto:** define la ventana de rollback real durante el corte.
- **Acción requerida:** ejecutar drill en staging tras aplicar
  `15_finalize_role_rename.sql`. Registrar tiempo y consistencia.
- **Estado:** OPEN — durante el dry run.
- **Bloquea Fase 1:** SÍ.

## B-07 · Idempotencia de webhooks bajo reintento

- **Descripción:** Stripe y Verificamex reenvían eventos con backoff.
  Debe probarse que reenvío del mismo `event_id` NO duplica escrituras
  ni genera doble payout/notificación.
- **Impacto:** riesgo de doble pago o doble alerta durante el corte,
  cuando ambos endpoints (viejo + nuevo) pueden estar activos por
  minutos.
- **Acción requerida:** Stripe CLI `--replay` + Verificamex sandbox
  duplicado en staging.
- **Estado:** OPEN.
- **Bloquea Fase 1:** SÍ.

## B-08 · Realtime bajo cuentas cruzadas

- **Descripción:** probar que un cliente conectado a `postgres_changes`
  para `dispute_messages`, `support_messages`, `notifications` sólo
  recibe eventos autorizados por RLS.
- **Impacto:** fuga de datos si RLS de SELECT no filtra realtime.
- **Acción requerida:** dos sesiones simultáneas en staging, una
  ajena a la disputa/ticket, verificando que no recibe eventos.
- **Estado:** OPEN.
- **Bloquea Fase 1:** SÍ.

## Blockers no bloqueantes de Fase 1 (registro)

- **B-N01 · `admin.functions.ts` legacy:** wrapper obsoleto (categoría
  D), eliminar durante la rama staging. No bloquea el corte.
- **B-N02 · `lovable-error-reporting.ts`:** telemetría a Lovable
  (categoría D), eliminar durante la rama staging. No bloquea el
  corte.
- **B-N03 · Archivos `supabase/config.toml`:** auto-generados por
  Lovable Cloud; verificar en staging que no contienen `project_id`
  productivo. Ajustar en la rama staging.
