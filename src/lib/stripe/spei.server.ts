// TODO Stripe SPEI (customer_balance / bank_transfer MX).
// Shell — devuelve CLABE simulada. En producción:
//   const pi = await stripe.paymentIntents.create({
//     amount, currency: "mxn",
//     payment_method_types: ["customer_balance"],
//     payment_method_data: { type: "customer_balance" },
//     payment_method_options: {
//       customer_balance: {
//         funding_type: "bank_transfer",
//         bank_transfer: { type: "mx_bank_transfer" },
//       },
//     },
//     confirm: true,
//     customer: stripeCustomerId,
//   });
//   // pi.next_action.display_bank_transfer_instructions trae la CLABE + referencia.

import type { FundingIntentInput, FundingIntentResult } from "@/lib/payments/adapter";
import { mockProvider } from "@/lib/payments/mock";

export async function createSpeiIntent(
  input: FundingIntentInput,
): Promise<FundingIntentResult> {
  // TODO: reemplazar por Stripe real.
  return mockProvider.createFundingIntent({ ...input, method: "spei" });
}
