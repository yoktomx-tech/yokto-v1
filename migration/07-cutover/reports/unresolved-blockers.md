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
- **Bloquea Fase 1:** SÍ hasta demostrar AI operando contra Gemini directo en staging.

## B-02 · Prerequisitos externos no provistos

- **Descripción:** el runbook `staging-runbook.md` requiere
  `TARGET_STAGING_PROJECT_REF`, credenciales sandbox de Nubarium,
  Verificamex, Copomex, Stripe test, SMTP staging, Google OAuth staging.
- **Impacto:** ningún reporte puede pasar a `PASS`; todos permanecen en `NOT TESTED`.
- **Acción requerida:** cliente crea proyecto staging + credenciales sandbox
  según `external-staging-prerequisites.md`.
- **Estado:** OPEN — a la espera del cliente.
- **Bloquea Fase 1:** SÍ.

## B-03 · Sub-decisión A.1 vs A.2 por función

- **Descripción:** 27 funciones categoría A. Falta decidir por función si se
  portan a Supabase Edge Function (A.1) o permanecen como TSS server function (A.2)
  apuntando al Supabase externo.
- **Acción requerida:** registrar decisión por función en
  `reports/edge-functions-inventory-final.md` durante el dry run.
- **Estado:** OPEN.
- **Bloquea Fase 1:** SÍ — cada A debe cerrar como A.1 (desplegada) o A.2 (justificada).

## B-04 · Hosting frontend durante Fase 1

- **Descripción:** el frontend sigue desarrollándose en Lovable. Definir si el
  hosting productivo se mantiene en Lovable/Cloudflare o migra a Vercel/otro.
- **Impacto:** si el cliente exige salida total de infraestructura Lovable,
  toda A.2 debe promoverse a A.1.
- **Estado:** OPEN — decisión del cliente.
- **Bloquea Fase 1:** condicional.

## B-05 · Backfill de `auth.users` con UUID preservados

- **Descripción:** import por SQL `COPY` de `auth.users`, `auth.identities`,
  `mfa_factors` preservando UUID y contraseñas cifradas.
- **Impacto:** si falla, todas las FK a `auth.users(id)` quedan colgando.
- **Acción requerida:** validar en staging con snapshot pequeño (10-20 usuarios).
- **Estado:** OPEN.
- **Bloquea Fase 1:** SÍ.

## B-06 · Reversibilidad del rename (Etapa D)

- **Descripción:** `rollback-drill.sql` debe demostrar que un rollback ejecutado
  minutos después del rename final restaura tablas legacy sin pérdida de datos.
- **Estado:** OPEN.
- **Bloquea Fase 1:** SÍ.

## B-07 · Idempotencia de webhooks bajo reintento

- **Descripción:** Stripe y Verificamex reenvían con backoff. Probar que el
  mismo `event_id` no duplica escrituras.
- **Acción requerida:** Stripe CLI `--replay` + duplicado Verificamex sandbox en staging.
- **Estado:** OPEN.
- **Bloquea Fase 1:** SÍ.

## B-08 · Realtime bajo cuentas cruzadas

- **Descripción:** probar que RLS filtra correctamente eventos `postgres_changes`
  para `dispute_messages`, `support_messages`, `notifications`.
- **Acción requerida:** dos sesiones simultáneas en staging.
- **Estado:** OPEN.
- **Bloquea Fase 1:** SÍ.

## No bloqueantes (registro)

- **B-N01** `admin.functions.ts` legacy — wrapper obsoleto (D), eliminar en la rama staging.
- **B-N02** `lovable-error-reporting.ts` — telemetría Lovable (D), eliminar en la rama staging.
- **B-N03** `supabase/config.toml` — verificar que no contiene `project_id` productivo
  en la rama staging.
