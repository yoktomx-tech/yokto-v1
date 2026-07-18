import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const INTERNAL_ROLES_SUPPORT = [
  "SOPORTE_N1", "AGENTE_ESCROW", "OFICIAL_CUMPLIMIENTO", "YOKTO_SUPER_ADMIN",
] as const;

async function requireInternalRole(userId: string, allowed: readonly string[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("internal_role_assignments")
    .select("rol, activo, expira_at").eq("user_id", userId).eq("activo", true).maybeSingle();
  if (!data) throw new Error("Sin rol interno activo.");
  if (data.expira_at && new Date(data.expira_at as string) < new Date()) throw new Error("Rol interno expirado.");
  if (!allowed.includes(data.rol as string)) throw new Error("Rol interno insuficiente.");
  return data.rol as string;
}

export type TicketAuditActionRow = {
  kind: "action";
  id: string;
  created_at: string;
  user_id: string | null;
  actor_email: string | null;
  rol_usado: string | null;
  accion: string | null;
  recurso: string | null;
  motivo: string | null;
  ip: string | null;
  user_agent: string | null;
  snapshot_antes: any;
  snapshot_despues: any;
  detalle_json: any;

};

export type TicketAuditDownloadRow = {
  kind: "download";
  id: string;
  created_at: string;
  user_id: string | null;
  actor_email: string | null;
  user_kind: string | null;
  internal_role: string | null;
  attachment_id: string;
  file_name: string | null;
  ip: string | null;
  user_agent: string | null;
};

export type TicketAuditRow = TicketAuditActionRow | TicketAuditDownloadRow;

export const adminGetTicketAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id: string;
    kinds?: Array<"action" | "download">;
    actions?: string[];
    from?: string | null;
    to?: string | null;
    search?: string | null;
  }) => z.object({
    id: uuid,
    kinds: z.array(z.enum(["action", "download"])).optional(),
    actions: z.array(z.string().min(1)).max(30).optional(),
    from: z.string().datetime().nullish(),
    to: z.string().datetime().nullish(),
    search: z.string().max(200).nullish(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const rol = await requireInternalRole(context.userId, INTERNAL_ROLES_SUPPORT);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const kinds = data.kinds && data.kinds.length ? data.kinds : ["action", "download"];
    const rows: TicketAuditRow[] = [];

    if (kinds.includes("action")) {
      let q = supabaseAdmin
        .from("internal_action_log")
        .select("id, created_at, user_id, rol_usado, recurso, accion, motivo, ip, user_agent, snapshot_antes, snapshot_despues, detalle_json")
        .eq("recurso", "soporte")
        .eq("entidad_id", data.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (data.from) q = q.gte("created_at", data.from);
      if (data.to) q = q.lte("created_at", data.to);
      if (data.actions?.length) q = q.in("accion", data.actions);
      const { data: acts, error } = await q;
      if (error) throw new Error(error.message);
      for (const a of acts ?? []) {
        rows.push({
          kind: "action",
          id: a.id, created_at: a.created_at, user_id: a.user_id,
          actor_email: null, rol_usado: a.rol_usado, accion: a.accion,
          recurso: a.recurso, motivo: a.motivo, ip: a.ip as string | null,
          user_agent: a.user_agent, snapshot_antes: a.snapshot_antes,
          snapshot_despues: a.snapshot_despues, detalle_json: a.detalle_json,
        });
      }
    }

    if (kinds.includes("download")) {
      let q = supabaseAdmin
        .from("support_attachment_downloads")
        .select("id, created_at, user_id, user_kind, internal_role, attachment_id, ip, user_agent, support_attachments!inner(file_name)")
        .eq("ticket_id", data.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (data.from) q = q.gte("created_at", data.from);
      if (data.to) q = q.lte("created_at", data.to);
      const { data: dls, error } = await q;
      if (error) throw new Error(error.message);
      for (const d0 of dls ?? []) {
        const att = (d0 as unknown as { support_attachments: { file_name: string | null } | null }).support_attachments;
        rows.push({
          kind: "download",
          id: d0.id, created_at: d0.created_at, user_id: d0.user_id,
          actor_email: null, user_kind: d0.user_kind, internal_role: d0.internal_role,
          attachment_id: d0.attachment_id, file_name: att?.file_name ?? null,
          ip: d0.ip as string | null, user_agent: d0.user_agent,
        });
      }
    }

    // Resolve actor emails (best effort) — only what we need.
    const userIds = Array.from(new Set(rows.map(r => r.user_id).filter((x): x is string => !!x)));
    if (userIds.length) {
      const { data: profs } = await supabaseAdmin.from("profiles")
        .select("id, email").in("id", userIds);
      const map = new Map((profs ?? []).map(p => [p.id, p.email as string | null]));
      for (const r of rows) if (r.user_id) r.actor_email = map.get(r.user_id) ?? null;
    }

    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));

    const filtered = data.search
      ? rows.filter(r => JSON.stringify(r).toLowerCase().includes(data.search!.toLowerCase()))
      : rows;

    const { data: ticket } = await supabaseAdmin.from("support_tickets")
      .select("id, numero, subject, status, priority, escalation, plan, created_at")
      .eq("id", data.id).maybeSingle();

    return { rol, ticket, rows: filtered };
  });
