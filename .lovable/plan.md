
## Alcance

Aplicar el complemento "Formatos, extensiones y validación de archivos" sobre el módulo de Subtipos de Operación e Hitos, según los 3 archivos adjuntos.

Nota importante: las tablas base del módulo (`subtipos_operacion`, `documentos_catalogo`, `hito_templates`, `hito_template_documentos`, `hito_template_condiciones`, `hito_template_informacion`) **no existen aún** en la BD. Sólo existe `transaction_hitos`. Debo crear tanto la Fase 1 (seed base) como la Fase 2 (perfiles de archivo).

## 1. Base de datos (migraciones)

**Fase 1 — Catálogo base**
- `sectores_operacion` (6 sectores incluidos, excluir COMERCIO_EXTERIOR)
- `subtipos_operacion` (default `is_default=true`, `is_editable=false`)
- `documentos_catalogo` (documentos maestros)
- `hito_templates`, `hito_template_documentos`, `hito_template_condiciones`, `hito_template_informacion`
- Seed desde `yokto_seed_subtipos_hitos_sin_comercio_exterior_1-2.json`

**Fase 2 — Perfiles de archivo**
- `document_file_profiles` (10 perfiles del complemento)
- Columnas de override en `documentos_catalogo` (file_profile_code, allowed_extensions_override, etc.)
- Columnas de override en `hito_template_documentos`
- Snapshot `transaction_milestone_document_requirements` (referencia `transaction_hitos`)
- Seed desde `yokto_document_file_profiles_patch-2.json` (asignaciones automáticas por código)

Todas con `GRANT` explícito + RLS: `SELECT` a `authenticated` para catálogos read-only; `INSERT/UPDATE` sólo a admins/backoffice. Snapshot con RLS por membresía de la transacción.

## 2. Función de resolución + tipos

Nuevo módulo `src/lib/document-file-rules.ts`:
- Tipo `ResolvedFileRule`
- `resolveFileRule(requirement, catalogDoc, profile)` con la cascada override → catálogo → perfil
- Helpers: `getExtension()`, `formatAllowedList()`, `formatMaxSize()`

## 3. Snapshot al crear transacción

Extender `src/lib/transactions.functions.ts`:
- Al crear operación desde plantilla (`createTransactionFromTemplate`), copiar reglas a `transaction_milestone_document_requirements` por cada hito+documento.
- Nueva `getMilestoneDocumentRequirements(transactionId)` para el wizard/expediente.

## 4. Backend de subida (validación obligatoria)

Extender `src/lib/tx-documents.functions.ts`:
- Antes de guardar: validar `extension`, `mime`, `size` contra el snapshot del hito.
- Calcular SHA-256, marcar `requires_virus_scan=true` en cola.
- Rechazar extensiones peligrosas: `exe, bat, cmd, sh, js, msi, dmg, jar`.
- Registrar en `audit_log` cada resultado.
- Dispatcher `validation_engine` → placeholder por motor (SAT_XML, IA_OCR, IMAGE_GPS_IA, GPS_TRACKING, TABLE_EXTRACTOR, VIDEO_REVIEW_IA, HASH_AND_VIRUS_SCAN, URL_HASH_REVIEW). En esta iteración: hash + antivirus + extensión activos; los motores externos quedan como stubs con log.

## 5. UI Wizard `/transactions/new` — paso Hitos y cumplimiento

En el paso unificado:
- Cada requisito muestra bajo el nombre: extensiones permitidas, tamaño máx, min/max archivos, badges (Geolocalización, Firma, SAT) — leyendo `ResolvedFileRule`.
- Dropzone dinámico según `capture_mode`: `UPLOAD`, `CAMERA_OR_UPLOAD`, `GPS_OR_UPLOAD`, `URL_OR_UPLOAD`.
- Errores claros de extensión/MIME/tamaño desde la API.
- Componentes nuevos: `<DocRequirementCard>`, `<FileRuleBadges>`, `<SmartDropzone>`.

## 6. Editor de Subtipos (Configuración)

Nueva ruta `_authenticated/settings.subtipos.tsx` y `settings.subtipos.$id.tsx`:
- Listado por sector, marcando defaults con candado.
- Duplicar subtipo default → crea custom editable.
- En custom: editar hitos, documentos requeridos, condiciones. Documento default bloqueado con leyenda "🔒 Documento default YOKTO". Documento custom permite editar formato/extensiones/tamaño/motor.
- Bloquear siempre extensiones peligrosas.

## 7. Auditoría y logs

- Todas las validaciones de subida → `audit_events` con `event_type='document.upload_validation'`.
- Motores externos → `onboarding_api_logs` reutilizado o nueva `document_validation_logs` (según encaje; usar `audit_events` por simplicidad).

## Detalles técnicos

```text
Migraciones (orden):
  001_catalogo_subtipos_base.sql
  002_seed_catalogo_subtipos.sql
  003_document_file_profiles.sql
  004_seed_file_profiles_and_assignments.sql
  005_snapshot_milestone_requirements.sql

Nuevos módulos:
  src/lib/document-file-rules.ts        // resolveFileRule + tipos
  src/lib/subtipos.functions.ts         // CRUD catálogo + duplicar
  src/lib/document-validation.server.ts // motores (stubs + hash + antivirus)

Cambios:
  src/lib/tx-documents.functions.ts     // validación obligatoria pre-upload
  src/lib/transactions.functions.ts     // snapshot al crear operación
  src/routes/_authenticated/transactions.new.tsx  // UI reglas por documento
  src/routes/_authenticated/settings.subtipos.tsx // nuevo
  src/routes/_authenticated/settings.subtipos.$id.tsx // nuevo
```

## Qué NO incluye esta iteración

- Integración real con antivirus externo (stub que marca `virus_scan_status='pending'`).
- Motores IA_OCR / VIDEO_REVIEW_IA / IMAGE_GPS_IA con proveedor externo (stubs con audit log; se puede conectar Gemini/Nubarium después).
- Comercio Exterior (excluido explícitamente en el seed).

## Riesgos

- Volumen del seed (~13,880 líneas JSON). Debe ejecutarse como migración `INSERT` masiva; usar `COPY` desde JSON parseado en un script SQL o particionar la migración en varios archivos por sector.
- Cambios en `transactions` (snapshot) requieren migración de datos existentes: se aplicará sólo a operaciones nuevas; las existentes quedan sin snapshot (grace).

¿Apruebas para implementar tal cual, o quieres ajustes (por ejemplo omitir el editor de subtipos ahora, o dejar los motores IA para una fase posterior)?
