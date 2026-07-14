// Server functions para el wizard de transacciones (Módulo C – Fase 1-2)
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { Step1Schema, Step2Schema, Step4Schema, HitoSchema, RFC_REGEX } from "@/lib/validations/transaction";
import { calcularFee, type SectorId } from "@/lib/sectors";


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

// ─── Guardar hitos (Step 3) ─────────────────────────────────────────────────
export const saveTransactionHitos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ transaction_id: z.string().uuid(), hitos: z.array(HitoSchema).min(1) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    // Verificar ownership del borrador
    const { data: tx, error: txErr } = await context.supabase
      .from("transactions")
      .select("id, status, creado_por, amount_cents")
      .eq("id", data.transaction_id)
      .maybeSingle();
    if (txErr) throw new Error(txErr.message);
    if (!tx || tx.creado_por !== context.userId) throw new Error("Borrador no encontrado");
    if (tx.status !== "draft") throw new Error("Solo se pueden editar borradores");

    // Validar 100%
    const suma = data.hitos.reduce((s, h) => s + Number(h.monto_porcentaje), 0);
    if (Math.abs(suma - 100) > 0.01) throw new Error("La suma debe ser 100%");

    // Reemplazar hitos
    const { error: delErr } = await context.supabase
      .from("transaction_hitos")
      .delete()
      .eq("transaction_id", data.transaction_id);
    if (delErr) throw new Error(delErr.message);

    const rows = data.hitos.map((h) => ({
      transaction_id: data.transaction_id,
      orden: h.orden,
      titulo: h.titulo,
      descripcion: h.descripcion ?? null,
      monto_porcentaje: h.monto_porcentaje,
      monto_cents: Math.round((tx.amount_cents ?? 0) * (h.monto_porcentaje / 100)),
      fecha_limite: h.fecha_limite,
      tipo_verificacion: h.tipo_verificacion,
      documentos_requeridos: h.documentos_requeridos,
      evidencia_requerida: h.evidencia_requerida,
      responsable: h.responsable,
      auto_release: h.auto_release,
      estado: "pendiente" as const,
    }));

    const { error: insErr } = await context.supabase.from("transaction_hitos").insert(rows);
    if (insErr) throw new Error(insErr.message);
    return { ok: true, count: rows.length };
  });

// ─── Guardar monto y calcular comisiones (Step 4) ───────────────────────────
export const saveTransactionMonto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      transaction_id: z.string().uuid(),
      sector: Step1Schema.shape.sector,
      step4: Step4Schema,
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: tx, error: txErr } = await context.supabase
      .from("transactions")
      .select("id, status, creado_por, buyer_id")
      .eq("id", data.transaction_id)
      .maybeSingle();
    if (txErr) throw new Error(txErr.message);
    if (!tx || tx.creado_por !== context.userId) throw new Error("Borrador no encontrado");
    if (tx.status !== "draft") throw new Error("Solo se pueden editar borradores");

    // Volumen histórico del pagador (últimos 12m) para descuento
    const desde = new Date();
    desde.setMonth(desde.getMonth() - 12);
    const { data: hist } = await context.supabase
      .from("transactions")
      .select("amount_cents")
      .eq("buyer_id", tx.buyer_id)
      .in("status", ["funded", "released", "in_progress", "conditions_met"])
      .gte("created_at", desde.toISOString());
    const volumen = (hist ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0) / 100;

    const fee = calcularFee(data.sector as SectorId, data.step4.monto, volumen);
    const amount_cents = Math.round(data.step4.monto * 100);
    const comision_cents = Math.round(fee.comision_final * 100);
    const iva_comision_cents = Math.round(fee.iva_comision * 100);
    const total_a_depositar_cents = Math.round(fee.total_a_depositar * 100);

    const { error: upErr } = await context.supabase
      .from("transactions")
      .update({
        amount_cents,
        payment_method: (data.step4.metodo_pago === "TARJETA" ? "card" : "spei") as "card" | "spei",
        comision_cents,
        iva_comision_cents,
        total_a_depositar_cents,
        descuento_volumetrico: fee.descuento_aplicado,
        funding_deadline: data.step4.fecha_inicio_estimada ?? null,
        delivery_deadline: data.step4.fecha_fin_estimada ?? null,
      })
      .eq("id", data.transaction_id);
    if (upErr) throw new Error(upErr.message);

    // Recalcular monto_cents en hitos
    const { data: hitos } = await context.supabase
      .from("transaction_hitos")
      .select("id, monto_porcentaje")
      .eq("transaction_id", data.transaction_id);
    if (hitos && hitos.length) {
      await Promise.all(hitos.map((h) =>
        context.supabase.from("transaction_hitos")
          .update({ monto_cents: Math.round(amount_cents * (Number(h.monto_porcentaje) / 100)) })
          .eq("id", h.id),
      ));
    }
    return { ok: true, fee };
  });

// ─── Firmar y activar transacción (Step 5) ──────────────────────────────────
export const signAndActivateTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      transaction_id: z.string().uuid(),
      acepta_terminos: z.literal(true),
      acepta_retencion: z.literal(true),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: tx, error: txErr } = await context.supabase
      .from("transactions")
      .select("id, numero, status, buyer_id, seller_id, creado_por, fecha_firma_pagador, fecha_firma_beneficiario, counterparty_email, beneficiario_nombre, amount_cents, total_a_depositar_cents, description")
      .eq("id", data.transaction_id)
      .maybeSingle();
    if (txErr) throw new Error(txErr.message);
    if (!tx) throw new Error("Transacción no encontrada");
    if (tx.creado_por !== context.userId && tx.buyer_id !== context.userId && tx.seller_id !== context.userId) {
      throw new Error("No autorizado");
    }
    if (tx.status !== "draft" && tx.status !== "pending_signature") {
      throw new Error("Esta transacción ya no admite firmas");
    }

    // Validar hitos existen y suman 100
    const { data: hitos } = await context.supabase
      .from("transaction_hitos")
      .select("id, monto_porcentaje")
      .eq("transaction_id", data.transaction_id);
    const suma = (hitos ?? []).reduce((s, h) => s + Number(h.monto_porcentaje), 0);
    if (!hitos || hitos.length === 0 || Math.abs(suma - 100) > 0.01) {
      throw new Error("Los hitos deben estar definidos y sumar 100%");
    }
    if (!tx.amount_cents || tx.amount_cents < 10_000) {
      throw new Error("Define un monto válido en el paso 4");
    }

    const now = new Date().toISOString();
    const isBuyer = tx.buyer_id === context.userId;
    const isSeller = tx.seller_id === context.userId;

    const update: {
      fecha_firma_pagador?: string;
      fecha_firma_beneficiario?: string;
      fecha_activacion?: string;
      status?: "awaiting_funding" | "pending_signature";
    } = {};
    if (isBuyer && !tx.fecha_firma_pagador) update.fecha_firma_pagador = now;
    if (isSeller && !tx.fecha_firma_beneficiario) update.fecha_firma_beneficiario = now;

    const firmaPagador = update.fecha_firma_pagador ?? tx.fecha_firma_pagador;
    const firmaBenef = update.fecha_firma_beneficiario ?? tx.fecha_firma_beneficiario;

    // Contraparte pendiente: si el seller_id es null (fue invitación), quedamos pending_signature
    const contraparteConCuenta = Boolean(tx.buyer_id && tx.seller_id);
    if (contraparteConCuenta && firmaPagador && firmaBenef) {
      update.status = "awaiting_funding";
      update.fecha_activacion = now;
    } else {
      update.status = "pending_signature";
    }

    const nuevoStatus = update.status;

    const { error: upErr } = await context.supabase
      .from("transactions")
      .update(update)
      .eq("id", data.transaction_id);
    if (upErr) throw new Error(upErr.message);

    // Notificar a contraparte (si tiene cuenta)
    const contraparteId = isBuyer ? tx.seller_id : tx.buyer_id;
    if (contraparteId) {
      await context.supabase.from("notifications").insert({
        user_id: contraparteId,
        type: nuevoStatus === "awaiting_funding" ? "transaction_activated" : "transaction_signature_requested",
        title: nuevoStatus === "awaiting_funding"
          ? `Transacción ${tx.numero} activada`
          : `Firma pendiente: ${tx.numero}`,
        body: nuevoStatus === "awaiting_funding"
          ? "Ambas partes firmaron. La transacción está lista para fondearse."
          : "Tu contraparte firmó la transacción. Revisa y firma para activarla.",
        link: `/transactions/${tx.id}`,
      });
    }

    // Registrar evento
    await context.supabase.from("transaction_events").insert({
      transaction_id: tx.id,
      event_type: isBuyer ? "signed_by_buyer" : "signed_by_seller",
      actor_id: context.userId,
      metadata: { status: nuevoStatus },
    });

    return { ok: true, status: nuevoStatus, activated: nuevoStatus === "awaiting_funding" };
  });



