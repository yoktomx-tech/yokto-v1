# Staging Environment Readiness Report

**Deliverable:** `staging-environment-readiness.md`
**Fase:** 0 — Preparación del entorno externo de staging
**Ejecutor:** Operador DevSecOps (estación controlada)
**Rol de Lovable:** Solo generación de plantilla y validaciones documentales. **No** ejecuta comandos contra el proyecto externo, **no** recibe secretos.
**Producción intocable:** `diqdpygummlrajsugotv` — NO modificar, NO enlazar, NO consultar durante esta fase.

> Este archivo es una plantilla sanitizada. El operador la completa **sin** pegar valores secretos. Marque cada ítem como `READY`, `PARTIAL`, `BLOCKED` o `N/A`. El estado final agregado se registra al pie.

---

## 0. Guard de seguridad ejecutado

- [ ] `ENVIRONMENT=staging` verificado
- [ ] `TARGET_STAGING_PROJECT_REF` no vacío
- [ ] `TARGET_STAGING_PROJECT_REF != diqdpygummlrajsugotv` (rechazo explícito de producción)
- [ ] Script `set -euo pipefail` ejecutado sin abort

Resultado guard: `READY` / `BLOCKED`

---

## 1. Identidad del proyecto staging (sanitizado)

| Campo | Valor sanitizado |
|---|---|
| Project Ref (parcial) | `xxxx…____` (primeros 4 + últimos 4) |
| Project URL | `https://xxxx…____.supabase.co` |
| DB Host (parcial) | `db.xxxx…____.supabase.co` |
| Región | `<region>` (ej. `us-east-1`) |
| Nombre del proyecto | `yokto-staging` |
| Plan | `<plan>` |
| Fecha de creación | `YYYY-MM-DD` |

**Verificación anti-producción:**
- [ ] Project Ref confirmado ≠ `diqdpygummlrajsugotv`
- [ ] URL confirmada ≠ URL productiva
- [ ] Cuenta / organización Supabase distinta o aislada de producción

---

## 2. Credenciales independientes cargadas (sin valores)

Marcar solo presencia. **Nunca** copiar valores en este archivo.

| Credencial | Cargada | Alcance | Notas |
|---|---|---|---|
| Publishable Key (staging) | [ ] | Frontend `.env.staging` | Distinta a prod |
| Secret Key backend (staging) | [ ] | Backend / Edge Functions | Distinta a prod |
| DB Password | [ ] | Solo operador | No en Git, no en Lovable |
| Personal Access Token (CLI) | [ ] | Solo operador | Rotable |
| BANK_ACCOUNT_HASH_SECRET (staging) | [ ] | Backend | **Distinto** al productivo |
| Google OAuth Client ID staging | [ ] | Auth | Cliente independiente |
| Google OAuth Client Secret staging | [ ] | Auth | Cliente independiente |
| SMTP staging (host/user/pass) | [ ] | Auth email | Servidor de pruebas |
| Stripe Test Mode keys | [ ] | Pagos | `sk_test_…` / `pk_test_…` |
| Nubarium sandbox creds | [ ] | KYC | Sandbox |
| Verificamex sandbox creds | [ ] | KYC | Sandbox |
| Copomex token | [ ] | Direcciones | Token staging |
| AI provider key (staging) | [ ] | ai-gateway | **No** `LOVABLE_API_KEY` |
| Webhook signing secrets (staging) | [ ] | Endpoints públicos | Distintos a prod |

- [ ] Ningún `sb_secret_*`, password, ni token en el repositorio
- [ ] Ningún secreto compartido con Lovable
- [ ] `.env.staging` fuera de Git (`.gitignore` verificado)

---

## 3. Configuración de Auth

| Ítem | Estado |
|---|---|
| Email + password habilitado | [ ] |
| Confirmación de correo activa | [ ] |
| OTP (si aplica) | [ ] / N/A |
| Recuperación de contraseña | [ ] |
| Site URL staging configurada | [ ] |
| Redirect URLs staging (lista) | [ ] |
| Google OAuth con cliente independiente | [ ] |
| Rate limits configurados | [ ] |
| Expiraciones (JWT / refresh) revisadas | [ ] |
| Protección contra abuso (captcha / bloqueo) | [ ] |
| SMTP de pruebas conectado | [ ] |
| Password HIBP activado | [ ] |
| Anonymous signups deshabilitado | [ ] |

- [ ] Confirmado: **cero** clientes OAuth productivos usados en staging
- [ ] Site URL y Redirects **no** apuntan a dominios productivos

---

## 4. Extensiones habilitadas

| Extensión | Habilitada | Motivo |
|---|---|---|
| `pgcrypto` | [ ] | Hashing / gen_random_uuid |
| `uuid-ossp` | [ ] | UUIDs |
| `pg_cron` | [ ] | SLA / cron internos |
| `pg_net` | [ ] | Llamadas HTTP desde DB |
| `vault` | [ ] | Secretos administrados |

- [ ] Ninguna extensión adicional habilitada sin justificación
- [ ] `pg_trgm`, `postgis`, etc.: **N/A** salvo requerimiento explícito

---

## 5. Proveedores en modo sandbox / test

| Proveedor | Modo | Verificado |
|---|---|---|
| Stripe | Test Mode | [ ] |
| Nubarium | Sandbox | [ ] |
| Verificamex | Sandbox | [ ] |
| Copomex | Staging token | [ ] |
| AI Gateway | Key propia (no Lovable) | [ ] |
| SMTP | Servidor de pruebas | [ ] |

- [ ] Ningún proveedor en modo producción
- [ ] Ninguna cuenta bancaria real cargada
- [ ] Ningún documento / biometría / identidad real cargada
- [ ] Ningún webhook productivo apuntando a staging (ni viceversa)

---

## 6. CLI enlazada correctamente

Comandos ejecutados por el operador (registrar solo confirmación, no salidas con IDs completos):

- [ ] `supabase login` OK
- [ ] `supabase projects list` muestra `yokto-staging`
- [ ] `supabase link --project-ref "$TARGET_STAGING_PROJECT_REF"` OK
- [ ] `supabase status` / `supabase projects api-keys` confirma proyecto **staging**
- [ ] Verificado manualmente: ref enlazada ≠ `diqdpygummlrajsugotv`

---

## 7. Aislamiento respecto a producción

- [ ] Ningún secreto productivo reutilizado
- [ ] Ninguna URL / dominio productivo referenciado en `.env.staging`
- [ ] Frontend productivo **no** apunta a staging
- [ ] Frontend staging (branch/preview) **no** apunta a producción
- [ ] Sin cross-project queries, sin foreign data wrappers a producción
- [ ] Sin restore desde snapshot productivo

---

## 8. Blockers registrados (referencia)

| ID | Estado | Nota |
|---|---|---|
| B-01 AI Gateway | RESOLVED IN DESIGN / NOT TESTED | Validar en dry run |
| B-02 Staging Project | EN CIERRE con este entregable | |
| B-04 Frontend Hosting | PENDING DECISION (pre-Fase 1) | No bloquea staging |
| B-05 Auth Backfill | OPEN | A validar en dry run |
| B-06 Rollback | OPEN | A validar en dry run |
| B-07 Webhook Idempotency | OPEN | A validar en dry run |
| B-08 Realtime | OPEN | A validar en dry run |

---

## 9. Estado final

Marcar **uno**:

- [ ] `READY` — Todos los ítems 0–7 en verde. Se autoriza ejecutar el runbook de dry run.
- [ ] `READY WITH OBSERVATIONS` — Todo lo bloqueante en verde; observaciones menores listadas abajo.
- [ ] `BLOCKED` — Hay ítems críticos sin cumplir; **no** ejecutar migraciones.

**Observaciones / desviaciones:**

```
<operador: describir aquí, sin secretos>
```

**Firma del operador:** `<iniciales> — YYYY-MM-DD HH:MM TZ`

---

## 10. Confirmaciones finales

- [ ] Producción `diqdpygummlrajsugotv` **no** fue tocada durante esta preparación
- [ ] Lovable **no** recibió secretos
- [ ] Este archivo **no** contiene valores secretos
- [ ] Próximo paso autorizado solo si estado = `READY` y runbook revisado

---

### Nota de ejecución (Lovable)

Lovable generó únicamente esta plantilla y no ejecutó ninguna acción contra el proyecto externo ni contra `diqdpygummlrajsugotv`. La ejecución real de los pasos 1–6 corresponde al operador desde su estación controlada. Detenido a la espera de la versión completada de este reporte antes de continuar con el runbook de dry run.
