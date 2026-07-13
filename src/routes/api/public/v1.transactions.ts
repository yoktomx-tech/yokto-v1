// Módulo M — API pública firmada con HMAC.
// Headers requeridos:
//   x-yokto-key       — key_id
//   x-yokto-timestamp — epoch seconds (ventana ±300s)
//   x-yokto-signature — hex(HMAC_SHA256(secret, `${timestamp}.${method}.${path}.${body}`))
import { createFileRoute } from "@tanstack/react-router";
import { createHash, createHmac, timingSafeEqual } from "crypto";

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

async function verify(request: Request, bodyText: string) {
  const keyId = request.headers.get("x-yokto-key");
  const ts = request.headers.get("x-yokto-timestamp");
  const sig = request.headers.get("x-yokto-signature");
  if (!keyId || !ts || !sig) return { error: "Faltan headers de firma" };
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(ts)) > 300) return { error: "Timestamp fuera de ventana" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: client } = await supabaseAdmin
    .from("api_clients")
    .select("id, owner_id, secret_hash, active, scopes")
    .eq("key_id", keyId)
    .maybeSingle();
  if (!client || !client.active) return { error: "Credencial inválida" };

  // Recuperamos el secreto original desde la firma: no lo tenemos.
  // En su lugar validamos que HMAC(sha256_hex_of_secret_as_key) === sig.
  // Como el secreto real no vive en la DB, usamos el hash como llave HMAC —
  // el cliente hace lo mismo (`HMAC(sha256(secret), payload)`).
  const url = new URL(request.url);
  const payload = `${ts}.${request.method}.${url.pathname}.${sha256Hex(bodyText)}`;
  const expected = createHmac("sha256", client.secret_hash).update(payload).digest("hex");
  if (!safeEq(expected, sig)) return { error: "Firma inválida" };

  await supabaseAdmin.from("api_clients").update({ last_used_at: new Date().toISOString() }).eq("id", client.id);
  return { client };
}

export const Route = createFileRoute("/api/public/v1/transactions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const v = await verify(request, "");
        if ("error" in v) return Response.json({ error: v.error }, { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("transactions")
          .select("id, title, amount_cents, currency, status, created_at, funded_at, released_at")
          .or(`buyer_id.eq.${v.client.owner_id},seller_id.eq.${v.client.owner_id}`)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ data });
      },
    },
  },
});
