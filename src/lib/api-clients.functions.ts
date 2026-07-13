// Módulo M — Gestión de credenciales API (HMAC).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export const listApiClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("api_clients")
      .select("id, name, key_id, scopes, active, last_used_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createApiClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    name: z.string().min(3).max(80),
    scopes: z.array(z.enum(["read", "write"])).default(["read"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const keyId = `yk_${randomBytes(8).toString("hex")}`;
    const secret = `sk_${randomBytes(24).toString("hex")}`;
    const secret_hash = sha256Hex(secret);

    const { data: row, error } = await supabase
      .from("api_clients")
      .insert({ owner_id: userId, name: data.name, key_id: keyId, secret_hash, scopes: data.scopes })
      .select("id, name, key_id, scopes, active, created_at")
      .single();
    if (error) throw new Error(error.message);
    // El secreto se devuelve UNA sola vez.
    return { ...row, secret };
  });

export const revokeApiClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("api_clients")
      .update({ active: false })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
