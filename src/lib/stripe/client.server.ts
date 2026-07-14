// Stripe singleton server-side.
// Devuelve null si STRIPE_SECRET_KEY no está configurada — el stack
// hace fallback automático al proveedor mock.
import Stripe from "stripe";

let cached: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (cached !== undefined) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    cached = null;
    return null;
  }
  cached = new Stripe(key, { typescript: true });
  return cached;
}

export function assertStripe(): Stripe {
  const s = getStripe();
  if (!s) throw new Error("Stripe no configurado — pega STRIPE_SECRET_KEY en secretos.");
  return s;
}

export function getWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET ?? null;
}

export function isStripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
