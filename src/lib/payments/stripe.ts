// Implementación real del PaymentProvider usando Stripe SDK.
// Solo se activa cuando STRIPE_SECRET_KEY está presente.
// Server-only: importa Stripe SDK vía client.server.ts.
import type {
  PaymentProvider,
  FundingIntentInput,
  FundingIntentResult,
  ReleaseInput,
  ReleaseResult,
  ConnectedAccountInput,
  ConnectedAccountResult,
} from "./adapter";
import { assertStripe } from "@/lib/stripe/client.server";

async function getOrCreateCustomer(email: string | null): Promise<string> {
  const stripe = assertStripe();
  if (!email) {
    const c = await stripe.customers.create({});
    return c.id;
  }
  const list = await stripe.customers.list({ email, limit: 1 });
  if (list.data[0]) return list.data[0].id;
  const c = await stripe.customers.create({ email });
  return c.id;
}

export const stripeProvider: PaymentProvider = {
  id: "stripe",

  async createFundingIntent(input: FundingIntentInput): Promise<FundingIntentResult> {
    const stripe = assertStripe();
    const customerId = await getOrCreateCustomer(input.buyerEmail);

    if (input.method === "spei") {
      const pi = await stripe.paymentIntents.create({
        amount: input.amountCents,
        currency: input.currency.toLowerCase(),
        customer: customerId,
        payment_method_types: ["customer_balance"],
        payment_method_data: { type: "customer_balance" },
        payment_method_options: {
          customer_balance: {
            funding_type: "bank_transfer",
            bank_transfer: { type: "mx_bank_transfer" },
          },
        },
        confirm: true,
        metadata: {
          yokto_transaction_id: input.transactionId,
          ...(input.metadata ?? {}),
        },
        description: `Cumplex ${input.transactionId}`,
        statement_descriptor: "Cumplex ESCROW",
      });

      const na = pi.next_action?.display_bank_transfer_instructions as
        | { financial_addresses?: Array<{ type: string; spei?: { clabe: string; bank_name?: string } }>; hosted_instructions_url?: string }
        | undefined;
      const spei = na?.financial_addresses?.find((f) => f.type === "spei")?.spei;

      return {
        provider: "stripe",
        providerRef: pi.id,
        method: "spei",
        status: "requires_payment",
        clabe: spei?.clabe,
        referenceCode: pi.id.slice(-8).toUpperCase(),
        beneficiary: "Cumplex PAGOS SEGUROS",
        bank: spei?.bank_name ?? "STP (Stripe)",
        hostedUrl: na?.hosted_instructions_url,
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      };
    }

    // Tarjeta — Checkout Session hosted
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: input.currency.toLowerCase(),
            product_data: { name: `Cumplex ${input.transactionId}` },
            unit_amount: input.amountCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        metadata: { yokto_transaction_id: input.transactionId, ...(input.metadata ?? {}) },
        statement_descriptor: "Cumplex ESCROW",
      },
      success_url: `${process.env.YOKTO_APP_URL ?? "https://yokto.mx"}/transactions/${input.transactionId}?funded=1`,
      cancel_url: `${process.env.YOKTO_APP_URL ?? "https://yokto.mx"}/transactions/${input.transactionId}`,
    });

    return {
      provider: "stripe",
      providerRef: session.id,
      method: "card",
      status: "requires_payment",
      hostedUrl: session.url ?? undefined,
      expiresAt: new Date((session.expires_at ?? Date.now() / 1000 + 86400) * 1000).toISOString(),
    };
  },

  async confirmFunding(providerRef: string) {
    const stripe = assertStripe();
    const pi = providerRef.startsWith("cs_")
      ? await stripe.checkout.sessions
          .retrieve(providerRef, { expand: ["payment_intent"] })
          .then((s) => s.payment_intent as import("stripe").Stripe.PaymentIntent | null)
      : await stripe.paymentIntents.retrieve(providerRef);

    if (!pi) return { status: "processing" as const };
    if (pi.status === "succeeded") return { status: "succeeded" as const, paidAt: new Date().toISOString() };
    if (pi.status === "canceled" || pi.status === "requires_payment_method") return { status: "failed" as const };
    return { status: "processing" as const };
  },

  async releaseToSeller(input: ReleaseInput): Promise<ReleaseResult> {
    const stripe = assertStripe();
    const netCents = input.grossCents - input.commissionCents;
    if (!input.sellerConnectedAccountId) {
      throw new Error("Beneficiario sin cuenta Stripe Connect");
    }

    const transfer = await stripe.transfers.create({
      amount: netCents,
      currency: input.currency.toLowerCase(),
      destination: input.sellerConnectedAccountId,
      transfer_group: input.transactionId,
      metadata: {
        yokto_transaction_id: input.transactionId,
        commission_cents: String(input.commissionCents),
        ...(input.metadata ?? {}),
      },
      description: `Cumplex ${input.transactionId} — liberación`,
    });

    return {
      provider: "stripe",
      providerRef: transfer.id,
      status: "paid",
      netCents,
    };
  },

  async createConnectedAccount(input: ConnectedAccountInput): Promise<ConnectedAccountResult> {
    const stripe = assertStripe();
    const account = await stripe.accounts.create({
      type: "custom",
      country: input.country ?? "MX",
      email: input.email ?? undefined,
      capabilities: {
        transfers: { requested: true },
      },
      settings: {
        payouts: { schedule: { interval: "manual" } },
      },
      metadata: { yokto_user_id: input.userId },
    });

    return {
      provider: "stripe",
      providerAccountId: account.id,
      status: "onboarding",
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    };
  },

  async getOnboardingLink(providerAccountId: string, returnUrl: string) {
    const stripe = assertStripe();
    const link = await stripe.accountLinks.create({
      account: providerAccountId,
      refresh_url: returnUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });
    return { url: link.url };
  },
};
