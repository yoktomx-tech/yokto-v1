// Factory: Stripe real si STRIPE_SECRET_KEY existe, si no cae a mock.
// Server-only: se importa vía `await import("@/lib/payments")` desde server fns.
import type { PaymentProvider } from "./adapter";
import { mockProvider } from "./mock";
import { stripeProvider } from "./stripe";

export function getPaymentProvider(): PaymentProvider {
  const forced = (process.env.PAYMENT_PROVIDER ?? "").toLowerCase();
  if (forced === "mock") return mockProvider;
  if (forced === "stripe" || process.env.STRIPE_SECRET_KEY) return stripeProvider;
  return mockProvider;
}

export function isRealPaymentProvider(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && (process.env.PAYMENT_PROVIDER ?? "").toLowerCase() !== "mock";
}

export type { PaymentProvider } from "./adapter";
