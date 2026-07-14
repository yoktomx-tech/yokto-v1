// TODO Stripe Transfers + Payouts hacia la cuenta conectada del beneficiario.
// Shell — usa mock. En producción:
//   const transfer = await stripe.transfers.create({
//     amount: netCents,
//     currency: "mxn",
//     destination: sellerConnectedAccountId,
//     transfer_group: transactionId,
//     metadata: { transaction_id, commission_cents, iva_cents },
//   });
//   // Payout automático a CLABE se dispara según el schedule del connected account.
//   // Para devolución: stripe.refunds.create({ payment_intent }) o stripe.customerBalanceTransactions.

import type { ReleaseInput, ReleaseResult } from "@/lib/payments/adapter";
import { mockProvider } from "@/lib/payments/mock";

export async function transferToSeller(input: ReleaseInput): Promise<ReleaseResult> {
  // TODO: implementar Stripe transfers + payouts reales.
  return mockProvider.releaseToSeller(input);
}

export async function refundBuyer(_transactionId: string, _amountCents: number) {
  // TODO: stripe.refunds.create({...}) devolviendo al Customer Balance del pagador.
  return { ok: true, provider: "mock", status: "refunded" as const };
}
