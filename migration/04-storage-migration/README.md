# Migración de Storage (buckets)

Los 6 buckets privados actuales:

| Bucket | Contenido | Sensibilidad |
|---|---|---|
| `kyc-documents` | INE/pasaporte anverso+reverso, comprobantes | ALTA (PII) |
| `dispute-evidence` | Evidencia de disputas | ALTA |
| `verification-evidence` | Nubarium/Verificamex responses | ALTA |
| `biometric-captures` | Selfies, videos de vida | ALTA (biométrico) |
| `transaction-documents` | Contratos firmados, CFDIs | ALTA |
| `support-attachments` | Adjuntos de tickets | MEDIA |

## Estrategia recomendada: `mc mirror` (MinIO client)

Supabase Storage expone S3 API. Usar `mc` para mirror directo bucket-a-bucket sin descargar a disco local.

### 1) Instalar mc

```bash
# macOS
brew install minio/stable/mc
# Linux
curl -O https://dl.min.io/client/mc/release/linux-amd64/mc && chmod +x mc
```

### 2) Configurar aliases (S3-compatible endpoint)

Cada proyecto Supabase expone `https://<ref>.supabase.co/storage/v1/s3` como endpoint. Requiere credenciales S3 generadas en Studio → Storage → S3 Access Keys (esto sólo lo puede hacer el propietario del proyecto).

```bash
mc alias set src https://<ref-cloud>.supabase.co/storage/v1/s3 \
  <SRC_S3_ACCESS_KEY> <SRC_S3_SECRET_KEY> --api S3v4 --path on
mc alias set dst https://<ref-nuevo>.supabase.co/storage/v1/s3 \
  <DST_S3_ACCESS_KEY> <DST_S3_SECRET_KEY> --api S3v4 --path on
```

### 3) Crear buckets vacíos en destino

Ejecutar `migration/01-schema/08_storage_buckets_and_policies.sql` **antes** del mirror — crea los buckets con `public=false` y las RLS de `storage.objects`.

### 4) Mirror

```bash
for b in kyc-documents dispute-evidence verification-evidence \
         biometric-captures transaction-documents support-attachments; do
  echo "→ Mirror $b"
  mc mirror --preserve --overwrite src/$b dst/$b
done
```

`--preserve` conserva metadatos (`content-type`, custom metadata) y timestamps.

### 5) Verificación

```bash
for b in kyc-documents dispute-evidence verification-evidence \
         biometric-captures transaction-documents support-attachments; do
  src_count=$(mc ls --recursive src/$b | wc -l)
  dst_count=$(mc ls --recursive dst/$b | wc -l)
  echo "$b: src=$src_count dst=$dst_count"
done
```

Los conteos deben coincidir exactamente. Cualquier divergencia se resuelve con:
```bash
mc mirror --overwrite --remove src/$b dst/$b
```

## Estrategia alternativa (sin credenciales S3): descarga y re-carga

Si el cliente NO puede habilitar S3 Access Keys, script Node.js que:
1. Lista objetos vía API REST de Storage.
2. Descarga a memoria (streaming).
3. Sube al destino vía API REST.

Ver `mirror-via-rest.ts` (a implementar bajo demanda si se elige esta ruta).

## Cambios de RUTA de los objetos

Los paths dentro de cada bucket se preservan íntegros. **No hay que reescribir referencias en la BD** (columnas `storage_path`, `document_url` en `kyc_documents`, `fiscal_documents`, etc.). Las URLs firmadas se regeneran on-demand con el nuevo cliente.

## Post-corte

- Los buckets del proyecto Cloud pasan a modo lectura durante 30 días de gracia.
- Después se ejecuta borrado seguro (bucket policy de deny + auditoría de accesos previa).
