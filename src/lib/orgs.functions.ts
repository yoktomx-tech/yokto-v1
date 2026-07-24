import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** List all orgs the current user is a member of */
export const listMyOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("memberships")
      .select("org_role, status, joined_at, organizations!inner(id, name, slug, type, rfc, kyb_status)")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("joined_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      id: row.organizations.id,
      name: row.organizations.name,
      slug: row.organizations.slug,
      type: row.organizations.type as "individual" | "business",
      rfc: row.organizations.rfc,
      kyb_status: row.organizations.kyb_status,
      org_role: row.org_role,
    }));
  });

/** Create a new business organization owned by the current user */
export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        name: z.string().min(2, "Nombre demasiado corto").max(120),
        rfc: z.string().trim().toUpperCase().optional().nullable(),
        razon_social: z.string().optional().nullable(),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: org, error } = await supabase
      .from("organizations")
      .insert({
        name: data.name,
        type: "business",
        rfc: data.rfc || null,
        razon_social: data.razon_social || null,
        owner_user_id: userId,
      })
      .select("id, name, type")
      .single();
    if (error) throw error;

    const { error: mErr } = await supabase
      .from("memberships")
      .insert({ org_id: org.id, user_id: userId, org_role: "owner", status: "active" });
    if (mErr) throw mErr;

    return org;
  });

/** List members of an org (must be a member) */
export const listOrgMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ org_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("memberships")
      .select("user_id, org_role, status, joined_at, profiles!inner(id, email, first_name, last_name, avatar_url)")
      .eq("org_id", data.org_id)
      .order("joined_at", { ascending: true });
    if (error) throw error;
    return (rows ?? []).map((r: any) => ({
      user_id: r.user_id,
      org_role: r.org_role,
      status: r.status,
      joined_at: r.joined_at,
      email: r.profiles.email,
      first_name: r.profiles.first_name,
      last_name: r.profiles.last_name,
      avatar_url: r.profiles.avatar_url,
    }));
  });

const ORG_ROLES = ["owner", "buyer_admin", "buyer_user", "seller_admin", "seller_user", "auditor"] as const;

/** Invite a user by email (owner only, enforced by RLS) */
export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        org_id: z.string().uuid(),
        email: z.string().email().trim().toLowerCase(),
        org_role: z.enum(ORG_ROLES),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { data: inv, error } = await supabase
      .from("invitations")
      .insert({
        org_id: data.org_id,
        email: data.email,
        org_role: data.org_role,
        token,
        invited_by: userId,
      })
      .select("id, email, org_role, token, expires_at")
      .single();
    if (error) throw error;
    return inv;
  });

/** List pending invitations of an org (owner only via RLS) */
export const listOrgInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ org_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("invitations")
      .select("id, email, org_role, expires_at, accepted_at, created_at")
      .eq("org_id", data.org_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

/** Accept an invitation by token */
export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const userEmail = (claims as any)?.email as string | undefined;

    const { data: inv, error } = await supabase
      .from("invitations")
      .select("id, org_id, email, org_role, expires_at, accepted_at")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw error;
    if (!inv) throw new Error("Invitación no encontrada");
    if (inv.accepted_at) throw new Error("Invitación ya utilizada");
    if (new Date(inv.expires_at) < new Date()) throw new Error("Invitación expirada");
    if (userEmail && userEmail.toLowerCase() !== inv.email.toLowerCase()) {
      throw new Error("Esta invitación es para otro correo electrónico");
    }

    const { error: mErr } = await supabase.from("memberships").insert({
      org_id: inv.org_id,
      user_id: userId,
      org_role: inv.org_role,
      status: "active",
    });
    if (mErr && !mErr.message.includes("duplicate")) throw mErr;

    await supabase
      .from("invitations")
      .update({ accepted_at: new Date().toISOString(), accepted_by: userId })
      .eq("id", inv.id);

    return { org_id: inv.org_id };
  });

/** Remove a member (owner only) */
export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ org_id: z.string().uuid(), user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("memberships")
      .delete()
      .eq("org_id", data.org_id)
      .eq("user_id", data.user_id);
    if (error) throw error;
    return { ok: true };
  });

/** Update a member's role (owner only) */
export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        org_id: z.string().uuid(),
        user_id: z.string().uuid(),
        org_role: z.enum(ORG_ROLES),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("memberships")
      .update({ org_role: data.org_role })
      .eq("org_id", data.org_id)
      .eq("user_id", data.user_id);
    if (error) throw error;
    return { ok: true };
  });

/** Get a single org (member only) */
export const getOrganization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ org_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: org, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", data.org_id)
      .single();
    if (error) throw error;
    return org;
  });

/** List pending invitations addressed to the current user (by email) */
export const listMyPendingInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, claims } = context;
    const email = ((claims as any)?.email as string | undefined)?.toLowerCase();
    if (!email) return [];
    const { data, error } = await supabase
      .from("invitations")
      .select("id, org_id, email, org_role, token, expires_at, accepted_at, created_at, organizations!inner(name, type)")
      .eq("email", email)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      id: r.id,
      org_id: r.org_id,
      email: r.email,
      org_role: r.org_role,
      token: r.token,
      expires_at: r.expires_at,
      created_at: r.created_at,
      org_name: r.organizations?.name ?? "Organización",
      org_type: r.organizations?.type ?? "business",
    }));
  });

/** List operations created by the current user that are awaiting counterparty response */
export const listMyCreatedPendingOperations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("transactions")
      .select("id, numero, sector, status, amount_cents, currency, buyer_id, seller_id, counterparty_email, beneficiario_nombre, pagador_nombre, fecha_firma_pagador, fecha_firma_beneficiario, created_at, updated_at")
      .eq("creado_por", userId)
      .in("status", ["pending_signature", "draft"])
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return (data ?? []).map((t: any) => {
      const iAmBuyer = t.buyer_id === userId;
      const counterpartyName = iAmBuyer
        ? (t.beneficiario_nombre ?? t.counterparty_email ?? "Contraparte")
        : (t.pagador_nombre ?? t.counterparty_email ?? "Contraparte");
      const myRole: "PAGADOR" | "BENEFICIARIO" = iAmBuyer ? "PAGADOR" : "BENEFICIARIO";
      const counterpartySigned = iAmBuyer ? !!t.fecha_firma_beneficiario : !!t.fecha_firma_pagador;
      const iSigned = iAmBuyer ? !!t.fecha_firma_pagador : !!t.fecha_firma_beneficiario;
      const counterpartyHasAccount = !!(t.buyer_id && t.seller_id);
      let counterpartyStatus: "INVITADO" | "FIRMO" | "PENDIENTE_FIRMA" = "INVITADO";
      if (!counterpartyHasAccount) counterpartyStatus = "INVITADO";
      else if (counterpartySigned) counterpartyStatus = "FIRMO";
      else counterpartyStatus = "PENDIENTE_FIRMA";
      return {
        id: t.id,
        numero: t.numero,
        sector: t.sector,
        status: t.status,
        amount_cents: t.amount_cents,
        currency: t.currency ?? "MXN",
        my_role: myRole,
        i_signed: iSigned,
        counterparty_name: counterpartyName,
        counterparty_status: counterpartyStatus,
        created_at: t.created_at,
        updated_at: t.updated_at,
      };
    });
  });

