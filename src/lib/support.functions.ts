import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest, getRequestIP } from "@tanstack/react-start/server";

const uuid = z.string().uuid();

type Priority = "low" | "normal" | "high" | "urgent";
type Plan = "free" | "pro" | "enterprise";

/** Prioridad automática según módulo, escalamiento y plan. */
function calcPriority(input: {
  module?: string | null;
  escalation?: string | null;
  hasDispute?: boolean;
  isLiveChat?: boolean;
  plan: Plan;
}): Priority {
  if (input.escalation && input.escalation !== "none") return "urgent";
  if (input.isLiveChat) return "urgent";
  if (input.plan === "enterprise") {
    if (input.hasDispute || input.module === "payments" || input.module === "disputes") return "urgent";
    return "high";
  }
  if (input.hasDispute) return "high";
  if (input.module === "payments" || input.module === "disputes") return "high";
  if (input.plan === "pro") return "high";
  return "normal";
}

/** SLA en horas — congelado en el ticket al crearse. */
function calcSla(plan: Plan, isLiveChat: boolean): { firstResponseHrs: number; resolutionHrs: number } {
  if (isLiveChat) return { firstResponseHrs: 0.25, resolutionHrs: 4 }; // 15 min
  switch (plan) {
    case "enterprise": return { firstResponseHrs: 2, resolutionHrs: 12 };
    case "pro":        return { firstResponseHrs: 6, resolutionHrs: 24 };
    default:           return { firstResponseHrs: 24, resolutionHrs: 72 };
  }
}

async function resolvePlan(supabase: NonNullable<Awaited<ReturnType<typeof getRequest>>> extends never ? never : unknown, orgId: string | null | undefined): Promise<Plan> {
  return orgId ? await resolvePlanInner(supabase as never, orgId) : "free";
}
async function resolvePlanInner(supabase: { from: (t: string) => { select: (c: string) => { eq: (a: string, b: string) => { maybeSingle: () => Promise<{ data: { plan?: Plan } | null }> } } } }, orgId: string): Promise<Plan> {
  const { data } = await supabase.from("organizations").select("plan").eq("id", orgId).maybeSingle();
  return (data?.plan as Plan) ?? "free";
}

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME = new Set<string>([
  "application/pdf",
  "image/png", "image/jpeg", "image/webp",
  "text/plain", "text/csv",
  "application/xml", "text/xml",
  "application/json",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// ============ QUICK ACCESS CONTEXT ============
export const getQuickAccessContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Derivar el plan más alto entre las organizaciones donde el usuario es miembro activo.
    const { data: memberships } = await supabase
      .from("memberships").select("org_id, status").eq("user_id", userId).eq("status", "active");
    const orgIds = (memberships ?? []).map((m: { org_id: string }) => m.org_id);
    let plan: Plan = "free";
    if (orgIds.length) {
      const { data: orgs } = await supabase.from("organizations").select("plan").in("id", orgIds);
      for (const o of orgs ?? []) {
        const p = (o.plan as Plan) ?? "free";
        if (p === "enterprise") { plan = "enterprise"; break; }
        if (p === "pro" && plan === "free") plan = "pro";
      }
    }

    const [tx, tickets, disputes, incidents] = await Promise.all([
      supabase.from("transactions").select("id", { count: "exact", head: true }).eq("status", "pending_action" as never),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", ["open","pending_user","in_progress","escalated","reopened"]),
      supabase.from("disputes").select("id", { count: "exact", head: true }).in("status", ["open","in_review","pending_response"] as never),
      supabase.from("platform_incidents").select("id, severity, status").neq("status", "resolved"),
    ]);

    const criticalIncident = (incidents.data ?? []).some((i: { severity: string }) => i.severity === "critical");
    const pending = (tx.count ?? 0) + (tickets.count ?? 0) + (disputes.count ?? 0);

    return {
      pendingOps: tx.count ?? 0,
      openTickets: tickets.count ?? 0,
      activeDisputes: disputes.count ?? 0,
      hasPending: pending > 0,
      criticalIncident,
      plan,
    };
  });

// ============ CREATE TICKET (contexto congelado server-side) ============
export const createSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    subject: string;
    description: string;
    module?: string | null;
    orgId?: string | null;
    activeView?: "buyer" | "seller" | null;
    relatedTransactionId?: string | null;
    relatedDisputeId?: string | null;
    isLiveChat?: boolean;
  }) => z.object({
    subject: z.string().trim().min(4).max(160),
    description: z.string().trim().min(10).max(4000),
    module: z.string().max(60).nullish(),
    orgId: uuid.nullish(),
    activeView: z.enum(["buyer","seller"]).nullish(),
    relatedTransactionId: uuid.nullish(),
    relatedDisputeId: uuid.nullish(),
    isLiveChat: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // Auditor no puede crear tickets
    if (data.orgId) {
      const { data: mem } = await supabase.from("memberships")
        .select("org_role,status").eq("org_id", data.orgId).eq("user_id", userId).maybeSingle();
      if (mem?.org_role === "auditor") throw new Error("Los auditores no pueden abrir tickets.");
    }

    // Congelar contexto server-side (no confiar en el cliente)
    const { data: rolesRow } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const { data: membership } = data.orgId ? await supabase.from("memberships")
      .select("org_role,status").eq("org_id", data.orgId).eq("user_id", userId).maybeSingle() : { data: null };
    const { data: org } = data.orgId ? await supabase.from("organizations")
      .select("id,name,type,kyb_status,plan").eq("id", data.orgId).maybeSingle() : { data: null };
    const plan: Plan = (org?.plan as Plan) ?? "free";

    // Live chat solo para Pro/Enterprise
    const isLiveChat = !!data.isLiveChat && (plan === "pro" || plan === "enterprise");
    if (data.isLiveChat && !isLiveChat) {
      throw new Error("El chat en vivo está disponible solo para los planes Profesional y Enterprise.");
    }

    const priority = calcPriority({
      module: data.module,
      hasDispute: !!data.relatedDisputeId,
      isLiveChat,
      plan,
    });
    const sla = calcSla(plan, isLiveChat);
    const now = new Date();
    const firstResp = new Date(now.getTime() + sla.firstResponseHrs * 3600_000);
    const resolution = new Date(now.getTime() + sla.resolutionHrs * 3600_000);

    const contextoFrozen = {
      user_roles: (rolesRow ?? []).map((r: { role: string }) => r.role),
      membership: membership ? { org_role: membership.org_role, status: membership.status } : null,
      org: org ? { id: org.id, name: org.name, type: org.type, kyb_status: org.kyb_status, plan } : null,
      active_view: data.activeView ?? null,
      plan,
      is_live_chat: isLiveChat,
      sla: { first_response_hrs: sla.firstResponseHrs, resolution_hrs: sla.resolutionHrs },
      frozen_at: now.toISOString(),
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.from("support_tickets").insert({
      user_id: userId,
      org_id: data.orgId ?? null,
      subject: data.subject,
      description: data.description,
      module: isLiveChat ? "live_chat" : (data.module ?? null),
      related_transaction_id: data.relatedTransactionId ?? null,
      related_dispute_id: data.relatedDisputeId ?? null,
      status: "open",
      priority,
      plan,
      is_live_chat: isLiveChat,
      contexto_rol_congelado: contextoFrozen as never,
      sla_first_response_at: firstResp.toISOString(),
      sla_resolution_at: resolution.toISOString(),
    }).select("id, numero, is_live_chat, priority, plan, sla_first_response_at").single();
    if (error) throw new Error(error.message);

    return created;
  });

// ============ LIST / GET ============
export const listMyTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("support_tickets")
      .select("id, numero, subject, module, status, priority, escalation, created_at, updated_at, org_id, user_id, is_live_chat, plan")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getTicket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: ticket, error } = await context.supabase
      .from("support_tickets").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!ticket) throw new Error("Ticket no encontrado.");

    const { data: messages } = await context.supabase
      .from("support_messages")
      .select("id, author_id, author_kind, body, created_at")
      .eq("ticket_id", data.id).eq("is_internal_note", false)
      .order("created_at", { ascending: true });

    const { data: attachments } = await context.supabase
      .from("support_attachments")
      .select("id, ticket_id, message_id, file_name, mime_type, size_bytes, storage_path, uploaded_by, created_at")
      .eq("ticket_id", data.id)
      .order("created_at", { ascending: true });

    return { ticket, messages: messages ?? [], attachments: attachments ?? [] };
  });

export const addTicketMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ticketId: string; body: string; attachmentIds?: string[] }) =>
    z.object({
      ticketId: uuid,
      body: z.string().trim().min(1).max(4000),
      attachmentIds: z.array(uuid).max(10).optional(),
    }).parse(d))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { data: msg, error } = await context.supabase.from("support_messages").insert({
      ticket_id: data.ticketId, author_id: userId, author_kind: "user", body: data.body, is_internal_note: false,
    }).select("id").single();
    if (error) throw new Error(error.message);

    if (data.attachmentIds?.length) {
      await context.supabase.from("support_attachments")
        .update({ message_id: msg.id })
        .in("id", data.attachmentIds)
        .eq("ticket_id", data.ticketId)
        .eq("uploaded_by", userId);
    }
    return { ok: true, messageId: msg.id };
  });

// ============ ATTACHMENTS ============
export const createAttachmentUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ticketId: string; fileName: string; mimeType: string; sizeBytes: number }) =>
    z.object({
      ticketId: uuid,
      fileName: z.string().trim().min(1).max(160),
      mimeType: z.string().trim().min(1).max(120),
      sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES, "Máximo 15 MB por archivo."),
    }).parse(d))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    if (!ALLOWED_MIME.has(data.mimeType)) {
      throw new Error("Tipo de archivo no permitido. Formatos aceptados: PDF, imágenes, texto, XML, CSV, JSON, Office.");
    }
    // Verify the caller can access the ticket
    const { data: ticket } = await context.supabase.from("support_tickets")
      .select("id").eq("id", data.ticketId).maybeSingle();
    if (!ticket) throw new Error("Ticket no encontrado.");

    const safeName = data.fileName.replace(/[^\w.\-]+/g, "_").slice(0, 120);
    const objectPath = `${data.ticketId}/${crypto.randomUUID()}-${safeName}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("support-attachments")
      .createSignedUploadUrl(objectPath);
    if (error || !signed) throw new Error(error?.message ?? "No se pudo firmar la URL de carga.");

    // Pre-registrar el adjunto (sin message_id aún). El cliente adjunta a un mensaje al enviarlo.
    const { data: att, error: attErr } = await supabaseAdmin.from("support_attachments").insert({
      ticket_id: data.ticketId,
      uploaded_by: userId,
      file_name: safeName,
      mime_type: data.mimeType,
      size_bytes: data.sizeBytes,
      storage_path: objectPath,
    }).select("id").single();
    if (attErr) throw new Error(attErr.message);

    return {
      attachmentId: att.id,
      uploadUrl: signed.signedUrl,
      token: signed.token,
      path: objectPath,
      maxBytes: MAX_ATTACHMENT_BYTES,
    };
  });

/** Firma una URL de descarga (60s) y registra la descarga en la auditoría. */
export const getAttachmentDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { attachmentId: string }) =>
    z.object({ attachmentId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    // Comprobar acceso vía RLS
    const { data: att, error } = await context.supabase.from("support_attachments")
      .select("id, ticket_id, storage_path, file_name")
      .eq("id", data.attachmentId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!att) throw new Error("Adjunto no encontrado o sin acceso.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("support-attachments")
      .createSignedUrl(att.storage_path, 60, { download: att.file_name });
    if (sErr || !signed) throw new Error(sErr?.message ?? "No se pudo firmar la URL de descarga.");

    // Auditar la descarga
    const req = getRequest();
    const ua = req?.headers.get("user-agent") ?? null;
    let ip: string | null = null;
    try { ip = getRequestIP({ xForwardedFor: true }) ?? null; } catch { ip = null; }
    await supabaseAdmin.from("support_attachment_downloads").insert({
      attachment_id: att.id, ticket_id: att.ticket_id,
      user_id: userId, user_kind: "user",
      ip: ip as never, user_agent: ua,
    });

    return { url: signed.signedUrl, fileName: att.file_name };
  });

// ============ HELP CENTER ============
export const listHelpCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const client = createClient(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false },
    global: { fetch: (input, init) => {
      const h = new Headers(init?.headers);
      if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
      h.set("apikey", key);
      return fetch(input, { ...init, headers: h });
    } },
  });
  const { data } = await client.from("help_categories").select("id, slug, name, description, module, icon, sort_order").order("sort_order");
  return data ?? [];
});

export const listHelpArticles = createServerFn({ method: "GET" })
  .inputValidator((d: { q?: string; category?: string; audience?: "buyer"|"seller" } | undefined) =>
    z.object({ q: z.string().max(120).optional(), category: z.string().max(60).optional(), audience: z.enum(["buyer","seller"]).optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const client = createClient(process.env.SUPABASE_URL!, key, {
      auth: { persistSession: false },
      global: { fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      } },
    });
    let q = client.from("help_articles").select("id, slug, title, summary, tags, module, category_id").eq("is_published", true);
    if (data.category) q = q.eq("module", data.category);
    if (data.q) q = q.ilike("title", `%${data.q}%`);
    const { data: rows } = await q.limit(60);
    return rows ?? [];
  });

export const getHelpArticle = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().max(120) }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const client = createClient(process.env.SUPABASE_URL!, key, {
      auth: { persistSession: false },
      global: { fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      } },
    });
    const { data: article } = await client.from("help_articles").select("*").eq("slug", data.slug).eq("is_published", true).maybeSingle();
    return article;
  });

export const listPlatformIncidents = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const client = createClient(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false },
    global: { fetch: (input, init) => {
      const h = new Headers(init?.headers);
      if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
      h.set("apikey", key);
      return fetch(input, { ...init, headers: h });
    } },
  });
  const { data } = await client.from("platform_incidents").select("*").order("started_at", { ascending: false }).limit(50);
  return data ?? [];
});
