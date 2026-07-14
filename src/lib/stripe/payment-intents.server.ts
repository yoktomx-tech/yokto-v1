// TODO Stripe PaymentIntents (tarjeta) — retención de fondos en Customer Balance.
// Shell — delega al mock provider mientras no haya STRIPE_SECRET_KEY.
//
// Flujo previsto:
//   const pi = await stripe.paymentIntents.create({
//     amount: totalCents, currency: "mxn",
//     capture_method: "automatic",
//     on_behalf_of: sellerAccountId, // Connect
//     transfer_group: transactionId,
//     metadata: { transaction_id, yokto_ref },
//   });
//   // Guardar pi.client_secret para el cliente y confirmar en el hook 'payment_intent.succeeded'.

import type { FundingIntentInput, FundingIntentResult } from "@/lib/payments/adapter";
import { mockProvider } from "@/lib/payments/mock";

export async function createStripePaymentIntent(
  input: FundingIntentInput,
): Promise<FundingIntentResult> {
  // TODO: implementar con Stripe real.
  return mockProvider.createFundingIntent(input);
}

export async function confirmStripePaymentIntent(providerRef: string) {
  // TODO: stripe.paymentIntents.retrieve(providerRef) y mapear status.
  return mockProvider.confirmFunding(providerRef);
}
