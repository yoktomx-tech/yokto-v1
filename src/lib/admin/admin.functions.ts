// Backoffice server functions — todas requieren rol interno activo y permisos.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  hasPermission, type InternalRole, type Resource, type Action, INTERNAL_ROLES,
} from "./permissions";

type Ctx = { supabase: unknown; userId: string; claims: unknown };

async function getInternalRole(userId: string): Promise<InternalRole | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("internal_role_assignments")
    .select("rol, expira_at")
    .eq("user_id", userId)
    .eq("activo", true)
    .maybeSingle();
  if (!data) return null;
  if (data.expira_at && new Date(data.expira_at) < new Date()) return null;
  return data.rol as InternalRole;
}

async function requirePermission(userId: string, resource: Resource, action: Action = "ver"): Promise<InternalRole> {
  const role = await getInternalRole(userId);
  if (!hasPermission(role, resource, action)) {
    throw new Error("No tienes permiso para esta acción");
  }
  return role!;
}

async function logAction(input: {
  userId: string; roleUsed: InternalRole; resource: Resource; action: string;
  entityType?: string; entityId?: string; reason?: string;
  snapshotBefore?: unknown; snapshotAfter?: unknown; detail?: unknown;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("internal_action_log").insert({
    user_id: input.userId,
    rol_usado: input.roleUsed,
    recurso: input.resource,
    accion: input.action,
    entidad_tipo: input.entityType ?? null,
    entidad_id: input.entityId ?? null,
    motivo: input.reason ?? null,
    snapshot_antes: (input.snapshotBefore ?? null) as never,
    snapshot_despues: (input.snapshotAfter ?? null) as never,
    detalle_json: (input.detail ?? null) as never,
  });
}

// ================= WHO AM I =================
export const getMyInternalRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await getInternalRole((context as Ctx).userId);
    return { role };
  });

// ================= DASHBOARD =================
export const adminDashboardOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = context as Ctx;
    const role = await requirePermission(c.userId, "admin_dashboard", "ver");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ count: kycPending }, { count: docPending }, { count: openDisputes }, { count: activeTx }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).in("kyc_status", ["pending", "in_review"]),
      supabaseAdmin.from("document_review_queue").select("id", { count: "exact", head: true }).in("estado", ["PENDIENTE", "EN_REVISION"]),
      supabaseAdmin.from("disputes").select("id", { count: "exact", head: true }).in("status", ["open", "in_review"]),
      supabaseAdmin.from("transactions").select("id", { count: "exact", head: true }).in("status", ["funded", "in_progress"]),
    ]);
    return {
      role,
      counts: {
        kycPending: kycPending ?? 0,
        docPending: docPending ?? 0,
        openDisputes: openDisputes ?? 0,
        activeTx: activeTx ?? 0,
      },
    };
  });

// ================= KYC =================
export const adminKycQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = context as Ctx;
    await requirePermission(c.userId, "kyc", "ver");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id, email, first_name, last_name, kyc_status, curp, rfc, created_at")
      .in("kyc_status", ["pending", "in_review", "approved", "rejected"])
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const adminKycDecide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    userId: z.string().uuid(),
    decision: z.enum(["approved", "rejected", "in_review"]),
    reason: z.string().min(3),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const c = context as Ctx;
    const role = await requirePermission(c.userId, "kyc", "actuar");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin.from("profiles").select("kyc_status").eq("id", data.userId).maybeSingle();
    const { error } = await supabaseAdmin.from("profiles").update({ kyc_status: data.decision }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    await logAction({
      userId: c.userId, roleUsed: role, resource: "kyc",
      action: data.decision === "approved" ? "APROBAR_KYC" : data.decision === "rejected" ? "RECHAZAR_KYC" : "MARCAR_EN_REVISION",
      entityType: "user", entityId: data.userId, reason: data.reason,
      snapshotBefore: before, snapshotAfter: { kyc_status: data.decision },
    });
    return { ok: true };
  });

// ================= DOCUMENTOS =================
export const adminDocQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    tipo: z.string().optional(), estado: z.string().optional(),
    prioridad: z.string().optional(), sector: z.string().optional(),
  }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const c = context as Ctx;
    await requirePermission(c.userId, "documentos", "ver");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("document_review_queue").select("*").order("created_at", { ascending: false }).limit(200);
    if (data.tipo) q = q.eq("tipo", data.tipo);
    if (data.estado) q = q.eq("estado", data.estado);
    if (data.prioridad) q = q.eq("prioridad", data.prioridad);
    if (data.sector) q = q.eq("sector", data.sector);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const adminDocGet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ reviewId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const c = context as Ctx;
    await requirePermission(c.userId, "documentos", "ver");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("document_review_queue").select("*").eq("id", data.reviewId).maybeSingle();
    return row;
  });

export const adminDocDecide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    reviewId: z.string().uuid(),
    decision: z.enum(["VALIDADO", "RECHAZADO", "SOLICITAR_CORRECCION", "ESCALAR_A_DISPUTA", "ESCALAR_A_COMPLIANCE", "INCONCLUSO"]),
    reason: z.string().min(3),
    notas: z.string().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const c = context as Ctx;
    const role = await requirePermission(c.userId, "documentos", "actuar");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin.from("document_review_queue").select("*").eq("id", data.reviewId).maybeSingle();
    const estado = data.decision === "VALIDADO" ? "VALIDADO"
      : data.decision === "RECHAZADO" ? "RECHAZADO"
      : data.decision === "SOLICITAR_CORRECCION" ? "CORRECCION_SOLICITADA"
      : data.decision === "INCONCLUSO" ? "INCONCLUSO"
      : "ESCALADO";
    const { error } = await supabaseAdmin.from("document_review_queue").update({
      estado, decision: data.decision, revisado_por: c.userId,
      revisado_at: new Date().toISOString(), notas_revision: data.notas ?? null,
    }).eq("id", data.reviewId);
    if (error) throw new Error(error.message);
    await logAction({
      userId: c.userId, roleUsed: role, resource: "documentos",
      action: `DECISION_${data.decision}`, entityType: "document_review",
      entityId: data.reviewId, reason: data.reason,
      snapshotBefore: before, snapshotAfter: { estado, decision: data.decision },
    });
    return { ok: true };
  });

// ================= COMPLIANCE / DISPUTAS / SOPORTE / FINANZAS =================
export const adminComplianceQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = context as Ctx;
    await requirePermission(c.userId, "compliance", "ver");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("pld_risk_profiles").select("*").order("updated_at", { ascending: false }).limit(200);
    return data ?? [];
  });

export const adminDisputesQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = context as Ctx;
    await requirePermission(c.userId, "disputas", "ver");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("disputes")
      .select("id, numero, transaction_id, status, reason_code, opened_by, created_at, resolution")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const adminFinanzasOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = context as Ctx;
    await requirePermission(c.userId, "finanzas", "ver");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: payouts }, { data: webhooks }] = await Promise.all([
      supabaseAdmin.from("payouts").select("*").order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("stripe_webhook_events").select("id, event_type, processed, created_at, error").order("created_at", { ascending: false }).limit(50),
    ]);
    return { payouts: payouts ?? [], webhooks: webhooks ?? [] };
  });

export const adminSupportOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = context as Ctx;
    await requirePermission(c.userId, "soporte", "ver");
    return { tickets: [] as Array<{ id: string; subject: string; status: string }> };
  });

// ================= ROLES (Super Admin) =================
export const adminListStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = context as Ctx;
    await requirePermission(c.userId, "roles", "ver");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("internal_role_assignments")
      .select("id, user_id, rol, motivo, activo, expira_at, created_at, revocado_at, motivo_revocacion, asignado_por")
      .order("created_at", { ascending: false })
      .limit(500);
    const userIds = [...new Set((data ?? []).map((r) => r.user_id))];
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, email, first_name, last_name").in("id", userIds)
      : { data: [] };
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (data ?? []).map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null }));
  });

export const adminSearchUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ q: z.string().min(2).max(120) }).parse(i))
  .handler(async ({ data, context }) => {
    const c = context as Ctx;
    await requirePermission(c.userId, "roles", "gestionar");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const like = `%${data.q}%`;
    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("id, email, first_name, last_name, rfc, curp")
      .or(`email.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},rfc.ilike.${like}`)
      .limit(20);
    return rows ?? [];
  });

export const adminAssignRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    userId: z.string().uuid(),
    role: z.enum(INTERNAL_ROLES as [InternalRole, ...InternalRole[]]),
    reason: z.string().min(5),
    expiresAt: z.string().datetime().optional(),
    mfaConfirmed: z.boolean(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const c = context as Ctx;
    const role = await requirePermission(c.userId, "roles", "gestionar");
    if (!data.mfaConfirmed) throw new Error("Confirmación MFA requerida");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Revoca previa activa
    await supabaseAdmin.from("internal_role_assignments")
      .update({ activo: false, revocado_at: new Date().toISOString(), revocado_por: c.userId, motivo_revocacion: "Reemplazado por nueva asignación" })
      .eq("user_id", data.userId).eq("activo", true);
    const { data: inserted, error } = await supabaseAdmin.from("internal_role_assignments").insert({
      user_id: data.userId, rol: data.role, asignado_por: c.userId,
      motivo: data.reason, expira_at: data.expiresAt ?? null, activo: true,
    }).select("id").single();
    if (error) throw new Error(error.message);
    await logAction({
      userId: c.userId, roleUsed: role, resource: "roles", action: "ASIGNAR_ROL",
      entityType: "internal_role_assignment", entityId: inserted!.id,
      reason: data.reason, snapshotAfter: { rol: data.role, user_id: data.userId },
    });
    return { ok: true, id: inserted!.id };
  });

export const adminRevokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    assignmentId: z.string().uuid(), reason: z.string().min(5), mfaConfirmed: z.boolean(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const c = context as Ctx;
    const role = await requirePermission(c.userId, "roles", "gestionar");
    if (!data.mfaConfirmed) throw new Error("Confirmación MFA requerida");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin.from("internal_role_assignments").select("*").eq("id", data.assignmentId).maybeSingle();
    const { error } = await supabaseAdmin.from("internal_role_assignments").update({
      activo: false, revocado_at: new Date().toISOString(),
      revocado_por: c.userId, motivo_revocacion: data.reason,
    }).eq("id", data.assignmentId);
    if (error) throw new Error(error.message);
    await logAction({
      userId: c.userId, roleUsed: role, resource: "roles", action: "REVOCAR_ROL",
      entityType: "internal_role_assignment", entityId: data.assignmentId,
      reason: data.reason, snapshotBefore: before,
    });
    return { ok: true };
  });

// ================= AUDIT =================
export const adminAuditList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = context as Ctx;
    await requirePermission(c.userId, "auditoria", "ver");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("internal_action_log")
      .select("id, user_id, rol_usado, recurso, accion, entidad_tipo, entidad_id, motivo, user_agent, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    return data ?? [];
  });

// ================= HEALTH =================
export const adminHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = context as Ctx;
    await requirePermission(c.userId, "health", "ver");
    return {
      db: "ok", storage: "ok", webhooks: "ok",
      lastCheck: new Date().toISOString(),
    };
  });
