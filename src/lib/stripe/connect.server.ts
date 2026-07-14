// TODO Stripe Connect Custom Accounts (KYB + payouts CLABE MX).
// Shell — hoy delega al mock provider. Cuando se active Stripe:
//   1. Crear cuenta: stripe.accounts.create({ type: "custom", country: "MX", ... })
//   2. Adjuntar external_account (CLABE) con stripe.accounts.createExternalAccount
//   3. Recolectar TOS: stripe.accounts.update({ tos_acceptance: { date, ip } })
//   4. Requerimientos: leer account.requirements y solicitar documentos KYB
//   5. Verificar charges_enabled/payouts_enabled antes de liberar.

import type {
  ConnectedAccountInput,
  ConnectedAccountResult,
} from "@/lib/payments/adapter";
import { mockProvider } from "@/lib/payments/mock";

export async function createStripeConnectAccount(
  input: ConnectedAccountInput,
): Promise<ConnectedAccountResult> {
  // TODO reemplazar por Stripe real cuando STRIPE_SECRET_KEY exista.
  return mockProvider.createConnectedAccount(input);
}

export async function getStripeOnboardingLink(
  accountId: string,
  returnUrl: string,
): Promise<{ url: string }> {
  // TODO: stripe.accountLinks.create({ account: accountId, refresh_url, return_url, type: "account_onboarding" })
  return mockProvider.getOnboardingLink(accountId, returnUrl);
}
