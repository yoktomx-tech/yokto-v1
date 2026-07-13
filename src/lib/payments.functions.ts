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
