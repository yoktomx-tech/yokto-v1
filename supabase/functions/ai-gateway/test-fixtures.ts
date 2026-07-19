// =============================================================================
// YOKTO — ai-gateway test fixtures (mocks in-memory)
// =============================================================================
// Fixtures sintéticos SIN datos reales, SIN JWT reales, SIN URLs productivas,
// SIN secretos. Todo se ejecuta 100% offline con `deno test`.
// =============================================================================

import type { AuthResult, DbClient, HandlerDeps, Provider } from "./handler.ts";

export const FIXTURE_USERS = {
  buyer:      "00000000-0000-0000-0000-000000000001",
  seller:     "00000000-0000-0000-0000-000000000002",
  no_member:  "00000000-0000-0000-0000-000000000003",
  inactive:   "00000000-0000-0000-0000-000000000004",
  cross:      "00000000-0000-0000-0000-000000000005",
} as const;

export const FIXTURE_ORGS = {
  alpha:   "10000000-0000-0000-0000-0000000000aa",
  beta:    "10000000-0000-0000-0000-0000000000bb",
  ghost:   "10000000-0000-0000-0000-0000000000cc", // no existe
} as const;

// Membership matrix — no service_role, no bearer real.
const MEMBERSHIPS: Array<{ user: string; org: string; status: "active" | "inactive" }> = [
  { user: FIXTURE_USERS.buyer,  org: FIXTURE_ORGS.alpha, status: "active" },
  { user: FIXTURE_USERS.seller, org: FIXTURE_ORGS.alpha, status: "active" },
  { user: FIXTURE_USERS.inactive, org: FIXTURE_ORGS.alpha, status: "inactive" },
  { user: FIXTURE_USERS.cross,    org: FIXTURE_ORGS.beta,  status: "active" },
];

export interface UsageRow {
  request_id: string;
  user_id: string;
  org_id: string;
  provider: Provider;
  model: string;
  input_tokens: number;
  output_tokens: number;
  status: number;
  error: string | null;
  latency_ms: number;
}

export function makeMockDb(seed?: {
  orgCounts?: Record<string, number>;
  userCounts?: Record<string, number>;
}): DbClient & { rows: UsageRow[]; orgCounts: Record<string, number>; userCounts: Record<string, number> } {
  const rows: UsageRow[] = [];
  const orgCounts = { ...(seed?.orgCounts ?? {}) };
  const userCounts = { ...(seed?.userCounts ?? {}) };

  return {
    rows,
    orgCounts,
    userCounts,
    async isActiveMember(userId, orgId) {
      return MEMBERSHIPS.some(
        (m) => m.user === userId && m.org === orgId && m.status === "active",
      );
    },
    async countUsageSince(scope, _sinceIso) {
      if (scope.orgId) return orgCounts[scope.orgId] ?? 0;
      if (scope.userId) return userCounts[scope.userId] ?? 0;
      return 0;
    },
    async insertUsage(row) {
      rows.push(row);
    },
  };
}

/**
 * Autenticación mock:
 * - bearer "valid:<userId>"  -> autentica ese userId
 * - bearer "invalid"         -> invalid_session
 * - sin bearer               -> missing_bearer
 */
export async function mockAuth(bearer: string | null): Promise<AuthResult> {
  if (!bearer || !bearer.startsWith("Bearer ")) {
    return { userId: null, error: "missing_bearer" };
  }
  const raw = bearer.slice(7);
  if (raw.startsWith("valid:")) {
    return { userId: raw.slice("valid:".length) };
  }
  return { userId: null, error: "invalid_session" };
}

/** fetch mock configurable — nunca sale a Internet. */
export type FetchMock = typeof fetch & {
  calls: Array<{ url: string; init: RequestInit | undefined }>;
};

export function makeFetchMock(
  responder: (url: string, init: RequestInit | undefined) => Promise<Response> | Response,
): FetchMock {
  const calls: FetchMock["calls"] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    return await responder(url, init);
  }) as FetchMock;
  fn.calls = calls;
  return fn;
}

export function makeEnv(overrides: Record<string, string | undefined> = {}) {
  const base: Record<string, string | undefined> = {
    AI_PROVIDER: "google",
    AI_PROVIDER_API_KEY: "test-provider-key-placeholder",
    AI_DEFAULT_MODEL: "google/gemini-1.5-flash",
    AI_MAX_INPUT_TOKENS: "1000",
    AI_MAX_OUTPUT_TOKENS: "500",
    AI_REQUEST_TIMEOUT_MS: "5000",
    ...overrides,
  };
  return (name: string) => base[name];
}

export function makeDeps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  const db = overrides.db ?? makeMockDb();
  return {
    env: overrides.env ?? makeEnv(),
    fetchImpl:
      overrides.fetchImpl ??
      makeFetchMock(() =>
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "ok" }] } }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    now: overrides.now ?? (() => 1_700_000_000_000),
    randomId: overrides.randomId ?? (() => "req_00000000"),
    auth: overrides.auth ?? mockAuth,
    db,
    rateLimits: overrides.rateLimits,
  };
}

export function makeRequest(init: {
  method?: string;
  bearer?: string;
  body?: unknown;
  json?: boolean;
} = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.bearer) headers.authorization = init.bearer;
  return new Request("http://localhost/ai-gateway", {
    method: init.method ?? "POST",
    headers,
    body:
      init.body === undefined
        ? undefined
        : init.json === false
        ? String(init.body)
        : JSON.stringify(init.body),
  });
}
