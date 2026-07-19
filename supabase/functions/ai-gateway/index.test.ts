// =============================================================================
// YOKTO — ai-gateway pruebas unitarias LOCALES
// =============================================================================
// Ejecutar con:
//
//   deno test --allow-env supabase/functions/ai-gateway/index.test.ts
//
// Estas pruebas NO tocan Supabase, NO tocan proveedores de IA reales, NO
// requieren red, NO usan secretos reales, NO usan JWT reales. Todas las
// dependencias externas se mockean vía `test-fixtures.ts`.
//
// Escenarios cubiertos (26):
//   1  solicitud sin Authorization
//   2  JWT inválido
//   3  sesión inexistente (= JWT inválido tratado por auth mock)
//   4  usuario autenticado
//   5  usuario sin membership
//   6  membership inactiva
//   7  organización inexistente (ghost org, sin membership)
//   8  organización de otro tenant
//   9  modelo permitido
//   10 modelo no permitido
//   11 endpoint / proveedor arbitrario (no expuesto)
//   12 input vacío (messages_required)
//   13 input superior al límite
//   14 max_output_tokens superior al límite (clamp, no error)
//   15 timeout
//   16 rate limit por organización
//   17 rate limit por usuario
//   18 respuesta válida del proveedor
//   19 error controlado del proveedor
//   20 respuesta malformada del proveedor
//   21 auditoría metadata-only
//   22 generación de request_id
//   23 ausencia de prompts completos en logs
//   24 ausencia de LOVABLE_API_KEY en código y en env
//   25 ausencia de llamadas a dominios lovable.dev
//   26 protección SSRF (cliente no elige endpoint)
// =============================================================================

import {
  assert,
  assertEquals,
  assertStringIncludes,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { createHandler, ALLOWED_MODELS, approxTokens, safeNum } from "./handler.ts";
import {
  FIXTURE_ORGS,
  FIXTURE_USERS,
  makeDeps,
  makeEnv,
  makeFetchMock,
  makeMockDb,
  makeRequest,
} from "./test-fixtures.ts";

function bearerFor(uid: string) {
  return `Bearer valid:${uid}`;
}

// -----------------------------------------------------------------------------
// Utilidades puras
// -----------------------------------------------------------------------------

Deno.test("util: approxTokens ~ chars/4", () => {
  assertEquals(approxTokens(""), 0);
  assertEquals(approxTokens("abcd"), 1);
  assertEquals(approxTokens("abcde"), 2);
});

Deno.test("util: safeNum ignora valores no positivos o NaN", () => {
  assertEquals(safeNum(undefined, 10), 10);
  assertEquals(safeNum("abc", 10), 10);
  assertEquals(safeNum("-5", 10), 10);
  assertEquals(safeNum("0", 10), 10);
  assertEquals(safeNum("42", 10), 42);
});

// -----------------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------------

Deno.test("1. solicitud sin Authorization -> 401 missing_bearer", async () => {
  const handler = createHandler(makeDeps());
  const res = await handler(makeRequest({ body: { org_id: "x", messages: [] } }));
  assertEquals(res.status, 401);
  assertEquals((await res.json()).error, "missing_bearer");
});

Deno.test("2. JWT inválido -> 401 invalid_session", async () => {
  const handler = createHandler(makeDeps());
  const res = await handler(
    makeRequest({ bearer: "Bearer invalid", body: { org_id: "x", messages: [] } }),
  );
  assertEquals(res.status, 401);
  assertEquals((await res.json()).error, "invalid_session");
});

Deno.test("3. sesión inexistente -> 401 invalid_session", async () => {
  const handler = createHandler(makeDeps());
  const res = await handler(
    makeRequest({ bearer: "Bearer other", body: { org_id: "x", messages: [] } }),
  );
  assertEquals(res.status, 401);
});

// -----------------------------------------------------------------------------
// Authorization / membership
// -----------------------------------------------------------------------------

Deno.test("4. usuario autenticado válido llega a respuesta 200", async () => {
  const deps = makeDeps();
  const res = await createHandler(deps)(
    makeRequest({
      bearer: bearerFor(FIXTURE_USERS.buyer),
      body: {
        org_id: FIXTURE_ORGS.alpha,
        model: "google/gemini-1.5-flash",
        messages: [{ role: "user", content: "hola" }],
      },
    }),
  );
  assertEquals(res.status, 200);
});

Deno.test("5. usuario sin membership -> 403 not_a_member", async () => {
  const res = await createHandler(makeDeps())(
    makeRequest({
      bearer: bearerFor(FIXTURE_USERS.no_member),
      body: {
        org_id: FIXTURE_ORGS.alpha,
        messages: [{ role: "user", content: "hi" }],
      },
    }),
  );
  assertEquals(res.status, 403);
  assertEquals((await res.json()).error, "not_a_member");
});

Deno.test("6. membership inactiva -> 403 not_a_member", async () => {
  const res = await createHandler(makeDeps())(
    makeRequest({
      bearer: bearerFor(FIXTURE_USERS.inactive),
      body: {
        org_id: FIXTURE_ORGS.alpha,
        messages: [{ role: "user", content: "hi" }],
      },
    }),
  );
  assertEquals(res.status, 403);
});

Deno.test("7. organización inexistente -> 403 not_a_member", async () => {
  const res = await createHandler(makeDeps())(
    makeRequest({
      bearer: bearerFor(FIXTURE_USERS.buyer),
      body: {
        org_id: FIXTURE_ORGS.ghost,
        messages: [{ role: "user", content: "hi" }],
      },
    }),
  );
  assertEquals(res.status, 403);
});

Deno.test("8. organización de otro tenant -> 403 not_a_member", async () => {
  const res = await createHandler(makeDeps())(
    makeRequest({
      bearer: bearerFor(FIXTURE_USERS.buyer),
      body: {
        org_id: FIXTURE_ORGS.beta,
        messages: [{ role: "user", content: "hi" }],
      },
    }),
  );
  assertEquals(res.status, 403);
});

// -----------------------------------------------------------------------------
// Modelos / SSRF
// -----------------------------------------------------------------------------

Deno.test("9. modelo permitido -> 200", async () => {
  for (const m of Object.keys(ALLOWED_MODELS)) {
    const spec = ALLOWED_MODELS[m];
    const deps = makeDeps({
      env: makeEnv({ AI_PROVIDER: spec.provider }),
      fetchImpl: makeFetchMock(() =>
        new Response(
          JSON.stringify(
            spec.provider === "google"
              ? { candidates: [{ content: { parts: [{ text: "ok" }] } }] }
              : { choices: [{ message: { content: "ok" } }], usage: { completion_tokens: 1 } },
          ),
          { status: 200 },
        ),
      ),
    });
    const res = await createHandler(deps)(
      makeRequest({
        bearer: bearerFor(FIXTURE_USERS.buyer),
        body: {
          org_id: FIXTURE_ORGS.alpha,
          model: m,
          messages: [{ role: "user", content: "hi" }],
        },
      }),
    );
    assertEquals(res.status, 200, `modelo ${m} debería ser aceptado`);
  }
});

Deno.test("10. modelo no permitido -> 400 model_not_allowed", async () => {
  const res = await createHandler(makeDeps())(
    makeRequest({
      bearer: bearerFor(FIXTURE_USERS.buyer),
      body: {
        org_id: FIXTURE_ORGS.alpha,
        model: "evil/backdoor-v1",
        messages: [{ role: "user", content: "hi" }],
      },
    }),
  );
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "model_not_allowed");
});

Deno.test("11. endpoint arbitrario NO se expone: request body ignora url/endpoint", async () => {
  const fetchMock = makeFetchMock(() =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }), {
      status: 200,
    }),
  );
  const deps = makeDeps({ fetchImpl: fetchMock });
  await createHandler(deps)(
    makeRequest({
      bearer: bearerFor(FIXTURE_USERS.buyer),
      body: {
        // Campos maliciosos: nunca son leídos por el handler.
        endpoint: "https://attacker.example/steal",
        provider_url: "http://169.254.169.254/latest/meta-data/",
        base_url: "file:///etc/passwd",
        org_id: FIXTURE_ORGS.alpha,
        messages: [{ role: "user", content: "hi" }],
      },
    }),
  );
  assertEquals(fetchMock.calls.length, 1);
  assertStringIncludes(fetchMock.calls[0].url, "generativelanguage.googleapis.com");
});

Deno.test("26. SSRF: fetch nunca llega a dominios internos ni arbitrarios", async () => {
  const fetchMock = makeFetchMock(() =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }), {
      status: 200,
    }),
  );
  const deps = makeDeps({ fetchImpl: fetchMock });
  await createHandler(deps)(
    makeRequest({
      bearer: bearerFor(FIXTURE_USERS.buyer),
      body: {
        org_id: FIXTURE_ORGS.alpha,
        messages: [{ role: "user", content: "x" }],
      },
    }),
  );
  const url = fetchMock.calls[0].url;
  assert(!url.includes("169.254.169.254"), "no debe llamar a metadata AWS");
  assert(!url.includes("localhost"), "no debe llamar a localhost");
  assert(!url.startsWith("file:"), "no debe usar file://");
  assert(!url.includes("lovable.dev"), "no debe llamar a dominios lovable");
});

// -----------------------------------------------------------------------------
// Input / límites
// -----------------------------------------------------------------------------

Deno.test("12. input vacío (messages ausente) -> 400 messages_required", async () => {
  const res = await createHandler(makeDeps())(
    makeRequest({
      bearer: bearerFor(FIXTURE_USERS.buyer),
      body: { org_id: FIXTURE_ORGS.alpha },
    }),
  );
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "messages_required");
});

Deno.test("13. input superior al límite -> 413 input_too_large", async () => {
  const huge = "x".repeat(10_000);
  const res = await createHandler(makeDeps())(
    makeRequest({
      bearer: bearerFor(FIXTURE_USERS.buyer),
      body: {
        org_id: FIXTURE_ORGS.alpha,
        messages: [{ role: "user", content: huge }],
      },
    }),
  );
  assertEquals(res.status, 413);
  assertEquals((await res.json()).error, "input_too_large");
});

Deno.test("14. max_output_tokens sobre el límite se recorta (no error)", async () => {
  let receivedMax = 0;
  const deps = makeDeps({
    fetchImpl: makeFetchMock(async (_u, init) => {
      const payload = JSON.parse(init?.body as string);
      receivedMax = payload.generationConfig.maxOutputTokens;
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }),
        { status: 200 },
      );
    }),
  });
  const res = await createHandler(deps)(
    makeRequest({
      bearer: bearerFor(FIXTURE_USERS.buyer),
      body: {
        org_id: FIXTURE_ORGS.alpha,
        messages: [{ role: "user", content: "hi" }],
        max_output_tokens: 99999,
      },
    }),
  );
  assertEquals(res.status, 200);
  assertEquals(receivedMax, 500, "debe recortarse al AI_MAX_OUTPUT_TOKENS (500)");
});

// -----------------------------------------------------------------------------
// Timeout / rate limit
// -----------------------------------------------------------------------------

Deno.test("15. timeout del proveedor -> 504 timeout", async () => {
  const deps = makeDeps({
    env: makeEnv({ AI_REQUEST_TIMEOUT_MS: "50" }),
    fetchImpl: makeFetchMock(async (_u, init) => {
      // Espera al abort del handler.
      await new Promise((_r, rej) => {
        init?.signal?.addEventListener("abort", () => {
          const e = new Error("aborted");
          e.name = "AbortError";
          rej(e);
        });
      });
      return new Response("unreachable");
    }),
  });
  const res = await createHandler(deps)(
    makeRequest({
      bearer: bearerFor(FIXTURE_USERS.buyer),
      body: {
        org_id: FIXTURE_ORGS.alpha,
        messages: [{ role: "user", content: "hi" }],
      },
    }),
  );
  assertEquals(res.status, 504);
  assertEquals((await res.json()).error, "timeout");
});

Deno.test("16. rate limit por organización -> 429 rate_limited_org", async () => {
  const db = makeMockDb({ orgCounts: { [FIXTURE_ORGS.alpha]: 60 } });
  const deps = makeDeps({ db });
  const res = await createHandler(deps)(
    makeRequest({
      bearer: bearerFor(FIXTURE_USERS.buyer),
      body: {
        org_id: FIXTURE_ORGS.alpha,
        messages: [{ role: "user", content: "hi" }],
      },
    }),
  );
  assertEquals(res.status, 429);
  assertEquals((await res.json()).error, "rate_limited_org");
});

Deno.test("17. rate limit por usuario -> 429 rate_limited_user", async () => {
  const db = makeMockDb({ userCounts: { [FIXTURE_USERS.buyer]: 20 } });
  const deps = makeDeps({ db });
  const res = await createHandler(deps)(
    makeRequest({
      bearer: bearerFor(FIXTURE_USERS.buyer),
      body: {
        org_id: FIXTURE_ORGS.alpha,
        messages: [{ role: "user", content: "hi" }],
      },
    }),
  );
  assertEquals(res.status, 429);
  assertEquals((await res.json()).error, "rate_limited_user");
});

// -----------------------------------------------------------------------------
// Respuesta del proveedor
// -----------------------------------------------------------------------------

Deno.test("18. respuesta válida del proveedor -> 200 y content propagado", async () => {
  const deps = makeDeps({
    fetchImpl: makeFetchMock(() =>
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: "respuesta ok" }] } }] }),
        { status: 200 },
      ),
    ),
  });
  const res = await createHandler(deps)(
    makeRequest({
      bearer: bearerFor(FIXTURE_USERS.buyer),
      body: {
        org_id: FIXTURE_ORGS.alpha,
        messages: [{ role: "user", content: "hola" }],
      },
    }),
  );
  const json = await res.json();
  assertEquals(res.status, 200);
  assertEquals(json.content, "respuesta ok");
});

Deno.test("19. error controlado del proveedor -> propaga status y error", async () => {
  const deps = makeDeps({
    fetchImpl: makeFetchMock(() =>
      new Response(JSON.stringify({ error: { message: "quota_exceeded" } }), { status: 429 }),
    ),
  });
  const res = await createHandler(deps)(
    makeRequest({
      bearer: bearerFor(FIXTURE_USERS.buyer),
      body: {
        org_id: FIXTURE_ORGS.alpha,
        messages: [{ role: "user", content: "hi" }],
      },
    }),
  );
  assertEquals(res.status, 429);
  assertEquals((await res.json()).error, "quota_exceeded");
});

Deno.test("20. respuesta malformada del proveedor -> maneja sin crash", async () => {
  const deps = makeDeps({
    fetchImpl: makeFetchMock(() => new Response("<<not json>>", { status: 200 })),
  });
  const res = await createHandler(deps)(
    makeRequest({
      bearer: bearerFor(FIXTURE_USERS.buyer),
      body: {
        org_id: FIXTURE_ORGS.alpha,
        messages: [{ role: "user", content: "hi" }],
      },
    }),
  );
  // 200 con content vacío, no crash.
  assertEquals(res.status, 200);
  const j = await res.json();
  assertEquals(j.content, "");
});

// -----------------------------------------------------------------------------
// Auditoría / logs
// -----------------------------------------------------------------------------

Deno.test("21+23. auditoría metadata-only: no guarda prompts ni content", async () => {
  const db = makeMockDb();
  const deps = makeDeps({ db });
  await createHandler(deps)(
    makeRequest({
      bearer: bearerFor(FIXTURE_USERS.buyer),
      body: {
        org_id: FIXTURE_ORGS.alpha,
        messages: [{ role: "user", content: "PII SECRETA 12345" }],
      },
    }),
  );
  assertEquals(db.rows.length, 1);
  const row = db.rows[0];
  // Sólo metadatos permitidos:
  const allowed = new Set([
    "request_id",
    "user_id",
    "org_id",
    "provider",
    "model",
    "input_tokens",
    "output_tokens",
    "status",
    "error",
    "latency_ms",
  ]);
  for (const k of Object.keys(row)) {
    assert(allowed.has(k), `campo no permitido en auditoría: ${k}`);
  }
  const serialized = JSON.stringify(row);
  assert(!serialized.includes("PII SECRETA"), "el prompt NO debe estar en auditoría");
});

Deno.test("22. genera un request_id y lo devuelve en la respuesta", async () => {
  const deps = makeDeps({ randomId: () => "req_test_42" });
  const res = await createHandler(deps)(
    makeRequest({
      bearer: bearerFor(FIXTURE_USERS.buyer),
      body: {
        org_id: FIXTURE_ORGS.alpha,
        messages: [{ role: "user", content: "hi" }],
      },
    }),
  );
  assertEquals((await res.json()).request_id, "req_test_42");
});

// -----------------------------------------------------------------------------
// Higiene estática (código, no ejecución)
// -----------------------------------------------------------------------------

Deno.test("24. no existe LOVABLE_API_KEY en el código de la función", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const hdl = await Deno.readTextFile(new URL("./handler.ts", import.meta.url));
  assert(!src.includes("LOVABLE_API_KEY"), "index.ts no debe referenciar LOVABLE_API_KEY");
  assert(!hdl.includes("LOVABLE_API_KEY"), "handler.ts no debe referenciar LOVABLE_API_KEY");
});

Deno.test("25. no hay dominios lovable.dev en el código de la función", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const hdl = await Deno.readTextFile(new URL("./handler.ts", import.meta.url));
  assert(!src.includes("lovable.dev"), "index.ts no debe llamar a lovable.dev");
  assert(!hdl.includes("lovable.dev"), "handler.ts no debe llamar a lovable.dev");
});

// Sanity: env por defecto de fixtures no filtra secretos.
Deno.test("higiene: env de fixtures no contiene secretos reales", () => {
  const env = makeEnv();
  const key = env("AI_PROVIDER_API_KEY") ?? "";
  assertNotEquals(key, "");
  assert(key.includes("placeholder"), "la key de fixtures debe ser placeholder");
});
