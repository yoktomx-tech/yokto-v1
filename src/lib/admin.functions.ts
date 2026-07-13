// Módulo K — Admin (aprobar KYC, forzar resolución disputa, listar todo)
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: ReturnType<typeof getSb>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Solo administradores");
}
// helper type
type Sb = ReturnType<typeof getSb>;
function getSb(): never { throw new Error("noop"); }
void getSb;

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as { supabase: Sb; userId: string });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles }, { data: txs }, { data: disputes }, { data: kyc }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, email, first_name, last_name, kyc_status, created_at").order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("transactions").select("id, title, amount_cents, currency, status, buyer_id, seller_id, created_at").order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("disputes").select("id, transaction_id, status, reason, opened_by, created_at").order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("kyc_documents").select("id, user_id, doc_type, status, created_at").order("created_at", { ascending: false }).limit(100),
    ]);

    return {
      profiles: profiles ?? [],
      transactions: txs ?? [],
      disputes: disputes ?? [],
      kyc: kyc ?? [],
      counts: {
        users: profiles?.length ?? 0,
        pendingKyc: (profiles ?? []).filter((p) => p.kyc_status === "in_review" || p.kyc_status === "submitted").length,
        openDisputes: (disputes ?? []).filter((d) => d.status === "open" || d.status === "in_review").length,
        activeTx: (txs ?? []).filter((t) => t.status === "funded" || t.status === "in_progress").length,
      },
    };
  });

export const adminSetKycStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    userId: z.string().uuid(),
    status: z.enum(["pending", "submitted", "in_review", "approved", "rejected"]),
    note: z.string().max(500).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as { supabase: Sb; userId: string });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ kyc_status: data.status, kyc_note: data.note ?? null, kyc_reviewed_at: new Date().toISOString() })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGrantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    userId: z.string().uuid(),
    role: z.enum(["buyer", "seller", "admin"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as { supabase: Sb; userId: string });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminForceResolveDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    disputeId: z.string().uuid(),
    resolution: z.enum(["release_to_seller", "refund_buyer", "partial"]),
    note: z.string().max(1000).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as { supabase: Sb; userId: string });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: d, error } = await supabaseAdmin
      .from("disputes")
      .update({ status: "resolved", resolution: data.resolution, resolved_at: new Date().toISOString(), resolution_note: data.note ?? null })
      .eq("id", data.disputeId)
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (d?.transaction_id) {
      await supabaseAdmin.from("transaction_events").insert({
        transaction_id: d.transaction_id,
        actor_id: (context as { userId: string }).userId,
        event_type: "dispute_resolved_admin",
        metadata: { dispute_id: d.id, resolution: data.resolution },
      });
    }
    return { ok: true };
  });
