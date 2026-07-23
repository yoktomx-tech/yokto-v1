import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest, getRequestIP } from "@tanstack/react-start/server";

const uuid = z.string().uuid();

const INTERNAL_ROLES_SUPPORT = ["SOPORTE_N1","AGENTE_ESCROW","OFICIAL_CUMPLIMIENTO","CUMPLEX_SUPER_ADMIN"] as const;

async function requireInternalRole(userId: string, allowed: readonly string[]) {
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

/** Snapshot completo del ticket para el log inmutable (antes/después). */
async function ticketSnapshot(ticketId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("support_tickets")
    .select("id, numero, status, priority, escalation, escalation_reason, escalated_at, escalated_by, first_response_at, resolved_at, closed_at, assigned_to, updated_at")
    .eq("id", ticketId).maybeSingle();
  return data;
}

export const listSupportQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { escalated?: boolean } | undefined) =>
    z.object({ escalated: z.boolean().optional() }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const rol = await requireInternalRole(context.userId, INTERNAL_ROLES_SUPPORT);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("support_tickets")
      .select("id, numero, subject, module, status, priority, escalation, plan, is_live_chat, created_at, sla_first_response_at, org_id, user_id")
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
    const rol = await requireInternalRole(context.userId, INTERNAL_ROLES_SUPPORT);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ticket } = await supabaseAdmin.from("support_tickets").select("*").eq("id", data.id).maybeSingle();
    if (!ticket) throw new Error("Ticket no encontrado.");
    const { data: messages } = await supabaseAdmin.from("support_messages").select("*").eq("ticket_id", data.id).order("created_at", { ascending: true });
    const { data: attachments } = await supabaseAdmin.from("support_attachments")
      .select("id, ticket_id, message_id, file_name, mime_type, size_bytes, storage_path, uploaded_by, created_at")
      .eq("ticket_id", data.id).order("created_at", { ascending: true });
    await logAccess(context.userId, rol, data.id);
    // Also check MFA elevation (aal2) — surface it for UI gating
    const aal = (context.claims as { aal?: string } | undefined)?.aal ?? "aal1";
    return { ticket, messages: messages ?? [], attachments: attachments ?? [], rol, aal };
  });

export const adminReplyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; body: string; internal?: boolean; attachmentIds?: string[] }) =>
    z.object({
      id: uuid, body: z.string().trim().min(1).max(4000),
      internal: z.boolean().optional(),
      attachmentIds: z.array(uuid).max(10).optional(),
    }).parse(d))
  .handler(async ({ context, data }) => {
    const rol = await requireInternalRole(context.userId, INTERNAL_ROLES_SUPPORT);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const before = await ticketSnapshot(data.id);
    const { data: msg, error } = await supabaseAdmin.from("support_messages").insert({
      ticket_id: data.id, author_id: context.userId, author_kind: "internal",
      body: data.body, is_internal_note: !!data.internal,
    }).select("id").single();
    if (error) throw new Error(error.message);

    if (data.attachmentIds?.length) {
      await supabaseAdmin.from("support_attachments")
        .update({ message_id: msg.id })
        .in("id", data.attachmentIds)
        .eq("ticket_id", data.id);
    }

    // Marcar first_response_at si aún no existía; y estado in_progress si no está cerrado/escalado.
    await supabaseAdmin.from("support_tickets").update({
      first_response_at: new Date().toISOString(),
    }).eq("id", data.id).is("first_response_at", null);
    if (!before || (before.status !== "closed" && before.status !== "escalated")) {
      await supabaseAdmin.from("support_tickets").update({ status: "in_progress" }).eq("id", data.id);
    }
    const after = await ticketSnapshot(data.id);
    await logAction(context.userId, rol, data.id, data.internal ? "internal_note" : "reply", {
      message_id: msg.id, attachments: data.attachmentIds ?? [], before, after,
    });
    return { ok: true, messageId: msg.id };
  });

export const adminEscalateTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; type: "conflict"|"pld_ft"|"financial"|"technical"; reason: string }) =>
    z.object({ id: uuid, type: z.enum(["conflict","pld_ft","financial","technical"]), reason: z.string().trim().min(6).max(1000) }).parse(d))
  .handler(async ({ context, data }) => {
    const rol = await requireInternalRole(context.userId, ["SOPORTE_N1","CUMPLEX_SUPER_ADMIN"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const before = await ticketSnapshot(data.id);
    const { error } = await supabaseAdmin.from("support_tickets").update({
      escalation: data.type, escalated_at: new Date().toISOString(), escalated_by: context.userId,
      escalation_reason: data.reason, status: "escalated", priority: "urgent",
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    const after = await ticketSnapshot(data.id);
    await logAction(context.userId, rol, data.id, "escalate", {
      type: data.type, reason: data.reason, before, after,
    });
    return { ok: true };
  });

/**
 * Cierra un ticket. Tickets sensibles (escalados o con vida ligada a payments/disputes)
 * requieren elevación MFA (JWT con claim aal=aal2) + motivo (>= 6 caracteres).
 * Se persiste snapshot antes/después en internal_action_log.
 */
export const adminCloseTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; reason: string; resolution: string }) =>
    z.object({
      id: uuid,
      reason: z.string().trim().min(6, "Motivo obligatorio (mín. 6 caracteres).").max(1000),
      resolution: z.string().trim().min(3).max(60),
    }).parse(d))
  .handler(async ({ context, data }) => {
    const rol = await requireInternalRole(context.userId, INTERNAL_ROLES_SUPPORT);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const before = await ticketSnapshot(data.id);
    if (!before) throw new Error("Ticket no encontrado.");

    const { data: extra } = await supabaseAdmin.from("support_tickets")
      .select("module, related_dispute_id, is_live_chat").eq("id", data.id).maybeSingle();
    const sensitive = Boolean(
      (before.escalation && before.escalation !== "none") ||
      (extra?.module === "payments" || extra?.module === "disputes") ||
      extra?.related_dispute_id ||
      extra?.is_live_chat
    );

    const aal = (context.claims as { aal?: string; amr?: Array<{ method: string }> } | undefined)?.aal ?? "aal1";
    if (sensitive && aal !== "aal2") {
      throw new Error("Este ticket es sensible o está escalado. Debes elevar tu sesión con MFA antes de cerrarlo.");
    }

    // IP/UA para trazabilidad forense
    const req = getRequest();
    let ip: string | null = null;
    try { ip = getRequestIP({ xForwardedFor: true }) ?? null; } catch { ip = null; }
    const ua = req?.headers.get("user-agent") ?? null;

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("support_tickets").update({
      status: "closed", resolved_at: now, closed_at: now,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);

    const after = await ticketSnapshot(data.id);
    await logAction(context.userId, rol, data.id, "close", {
      reason: data.reason, resolution: data.resolution, sensitive, aal,
      ip, user_agent: ua, before, after,
    });
    return { ok: true };
  });

/** Adjuntos: firma URL de descarga y auditoría (rol interno). */
export const adminGetAttachmentDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { attachmentId: string }) =>
    z.object({ attachmentId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const rol = await requireInternalRole(context.userId, INTERNAL_ROLES_SUPPORT);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: att } = await supabaseAdmin.from("support_attachments")
      .select("id, ticket_id, storage_path, file_name").eq("id", data.attachmentId).maybeSingle();
    if (!att) throw new Error("Adjunto no encontrado.");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("support-attachments")
      .createSignedUrl(att.storage_path, 60, { download: att.file_name });
    if (error || !signed) throw new Error(error?.message ?? "No se pudo firmar la URL de descarga.");

    const req = getRequest();
    const ua = req?.headers.get("user-agent") ?? null;
    let ip: string | null = null;
    try { ip = getRequestIP({ xForwardedFor: true }) ?? null; } catch { ip = null; }
    await supabaseAdmin.from("support_attachment_downloads").insert({
      attachment_id: att.id, ticket_id: att.ticket_id, user_id: context.userId,
      user_kind: "internal", internal_role: rol, ip: ip as never, user_agent: ua,
    });
    return { url: signed.signedUrl, fileName: att.file_name };
  });
