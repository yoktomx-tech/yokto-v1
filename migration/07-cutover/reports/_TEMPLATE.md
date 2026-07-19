# Report Skeleton Template

Todos los reportes en este directorio siguen el mismo formato. Este
archivo es la referencia; cada reporte real duplica esta estructura.

## Metadatos

| Campo | Valor |
|-------|-------|
| Reporte | (nombre) |
| Fecha ejecución (UTC) | YYYY-MM-DDTHH:MM:SSZ |
| Operador | (nombre) |
| Commit frontend | `git rev-parse HEAD` (rama `chore/staging-cutover-dryrun`) |
| Commit migration/ | `git rev-parse HEAD -- migration/` |
| SOURCE_PROJECT_REF | diqdpygummlrajsugotv (NO tocado) |
| TARGET_STAGING_PROJECT_REF | (ref del staging) |
| ENVIRONMENT | staging |
| Guard passed | YES / NO |

## Estados posibles por prueba/sección

- `PASS` — Ejecutado en staging con el resultado esperado.
- `PASS WITH OBSERVATIONS` — Pasa pero hay una nota que registrar
  (rendimiento, warning, dependencia externa lenta).
- `FAIL` — Ejecutado y no pasa. Bloquea el reporte.
- `BLOCKER` — Impide continuar con Fase 1 aunque no haya podido
  ejecutarse.
- `NOT TESTED` — No se ejecutó (por dependencia externa, credencial
  faltante, tiempo insuficiente).

Prohibido:

- Marcar `PASS` una prueba no ejecutada en staging.
- Sustituir prueba real por validación teórica.
- Ocultar fallas.

## Niveles de evidencia

Cada prueba debe indicar en qué nivel se validó:

- `static` — Sólo revisión de código o SQL, sin ejecución.
- `local` — Ejecutado en Postgres local o `supabase start` local.
- `staging` — Ejecutado en el proyecto Supabase staging externo. **Único
  nivel válido para marcar PASS.**
- `production` — **Prohibido en Fase 0.** Si aparece, la Fase 0 se
  invalida.

## Estructura de cada sección

```markdown
### Nombre de la prueba

- **Estado:** PASS | PASS WITH OBSERVATIONS | FAIL | BLOCKER | NOT TESTED
- **Nivel:** static | local | staging
- **Descripción breve:** ...
- **Comando/prueba:** ...
- **Resultado observado:** ...
- **Evidencia:** ruta al log en `reports/logs/` o captura
- **Observaciones / Acción de seguimiento:** ...
```

## Cierre

Cada reporte termina con:

```markdown
## Resumen

| Estado | Cantidad |
|--------|----------|
| PASS | N |
| PASS WITH OBSERVATIONS | N |
| FAIL | N |
| BLOCKER | N |
| NOT TESTED | N |

## Decisión

- [ ] Reporte listo para consolidar en `phase-1-readiness-report.md`
- [ ] Requiere re-ejecución
- [ ] Bloqueado por: ...
```
