import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

// ---------- FUNDING ----------
export const createFundingIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { transactionId: string; method: "spei" | "card" }) =>
    z.object({ transactionId: uuid, method: z.enum(["spei", "card"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: tx, error } = await supabase
      .from("transactions")
      .select("id, buyer_id, amount_cents, currency, status")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (error || !tx) throw new Error("Transacción no encontrada");
    if (tx.buyer_id !== userId) throw new Error("Solo el comprador puede fondear");
    if (tx.status !== "awaiting_funding") throw new Error("La transacción no acepta fondeo");

    const { getPaymentProvider } = await import("@/lib/payments");
    const provider = getPaymentProvider();
    const buyerEmail = context.claims?.email ?? null;
    const intent = await provider.createFundingIntent({
      transactionId: tx.id,
      amountCents: tx.amount_cents,
      currency: tx.currency,
      method: data.method,
      buyerEmail,
    });

    const { data: pi, error: insErr } = await supabase
      .from("payment_intents")
      .insert({
        transaction_id: tx.id,
        provider: intent.provider,
        provider_ref: intent.providerRef,
        method: intent.method,
        amount_cents: tx.amount_cents,
        currency: tx.currency,
        clabe: intent.clabe ?? null,
        reference_code: intent.referenceCode ?? null,
        status: intent.status,
        expires_at: intent.expiresAt ?? null,
        metadata: {
          hosted_url: intent.hostedUrl ?? null,
          beneficiary: intent.beneficiary ?? null,
          bank: intent.bank ?? null,
        } as never,
      })
      .select("*")
      .single();
    if (insErr) throw new Error(insErr.message);

    await supabase.from("transaction_events").insert({
      transaction_id: tx.id,
      actor_id: userId,
      event_type: "funding.intent_created",
      metadata: { provider: intent.provider, method: intent.method, ref: intent.providerRef } as never,
    });

    return pi;
  });

export const simulateFundingReceived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { paymentIntentId: string }) =>
    z.object({ paymentIntentId: uuid }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pi } = await supabase
      .from("payment_intents")
      .select("id, transaction_id, provider_ref, status")
      .eq("id", data.paymentIntentId)
      .maybeSingle();
    if (!pi) throw new Error("Intento de pago no encontrado");
    if (pi.status === "succeeded") return { ok: true };

    const { getPaymentProvider } = await import("@/lib/payments");
    const confirm = await getPaymentProvider().confirmFunding(pi.provider_ref ?? "");
    if (confirm.status !== "succeeded") throw new Error("No confirmado por el proveedor");

    const paidAt = confirm.paidAt ?? new Date().toISOString();
    await supabase.from("payment_intents").update({ status: "succeeded", paid_at: paidAt }).eq("id", pi.id);
    await supabase
      .from("transactions")
      .update({ status: "funded", funded_at: paidAt })
      .eq("id", pi.transaction_id);
    await supabase.from("transaction_events").insert({
      transaction_id: pi.transaction_id,
      actor_id: userId,
      event_type: "funding.succeeded",
      metadata: { provider_ref: pi.provider_ref } as never,
    });
    return { ok: true };
  });

// ---------- RELEASE ----------
export const releaseFunds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { transactionId: string }) => z.object({ transactionId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: tx } = await supabase
      .from("transactions")
      .select("id, buyer_id, seller_id, amount_cents, currency, commission_bps, status")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (!tx) throw new Error("Transacción no encontrada");
    if (tx.buyer_id !== userId) throw new Error("Solo el comprador libera fondos");
    if (tx.status !== "conditions_met" && tx.status !== "in_progress")
      throw new Error("La transacción no está lista para liberar");

    let sellerAccount: string | null = null;
    if (tx.seller_id) {
      const { data: ca } = await supabase
        .from("connected_accounts")
        .select("provider_account_id")
        .eq("user_id", tx.seller_id)
        .maybeSingle();
      sellerAccount = ca?.provider_account_id ?? null;
    }

    const commissionCents = Math.round((tx.amount_cents * tx.commission_bps) / 10000);
    const { getPaymentProvider } = await import("@/lib/payments");
    const result = await getPaymentProvider().releaseToSeller({
      transactionId: tx.id,
      sellerConnectedAccountId: sellerAccount,
      grossCents: tx.amount_cents,
      commissionCents,
      currency: tx.currency,
    });

    await supabase.from("payouts").insert({
      transaction_id: tx.id,
      seller_id: tx.seller_id,
      provider: result.provider,
      provider_ref: result.providerRef,
      gross_cents: tx.amount_cents,
      commission_cents: commissionCents,
      net_cents: result.netCents,
      currency: tx.currency,
      status: result.status,
      paid_at: result.status === "paid" ? new Date().toISOString() : null,
    });

    await supabase
      .from("transactions")
      .update({ status: "released", released_at: new Date().toISOString() })
      .eq("id", tx.id);
    await supabase.from("transaction_events").insert({
      transaction_id: tx.id,
      actor_id: userId,
      event_type: "funds.released",
      metadata: { provider_ref: result.providerRef, net_cents: result.netCents } as never,
    });

    return { ok: true };
  });

// ---------- CONNECTED ACCOUNT (seller onboarding) ----------
export const ensureConnectedAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const { data: existing } = await supabase
      .from("connected_accounts")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return existing;

    const { getPaymentProvider } = await import("@/lib/payments");
    const acct = await getPaymentProvider().createConnectedAccount({
      userId,
      email: claims?.email ?? null,
      country: "MX",
    });
    const { data: created, error } = await supabase
      .from("connected_accounts")
      .insert({
        user_id: userId,
        provider: acct.provider,
        provider_account_id: acct.providerAccountId,
        status: acct.status,
        charges_enabled: acct.chargesEnabled,
        payouts_enabled: acct.payoutsEnabled,
        requirements: { onboarding_url: acct.onboardingUrl ?? null } as never,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const simulateAccountVerified = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("connected_accounts")
      .update({ status: "verified", charges_enabled: true, payouts_enabled: true })
      .eq("user_id", userId);
    return { ok: true };
  });

// ---------- REFUND ----------
export const refundTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { transactionId: string; reason: string; percentage?: number }) =>
    z.object({
      transactionId: uuid,
      reason: z.string().min(10),
      percentage: z.number().min(1).max(100).default(100),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: tx } = await supabase
      .from("transactions")
      .select("id, buyer_id, seller_id, amount_cents, currency, status, numero")
      .eq("id", data.transactionId)
      .maybeSingle();
    if (!tx) throw new Error("Transacción no encontrada");
    if (tx.buyer_id !== userId) throw new Error("Solo el pagador puede solicitar devolución");
    if (!["funded", "in_progress", "en_verificacion", "disputed", "conditions_met"].includes(tx.status)) {
      throw new Error("La transacción no está en un estado que permita devolución");
    }

    // Descontar hitos ya liberados
    const { data: hitosLiberados } = await supabase
      .from("transaction_hitos")
      .select("monto_cents")
      .eq("transaction_id", tx.id)
      .eq("estado", "APROBADO");
    const yaLiberado =
      hitosLiberados?.reduce((s: number, h: { monto_cents?: number | null }) => s + (h.monto_cents ?? 0), 0) ?? 0;
    const pendiente = Math.max(0, tx.amount_cents - yaLiberado);
    const montoDevolver = Math.round((pendiente * data.percentage) / 100);
    if (montoDevolver <= 0) throw new Error("No hay fondos disponibles para devolver");

    // Refund vía Stripe si está activo, si no solo registrar
    let providerRef = `mock_re_${Date.now().toString(36)}`;
    const { getStripe } = await import("@/lib/stripe/client.server");
    const stripe = getStripe();
    if (stripe) {
      const { data: pi } = await supabase
        .from("payment_intents")
        .select("provider_ref")
        .eq("transaction_id", tx.id)
        .eq("status", "succeeded")
        .maybeSingle();
      if (!pi?.provider_ref) throw new Error("No se encontró el pago original");
      const refund = await stripe.refunds.create({
        payment_intent: pi.provider_ref,
        amount: montoDevolver,
        reason: "requested_by_customer",
        metadata: {
          yokto_transaction_id: tx.id,
          yokto_motivo: data.reason,
          porcentaje: String(data.percentage),
        },
      });
      providerRef = refund.id;
    }

    await supabase.from("transactions").update({ status: "refunded" }).eq("id", tx.id);
    await supabase.from("transaction_events").insert({
      transaction_id: tx.id,
      actor_id: userId,
      event_type: "funds.refunded",
      metadata: {
        provider_ref: providerRef,
        amount_cents: montoDevolver,
        percentage: data.percentage,
        reason: data.reason,
      } as never,
    });

    return { ok: true, refundId: providerRef, amountCents: montoDevolver };
  });

// ---------- MOVIMIENTOS (historial de pagos) ----------
export const listPaymentMovements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // PIs donde soy buyer
    const { data: pis } = await supabase
      .from("payment_intents")
      .select("id, provider, provider_ref, method, amount_cents, currency, status, created_at, paid_at, transaction:transactions!inner(numero, buyer_id, seller_id)")
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`, { foreignTable: "transactions" });

    // Payouts donde soy seller
    const { data: pos } = await supabase
      .from("payouts")
      .select("id, provider, provider_ref, gross_cents, commission_cents, net_cents, currency, status, created_at, paid_at, seller_id, transaction:transactions!inner(numero, buyer_id, seller_id)");

    type Row = {
      id: string;
      created_at: string;
      kind: "deposito" | "liberacion" | "comision" | "devolucion" | "payout";
      amount_cents: number;
      currency: string;
      description: string;
      transaction_numero: string | null;
      status: string;
      provider_ref: string | null;
    };

    const movements: Row[] = [];

    for (const p of pis ?? []) {
      const tx = Array.isArray(p.transaction) ? p.transaction[0] : p.transaction;
      const numero = tx?.numero ?? null;
      const isBuyer = tx?.buyer_id === userId;
      if (!isBuyer) continue;
      movements.push({
        id: p.id,
        created_at: p.paid_at ?? p.created_at,
        kind: "deposito",
        amount_cents: p.amount_cents,
        currency: p.currency,
        description: `Depósito ${p.method.toUpperCase()}${numero ? " · " + numero : ""}`,
        transaction_numero: numero,
        status: p.status,
        provider_ref: p.provider_ref,
      });
    }

    for (const po of pos ?? []) {
      const tx = Array.isArray(po.transaction) ? po.transaction[0] : po.transaction;
      const numero = tx?.numero ?? null;
      const isBuyer = tx?.buyer_id === userId;
      const isSeller = tx?.seller_id === userId;
      if (isSeller) {
        movements.push({
          id: `${po.id}-net`,
          created_at: po.paid_at ?? po.created_at,
          kind: "liberacion",
          amount_cents: po.net_cents,
          currency: po.currency,
          description: `Liberación recibida${numero ? " · " + numero : ""}`,
          transaction_numero: numero,
          status: po.status,
          provider_ref: po.provider_ref,
        });
      }
      if (isBuyer) {
        movements.push({
          id: `${po.id}-com`,
          created_at: po.paid_at ?? po.created_at,
          kind: "comision",
          amount_cents: po.commission_cents,
          currency: po.currency,
          description: `Comisión CUMPLEX${numero ? " · " + numero : ""}`,
          transaction_numero: numero,
          status: po.status,
          provider_ref: po.provider_ref,
        });
      }
    }

    movements.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return movements;
  });

// ---------- RESUMEN FINANCIERO ----------
export const getPaymentsSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    // Retenido (fondeado, no liberado) como buyer
    const { data: retenidas } = await supabase
      .from("transactions")
      .select("amount_cents")
      .eq("buyer_id", userId)
      .in("status", ["funded", "in_progress", "en_verificacion", "conditions_met", "partial_release", "disputed"]);
    const retenidoCents = (retenidas ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0);

    // Por recibir como seller
    const { data: porRecibir } = await supabase
      .from("transactions")
      .select("amount_cents, commission_bps")
      .eq("seller_id", userId)
      .in("status", ["funded", "in_progress", "en_verificacion", "conditions_met", "partial_release"]);
    const porRecibirCents = (porRecibir ?? []).reduce((s, r) => {
      const com = Math.round((r.amount_cents * (r.commission_bps ?? 0)) / 10000);
      return s + ((r.amount_cents ?? 0) - com);
    }, 0);

    // Depositado 30d
    const { data: dep } = await supabase
      .from("payment_intents")
      .select("amount_cents, transaction:transactions!inner(buyer_id)")
      .eq("status", "succeeded")
      .gte("created_at", since);
    const depositadoMesCents = (dep ?? [])
      .filter((d) => {
        const tx = Array.isArray(d.transaction) ? d.transaction[0] : d.transaction;
        return tx?.buyer_id === userId;
      })
      .reduce((s, d) => s + (d.amount_cents ?? 0), 0);

    // Recibido 30d
    const { data: rec } = await supabase
      .from("payouts")
      .select("net_cents, seller_id")
      .eq("seller_id", userId)
      .eq("status", "paid")
      .gte("created_at", since);
    const recibidoMesCents = (rec ?? []).reduce((s, r) => s + (r.net_cents ?? 0), 0);

    return { retenidoCents, porRecibirCents, depositadoMesCents, recibidoMesCents, currency: "MXN" };
  });

// ---------- ONBOARDING LINK (Stripe Connect real) ----------
export const getOnboardingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: acct } = await supabase
      .from("connected_accounts")
      .select("provider_account_id, provider")
      .eq("user_id", userId)
      .maybeSingle();
    if (!acct?.provider_account_id) throw new Error("Sin cuenta conectada");

    const returnUrl = `${process.env.YOKTO_APP_URL ?? "https://yokto.mx"}/payments`;
    const { getPaymentProvider } = await import("@/lib/payments");
    const link = await getPaymentProvider().getOnboardingLink(acct.provider_account_id, returnUrl);
    await supabase
      .from("connected_accounts")
      .update({ requirements: { onboarding_url: link.url } as never })
      .eq("user_id", userId);
    return link;
  });

