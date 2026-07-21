// Módulo: Onboarding de miembros invitados a una organización.
// Server functions públicas (con token) + privadas (owner) usadas por el flujo
// de invitación con hash único y vigencia de 48h.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateCurp } from "@/lib/validations/curp";
import { validateRfc } from "@/lib/validations/rfc";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers Nubarium (mismos endpoints usados en onboarding.functions.ts)
// ─────────────────────────────────────────────────────────────────────────────
async function nubariumRfc(rfc: string) {
  const user = process.env.NUBARIUM_USER;
  const pass = process.env.NUBARIUM_PASSWORD;
  if (!user || !pass) throw new Error("Credenciales de Nubarium no configuradas");
  const auth = Buffer.from(`${user}:${pass}`).toString("base64");
  const res = await fetch("https://sat.nubarium.com/sat/v1/obtener-razonsocial", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify({ rfc }),
  });
  let payload: Record<string, unknown> = {};
  try { payload = (await res.json()) as Record<string, unknown>; } catch { /* noop */ }
  return payload;
}

async function nubariumCurp(curp: string) {
  const user = process.env.NUBARIUM_USER;
  const pass = process.env.NUBARIUM_PASSWORD;
  if (!user || !pass) throw new Error("Credenciales de Nubarium no configuradas");
  const auth = Buffer.from(`${user}:${pass}`).toString("base64");
  const res = await fetch("https://curp.nubarium.com/renapo/v3/valida_curp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify({ curp }),
  });
  let payload: Record<string, unknown> = {};
  try { payload = (await res.json()) as Record<string, unknown>; } catch { /* noop */ }
  return payload;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) Verificar identidad de un futuro invitado por CURP o RFC (owner-side)
// ─────────────────────────────────────────────────────────────────────────────
export const validateInviteeIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ curp_or_rfc: z.string().trim().min(10).max(18).transform((v) => v.toUpperCase()) }).parse(i),
  )
  .handler(async ({ data }) => {
    const raw = data.curp_or_rfc;
    const isCurp = raw.length === 18 && validateCurp(raw).valid;
    const isRfc = (raw.length === 12 || raw.length === 13) && validateRfc(raw).valid;
    if (!isCurp && !isRfc) throw new Error("Formato inválido. Ingresa una CURP (18) o RFC (12/13) válido.");

    if (isCurp) {
      const p = await nubariumCurp(raw);
      if (String(p.estatus ?? "") !== "OK") {
        throw new Error(typeof p.mensaje === "string" ? p.mensaje : "CURP no válida en RENAPO");
      }
      const first = String(p.nombre ?? "");
      const last = String(p.apellidoPaterno ?? "");
      const second = String(p.apellidoMaterno ?? "");
      const full_name = [first, last, second].filter(Boolean).join(" ").trim();
      return {
        kind: "CURP" as const,
        curp_rfc: raw,
        full_name,
        first_name: first,
        last_name: last,
        second_last_name: second,
      };
    }
    const p = await nubariumRfc(raw);
    if (String(p.estatus ?? "") !== "OK") {
      throw new Error(typeof p.mensaje === "string" ? p.mensaje : "RFC no encontrado en el SAT");
    }
    const razonSocial = String(p.razonSocial ?? p.nombre ?? "");
    const nombres = String(p.nombres ?? p.nombre ?? "");
    const apellidoPaterno = String(p.apellidoPaterno ?? "");
    const apellidoMaterno = String(p.apellidoMaterno ?? "");
    const tipo: "PF" | "PM" = raw.length === 13 ? "PF" : "PM";
    const full_name = tipo === "PF"
      ? [nombres || razonSocial, apellidoPaterno, apellidoMaterno].filter(Boolean).join(" ").trim()
      : (razonSocial || nombres);
    return {
      kind: "RFC" as const,
      curp_rfc: raw,
      full_name,
      first_name: tipo === "PF" ? (nombres || razonSocial) : "",
      last_name: tipo === "PF" ? apellidoPaterno : "",
      second_last_name: tipo === "PF" ? apellidoMaterno : "",
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// 2) Slug único para organización (público)
// ─────────────────────────────────────────────────────────────────────────────
export function toSlug(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48) || "workspace";
}

export const checkOrgSlugAvailable = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ slug: z.string().trim().min(2).max(48) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const slug = toSlug(data.slug);
    const { data: row } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    // sugerir alternativa si ocupado
    let suggestion: string | null = null;
    if (row) {
      for (let n = 2; n < 200; n++) {
        const candidate = `${slug}-${n}`;
        const { data: r2 } = await supabaseAdmin.from("organizations").select("id").eq("slug", candidate).maybeSingle();
        if (!r2) { suggestion = candidate; break; }
      }
    }
    return { slug, available: !row, suggestion };
  });

// ─────────────────────────────────────────────────────────────────────────────
// 3) Persistir invitaciones "borrador" desde el onboarding del owner
//    (se envían por correo hasta que el owner concluye su onboarding)
// ─────────────────────────────────────────────────────────────────────────────
const ORG_ROLES = ["owner", "buyer_admin", "buyer_user", "seller_admin", "seller_user", "auditor"] as const;

export const createInvitationDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      org_id: z.string().uuid(),
      email: z.string().email().trim().toLowerCase(),
      org_role: z.enum(ORG_ROLES),
      curp_rfc: z.string().min(10).max(18).transform((v) => v.toUpperCase()),
      full_name: z.string().min(2).max(200),
      first_name: z.string().max(120).optional().nullable(),
      last_name: z.string().max(120).optional().nullable(),
      second_last_name: z.string().max(120).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const token =
      crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { data: inv, error } = await supabase
      .from("invitations")
      .insert({
        org_id: data.org_id,
        email: data.email,
        org_role: data.org_role,
        token,
        invited_by: userId,
        curp_rfc: data.curp_rfc,
        full_name: data.full_name,
        first_name: data.first_name ?? null,
        last_name: data.last_name ?? null,
        second_last_name: data.second_last_name ?? null,
        nubarium_verified: true,
      })
      .select("id, email, org_role, token, expires_at, full_name")
      .single();
    if (error) throw error;
    return inv;
  });

// ─────────────────────────────────────────────────────────────────────────────
// 4) Enviar todas las invitaciones pendientes de una org (al concluir owner)
//    Marca email_sent_at. El envío real requiere email domain configurado; en
//    ausencia solo marca la fila como "lista para enviar".
// ─────────────────────────────────────────────────────────────────────────────
export const sendPendingInvitationEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ org_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("invitations")
      .select("id, email, full_name, org_role, token, expires_at, organizations!inner(name)")
      .eq("org_id", data.org_id)
      .is("email_sent_at", null)
      .is("accepted_at", null);
    if (error) throw error;

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

    const results: Array<{ id: string; email: string; sent: boolean; reason?: string }> = [];
    for (const inv of rows ?? []) {
      const orgName = (inv as any).organizations?.name ?? "YOKTO";
      let sent = false;
      let reason: string | undefined;
      try {
        const r = await sendTemplateEmail("invitation-to-organization", inv.email, {
          templateData: {
            inviteeName: inv.full_name ?? inv.email,
            organizationName: orgName,
            orgRole: inv.org_role,
            acceptUrl: `${process.env.APP_URL ?? "https://secure-trust-mx.lovable.app"}/invitations/${inv.token}/onboarding`,
            expiresAt: inv.expires_at,
          },
          idempotencyKey: `invitation-${inv.id}`,
        });
        sent = !!r?.sent;
        if (!sent) reason = r?.reason;
      } catch (e) {
        reason = e instanceof Error ? e.message : "send_failed";
      }
      // Marcamos email_sent_at incluso si no hay dominio para no reintentar en bucle;
      // el owner puede reenviar manualmente desde Equipo.
      await supabase.from("invitations").update({ email_sent_at: new Date().toISOString() }).eq("id", inv.id);
      results.push({ id: inv.id, email: inv.email, sent, reason });
    }
    return { total: (rows ?? []).length, results };
  });

// ─────────────────────────────────────────────────────────────────────────────
// 5) PÚBLICO — Leer invitación por token (para render del flujo de invitado)
// ─────────────────────────────────────────────────────────────────────────────
export const getInvitationByToken = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error } = await supabaseAdmin
      .from("invitations")
      .select(
        "id, org_id, email, org_role, expires_at, accepted_at, full_name, first_name, last_name, second_last_name, curp_rfc",
      )
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw error;
    if (!inv) return { status: "not_found" as const };
    if (inv.accepted_at) return { status: "already_used" as const };
    if (new Date(inv.expires_at) < new Date()) return { status: "expired" as const };

    // Domicilio de la organización (heredado)
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id, name, slug, domicilio_fiscal")
      .eq("id", inv.org_id)
      .maybeSingle();

    // Domicilio del owner (fallback si la org no lo tiene)
    let ownerAddress: Record<string, string | null> | null = null;
    if (!org?.domicilio_fiscal) {
      const { data: ownerMembership } = await supabaseAdmin
        .from("memberships")
        .select("user_id")
        .eq("org_id", inv.org_id)
        .eq("org_role", "owner")
        .maybeSingle();
      if (ownerMembership?.user_id) {
        const { data: ownerProfile } = await supabaseAdmin
          .from("profiles")
          .select("fiscal_street, fiscal_ext_number, fiscal_int_number, fiscal_colonia, fiscal_postal_code, fiscal_municipio, fiscal_estado")
          .eq("id", ownerMembership.user_id)
          .maybeSingle();
        if (ownerProfile) ownerAddress = ownerProfile as never;
      }
    }

    return {
      status: "ok" as const,
      invitation: {
        id: inv.id,
        email: inv.email,
        org_role: inv.org_role,
        expires_at: inv.expires_at,
        full_name: inv.full_name,
        first_name: inv.first_name,
        last_name: inv.last_name,
        second_last_name: inv.second_last_name,
        curp_rfc: inv.curp_rfc,
      },
      organization: {
        id: org?.id,
        name: org?.name,
        slug: org?.slug,
      },
      address: (org?.domicilio_fiscal as Record<string, string | null> | null) ?? ownerAddress,
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// 6) PÚBLICO — Paso 1: crea la cuenta auth.users + pre-carga profile con domicilio
//    Devuelve el email para que el cliente inicie sesión y continúe biométrico/MFA.
// ─────────────────────────────────────────────────────────────────────────────
export const createInviteeAccount = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      token: z.string().min(10),
      password: z.string().min(10).max(200),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: inv, error } = await supabaseAdmin
      .from("invitations")
      .select("id, org_id, email, org_role, expires_at, accepted_at, full_name, first_name, last_name, second_last_name, curp_rfc")
      .eq("token", data.token).maybeSingle();
    if (error) throw error;
    if (!inv) throw new Error("Invitación no encontrada");
    if (inv.accepted_at) throw new Error("Invitación ya utilizada");
    if (new Date(inv.expires_at) < new Date()) throw new Error("Invitación expirada");

    // ¿Existe ya un usuario con este email? Si sí, evitamos duplicar y solo devolvemos email.
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
    const already = existing?.users?.find((u) => u.email?.toLowerCase() === inv.email.toLowerCase());
    if (already) {
      return { ok: true, email: inv.email, user_id: already.id, already_existed: true as const };
    }

    // Domicilio heredado (org o owner)
    const { data: org } = await supabaseAdmin
      .from("organizations").select("id, domicilio_fiscal").eq("id", inv.org_id).maybeSingle();
    let inheritedAddress: Record<string, string | null> = (org?.domicilio_fiscal as never) ?? {};
    if (!org?.domicilio_fiscal) {
      const { data: ownerMembership } = await supabaseAdmin
        .from("memberships").select("user_id").eq("org_id", inv.org_id).eq("org_role", "owner").maybeSingle();
      if (ownerMembership?.user_id) {
        const { data: op } = await supabaseAdmin
          .from("profiles")
          .select("fiscal_street, fiscal_ext_number, fiscal_int_number, fiscal_colonia, fiscal_postal_code, fiscal_municipio, fiscal_estado")
          .eq("id", ownerMembership.user_id).maybeSingle();
        inheritedAddress = (op as never) ?? {};
      }
    }

    const { data: created, error: userErr } = await supabaseAdmin.auth.admin.createUser({
      email: inv.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        first_name: inv.first_name,
        last_name: inv.last_name,
        second_last_name: inv.second_last_name,
        invited_org_id: inv.org_id,
      },
    });
    if (userErr || !created?.user) throw new Error(userErr?.message ?? "No se pudo crear la cuenta");
    const uid = created.user.id;

    const isRfc13 = inv.curp_rfc?.length === 13;
    const isCurp = inv.curp_rfc?.length === 18;
    await supabaseAdmin.from("profiles").update({
      first_name: inv.first_name ?? null,
      last_name: inv.last_name ?? null,
      second_last_name: inv.second_last_name ?? null,
      account_type: "persona_fisica",
      curp: isCurp ? inv.curp_rfc : null,
      rfc: isRfc13 ? inv.curp_rfc : null,
      fiscal_street: inheritedAddress?.fiscal_street ?? null,
      fiscal_ext_number: inheritedAddress?.fiscal_ext_number ?? null,
      fiscal_int_number: inheritedAddress?.fiscal_int_number ?? null,
      fiscal_colonia: inheritedAddress?.fiscal_colonia ?? null,
      fiscal_postal_code: inheritedAddress?.fiscal_postal_code ?? null,
      fiscal_municipio: inheritedAddress?.fiscal_municipio ?? null,
      fiscal_estado: inheritedAddress?.fiscal_estado ?? null,
      onboarding_step: 1,
    }).eq("id", uid);

    return { ok: true, email: inv.email, user_id: uid, already_existed: false as const };
  });

// ─────────────────────────────────────────────────────────────────────────────
// 7) Paso final: crea membership y marca invitación aceptada
// ─────────────────────────────────────────────────────────────────────────────
export const finalizeInviteeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      token: z.string().min(10),
      biometric_completed: z.boolean().optional().default(false),
      mfa_enrolled: z.boolean().optional().default(false),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: inv, error } = await supabaseAdmin
      .from("invitations")
      .select("id, org_id, email, org_role, expires_at, accepted_at")
      .eq("token", data.token).maybeSingle();
    if (error) throw error;
    if (!inv) throw new Error("Invitación no encontrada");
    if (inv.accepted_at) throw new Error("Invitación ya utilizada");
    if (new Date(inv.expires_at) < new Date()) throw new Error("Invitación expirada");
    const email = (claims as { email?: string })?.email?.toLowerCase();
    if (email && email !== inv.email.toLowerCase()) {
      throw new Error("La invitación fue enviada a otro correo. Inicia sesión con la cuenta correcta.");
    }

    // Membership (idempotente)
    const { data: existingM } = await supabaseAdmin
      .from("memberships").select("id").eq("org_id", inv.org_id).eq("user_id", userId).maybeSingle();
    if (!existingM) {
      await supabaseAdmin.from("memberships").insert({
        org_id: inv.org_id, user_id: userId, org_role: inv.org_role, status: "active",
      });
    }

    await supabaseAdmin.from("profiles").update({
      mfa_status: data.mfa_enrolled ? "enabled" : "not_configured",
      onboarding_completed: true,
      onboarding_step: 4,
      kyc_status: data.biometric_completed ? "in_review" : "pending",
    }).eq("id", userId);

    await supabaseAdmin.from("invitations").update({
      accepted_at: new Date().toISOString(), accepted_by: userId,
    }).eq("id", inv.id);

    return { ok: true, user_id: userId, org_id: inv.org_id };
  });

