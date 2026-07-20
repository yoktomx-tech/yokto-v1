
## Objetivo

Reutilizar en Persona Moral (PM) los tres mecanismos de precaptura fiscal que hoy sólo se muestran para Persona Física (PF) en `/onboarding` paso 3, con las reglas específicas que definiste.

## Cambios

### 1. Selector de modo (CSF / e.firma / Manual) también para PM
Mostrar los tres `FiscalModeButton` cuando `tipo === "persona_moral"`. El resto de la UI del paso se activa por `fillMode`, igual que en PF.

### 2. Modo **Manual (PM)**
- Único campo requerido inicial: **RFC (12 dígitos, PM)**.
- Al perder foco, llamar a `POST https://sat.nubarium.com/sat/v1/obtener-razonsocial` (Nubarium — Get Name from RFC) vía server function existente (`validateRfcNubarium`) que ya devuelve razón social.
- Autollenar y bloquear `legal_name` con la razón social devuelta.
- Habilitados para captura manual: **Fecha de constitución**, **Nombre comercial**, **Régimen fiscal** (select SAT).
- Banner amarillo: *"Los datos capturados manualmente serán revisados por el equipo de YOKTO antes de activar tu cuenta."*
- Sección **Representante legal**:
  - Empieza pidiendo **CURP** del representante.
  - Al validar, correr RENAPO/Nubarium (misma `validateCurpNubarium` de PF).
  - Mostrar el mismo recuadro colapsable (auto-cierre 5s) con nombre, apellidos, fecha, sexo, entidad.
  - Autollenar `rep_full_name` y `rep_rfc` (derivado si Nubarium lo devuelve; si no, editable).
  - Cargo (`rep_role`) sigue siendo captura manual.

### 3. Modo **Constancia de Situación Fiscal (PM)**
- Subir PDF/imagen → `parseCsf` (ya existe). Debe entregar: RFC, razón social, régimen fiscal (código + nombre), fecha constitución, nombre comercial (si aparece), domicilio completo.
- Autollenar y **bloquear** todos esos campos.
- **Concatenar** `razón social + " " + nombre del régimen` en el campo `legal_name` mostrado.
- Único bloque editable: **Representante legal** (CURP → validación → nombre; cargo manual).
- Mostrar recuadro colapsable con **todos los campos** devueltos por Nubarium/parser (auto-cierre 5s).

### 4. Modo **e.firma (PM)**
- Reutilizar el flujo actual de PF: subir `.cer` + `.key` + contraseña → `validateFielSerialNubarium` (validación de serial, vigencia SAT).
- Del certificado extraer: **RFC** de la persona moral y **CURP del representante legal** (subject).
- Con el RFC extraído, invocar `validateRfcNubarium` (obtener-razonsocial) y bloquear `legal_name` con el resultado.
- Con la CURP extraída del certificado, correr `validateCurpNubarium` y autollenar campos del representante (bloqueados + recuadro colapsable 5s).
- Campos aún requeridos por captura manual: **Fecha de constitución**, **Régimen fiscal**, **Nombre comercial**.
- Mismo banner amarillo de "los datos manuales serán revisados por YOKTO".
- Si la e.firma no está vigente, mantener el bloqueo actual.

### 5. Domicilio fiscal
- CSF: extraído y bloqueado (comportamiento actual).
- e.firma / Manual (PM): captura por CP con `lookupCP` (como hoy en PF).

### 6. Validación final del paso
Ajustar el `validate()` del step 3 para PM:
- Requiere `legal_name` (viene de Nubarium/CSF), `rfc`, `regimen_fiscal`, domicilio completo, y datos del representante (`rep_full_name`, `rep_rfc`, `rep_curp`, `rep_role`).
- Si `fillMode === "efirma"` y la e.firma es NO VIGENTE → bloquear.
- Si `fillMode === "manual"` y el RFC no fue verificado por Nubarium → bloquear.

## Notas técnicas

- Archivos afectados:
  - `src/routes/onboarding.tsx` → renderizado del paso 3 (rama PM).
  - `src/lib/onboarding.functions.ts` → asegurar que `validateRfcNubarium` acepte RFC de 12 (PM) y que `parseCsf` devuelva `regimen_nombre` + `nombre_comercial`; extender `parseEfirmaFiles` para retornar `rep_curp` extraída del subject del `.cer`.
- No se toca el paso 3 de PF (ya funciona con los tres modos).
- No se agregan nuevas tablas; los logs de validación siguen escribiéndose en `audit_log` como hoy.
- El `submitKyc` no cambia — sólo se persisten los campos ya definidos en el perfil.
