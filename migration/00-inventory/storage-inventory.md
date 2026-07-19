# Inventario de Storage

## Buckets
| ID | Nombre | Público |
|---|---|---|
| `biometric-captures` | biometric-captures | f |
| `dispute-evidence` | dispute-evidence | f |
| `kyc-documents` | kyc-documents | f |
| `support-attachments` | support-attachments | f |
| `transaction-documents` | transaction-documents | f |
| `verification-evidence` | verification-evidence | f |

Todos privados por diseño (contienen documentos KYC/KYB, evidencias, biometría, contratos, fiscales). En el Supabase externo:
- Crear con las MISMAS ids (script en `01-schema/08_storage_buckets_and_policies.sql`).
- Políticas RLS ya incluidas en el dump de `06_rls_policies.sql` (schema `storage`).
- Migración de objetos: ver `04-storage-migration/storage-migration.md`.
