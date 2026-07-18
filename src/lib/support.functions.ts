import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

type Priority = "low" | "normal" | "high" | "urgent";
type Plan = "free" | "pro" | "enterprise";

function calcPriority(input: { module?: string | null; escalation?: string | null; hasDispute?: boolean }): Priority {
  if (input.escalation && input.escalation !== "none") return "urgent";
  if (input.hasDispute) return "high";
  if (input.module === "payments" || input.module === "disputes") return "high";
  return "normal";
}

function calcSla(plan: Plan): { firstResponseHrs: number; resolutionHrs: number } {
  switch (plan) {
    case "enterprise": return { firstResponseHrs: 2, resolutionHrs: 12 };
    case "pro": return { firstResponseHrs: 6, resolutionHrs: 24 };
    default: return { firstResponseHrs: 24, resolutionHrs: 72 };
  }
}

// ============ QUICK ACCESS CONTEXT ============
export const getQuickAccessContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

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
      plan: "free" as Plan, // Placeholder: organización.plan (upgrade path)
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
  }) => z.object({
    subject: z.string().trim().min(4).max(160),
    description: z.string().trim().min(10).max(4000),
    module: z.string().max(60).nullish(),
    orgId: uuid.nullish(),
    activeView: z.enum(["buyer","seller"]).nullish(),
    relatedTransactionId: uuid.nullish(),
    relatedDisputeId: uuid.nullish(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    // Auditor cannot create tickets
    if (data.orgId) {
      const { data: mem } = await supabase.from("memberships")
        .select("org_role,status").eq("org_id", data.orgId).eq("user_id", userId).maybeSingle();
      if (mem?.org_role === "auditor") throw new Error("Los auditores no pueden abrir tickets.");
    }

    // Freeze context server-side
    const { data: rolesRow } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const { data: membership } = data.orgId ? await supabase.from("memberships")
      .select("org_role,status").eq("org_id", data.orgId).eq("user_id", userId).maybeSingle() : { data: null };
    const { data: org } = data.orgId ? await supabase.from("organizations")
      .select("id,name,type,kyb_status").eq("id", data.orgId).maybeSingle() : { data: null };

    const plan: Plan = "free"; // TODO: derive from org billing when available
    const priority = calcPriority({ module: data.module, hasDispute: !!data.relatedDisputeId });
    const sla = calcSla(plan);
    const now = new Date();
    const firstResp = new Date(now.getTime() + sla.firstResponseHrs * 3600_000);
    const resolution = new Date(now.getTime() + sla.resolutionHrs * 3600_000);

    const contextoFrozen = {
      user_roles: (rolesRow ?? []).map((r: { role: string }) => r.role),
      org_id: data.orgId ?? null,
      org_name: org?.name ?? null,
      org_type: org?.type ?? null,
      kyb_status: org?.kyb_status ?? null,
      org_role: membership?.org_role ?? null,
      active_view: data.activeView ?? null,
      plan,
      frozen_at: now.toISOString(),
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.from("support_tickets").insert({
      user_id: userId,
      org_id: data.orgId ?? null,
      subject: data.subject,
      description: data.description,
      module: data.module ?? null,
      related_transaction_id: data.relatedTransactionId ?? null,
      related_dispute_id: data.relatedDisputeId ?? null,
      status: "open",
      priority,
      plan,
      contexto_rol_congelado: contextoFrozen as never,
      sla_first_response_at: firstResp.toISOString(),
      sla_resolution_at: resolution.toISOString(),
    }).select("id, numero").single();
    if (error) throw new Error(error.message);

    return created;
  });

// ============ LIST TICKETS (own + org admin visibility via RLS) ============
export const listMyTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("support_tickets")
      .select("id, numero, subject, module, status, priority, escalation, created_at, updated_at, org_id, user_id")
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

    return { ticket, messages: messages ?? [] };
  });

export const addTicketMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ticketId: string; body: string }) =>
    z.object({ ticketId: uuid, body: z.string().trim().min(1).max(4000) }).parse(d))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { error } = await context.supabase.from("support_messages").insert({
      ticket_id: data.ticketId, author_id: userId, author_kind: "user", body: data.body, is_internal_note: false,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
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
