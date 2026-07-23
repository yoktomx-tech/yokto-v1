import type {
  PaymentProvider,
  FundingIntentInput,
  FundingIntentResult,
  ReleaseInput,
  ReleaseResult,
  ConnectedAccountInput,
  ConnectedAccountResult,
} from "./adapter";

function rand(n: number) {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10).toString();
  return s;
}

// CLABE ficticia (18 dígitos, prefijo CUMPLEX 646180 = STP)
function fakeClabe() {
  return `646180${rand(12)}`;
}

export const mockProvider: PaymentProvider = {
  id: "mock",

  async createFundingIntent(input: FundingIntentInput): Promise<FundingIntentResult> {
    const ref = `mock_pi_${Date.now().toString(36)}${rand(4)}`;
    const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    if (input.method === "spei") {
      return {
        provider: "mock",
        providerRef: ref,
        method: "spei",
        status: "requires_payment",
        clabe: fakeClabe(),
        referenceCode: `YKT${rand(8)}`,
        beneficiary: "CUMPLEX ESCROW SIMULADO",
        bank: "STP (Sandbox)",
        expiresAt,
      };
    }
    return {
      provider: "mock",
      providerRef: ref,
      method: "card",
      status: "requires_payment",
      hostedUrl: `about:blank#mock-checkout-${ref}`,
      expiresAt,
    };
  },

  async confirmFunding(_providerRef: string) {
    return { status: "succeeded" as const, paidAt: new Date().toISOString() };
  },

  async releaseToSeller(input: ReleaseInput): Promise<ReleaseResult> {
    return {
      provider: "mock",
      providerRef: `mock_po_${Date.now().toString(36)}${rand(4)}`,
      status: "paid",
      netCents: input.grossCents - input.commissionCents,
    };
  },

  async createConnectedAccount(input: ConnectedAccountInput): Promise<ConnectedAccountResult> {
    return {
      provider: "mock",
      providerAccountId: `mock_acct_${rand(10)}`,
      status: "onboarding",
      chargesEnabled: false,
      payoutsEnabled: false,
      onboardingUrl: `about:blank#mock-onboarding-${input.userId}`,
    };
  },

  async getOnboardingLink(providerAccountId: string, returnUrl: string) {
    return { url: `about:blank#mock-onboarding-${providerAccountId}?return=${encodeURIComponent(returnUrl)}` };
  },
};
