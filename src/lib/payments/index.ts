// Factory: elige Stripe real si STRIPE_SECRET_KEY existe, si no cae a mock.
import type { PaymentProvider } from "./adapter";
import { mockProvider } from "./mock";

export function getPaymentProvider(): PaymentProvider {
  const forced = (process.env.PAYMENT_PROVIDER ?? "").toLowerCase();
  if (forced === "mock") return mockProvider;
  if (forced === "stripe" || process.env.STRIPE_SECRET_KEY) {
    // Import perezoso para no cargar el SDK de Stripe cuando no aplica.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { stripeProvider } = require("./stripe") as typeof import("./stripe");
    return stripeProvider;
  }
  return mockProvider;
}

export function isRealPaymentProvider(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && (process.env.PAYMENT_PROVIDER ?? "").toLowerCase() !== "mock";
}

export type { PaymentProvider } from "./adapter";
