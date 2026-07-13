// Factory: elige el proveedor según env. Hoy siempre "mock".
// Cuando se conecte Stripe: setear PAYMENT_PROVIDER=stripe y agregar ./stripe.ts.
import type { PaymentProvider } from "./adapter";
import { mockProvider } from "./mock";

export function getPaymentProvider(): PaymentProvider {
  const which = (process.env.PAYMENT_PROVIDER ?? "mock").toLowerCase();
  switch (which) {
    // case "stripe": return stripeProvider; // TODO Sprint 5
    case "mock":
    default:
      return mockProvider;
  }
}

export type { PaymentProvider } from "./adapter";
