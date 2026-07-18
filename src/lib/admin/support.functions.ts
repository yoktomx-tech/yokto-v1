import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

async function requireInternalRole(userId: string, allowed: string[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("internal_role_assignments")
    .select("rol, activo, expira_at").eq("user_id", userId).eq("activo", true).maybeSingle();
  if (!data) throw new Error("Sin rol interno activo.");
  if (data.expira_at && new Date(data.expira_at as string) < new Date()) throw new Error("Rol interno expirado.");
  if (!allowed.includes(data.rol as string)) throw new Error("Rol interno insuficiente.");
  return data.rol as string;
}

async function logAccess(userId: string, rol: string, ticketId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("internal_access_log").insert({
    user_id: userId, rol_usado: rol as never, resource: "soporte" as never, resource_id: ticketId,
  } as never);
}
async function logAction(userId: string, rol: string, ticketId: string, action: string, meta: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("internal_action_log").insert({
    user_id: userId, rol_usado: rol as never, resource: "soporte" as never, resource_id: ticketId,
    action: action as never, metadata: meta as never,
  } as never);
}

export const listSupportQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { escalated?: boolean } | undefined) =>
    z.object({ escalated: z.boolean().optional() }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const rol = await requireInternalRole(context.userId, ["SOPORTE_N1","AGENTE_ESCROW","OFICIAL_CUMPLIMIENTO","YOKTO_SUPER_ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("support_tickets")
      .select("id, numero, subject, module, status, priority, escalation, created_at, sla_first_response_at, org_id, user_id")
      .order("created_at", { ascending: false }).limit(200);
    if (data.escalated) q = q.neq("escalation", "none");
    if (rol === "AGENTE_ESCROW") q = q.eq("escalation", "conflict");
    if (rol === "OFICIAL_CUMPLIMIENTO") q = q.eq("escalation", "pld_ft");
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminGetTicket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const rol = await requireInternalRole(context.userId, ["SOPORTE_N1","AGENTE_ESCROW","OFICIAL_CUMPLIMIENTO","YOKTO_SUPER_ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ticket } = await supabaseAdmin.from("support_tickets").select("*").eq("id", data.id).maybeSingle();
    if (!ticket) throw new Error("Ticket no encontrado.");
    const { data: messages } = await supabaseAdmin.from("support_messages").select("*").eq("ticket_id", data.id).order("created_at", { ascending: true });
    await logAccess(context.userId, rol, data.id);
    return { ticket, messages: messages ?? [], rol };
  });

export const adminReplyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; body: string; internal?: boolean }) =>
    z.object({ id: uuid, body: z.string().trim().min(1).max(4000), internal: z.boolean().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const rol = await requireInternalRole(context.userId, ["SOPORTE_N1","AGENTE_ESCROW","OFICIAL_CUMPLIMIENTO","YOKTO_SUPER_ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("support_messages").insert({
      ticket_id: data.id, author_id: context.userId, author_kind: "internal",
      body: data.body, is_internal_note: !!data.internal,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("support_tickets").update({
      status: "in_progress", first_response_at: new Date().toISOString(),
    }).eq("id", data.id).is("first_response_at", null);
    await supabaseAdmin.from("support_tickets").update({ status: "in_progress" }).eq("id", data.id);
    await logAction(context.userId, rol, data.id, data.internal ? "internal_note" : "reply", {});
    return { ok: true };
  });

export const adminEscalateTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; type: "conflict"|"pld_ft"|"financial"|"technical"; reason: string }) =>
    z.object({ id: uuid, type: z.enum(["conflict","pld_ft","financial","technical"]), reason: z.string().trim().min(6).max(1000) }).parse(d))
  .handler(async ({ context, data }) => {
    const rol = await requireInternalRole(context.userId, ["SOPORTE_N1","YOKTO_SUPER_ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin.from("support_tickets").select("status, escalation").eq("id", data.id).maybeSingle();
    const { error } = await supabaseAdmin.from("support_tickets").update({
      escalation: data.type, escalated_at: new Date().toISOString(), escalated_by: context.userId,
      escalation_reason: data.reason, status: "escalated", priority: "urgent",
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction(context.userId, rol, data.id, "escalate", { type: data.type, reason: data.reason, before });
    return { ok: true };
  });

export const adminCloseTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; reason: string; mfaOtp?: string }) =>
    z.object({ id: uuid, reason: z.string().trim().min(6).max(1000), mfaOtp: z.string().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const rol = await requireInternalRole(context.userId, ["SOPORTE_N1","AGENTE_ESCROW","OFICIAL_CUMPLIMIENTO","YOKTO_SUPER_ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin.from("support_tickets").select("status, escalation").eq("id", data.id).maybeSingle();
    const sensitive = before?.escalation && before.escalation !== "none";
    if (sensitive && !data.mfaOtp) throw new Error("Requiere MFA para cerrar un ticket escalado.");
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("support_tickets").update({
      status: "closed", resolved_at: now, closed_at: now,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction(context.userId, rol, data.id, "close", { reason: data.reason, sensitive, before });
    return { ok: true };
  });
