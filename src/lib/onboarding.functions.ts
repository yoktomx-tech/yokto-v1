// Módulo A — Onboarding + KYC.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomInt } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateRfc } from "@/lib/validations/rfc";
import { validateCurp } from "@/lib/validations/curp";
import { validateClabe } from "@/lib/validations/clabe";

// ---------- 1. Email — check fail-fast ----------
export const checkEmailExists = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ email: z.string().email() }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // No usamos admin.listUsers (paginado, caro). Consultamos profiles por email.
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", data.email.toLowerCase())
      .maybeSingle();
    return { exists: !!existing };
  });

// ---------- 2. Validar RFC (estructura) ----------
export const validateRfcServer = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    rfc: z.string().min(12).max(13),
    expected: z.enum(["PF", "PM"]).optional(),
  }).parse(i))
  .handler(async ({ data }) => {
    const check = validateRfc(data.rfc, data.expected);
    return { ...check, activo: null as boolean | null };
  });

// ---------- 2b. Validar CURP contra Nubarium (RENAPO) ----------
function parseNubariumDate(s: string | undefined | null): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export const validateCurpNubarium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ curp: z.string().min(18).max(18) }).parse(i))
  .handler(async ({ data, context }) => {
    const local = validateCurp(data.curp);
    if (!local.valid) throw new Error(local.error ?? "CURP inválida");

    const user = process.env.NUBARIUM_USER;
    const pass = process.env.NUBARIUM_PASSWORD;
    if (!user || !pass) throw new Error("Credenciales de Nubarium no configuradas");

    const curp = data.curp.toUpperCase();
    const auth = Buffer.from(`${user}:${pass}`).toString("base64");

    let res: Response;
    try {
      res = await fetch("https://curp.nubarium.com/renapo/v3/valida_curp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${auth}`,
        },
        body: JSON.stringify({ curp }),
      });
    } catch {
      throw new Error("No se pudo contactar al servicio de validación (Nubarium)");
    }

    let payload: Record<string, unknown> = {};
    try { payload = (await res.json()) as Record<string, unknown>; } catch { /* ignore */ }

    const estatus = String(payload.estatus ?? "");
    const codigoMensaje = String(payload.codigoMensaje ?? "");

    if (estatus !== "OK") {
      if (codigoMensaje === "-1") throw new Error("Servicio de validación saturado, intenta en unos minutos");
      const msg = typeof payload.mensaje === "string" ? payload.mensaje : "CURP no válida en RENAPO";
      throw new Error(msg);
    }

    const fechaISO = parseNubariumDate(payload.fechaNacimiento as string | undefined);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("curp_verifications").insert({
      user_id: context.userId,
      curp,
      nombre: (payload.nombre as string) ?? null,
      apellido_paterno: (payload.apellidoPaterno as string) ?? null,
      apellido_materno: (payload.apellidoMaterno as string) ?? null,
      sexo: (payload.sexo as string) ?? null,
      fecha_nacimiento: fechaISO,
      pais_nacimiento: (payload.paisNacimiento as string) ?? null,
      estado_nacimiento: (payload.estadoNacimiento as string) ?? null,
      doc_probatorio: typeof payload.docProbatorio === "number" ? (payload.docProbatorio as number) : null,
      datos_doc_probatorio: (payload.datosDocProbatorio as never) ?? null,
      estatus_curp: (payload.estatusCurp as string) ?? null,
      codigo_validacion: (payload.codigoValidacion as string) ?? null,
      codigo_mensaje: codigoMensaje,
      estatus,
      raw_response: payload as never,
      provider: "nubarium",
    });

    return {
      valid: true,
      curp,
      nombre: (payload.nombre as string) ?? "",
      apellidoPaterno: (payload.apellidoPaterno as string) ?? "",
      apellidoMaterno: (payload.apellidoMaterno as string) ?? "",
      sexo: (payload.sexo as string) ?? "",
      fechaNacimiento: fechaISO,
      fechaNacimientoRaw: (payload.fechaNacimiento as string) ?? "",
      paisNacimiento: (payload.paisNacimiento as string) ?? "",
      estadoNacimiento: (payload.estadoNacimiento as string) ?? "",
      estatusCurp: (payload.estatusCurp as string) ?? "",
    };
  });

// ---------- 3. Autosave paso a paso ----------
const domicilioSchema = z.object({
  fiscal_street: z.string().min(2),
  fiscal_ext_number: z.string().min(1),
  fiscal_int_number: z.string().optional().nullable(),
  fiscal_colonia: z.string().min(2),
  fiscal_municipio: z.string().min(2),
  fiscal_estado: z.string().min(2),
  fiscal_postal_code: z.string().regex(/^\d{5}$/, "CP inválido"),
});

const step2Schema = z.object({
  step: z.literal(2),
  account_type: z.enum(["persona_fisica", "persona_moral"]),
});

const step3PfSchema = z.object({
  step: z.literal(3),
  account_type: z.literal("persona_fisica"),
  first_name: z.string().min(2),
  last_name: z.string().min(2),
  second_last_name: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(), // YYYY-MM-DD
  rfc: z.string(),
  curp: z.string(),
  regimen_fiscal: z.string().min(3),
  uso_cfdi_default: z.string().optional().nullable(),
}).merge(domicilioSchema);

const step3PmSchema = z.object({
  step: z.literal(3),
  account_type: z.literal("persona_moral"),
  legal_name: z.string().min(3),
  trade_name: z.string().optional().nullable(),
  rfc: z.string(),
  regimen_fiscal: z.string().min(3),
  uso_cfdi_default: z.string().optional().nullable(),
  incorporation_date: z.string().optional().nullable(),
  legal_rep: z.object({
    full_name: z.string().min(3),
    rfc: z.string(),
    curp: z.string(),
    role: z.string().min(2),
  }),
}).merge(domicilioSchema);

const saveStepSchema = z.union([
  step2Schema,
  step3PfSchema,
  step3PmSchema,
]);


export const saveOnboardingStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => saveStepSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.step === 2) {
      const { error } = await supabase
        .from("profiles")
        .update({ account_type: data.account_type, onboarding_step: 2 })
        .eq("id", userId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    // step 3
    const rfcCheck = validateRfc(data.rfc, data.account_type === "persona_fisica" ? "PF" : "PM");
    if (!rfcCheck.valid) throw new Error(rfcCheck.error ?? "RFC inválido");

    if (data.account_type === "persona_fisica") {
      const curpCheck = validateCurp(data.curp);
      if (!curpCheck.valid) throw new Error(curpCheck.error ?? "CURP inválida");

      const { error } = await supabase.from("profiles").update({
        account_type: "persona_fisica",
        first_name: data.first_name,
        last_name: data.last_name,
        second_last_name: data.second_last_name ?? null,
        birth_date: data.birth_date ?? null,
        rfc: data.rfc.toUpperCase(),
        curp: data.curp.toUpperCase(),
        regimen_fiscal: data.regimen_fiscal,
        uso_cfdi_default: data.uso_cfdi_default,
        fiscal_street: data.fiscal_street,
        fiscal_ext_number: data.fiscal_ext_number,
        fiscal_int_number: data.fiscal_int_number ?? null,
        fiscal_colonia: data.fiscal_colonia,
        fiscal_municipio: data.fiscal_municipio,
        fiscal_estado: data.fiscal_estado,
        fiscal_postal_code: data.fiscal_postal_code,
        onboarding_step: 3,
      }).eq("id", userId);
      if (error) throw new Error(error.message);
    } else {
      // rep legal validaciones
      const repRfc = validateRfc(data.legal_rep.rfc, "PF");
      if (!repRfc.valid) throw new Error("RFC del representante legal inválido");
      const repCurp = validateCurp(data.legal_rep.curp);
      if (!repCurp.valid) throw new Error("CURP del representante legal inválida");

      const { error } = await supabase.from("profiles").update({
        account_type: "persona_moral",
        legal_name: data.legal_name,
        trade_name: data.trade_name ?? null,
        rfc: data.rfc.toUpperCase(),
        regimen_fiscal: data.regimen_fiscal,
        uso_cfdi_default: data.uso_cfdi_default,
        incorporation_date: data.incorporation_date ?? null,
        legal_rep: {
          full_name: data.legal_rep.full_name,
          rfc: data.legal_rep.rfc.toUpperCase(),
          curp: data.legal_rep.curp.toUpperCase(),
          role: data.legal_rep.role,
        },
        fiscal_street: data.fiscal_street,
        fiscal_ext_number: data.fiscal_ext_number,
        fiscal_int_number: data.fiscal_int_number ?? null,
        fiscal_colonia: data.fiscal_colonia,
        fiscal_municipio: data.fiscal_municipio,
        fiscal_estado: data.fiscal_estado,
        fiscal_postal_code: data.fiscal_postal_code,
        onboarding_step: 3,
      }).eq("id", userId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ---------- 4. Documentos KYC ----------
const DOC_TYPES = [
  "ine_frente", "ine_reverso", "passport", "selfie_con_id",
  "acta_constitutiva", "poder_notarial", "cedula_fiscal",
  "constancia_fiscal", "proof_of_address", "other",
] as const;

export const uploadKycDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    document_type: z.enum(DOC_TYPES),
    file_base64: z.string(),
    file_name: z.string(),
    mime_type: z.string(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const bytes = Uint8Array.from(atob(data.file_base64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("Archivo demasiado grande (máx 8 MB)");

    const path = `${userId}/${data.document_type}-${Date.now()}-${data.file_name.replace(/[^\w.-]/g, "_")}`;
    const { error: upErr } = await supabase.storage
      .from("kyc-documents")
      .upload(path, bytes, { contentType: data.mime_type, upsert: true });
    if (upErr) throw new Error(upErr.message);

    const { data: row, error } = await supabase
      .from("kyc_documents")
      .insert({
        user_id: userId,
        document_type: data.document_type,
        storage_path: path,
        file_name: data.file_name,
        mime_type: data.mime_type,
        status: "pending",
      })
      .select("id, document_type, file_name, status, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listOwnKycDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("kyc_documents")
      .select("id, document_type, file_name, status, created_at, rejection_reason")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteOwnKycDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: doc } = await supabase
      .from("kyc_documents")
      .select("storage_path, status, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!doc || doc.user_id !== userId) throw new Error("Documento no encontrado");
    if (doc.status !== "pending") throw new Error("Solo se pueden eliminar documentos pendientes");
    await supabase.storage.from("kyc-documents").remove([doc.storage_path]);
    const { error } = await supabase.from("kyc_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- 5. CLABE + Penny-test (mock) ----------
export const registerClabe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ clabe: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    const check = validateClabe(data.clabe);
    if (!check.valid) throw new Error(check.error ?? "CLABE inválida");

    const { data: row, error } = await context.supabase
      .from("clabe_verifications")
      .insert({
        user_id: context.userId,
        clabe: data.clabe,
        banco: check.banco ?? null,
        nivel: "algoritmica",
        status: "verified", // validación algorítmica pasada
      })
      .select("id, clabe, banco, status, nivel")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const startPennyTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ clabe_verification_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // Mock: genera código de 4 dígitos. En producción → depósito real vía STP/Stripe/Toku.
    const code = String(randomInt(1000, 10000));
    const { error } = await context.supabase
      .from("clabe_verifications")
      .update({
        nivel: "penny_test",
        status: "verifying",
        penny_test_code: code,
        penny_test_ref: `MOCK-${Date.now()}`,
      })
      .eq("id", data.clabe_verification_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    // Devolvemos el código en el mock para poder confirmar sin banco real.
    return { ok: true, mockCode: code };
  });

export const confirmPennyTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    clabe_verification_id: z.string().uuid(),
    code: z.string().regex(/^\d{4}$/),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("clabe_verifications")
      .select("id, penny_test_code")
      .eq("id", data.clabe_verification_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row) throw new Error("Verificación no encontrada");
    if (row.penny_test_code !== data.code) throw new Error("Código incorrecto");

    const { error } = await context.supabase
      .from("clabe_verifications")
      .update({
        status: "verified",
        penny_test_confirmed_at: new Date().toISOString(),
      })
      .eq("id", data.clabe_verification_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- 6. Submit KYC ----------
export const submitKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_type, rfc, kyc_status")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) throw new Error("Perfil no encontrado");
    if (!profile.account_type || !profile.rfc) throw new Error("Datos fiscales incompletos");
    if (profile.kyc_status === "approved") return { ok: true, already: true };

    const { data: docs } = await supabase
      .from("kyc_documents")
      .select("document_type")
      .eq("user_id", userId);
    const types = new Set<string>((docs ?? []).map((d) => d.document_type as string));

    const requiredPf: string[] = ["ine_frente", "ine_reverso"];
    const requiredPm: string[] = ["acta_constitutiva", "poder_notarial", "cedula_fiscal"];
    const required = profile.account_type === "persona_fisica" ? requiredPf : requiredPm;
    const missing = required.filter((t) => !types.has(t));
    if (missing.length > 0) throw new Error(`Faltan documentos: ${missing.join(", ")}`);

    const { data: clabes } = await supabase
      .from("clabe_verifications")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "verified")
      .limit(1);
    if (!clabes || clabes.length === 0) throw new Error("Falta registrar y verificar tu CLABE");

    const { error } = await supabase
      .from("profiles")
      .update({
        kyc_status: "in_review",
        kyc_submitted_at: new Date().toISOString(),
        onboarding_step: 5,
        onboarding_completed: true,
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);

    await supabase.from("audit_log").insert({
      user_id: userId,
      entity_type: "profile",
      entity_id: userId,
      action: "kyc.submitted",
      new_data: { account_type: profile.account_type },
    });

    return { ok: true };
  });

// ---------- 7. Estado actual (para pantalla pendiente) ----------
export const getKycStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("kyc_status, kyc_submitted_at, kyc_approved_at, kyc_rejection_reason, onboarding_step, onboarding_completed, account_type")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });
