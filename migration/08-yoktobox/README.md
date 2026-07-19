# migration/08-yoktobox/

Entregables finales para que un **operador externo** ejecute la migración
definitiva desde una estación DevOps hacia el Supabase externo `yoktobox`.

## Estado

```
CURRENT LOVABLE PROJECT: ARTIFACT GENERATOR ONLY
OLD BACKEND: diqdpygummlrajsugotv — DO NOT TOUCH
TARGET BACKEND: yoktobox
EXECUTION: EXTERNAL OPERATOR REQUIRED
PRODUCTION CUTOVER: NOT YET EXECUTED
```

Lovable **no ejecuta** ninguno de estos scripts, ni recibe credenciales de
`yoktobox`. Todo el trabajo real lo hace el operador desde su estación.

## Archivos

| Archivo | Propósito |
|---|---|
| `runbook-yoktobox.md` | Runbook maestro paso a paso (secciones 0-15). |
| `apply-yoktobox.sh`   | Script Bash (macOS/Linux) idempotente con guards. |
| `apply-yoktobox.ps1`  | Script PowerShell 7+ (Windows) idempotente con guards. |

## Guards obligatorios (implementados en ambos scripts)

- Aborta si `SUPABASE_PROJECT_REF == "diqdpygummlrajsugotv"`.
- Aborta si `CONFIRM_TARGET != "yoktobox"`.
- Aborta si `SUPABASE_DB_URL` contiene el ref prohibido.
- Aborta si falta cualquier variable requerida.
- Pide confirmación explícita del operador (`YES`) antes de aplicar.

## Cómo empezar

1. Leer completo `runbook-yoktobox.md`.
2. Cumplir prerrequisitos (Supabase CLI, Deno, psql, credenciales).
3. Exportar variables y ejecutar el script correspondiente a tu OS.
4. Completar los pasos manuales del Dashboard (sección 8 del runbook).
5. Completar reportes en `migration/07-cutover/reports/` con resultados reales.

## Blockers y datos no automigrables

Ver secciones 10 y 11 del runbook. Resumen:

- `auth.users` con contraseñas: no migrable desde este runbook.
- Archivos en Storage: requieren script del operador (`supabase storage cp` / rclone).
- Datos operativos: `pg_dump/pg_restore` bajo autorización expresa y ventana de freeze.
- B-02, B-05, B-06, B-07, B-08 siguen OPEN — resolverlos antes o durante Fase 1.
- B-04 (hosting definitivo del frontend): decisión pendiente del operador antes de Fase 1.

## Prohibiciones

- ❌ No ejecutar contra `diqdpygummlrajsugotv`.
- ❌ No copiar valores de secretos productivos a `yoktobox`.
- ❌ No usar Stripe Live.
- ❌ No marcar PASS pruebas no ejecutadas.
