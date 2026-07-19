# Migración de Storage — playbook completo y conciliación

`mc mirror` es sólo el paso de copia de objetos. La migración completa cubre estructura, políticas, metadatos y verificación por bucket.

## Paso 1 — Crear buckets en destino (idéntica configuración)

Ejecutar `01-schema/08_storage_buckets_and_policies.sql`. Antes, cargar los valores reales desde origen:

```sql
-- Origen
SELECT format(
  'INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
   VALUES (%L, %L, %L, %s, %L);',
  id, name, public, file_size_limit, allowed_mime_types
) FROM storage.buckets ORDER BY id;
```

Copiar el resultado a `04-storage-migration/buckets.sql` y aplicarlo en destino con el usuario Postgres del proyecto (Studio → SQL Editor).

Verificar:

```sql
SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY id;
```

Debe coincidir línea por línea con el origen.

## Paso 2 — Políticas RLS de storage

`storage.objects` y `storage.buckets` tienen RLS con policies definidas en `01-schema/08_storage_buckets_and_policies.sql`. Confirmar:

```sql
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies WHERE schemaname='storage' ORDER BY tablename, policyname;
```

Todas las policies del origen deben existir en destino (mismo nombre y `cmd`).

## Paso 3 — Copia de objetos

### 3.1 Configurar clientes `mc` (MinIO Client)

En Supabase Studio → Storage → S3 Access Keys de ambos proyectos generar par de claves. Luego:

```bash
mc alias set src  https://<ref-src>.storage.supabase.co  <src-access>  <src-secret>
mc alias set dst  https://<ref-dst>.storage.supabase.co  <dst-access>  <dst-secret>
```

### 3.2 Espejo por bucket (respeta rutas, propietarios, metadatos)

```bash
for b in biometric-captures dispute-evidence kyc-documents \
         support-attachments transaction-documents verification-evidence; do
  echo "==== $b ===="
  mc mirror --overwrite --preserve --checksum \
    "src/$b" "dst/$b" | tee "logs/$b.log"
done
```

`--preserve` mantiene metadata custom; `--checksum` valida SHA por objeto.

### 3.3 Delta durante ventana de corte

Repetir `mc mirror --overwrite --newer-than 1h` inmediatamente después del congelamiento para capturar uploads recientes.

## Paso 4 — Reconciliación por bucket

Ejecutar en ambos proyectos y comparar:

```sql
-- Ejecutar en origen y en destino
SELECT bucket_id,
       count(*)                                        AS object_count,
       COALESCE(sum((metadata->>'size')::bigint), 0)   AS total_bytes,
       count(*) FILTER (WHERE owner IS NULL)           AS anon_owned,
       count(DISTINCT owner)                           AS distinct_owners
FROM storage.objects
GROUP BY bucket_id
ORDER BY bucket_id;
```

### Plantilla de reporte `04-storage-migration/reconciliation-report.md`

Sustituir los `?` por los valores reales del dry run:

| bucket | src_object_count | dst_object_count | src_total_bytes | dst_total_bytes | missing_objects | hash_mismatches |
| --- | --- | --- | --- | --- | --- | --- |
| biometric-captures | ? | ? | ? | ? | ? | ? |
| dispute-evidence | ? | ? | ? | ? | ? | ? |
| kyc-documents | ? | ? | ? | ? | ? | ? |
| support-attachments | ? | ? | ? | ? | ? | ? |
| transaction-documents | ? | ? | ? | ? | ? | ? |
| verification-evidence | ? | ? | ? | ? | ? | ? |

Criterio de aceptación: `missing_objects = 0` y `hash_mismatches = 0` para los seis buckets.

### 4.1 Detección de faltantes

```bash
for b in biometric-captures dispute-evidence kyc-documents \
         support-attachments transaction-documents verification-evidence; do
  diff <(mc ls -r --json "src/$b" | jq -r '.key' | sort) \
       <(mc ls -r --json "dst/$b" | jq -r '.key' | sort) \
       > "diff/$b.diff"
done
```

Cualquier línea `< key` es un faltante en destino. Reintentar `mc mirror --overwrite` sólo para ese prefijo.

### 4.2 Detección de hash mismatches

`mc diff src/$b dst/$b` reporta objetos con etag distinto. Reintentar copia individual.

### 4.3 Objetos duplicados

Improbable (nombres son UUID), pero verificar:

```sql
SELECT bucket_id, name, count(*)
FROM storage.objects
GROUP BY 1,2 HAVING count(*) > 1;
```

Debe devolver 0 filas en ambos lados.

## Paso 5 — Propietarios y metadatos

`mc mirror` NO copia el campo `owner` (uuid del usuario). Después del mirror, ejecutar en destino:

```sql
-- Restaurar owner desde export CSV del origen
UPDATE storage.objects o
SET owner = src.owner,
    owner_id = src.owner_id,
    metadata = src.metadata
FROM (SELECT bucket_id, name, owner, owner_id, metadata FROM ...) src
WHERE o.bucket_id = src.bucket_id AND o.name = src.name;
```

CSV de referencia: exportar previamente en origen:

```sql
\COPY (SELECT bucket_id, name, owner, owner_id, metadata FROM storage.objects)
      TO 'storage_metadata.csv' CSV HEADER;
```

Verificar que ninguna fila queda con `owner IS NULL` cuando el original sí lo tenía.

## Paso 6 — Signed URLs y referencias antiguas

- Los signed URLs contienen firma con el JWT secret del proyecto de origen y **dejan de funcionar** apuntando al nuevo host.
- En la aplicación, todas las URLs firmadas se generan on-demand (`supabase.storage.from(bucket).createSignedUrl()`) — no hay URLs firmadas persistidas en `public.*` (verificado en tablas `kyc_documents`, `transaction_documents`, `support_attachments`: guardan `path`, no URL).
- Después del corte, cualquier link recién generado apunta al nuevo host automáticamente.

## Paso 7 — Actualización de referencias en `public.*`

No aplica: las columnas de tipo `path` almacenan la ruta relativa (`bucket/uuid/nombre`) y el frontend construye URLs contra `SUPABASE_URL`. Al cambiar `VITE_SUPABASE_URL` todas las referencias se resuelven contra el nuevo proyecto.

## Paso 8 — CORS de Storage

En destino, Settings → Storage → Configuration → CORS: replicar los orígenes permitidos del origen.

## Criterio de aceptación de Storage

- [ ] 6 buckets creados con mismos límites y MIME types.
- [ ] Todas las policies de `storage.objects` y `storage.buckets` presentes.
- [ ] Reconciliación: `missing_objects=0` y `hash_mismatches=0` por bucket.
- [ ] `owner`/`owner_id`/`metadata` restaurados.
- [ ] Sin duplicados.
- [ ] Descarga de al menos 1 archivo por bucket con usuario real vía signed URL en destino.
- [ ] CORS aplicado.
