# ai-gateway — Pruebas locales (Opción D)

Pruebas **100% offline** para la Edge Function `ai-gateway`. No tocan
Supabase externo, no tocan proveedores de IA reales y no requieren
credenciales. Toda dependencia externa está mockeada en
`test-fixtures.ts`.

**Producción Lovable Cloud (`diqdpygummlrajsugotv`) NO se toca en esta
suite.** Las pruebas se ejecutan en el sandbox local del operador.

---

## 1. Unit tests locales (Deno)

Requisitos: `deno` ≥ 1.44 en la estación local. Nada más.

```bash
deno test --allow-env --allow-read supabase/functions/ai-gateway/index.test.ts
```

Estado esperado: **PASS** para los 26 escenarios listados abajo.

### Escenarios cubiertos

| #  | Escenario                                              | Nivel |
|----|--------------------------------------------------------|-------|
| 1  | Solicitud sin Authorization                            | Unit  |
| 2  | JWT inválido                                           | Unit  |
| 3  | Sesión inexistente                                     | Unit  |
| 4  | Usuario autenticado                                    | Unit  |
| 5  | Usuario sin membership                                 | Unit  |
| 6  | Membership inactiva                                    | Unit  |
| 7  | Organización inexistente                               | Unit  |
| 8  | Organización de otro tenant                            | Unit  |
| 9  | Modelo permitido (todos los del allowlist)             | Unit  |
| 10 | Modelo no permitido                                    | Unit  |
| 11 | Endpoint/proveedor arbitrario ignorado (no expuesto)   | Unit  |
| 12 | Input vacío                                            | Unit  |
| 13 | Input superior al límite                               | Unit  |
| 14 | `max_output_tokens` sobre el límite → clamp            | Unit  |
| 15 | Timeout                                                | Unit  |
| 16 | Rate limit por organización                            | Unit  |
| 17 | Rate limit por usuario                                 | Unit  |
| 18 | Respuesta válida del proveedor                         | Unit  |
| 19 | Error controlado del proveedor                         | Unit  |
| 20 | Respuesta malformada del proveedor                     | Unit  |
| 21 | Auditoría metadata-only                                | Unit  |
| 22 | Generación de `request_id`                             | Unit  |
| 23 | Ausencia de prompts completos en logs                  | Unit  |
| 24 | Ausencia de `LOVABLE_API_KEY` en el código             | Unit  |
| 25 | Ausencia de dominios `lovable.dev` en el código        | Unit  |
| 26 | Protección SSRF (dominios internos/metadata)           | Unit  |

Los mocks (`test-fixtures.ts`) NO contienen:

- claves reales;
- JWT reales;
- URLs productivas;
- secretos;
- datos personales, bancarios o documentos reales.

---

## 2. Integration test local (Supabase CLI del operador)

Sólo el operador ejecuta esto en su estación DevOps controlada. **Lovable
no lo ejecuta.**

Prerequisito: archivo local `.env.staging.local` en el sandbox del
operador — **nunca se commitea**, ya está en `.gitignore` (patrón
`*.local`).

Contenido esperado (**el operador lo crea con sus propios valores**;
plantilla sin valores reales):

```
AI_PROVIDER=google
AI_PROVIDER_API_KEY=<sandbox_key_del_operador>
AI_DEFAULT_MODEL=google/gemini-1.5-flash
AI_MAX_INPUT_TOKENS=8000
AI_MAX_OUTPUT_TOKENS=2000
AI_REQUEST_TIMEOUT_MS=30000
SUPABASE_URL=<staging_supabase_url>
SUPABASE_ANON_KEY=<staging_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<staging_service_role_key>
```

Levantar la función localmente contra un Supabase staging **externo**:

```bash
supabase functions serve ai-gateway --env-file .env.staging.local
```

Verificación mínima recomendada (usar `curl` con un JWT emitido por el
Supabase staging externo; nunca uno de producción):

```bash
curl -s -X POST http://127.0.0.1:54321/functions/v1/ai-gateway \
  -H "authorization: Bearer <staging_user_jwt>" \
  -H "content-type: application/json" \
  --data '{"org_id":"<org_staging>","messages":[{"role":"user","content":"ping"}]}'
```

Resultado esperado: HTTP 200 con `request_id`, `content`,
`input_tokens`, `output_tokens`, `latency_ms`.

---

## 3. Estados de prueba

Registrar sólo lo realmente ejecutado:

| Nivel                         | Puede quedar en |
|-------------------------------|-----------------|
| Unit test local               | PASS / FAIL     |
| Integration test local        | PASS / FAIL / NOT TESTED |
| Supabase staging test         | NOT TESTED (hasta dry run externo) |
| Production                    | NOT AUTHORIZED  |

Prohibido marcar `PASS` una prueba no ejecutada.

---

## 4. Blocker B-01 — estado

- **RESOLVED IN DESIGN** — sin dependencia de `LOVABLE_API_KEY` ni de
  `ai.gateway.lovable.dev`.
- **LOCAL UNIT TESTS** — el operador registra el resultado real tras
  correr `deno test` arriba (PASS / FAIL).
- **STAGING INTEGRATION TEST** — NOT TESTED.
- **PRODUCTION** — NOT AUTHORIZED.
