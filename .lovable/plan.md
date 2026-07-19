# Ruta A — Entregables portables para migración a Supabase externo

## Objetivo
Producir en este repositorio Lovable **todo lo necesario** para que tú (o tu equipo DevOps) ejecutéis el corte contra un proyecto Supabase externo, sin apagar Lovable Cloud hasta que la validación final se haya hecho fuera de este entorno.

## Restricciones honestas de la plataforma
Estos archivos NO puedo modificarlos aquí — se auto‑regeneran por la integración de Cloud y sobrescribirán cualquier cambio (además romperían el build del preview actual):
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/client.server.ts`
- `src/integrations/supabase/auth-middleware.ts`
- `src/integrations/supabase/auth-attacher.ts`
- `src/integrations/supabase/types.ts`
- `.env` (VITE_SUPABASE_*)

**Solución:** entrego versiones *portables* de estos archivos bajo `migration/frontend-portable/` listas para copiarse encima cuando el proyecto salga de Lovable Cloud (Ruta A paso final). El proyecto Lovable actual sigue funcionando con Cloud hasta el corte.

También: no puedo exportar `SUPABASE_SERVICE_ROLE_KEY` ni la password de la BD del Cloud actual. El export de datos se hace por Cloud → Advanced settings → Export data (CSV) — es el único path self‑service. Documento el procedimiento.

## Estructura de entregables

```text
migration/
├── README.md                          Índice y orden de ejecución
├── 00-inventory/
│   ├── schema-inventory.md            Tablas, enums, funciones, triggers, índices, vistas
│   ├── storage-inventory.md           Buckets y políticas
│   ├── edge-functions-inventory.md    Funciones actuales y su reemplazo
│   ├── secrets-inventory.md           Nombres de secretos (sin valores)
│   └── lovable-cloud-dependencies.md  Referencias a eliminar en frontend
├── 01-schema/
│   ├── 00_extensions.sql
│   ├── 01_enums.sql                   Incluye modelo OFICIAL nuevo
│   ├── 02_tables.sql                  Dump del esquema actual
│   ├── 03_functions.sql
│   ├── 04_triggers.sql
│   ├── 05_indexes.sql
│   ├── 06_rls_policies.sql
│   ├── 07_grants.sql
│   └── 08_storage_buckets_and_policies.sql
├── 02-role-model-migration/
│   ├── 10_new_role_enums.sql          app_role, org_role, internal_role oficiales
│   ├── 11_new_role_tables.sql         user_roles, memberships, internal_role_assignments
│   ├── 12_authz_functions.sql         has_app_role, has_org_role, has_internal_role, can_*
│   ├── 13_role_data_backfill.sql      Mapeo de roles legacy → oficiales
│   ├── 14_new_rls_policies.sql        RLS reescritas con nuevas funciones
│   └── permissions-matrix.md          Matriz recurso × acción × rol
├── 03-data-migration/
│   ├── export-procedure.md            Cómo exportar de Cloud (CSV)
│   ├── import-order.md                Orden de import respetando FKs
│   ├── auth-users-migration.md        supabase.auth.admin.createUser preservando UUIDs
│   └── reconciliation-queries.sql     Conteos y checksums antes/después
├── 04-storage-migration/
│   └── storage-migration.md           Descargar/subir preservando rutas
├── 05-edge-functions/
│   ├── README.md                      Mapeo funciones actuales → estándar Deno
│   └── (subcarpetas por función)      Código adaptado
├── 06-frontend-portable/
│   ├── client.ts                      Cliente Supabase estándar
│   ├── auth-middleware.ts             Sin dependencias de Lovable
│   ├── .env.template                  Variables requeridas
│   └── refactor-notes.md              Qué imports/hooks cambian
├── 07-cutover/
│   ├── cutover-checklist.md           Orden estricto del corte
│   ├── validation-tests.md            Pruebas funcionales y de RLS
│   └── rollback-plan.md
└── supabase/                          Estructura Supabase CLI lista
    ├── config.toml
    ├── migrations/
    │   └── (mismos SQL numerados con timestamp)
    └── functions/
```

## Fases de ejecución (mías, aquí)

**Fase 1 — Inventario** (dump vía `psql` del Cloud actual)
- Extraigo esquema completo: tablas, columnas, tipos, FKs, defaults, checks
- Extraigo enums, funciones, triggers, índices, vistas, secuencias
- Extraigo políticas RLS y grants
- Extraigo buckets y policies de storage
- Listo Edge Functions actuales (`supabase/functions/*` en repo) y secretos por nombre

**Fase 2 — Esquema portable**
- Escribo `01-schema/*.sql` reproducible e idempotente
- Añado `GRANT` explícitos en cada tabla pública (regla plataforma)

**Fase 3 — Modelo oficial de roles**
- Creo enums nuevos: `app_role(buyer,seller,admin)`, `org_role(owner,admin,finance,operator,viewer,auditor)`, `internal_role(super_admin,compliance_officer,kyc_reviewer,document_reviewer,dispute_manager,finance_ops,support_agent)`
- Tablas: `user_roles`, `memberships`, `internal_role_assignments` con índice único parcial para "una asignación activa"
- Funciones de autorización con `search_path` explícito, `security definer`, sin recursión
- Trigger `handle_new_user` idempotente que asigna `buyer` por defecto
- Backfill: mapeo de roles legacy actuales (`buyer_admin`, `seller_user`, `YOKTO_SUPER_ADMIN`, etc.) → nuevos
- Matriz de permisos en Markdown (recurso × acción × app_role × org_role × internal_role)

**Fase 4 — RLS reescrita**
- Políticas reemitidas usando las nuevas funciones `has_*` / `can_*`
- Verificación: ninguna política abierta `USING (true)` excepto data pública documentada

**Fase 5 — Data migration**
- Procedimiento paso a paso: export CSV desde Cloud → import ordenado por dependencias → migración de `auth.users` preservando UUIDs con Admin API → validación
- Queries de conciliación (conteos, checksums, huérfanos)

**Fase 6 — Storage**
- Script/procedimiento para descargar objetos del bucket viejo (signed URLs) y subirlos al nuevo preservando ruta `org_id/tx_id/...`

**Fase 7 — Edge Functions**
- Copio cada función actual bajo `supabase/functions/` en formato Deno estándar
- Quito dependencias específicas de Lovable Cloud (helpers internos, imports de Cloud)

**Fase 8 — Frontend portable**
- Genero `client.ts` estándar (createClient + persistSession) bajo `migration/06-frontend-portable/`
- Genero middleware/attacher sin dependencias Lovable
- `.env.template` con `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Notas de refactor: qué hooks y funciones cambian (`lovable.auth.signInWithOAuth` → `supabase.auth.signInWithOAuth`, etc.)

**Fase 9 — Corte y validación**
- Checklist ordenado
- Suite de pruebas (auth, RLS, multi-tenant, storage, pagos, webhooks)
- Plan de rollback

## Lo que NO voy a hacer sin tu confirmación adicional

- **No** modifico `src/integrations/supabase/*.ts` ni `.env` del proyecto Lovable actual (rompería el preview y se regeneraría).
- **No** ejecuto migraciones ni inserts contra el Supabase externo — eso lo haces tú con `supabase db push` o `psql` contra tu proyecto.
- **No** apago Lovable Cloud. El corte lo activas tú una vez validado (Ruta A cierre).
- **No** creo cuentas ni proyectos Supabase — eso lo haces tú.

## Cuando estos entregables estén listos, tu trabajo será:

1. Crear proyecto Supabase externo en tu cuenta
2. `supabase link` + `supabase db push` de los SQL numerados
3. Configurar Auth (proveedores, Site URL, Redirect URLs) según `07-cutover/cutover-checklist.md`
4. Ejecutar procedimiento de datos + storage
5. Desplegar Edge Functions
6. Sacar el frontend de Lovable (GitHub export) y aplicar `06-frontend-portable/`
7. Ejecutar suite de validación
8. Deshabilitar Lovable Cloud en workspace settings

## Alcance realista de esta primera entrega

Dado el tamaño (44 tablas, ~13 funciones DB, ~7 buckets, ~5 rutas API públicas actuales, modelo de roles nuevo completo, matriz de permisos), estimo esto en **varios turnos**. En este primer batch voy a:

- Producir el inventario completo (Fase 1)
- Producir el esquema consolidado dumpeado (Fase 2)
- Producir el modelo oficial de roles + funciones authz + matriz (Fase 3)
- Producir el README maestro y estructura de carpetas

Fases 4–9 en turnos siguientes. Confírmame si el alcance del primer batch es correcto o si prefieres reordenar (p.ej. priorizar frontend-portable antes que RLS reescrita).