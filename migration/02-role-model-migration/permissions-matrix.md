# Matriz de permisos — YOKTO modelo oficial

Fuente única de verdad para autorización. Los componentes del frontend ocultan/muestran UI, pero **la seguridad real vive aquí, en RLS y en `can_*` helpers**.

## Convenciones

- `A` = puede ejecutar la acción sin condiciones adicionales.
- `M` = puede ejecutar con MFA/reautenticación reciente (`aal2`) o motivo obligatorio.
- `O` = solo sobre recursos propios (owner del registro / participante en la transacción).
- `—` = no autorizado.

Las tres columnas de rol son **independientes y acumulables**: un usuario cumple si tiene el rol adecuado en cualquier nivel aplicable al recurso.

## App-level (rutas externas `/app/*`, `/transactions/*`, `/payments/*`)

| Recurso · Acción | buyer | seller | admin (legacy) | Nota |
|---|:---:|:---:|:---:|---|
| profile.read (propio) | A | A | A | siempre propio |
| profile.update (propio) | A | A | A | MFA para email/password |
| user_roles.read (propio) | A | A | A | |
| user_roles.assign | — | — | — | solo super_admin |

`admin` es legacy — se preserva por compat pero NO concede acceso al backoffice (que requiere `internal_role_assignments`).

## Org-level (dentro de una organización)

| Recurso · Acción | owner | admin | finance | operator | viewer | auditor |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| organization.read | A | A | A | A | A | A |
| organization.update | A | — | — | — | — | — |
| organization.delete | M | — | — | — | — | — |
| member.invite | A | A | — | — | — | — |
| member.assign_role | A | A(*) | — | — | — | — |
| member.remove | A | A(*) | — | — | — | — |
| transaction.create | A | A | — | A | — | — |
| transaction.read | A | A | A | A | A | A |
| transaction.update | A | A | — | A(O) | — | — |
| transaction.fund | A | A | A | A | — | — |
| transaction.approve_release | M | M | — | — | — | — |
| transaction.dispute | A | A | — | A(O) | — | — |
| evidence.upload | A | A | — | A | — | — |
| evidence.read | A | A | A | A | A | A |
| document.upload_fiscal | A | A | A | A | — | — |
| document.read | A | A | A | A | A | A |
| bank_account.read | A | A | A | — | — | A |
| bank_account.manage | M | — | M | — | — | — |
| payout.read | A | A | A | — | — | A |
| refund.request | M | M | M | — | — | — |
| ledger.read | A | A | A | A | A | A |
| report.export | A | A | A | — | — | A |
| api_key.manage | A | A | — | — | — | — |
| billing.manage | M | — | — | — | — | — |

(*) `admin` no puede promover a `owner` ni removerlo — validación de aplicación adicional.

## Backoffice (rutas `/backoffice/*`) — requiere `internal_role_assignments` activa

| Recurso · Acción | super_admin | compliance_officer | kyc_reviewer | document_reviewer | dispute_manager | finance_ops | support_agent |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| backoffice.access | A | A | A | A | A | A | A |
| kyc.read | A | A | A | — | — | — | — |
| kyc.review | A | A | A | — | — | — | — |
| kyc.final_approve | A | A | — | — | — | — | — |
| document.read | A | A | — | A | A | — | — |
| document.review | A | A | — | A | — | — | — |
| compliance.pld.read | A | A | — | — | — | — | — |
| compliance.pld.decide | A | A | — | — | — | — | — |
| dispute.read | A | A | — | A | A | A | A |
| dispute.act | A | — | — | — | A | — | — |
| dispute.resolve | M | — | — | — | M | — | — |
| finance.ledger.read | A | A | — | — | — | A | — |
| finance.reconcile | A | — | — | — | — | A | — |
| finance.payout.approve | M | — | — | — | — | M | — |
| finance.refund.approve | M | — | — | — | — | M | — |
| support.ticket.read | A | — | — | — | — | — | A |
| support.ticket.act | A | — | — | — | — | — | A |
| support.ticket.close_sensitive | M | — | — | — | — | — | M |
| user.impersonate | — | — | — | — | — | — | — |
| role.assign_internal | M | — | — | — | — | — | — |
| role.revoke_internal | M | — | — | — | — | — | — |
| platform.config | M | — | — | — | — | — | — |
| audit.read_all | A | A | — | — | — | A | — |
| audit.read_scoped | A | A | A | A | A | A | A |
| health.read | A | — | — | — | — | A | — |

**Regla dura**: NADIE puede realizar `user.impersonate`. Esta capacidad no existe en YOKTO — no se implementa nunca.

## Auditoría requerida

Toda acción marcada `M` en cualquier tabla anterior genera obligatoriamente un registro en `audit_events` con:
- `actor_user_id`, `target_user_id`, `organization_id`, `resource_type`, `resource_id`
- `action`, `before`, `after`, `reason` (texto libre requerido)
- `ip_address`, `user_agent`, `request_id`
- `mfa_verified_at` (timestamp del aal2 verificado)

## Cómo se aplica esta matriz

1. **Base de datos**: cada acción se traduce a una policy RLS + `can_*()` en `12_authz_functions.sql`.
2. **Server functions** (`src/lib/*.functions.ts`): al inicio del handler, llamar al `can_*()` correspondiente vía `context.supabase.rpc('can_...', {...})` y `throw` si `false`.
3. **UI**: hooks tipo `useCurrentOrg().can('transaction.create')` ocultan menús — sólo por UX, la seguridad está en 1+2.
4. **Backoffice**: gate `/backoffice/*` verifica `can_access_backoffice()`. Cada módulo interno además verifica el rol específico.

Cualquier acción no listada aquí es por defecto **denegada** — extiende la matriz explícitamente antes de implementar.
