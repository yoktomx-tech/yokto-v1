// =============================================================================
// YOKTO — ai-gateway Edge Function (portable, sin Lovable Cloud)
// =============================================================================
// Entrypoint delgado. Toda la lógica vive en `handler.ts` para permitir
// pruebas unitarias locales (ver `LOCAL_TESTING.md` y `index.test.ts`).
//
// Contrato externo INALTERADO respecto a la versión previa:
//   - POST /functions/v1/ai-gateway
//   - Authorization: Bearer <supabase_user_jwt>
//   - Body: { org_id, model?, messages[], max_output_tokens?, temperature?, json? }
//   - Respuestas y códigos idénticos.
//
// Secretos requeridos (nombres genéricos — sin valores reales aquí):
//   AI_PROVIDER, AI_PROVIDER_API_KEY, AI_DEFAULT_MODEL,
//   AI_MAX_INPUT_TOKENS, AI_MAX_OUTPUT_TOKENS, AI_REQUEST_TIMEOUT_MS,
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
//
// Auth: verify_jwt = true (configurado en supabase/config.toml).
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import type { AuthResult, DbClient, Provider } from "./handler.ts";
import { createHandler } from "./handler.ts";

function buildRealDeps() {
  const env = (name: string) => Deno.env.get(name);
  const supabaseUrl = env("SUPABASE_URL");
  const supabaseAnon = env("SUPABASE_ANON_KEY");
  const supabaseSrv = env("SUPABASE_SERVICE_ROLE_KEY");

  // Auth real contra Supabase Auth.
  const auth = async (bearer: string | null): Promise<AuthResult> => {
    if (!bearer || !bearer.startsWith("Bearer ")) {
      return { userId: null, error: "missing_bearer" };
    }
    if (!supabaseUrl || !supabaseAnon) {
      return { userId: null, error: "invalid_session" };
    }
    const userToken = bearer.slice(7);
    const supaUser = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: `Bearer ${userToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supaUser.auth.getUser(userToken);
    if (error || !data?.user) return { userId: null, error: "invalid_session" };
    return { userId: data.user.id };
  };

  // DB real con service_role SÓLO para membership check, rate-limit y audit.
  const supaSrv =
    supabaseUrl && supabaseSrv
      ? createClient(supabaseUrl, supabaseSrv, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;

  const db: DbClient = {
    async isActiveMember(userId, orgId) {
      if (!supaSrv) return false;
      const { data } = await supaSrv
        .from("memberships")
        .select("org_id")
        .eq("user_id", userId)
        .eq("org_id", orgId)
        .eq("status", "active")
        .maybeSingle();
      return !!data;
    },
    async countUsageSince(scope, sinceIso) {
      if (!supaSrv) return 0;
      let q = supaSrv
        .from("ai_gateway_usage")
        .select("id", { count: "exact", head: true })
        .gte("created_at", sinceIso);
      if (scope.orgId) q = q.eq("org_id", scope.orgId);
      if (scope.userId) q = q.eq("user_id", scope.userId);
      const { count } = await q;
      return count ?? 0;
    },
    async insertUsage(row) {
      if (!supaSrv) return;
      await supaSrv.from("ai_gateway_usage").insert(row as unknown as Record<string, unknown>);
      // Cast controlado: la fila coincide con la tabla ai_gateway_usage.
      void (row.provider as Provider);
    },
  };

  return {
    env,
    fetchImpl: fetch,
    now: () => Date.now(),
    randomId: () => crypto.randomUUID(),
    auth,
    db,
  };
}

const handler = createHandler(buildRealDeps());
serve((req) => handler(req));
