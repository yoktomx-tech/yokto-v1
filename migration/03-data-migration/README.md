# Migración de datos: extracción y carga

Objetivo: mover todos los registros de las 51 tablas del proyecto Cloud actual al proyecto Supabase externo, preservando IDs (`uuid`), timestamps y relaciones.

## Prerrequisitos

- Proyecto externo creado.
- Scripts `migration/01-schema/*` ya aplicados (schema vacío listo).
- Scripts `migration/02-role-model-migration/10..12` aplicados (enums/tablas/funciones v2 creados).
- `pg_dump` local versión 15+.

## Variables

```bash
# Origen (Lovable Cloud actual — solicitar credenciales por canal seguro)
export SRC_HOST="aws-0-us-east-1.pooler.supabase.com"
export SRC_PORT=6543
export SRC_USER="postgres.diqdpygummlrajsugotv"
export SRC_DB="postgres"
export SRC_PASSWORD="<db password del proyecto Cloud>"

# Destino (proyecto Supabase externo del cliente)
export DST_HOST="db.<nuevo-ref>.supabase.co"
export DST_PORT=5432
export DST_USER="postgres"
export DST_DB="postgres"
export DST_PASSWORD="<db password nuevo>"
```

## 1) Dump de datos (solo `public`, sin schema)

```bash
PGPASSWORD="$SRC_PASSWORD" pg_dump \
  -h "$SRC_HOST" -p "$SRC_PORT" -U "$SRC_USER" -d "$SRC_DB" \
  --schema=public \
  --data-only \
  --no-owner \
  --no-privileges \
  --disable-triggers \
  --format=custom \
  --file=./yokto-data.dump
```

`--disable-triggers` evita que el trigger `on_auth_user_created` intente re-crear profiles al cargar `auth.users` (ver paso 3).

## 2) Dump de `auth.users` (necesario para preservar IDs y sesiones)

```bash
PGPASSWORD="$SRC_PASSWORD" pg_dump \
  -h "$SRC_HOST" -p "$SRC_PORT" -U "$SRC_USER" -d "$SRC_DB" \
  --table=auth.users \
  --data-only \
  --no-owner \
  --column-inserts \
  --file=./yokto-auth-users.sql
```

**Los usuarios se migran preservando `id`, `email`, `encrypted_password`, `email_confirmed_at`.** Al restaurarse, todas las contraseñas siguen siendo válidas y las sesiones actuales invalidan.

## 3) Cargar `auth.users` en destino

```bash
# En una transacción, deshabilitar triggers primero.
PGPASSWORD="$DST_PASSWORD" psql -h "$DST_HOST" -p "$DST_PORT" -U "$DST_USER" -d "$DST_DB" <<EOF
BEGIN;
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
\i yokto-auth-users.sql
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
COMMIT;
EOF
```

## 4) Cargar datos de `public`

```bash
PGPASSWORD="$DST_PASSWORD" pg_restore \
  -h "$DST_HOST" -p "$DST_PORT" -U "$DST_USER" -d "$DST_DB" \
  --data-only \
  --disable-triggers \
  --no-owner \
  --single-transaction \
  ./yokto-data.dump
```

Si falla por FK, revisar orden en `--use-list` o correr sin `--single-transaction` y resolver dependencias individuales.

## 5) Backfill del modelo de roles

```bash
PGPASSWORD="$DST_PASSWORD" psql -h "$DST_HOST" -p "$DST_PORT" -U "$DST_USER" -d "$DST_DB" \
  -f migration/02-role-model-migration/13_role_data_backfill.sql
```

## 6) Aplicar nueva RLS

```bash
PGPASSWORD="$DST_PASSWORD" psql -h "$DST_HOST" -p "$DST_PORT" -U "$DST_USER" -d "$DST_DB" \
  -f migration/02-role-model-migration/14_new_rls_policies.sql
```

## 7) Verificación de conteos

Ver `migration/07-cutover/verification-suite.sql`.

## Delta incremental (durante la ventana de corte)

Al momento del corte, para cada tabla con timestamp `updated_at`:

```sql
-- Ejecutar en origen, exportar CSV, insertar en destino.
COPY (
  SELECT * FROM public.<tabla>
  WHERE updated_at > '<timestamp del dump inicial>'
) TO STDOUT WITH CSV HEADER;
```

Tablas de append-only (`audit_events`, `notifications`, `transaction_events`) usar `created_at` en su lugar.

## Consideraciones especiales

- **`buckets` de storage**: los objetos NO viajan en el dump. Ver `04-storage-migration/`.
- **Secretos del Vault**: `vault.secrets` no se migra automáticamente; recrear en destino con `add_secret` o Vault directamente.
- **`extensions`**: `pgcrypto` y `pg_net` deben estar habilitadas antes del restore (ver `01-schema/00_extensions.sql`).
- **Sequences**: `pg_dump --data-only` incluye setval; verificar que `dispute_numero_seq`, `transaction_numero_seq`, `support_ticket_numero_seq` continúan con el valor correcto post-carga.
