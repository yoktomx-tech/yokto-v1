// Manejadores idempotentes de eventos Stripe.
// Cada handler debe:
//   1. Verificar en stripe_webhook_events que el event_id no esté ya `processed`.
//   2. Aplicar la mutación (payment_intents / payouts / transactions / connected_accounts).
//   3. Marcar processed=true y processed_at=now.
//   4. Insertar en transaction_events + notifications según corresponda.
//
// Shell — hoy solo registra el evento. La lógica real se completa cuando se
// habilite Stripe y se pegue STRIPE_WEBHOOK_SECRET.

type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

export async function handleStripeEvent(event: StripeEvent): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Idempotencia: si ya está registrado y procesado, no re-procesar.
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
        // TODO: marcar payment_intents.status='succeeded', transactions.status='funded'
        break;
      case "payment_intent.payment_failed":
        // TODO: marcar failed, notificar al pagador
        break;
      case "charge.refunded":
        // TODO: registrar refund, transactions.status='refunded'
        break;
      case "transfer.created":
      case "payout.paid":
        // TODO: actualizar payouts.status='paid'
        break;
      case "account.updated":
        // TODO: sync connected_accounts.charges_enabled/payouts_enabled/requirements
        break;
      default:
        // Evento no manejado — se guarda por trazabilidad.
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
