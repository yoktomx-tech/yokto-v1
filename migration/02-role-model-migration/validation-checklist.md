# Validación del modelo oficial de roles

Confirmación explícita punto por punto del cliente.

## Enums oficiales (post-rename)

- `public.app_role` = `buyer, seller, admin` ✔ definido en `10_new_role_enums.sql` como `app_role_v2` y renombrado a `app_role` en `15_finalize_role_rename.sql`.
- `public.org_role` = `owner, admin, finance, operator, viewer, auditor` ✔ definido como `org_role_v2`.
- `public.internal_role` = `super_admin, compliance_officer, kyc_reviewer, document_reviewer, dispute_manager, finance_ops, support_agent` ✔ definido como `internal_role_v2`.

## Confirmaciones adicionales

| Regla | Implementación | Estado |
| --- | --- | --- |
| `buyer` se asigna por defecto en signup | `handle_new_user()` inserta `('buyer')` en `user_roles` | ✔ existente, preservado |
| `buyer` y `seller` pueden coexistir | `user_roles(user_id, role)` con `UNIQUE(user_id, role)` permite múltiples filas | ✔ |
| Múltiples `org_role` cuando corresponda | `memberships_v2` con PK `(org_id, user_id)` — un usuario tiene una fila por org, cada una con un rol; para múltiples orgs = múltiples filas | ✔ |
| Máximo un `internal_role` activo por usuario | `internal_role_assignments` con índice único `WHERE activo = true` | ✔ agregado en `11_new_role_tables.sql` |
| `app_role=admin` NO concede backoffice | Funciones `can_access_backoffice()` verifican `internal_role_assignments`, no `user_roles` | ✔ |
| `org_role=owner` NO concede backoffice | Idem | ✔ |
| `org_role=admin` NO concede backoffice | Idem | ✔ |
| Backoffice exige `internal_role_assignments` activo | `has_platform_role`/`get_active_internal_role` filtran `activo = true AND (expira_at IS NULL OR expira_at > now())` | ✔ |
| Backfill NO genera roles internos | `13_role_data_backfill.sql` sólo mapea `user_roles` y `memberships`; `internal_role_assignments` se puebla manualmente post-corte | ✔ |
| No quedan referencias legacy tras el rename | `15_finalize_role_rename.sql` renombra `_v2` → oficial; ninguna policy o función referencia `buyer_admin`, `ANALISTA_KYC`, etc. | Validar con grep tras el dry run |

## Grep obligatorio antes de autorizar corte

```bash
# Legacy app_role
grep -rn "'admin'\|'verifier'\|'mediator'" migration/ src/ | grep -v internal_role
# Legacy org_role
grep -rn "buyer_admin\|buyer_user\|seller_admin\|seller_user" migration/ src/
# Legacy internal_role
grep -rn "YOKTO_SUPER_ADMIN\|ANALISTA_KYC\|ANALISTA_DOCUMENTAL\|OFICIAL_CUMPLIMIENTO\|AGENTE_ESCROW\|AGENTE_SOPORTE\|ANALISTA_FINANCIERO" migration/ src/
```

Objetivo: 0 coincidencias en `src/` productivo tras el corte. Coincidencias residuales sólo en `migration/02-role-model-migration/13_role_data_backfill.sql` (mapa legacy → oficial) y comentarios de documentación.

## Compatibilidad frontend

- `useAuthUser` / `useViewRole` — validar que sólo consultan `buyer`, `seller`, `admin`.
- Backoffice (`_backoffice/*`) — validar que llama `has_platform_role` (nombre nuevo) o el helper equivalente.
- Ninguna vista renderiza por `app_role='admin'` para dar acceso a backoffice.

Pendiente para la Fase 1 (frontend cutover): sweep completo de referencias en `src/`.
