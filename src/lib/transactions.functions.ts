// Server functions para el wizard de transacciones (Módulo C – Fase 1)
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { Step1Schema, Step2Schema, RFC_REGEX } from "@/lib/validations/transaction";

// ─── Buscar contraparte por RFC o email ──────────────────────────────────────
export const searchCounterpart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ query: z.string().trim().min(3).max(255) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const q = data.query.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q);
    const isRfc = RFC_REGEX.test(q);

    let query = context.supabase
      .from("profiles")
      .select("id, first_name, last_name, legal_name, email, rfc, account_type, kyc_status")
      .neq("id", context.userId)
      .limit(5);

    if (isEmail) query = query.ilike("email", q);
    else if (isRfc) query = query.ilike("rfc", q.toUpperCase());
    else query = query.or(`email.ilike.%${q}%,rfc.ilike.%${q.toUpperCase()}%,legal_name.ilike.%${q}%`);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { results: rows ?? [] };
  });

// ─── Crear o actualizar borrador (Steps 1 & 2) ───────────────────────────────
const UpsertDraftSchema = z.object({
  transaction_id: z.string().uuid().optional().nullable(),
  step1: Step1Schema,
  step2: Step2Schema,
});

export const upsertTransactionDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UpsertDraftSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { step1, step2 } = data;

    // Resolver pagador / beneficiario según rol del usuario actual
    const soyPagador = step2.rol === "PAGADOR";
    const buyer_id = soyPagador ? context.userId : (step2.contraparte_user_id ?? null);
    const seller_id = soyPagador ? (step2.contraparte_user_id ?? null) : context.userId;

    // Si el usuario es beneficiario y la contraparte (pagador) es invitada, el pagador debe existir:
    // guardamos solo un borrador provisional donde buyer_id = context.userId como propietario temporal
    // y beneficiario_* se ignora — el spec exige pagador identificado. Aquí lo bloqueamos.
    if (!soyPagador && !step2.contraparte_user_id) {
      throw new Error("Si eres beneficiario, la contraparte (pagador) debe tener cuenta YOKTO. Pídele que se registre y vuelve a intentarlo.");
    }

    const counterpart_email = soyPagador ? (step2.contraparte_email ?? null) : null;
    const counterpart_nombre = soyPagador ? (step2.contraparte_nombre ?? null) : null;

    const payload = {
      buyer_id: buyer_id ?? context.userId,
      seller_id,
      counterparty_email: counterpart_email,
      beneficiario_nombre: counterpart_nombre,
      title: step2.descripcion.slice(0, 120),
      description: step2.descripcion,
      sector: step1.sector,
      amount_cents: 100_00, // placeholder; se define en step 4
      currency: "MXN" as const,
      payment_method: "spei" as const,
      creado_por: context.userId,
      status: "draft" as const,
    };

    if (data.transaction_id) {
      const { data: updated, error } = await context.supabase
        .from("transactions")
        .update(payload)
        .eq("id", data.transaction_id)
        .eq("status", "draft")
        .select("id, numero")
        .single();
      if (error) throw new Error(error.message);
      return updated;
    }

    const { data: created, error } = await context.supabase
      .from("transactions")
      .insert(payload)
      .select("id, numero")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

// ─── Obtener borrador propio ────────────────────────────────────────────────
export const getTransactionDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: tx, error } = await context.supabase
      .from("transactions")
      .select(
        "id, numero, sector, description, status, buyer_id, seller_id, counterparty_email, beneficiario_nombre, amount_cents, currency, payment_method, comision_cents, iva_comision_cents, total_a_depositar_cents, descuento_volumetrico, auto_release_global, repse_requerido, funding_deadline, delivery_deadline, contrato_pdf_url, created_at, updated_at, transaction_hitos(id, orden, titulo, descripcion, monto_porcentaje, monto_cents, fecha_limite, tipo_verificacion, documentos_requeridos, evidencia_requerida, responsable, auto_release, estado)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return tx;
  });

// ─── Cancelar borrador ──────────────────────────────────────────────────────
export const cancelTransactionDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("transactions")
      .delete()
      .eq("id", data.id)
      .eq("status", "draft");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
