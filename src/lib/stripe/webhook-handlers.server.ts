// Handlers idempotentes de eventos Stripe.
// Cada evento actualiza el estado en Supabase con service-role.
// Nunca duplica efectos: se apoya en stripe_webhook_events.processed.
type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> & { id?: string; metadata?: Record<string, string> } };
};

export async function handleStripeEvent(event: StripeEvent): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing } = await supabaseAdmin
    .from("stripe_webhook_events")
    .select("id, processed")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existing?.processed) return;

  if (!existing) {
    await supabaseAdmin.from("stripe_webhook_events").insert({
      event_id: event.id,
      event_type: event.type,
      payload: event as never,
    });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await onPaymentSucceeded(supabaseAdmin, event.data.object);
        break;
      case "payment_intent.payment_failed":
      case "payment_intent.canceled":
        await onPaymentFailed(supabaseAdmin, event.data.object);
        break;
      case "checkout.session.completed":
        await onCheckoutCompleted(supabaseAdmin, event.data.object);
        break;
      case "charge.refunded":
      case "refund.created":
        await onRefund(supabaseAdmin, event.data.object);
        break;
      case "transfer.created":
        await onTransferCreated(supabaseAdmin, event.data.object);
        break;
      case "payout.created":
      case "payout.paid":
      case "payout.failed":
        await onPayoutStatus(supabaseAdmin, event.type, event.data.object);
        break;
      case "account.updated":
        await onAccountUpdated(supabaseAdmin, event.data.object);
        break;
      default:
        // Trazabilidad: se guarda sin acción.
        break;
    }

    await supabaseAdmin
      .from("stripe_webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString(), error: null })
      .eq("event_id", event.id);
  } catch (e) {
    await supabaseAdmin
      .from("stripe_webhook_events")
      .update({ processed: false, error: (e as Error).message })
      .eq("event_id", event.id);
    throw e;
  }
}

type Admin = Awaited<ReturnType<typeof import("@/integrations/supabase/client.server").supabaseAdmin extends infer T ? () => T : never>>;
type Obj = Record<string, unknown> & { id?: string; metadata?: Record<string, string> };

async function onPaymentSucceeded(sb: Admin, obj: Obj) {
  const piId = obj.id;
  if (!piId) return;
  const txId = obj.metadata?.yokto_transaction_id;
  const paidAt = new Date().toISOString();
  await sb.from("payment_intents").update({ status: "succeeded", paid_at: paidAt }).eq("provider_ref", piId);
  if (txId) {
    await sb.from("transactions").update({ status: "funded", funded_at: paidAt }).eq("id", txId);
    await sb.from("transaction_events").insert({
      transaction_id: txId,
      event_type: "funding.succeeded",
      metadata: { provider_ref: piId, provider: "stripe" } as never,
    });
  }
}

async function onPaymentFailed(sb: Admin, obj: Obj) {
  const piId = obj.id;
  if (!piId) return;
  await sb.from("payment_intents").update({ status: "requires_payment" }).eq("provider_ref", piId);
  const txId = obj.metadata?.yokto_transaction_id;
  if (txId) {
    await sb.from("transaction_events").insert({
      transaction_id: txId,
      event_type: "funding.failed",
      metadata: { provider_ref: piId } as never,
    });
  }
}

async function onCheckoutCompleted(sb: Admin, obj: Obj) {
  const sessionId = obj.id;
  if (!sessionId) return;
  await sb.from("payment_intents").update({ status: "succeeded", paid_at: new Date().toISOString() }).eq("provider_ref", sessionId);
  const txId = obj.metadata?.yokto_transaction_id;
  if (txId) {
    await sb.from("transactions").update({ status: "funded", funded_at: new Date().toISOString() }).eq("id", txId);
  }
}

async function onRefund(sb: Admin, obj: Obj) {
  const txId = obj.metadata?.yokto_transaction_id;
  if (!txId) return;
  await sb.from("transactions").update({ status: "refunded" }).eq("id", txId);
  await sb.from("transaction_events").insert({
    transaction_id: txId,
    event_type: "funds.refunded",
    metadata: { refund_id: obj.id } as never,
  });
}

async function onTransferCreated(sb: Admin, obj: Obj) {
  const trId = obj.id;
  if (!trId) return;
  await sb.from("payouts").update({ status: "processing" }).eq("provider_ref", trId);
}

async function onPayoutStatus(sb: Admin, eventType: string, obj: Obj) {
  const poId = obj.id;
  if (!poId) return;
  const status = eventType === "payout.paid" ? "paid" : eventType === "payout.failed" ? "failed" : "processing";
  const paidAt = status === "paid" ? new Date().toISOString() : null;
  await sb
    .from("payouts")
    .update({ status, ...(paidAt ? { paid_at: paidAt } : {}) })
    .eq("provider_ref", poId);
}

async function onAccountUpdated(sb: Admin, obj: Obj) {
  const acctId = obj.id;
  if (!acctId) return;
  const capabilities = (obj as { capabilities?: { transfers?: string } }).capabilities ?? {};
  const chargesEnabled = Boolean((obj as { charges_enabled?: boolean }).charges_enabled);
  const payoutsEnabled = Boolean((obj as { payouts_enabled?: boolean }).payouts_enabled);
  const transfersActive = capabilities.transfers === "active";
  const status = chargesEnabled && payoutsEnabled && transfersActive ? "verified" : "onboarding";
  await sb
    .from("connected_accounts")
    .update({ status, charges_enabled: chargesEnabled, payouts_enabled: payoutsEnabled })
    .eq("provider_account_id", acctId);
}
