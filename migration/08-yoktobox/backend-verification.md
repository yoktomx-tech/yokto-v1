# Verificación — ¿está el backend conectado a `yoktobox`?

Guía y comandos que **el operador** corre desde su estación DevOps para
confirmar que:
1. El proyecto Supabase enlazado localmente es **`yoktobox`**.
2. `diqdpygummlrajsugotv` **NO** recibe tráfico ni cambios durante la migración.
3. El frontend externo apunta al backend correcto.

Lovable NO puede correr estas comprobaciones — su cliente Supabase está
hard-cableado a `diqdpygummlrajsugotv`.

---

## 1. Verificar CLI y link local

```bash
supabase projects list
supabase status                       # ref del proyecto enlazado
cat supabase/.temp/project-ref 2>/dev/null   # ref cacheado por CLI
```

**PASS** si:
- El proyecto listado con estrella / marcado como linked es **`yoktobox`**.
- El ref impreso **NO** es `diqdpygummlrajsugotv`.

**FAIL** si aparece `diqdpygummlrajsugotv` en cualquier salida → detén todo y
re-linka con `supabase link --project-ref <ref-yoktobox>`.

---

## 2. Verificar conexión SQL directa

```bash
psql "$SUPABASE_DB_URL" -c "
  SELECT
    current_database()                      AS db,
    inet_server_addr()                      AS host_ip,
    current_setting('cluster_name', true)   AS cluster,
    now()                                   AS ts;
"
```

Compara `host_ip` contra el host esperado de yoktobox (visible en
Dashboard → Project Settings → Database → Connection info).

**FAIL** si el host resuelve al hostname productivo de Lovable Cloud.

Adicional — sanidad de identidad:

```bash
psql "$SUPABASE_DB_URL" -c "
  SELECT
    (SELECT count(*) FROM pg_tables WHERE schemaname='public')  AS tables_public,
    (SELECT count(*) FROM auth.users)                            AS users_auth;
"
```

Antes de aplicar migraciones, `tables_public` debe ser `0` (o muy bajo). Si
es alto, probablemente estás apuntando al proyecto equivocado.

---

## 3. Verificar Edge Functions

```bash
supabase functions list --project-ref "$SUPABASE_PROJECT_REF"
```

En un yoktobox recién creado la lista está vacía o solo contiene
`ai-gateway` tras el deploy. Si aparecen funciones del proyecto Cloud
(`ai-gateway` con configuración vieja, funciones legacy), estás en el
proyecto equivocado.

---

## 4. Guard defensivo — script portable

```bash
#!/usr/bin/env bash
set -euo pipefail
FORBIDDEN="diqdpygummlrajsugotv"
EXPECTED="yoktobox"

REF="$(supabase status 2>/dev/null | awk -F': ' '/Project ref/{print $2}')"
[[ -n "$REF" ]] || { echo "No hay proyecto enlazado"; exit 1; }
[[ "$REF" != "$FORBIDDEN" ]] || { echo "PROHIBIDO: enlazado a $FORBIDDEN"; exit 1; }

# Opcional: nombre del proyecto vía API
NAME="$(curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/$REF" | jq -r .name)"
[[ "$NAME" == "$EXPECTED" ]] || { echo "Nombre inesperado: $NAME"; exit 1; }

echo "OK — enlazado a $NAME ($REF)"
```

---

## 5. Verificar que `diqdpygummlrajsugotv` NO recibe cambios

**Desde el Dashboard de Lovable Cloud** (solo consulta, no ejecutar cambios):

- Project Settings → Database → **Backups**: verificar que no hay
  writes recientes distintos a tráfico normal de la app en producción.
- Project Settings → Database → **Migrations**: verificar que **no** aparecen
  migraciones nuevas con timestamps de la ventana de migración.
- Cloud → **Edge Functions**: verificar que no hay deployments nuevos.
- Cloud → **Secrets**: verificar que la lista es la esperada
  (`NUBARIUM_*`, `COPOMEX_TOKEN`, `VERIFICAMEX_*`, `BANK_ACCOUNT_HASH_SECRET`,
  `SUPABASE_*`, `LOVABLE_API_KEY`) sin adiciones nuevas.

**Marcador humano en logs**: antes de iniciar la migración, ejecuta desde
Lovable un `SELECT now()` inocuo y anota el timestamp. Al terminar, verifica
en Cloud que **no** hay actividad de escritura entre esos dos timestamps.

Si detectas escrituras nuevas en `diqdpygummlrajsugotv` durante la ventana:
- Detén la migración.
- Investiga qué cliente/servicio escribió (Stripe webhooks, cron jobs,
  usuarios activos).
- Considera freeze window (ver `migration/07-cutover/delta-and-freeze-window.md`).

---

## 6. Verificar frontend externo

Una vez desplegado el fork del frontend en el hosting externo:

```bash
# Inspeccionar el bundle deployado
curl -s https://<hosting-yokto-final>/ | grep -oE 'supabase\.co[^"]*' | sort -u
```

Debe imprimir el subdominio **yoktobox** (`<ref-yoktobox>.supabase.co`).
Si imprime `diqdpygummlrajsugotv.supabase.co`, hay una variable de entorno
mal configurada.

Verificación runtime desde DevTools:

```js
// Abrir DevTools en el sitio publicado, ejecutar en Console:
Object.entries(import.meta?.env ?? {}).filter(([k]) => k.startsWith('VITE_SUPABASE'))
```

Debe mostrar solo el URL y publishable key de yoktobox. **Nunca** debe
aparecer el ref `diqdpygummlrajsugotv`.

---

## 7. Verificar tráfico y realtime

Durante y después del cutover:

- Dashboard yoktobox → **Reports → API** debe mostrar aumento de tráfico.
- Dashboard Lovable Cloud (`diqdpygummlrajsugotv`) → **Reports → API** debe
  mostrar **caída** de tráfico a niveles residuales (bots, webhooks legados).
- Dashboard yoktobox → **Auth → Logs** debe mostrar signups/logins nuevos.
- Dashboard yoktobox → **Realtime → Inspector** debe mostrar subscripciones
  activas del frontend.

---

## 8. Checklist consolidado — pre-cutover

| # | Verificación | PASS si … |
|---|---|---|
| 1 | `supabase status` local | ref = yoktobox, ≠ `diqdpygummlrajsugotv` |
| 2 | `psql SELECT current_database()` | conecta al host de yoktobox |
| 3 | `supabase functions list` | solo funciones esperadas de yoktobox |
| 4 | Guard bash (sección 4) | imprime "OK — enlazado a yoktobox" |
| 5 | Dashboard Cloud (`diqdpy…`) → Migrations | sin migraciones nuevas |
| 6 | Dashboard Cloud → Edge Functions | sin deployments nuevos |
| 7 | Bundle frontend deployado | apunta a yoktobox.supabase.co |
| 8 | DevTools `import.meta.env` | solo credenciales de yoktobox |
| 9 | Dashboard yoktobox → Reports API | tráfico creciendo |
| 10 | Dashboard Cloud → Reports API | tráfico decreciendo |

Marca `PASS`, `FAIL` o `NOT_TESTED` explícitamente en
`migration/07-cutover/reports/backend-verification-report.md` (plantilla en
esta misma entrega). **No** marques `PASS` sin evidencia.

---

## 9. Qué NO hacer

- ❌ Ejecutar estas comprobaciones desde Lovable — el cliente Lovable siempre
  reporta `diqdpygummlrajsugotv`.
- ❌ Asumir que la CLI está enlazada al proyecto correcto sin verificar.
- ❌ Configurar variables `VITE_SUPABASE_*` en Lovable esperando que afecten
  el hosting externo — son entornos distintos.
- ❌ Silenciar tráfico residual en `diqdpygummlrajsugotv` durante la migración
  sin registrar de dónde viene.
