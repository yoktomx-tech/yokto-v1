// Payment provider adapter — mock hoy, Stripe Connect mañana.
// Cualquier implementación (mock, stripe, etc.) debe cumplir este contrato.

export type PaymentMethod = "spei" | "card";

export interface FundingIntentInput {
  transactionId: string;
  amountCents: number;
  currency: string;
  method: PaymentMethod;
  buyerEmail: string | null;
  metadata?: Record<string, string>;
}

export interface FundingIntentResult {
  provider: string;
  providerRef: string;
  method: PaymentMethod;
  status: "requires_payment" | "processing" | "succeeded";
  // SPEI
  clabe?: string;
  referenceCode?: string;
  beneficiary?: string;
  bank?: string;
  // Card / hosted
  hostedUrl?: string;
  expiresAt?: string;
}

export interface ReleaseInput {
  transactionId: string;
  sellerConnectedAccountId: string | null;
  grossCents: number;
  commissionCents: number;
  currency: string;
  metadata?: Record<string, string>;
}

export interface ReleaseResult {
  provider: string;
  providerRef: string;
  status: "pending" | "processing" | "paid";
  netCents: number;
}

export interface ConnectedAccountInput {
  userId: string;
  email: string | null;
  country?: string; // "MX"
}

export interface ConnectedAccountResult {
  provider: string;
  providerAccountId: string;
  status: "pending" | "onboarding" | "verified" | "restricted";
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingUrl?: string;
}

export interface PaymentProvider {
  readonly id: string;
  createFundingIntent(input: FundingIntentInput): Promise<FundingIntentResult>;
  confirmFunding(providerRef: string): Promise<{ status: "succeeded" | "processing" | "failed"; paidAt?: string }>;
  releaseToSeller(input: ReleaseInput): Promise<ReleaseResult>;
  createConnectedAccount(input: ConnectedAccountInput): Promise<ConnectedAccountResult>;
  getOnboardingLink(providerAccountId: string, returnUrl: string): Promise<{ url: string }>;
}
