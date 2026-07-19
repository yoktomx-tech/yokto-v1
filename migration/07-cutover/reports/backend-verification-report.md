# Verificación del backend — reporte del operador

> **Plantilla.** El operador la completa tras la migración a `yoktobox`.
> No marcar `PASS` sin evidencia. Sanitizar cualquier ref/URL/credencial.

- Timestamp UTC:
- Ejecutado por (rol, no nombre):
- Ventana de migración (inicio / fin UTC):

## Estado global

- [ ] `PASS` — yoktobox es el backend activo, Cloud sin cambios en la ventana.
- [ ] `FAIL` — describir causa.
- [ ] `NOT_TESTED`.

## Verificaciones (ver `backend-verification.md`)

| # | Verificación | Estado | Evidencia mínima |
|---|---|---|---|
| 1 | `supabase status` local | `PASS` / `FAIL` / `NOT_TESTED` | comando + primeras 3 líneas de salida (sanitizado) |
| 2 | `psql SELECT current_database()` contra yoktobox | | count de tablas antes de aplicar |
| 3 | `supabase functions list` | | lista de nombres |
| 4 | Guard bash de sección 4 | | "OK — enlazado a yoktobox" |
| 5 | Dashboard Cloud → Migrations sin nuevas | | screenshot ID / timestamp última migración |
| 6 | Dashboard Cloud → Edge Functions sin deploys | | screenshot ID |
| 7 | Bundle frontend apunta a yoktobox | | output `curl … | grep supabase.co` |
| 8 | DevTools `import.meta.env` correcto | | screenshot ID |
| 9 | Reports API yoktobox creciendo | | rango de tráfico |
| 10 | Reports API Cloud decreciendo | | rango de tráfico |

## Escrituras no autorizadas en Cloud (`diqdpygummlrajsugotv`)

- [ ] Ninguna detectada en la ventana.
- [ ] Detectadas — origen:
  - Stripe webhooks legados: [ ]
  - Cron jobs no reapuntados: [ ]
  - Usuarios activos: [ ]
  - Otro:

## Bloqueos identificados

Referenciar `unresolved-blockers.md` (B-02, B-04, B-05, B-06, B-07, B-08).

## Firma

- Operador (iniciales):
- Fecha UTC:
- Estado registrado en `migration/08-yoktobox/state/apply-all.state`: sí / no
