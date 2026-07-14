// TODO Stripe real: `bun add stripe` y `import Stripe from "stripe"`.
// Cliente de Stripe cargado solo en el servidor. Mientras no se pegue
// STRIPE_SECRET_KEY, `getStripe()` regresa null y el resto del stack
// cae al proveedor mock ya existente en src/lib/payments.
//
// Uso previsto (cuando se active):
//   const stripe = getStripe();
//   if (!stripe) throw new Error("Stripe no configurado");
//   await stripe.paymentIntents.create({...});

export interface StripeLike {
  // Placeholder hasta pegar el SDK real.
  readonly __placeholder: true;
}

let cached: StripeLike | null | undefined;

export function getStripe(): StripeLike | null {
  if (cached !== undefined) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    cached = null;
    return null;
  }
  // TODO: cached = new Stripe(key, { apiVersion: "2024-06-20" }) as unknown as StripeLike;
  cached = { __placeholder: true } as StripeLike;
  return cached;
}

export function assertStripe(): StripeLike {
  const s = getStripe();
  if (!s) {
    throw new Error(
      "Stripe no está configurado. Pega STRIPE_SECRET_KEY en secretos para activar el Módulo D real.",
    );
  }
  return s;
}

export function getWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET ?? null;
}
