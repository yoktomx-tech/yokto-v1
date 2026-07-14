// Webhook público Stripe. Verificación HMAC vía Stripe SDK.
// Si STRIPE_WEBHOOK_SECRET no está configurado, responde 503.
import { createFileRoute } from "@tanstack/react-router";
import { handleStripeEvent } from "@/lib/stripe/webhook-handlers.server";
import { getStripe, getWebhookSecret } from "@/lib/stripe/client.server";

export const Route = createFileRoute("/api/public/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = getWebhookSecret();
        const stripe = getStripe();
        const signature = request.headers.get("stripe-signature");
        const rawBody = await request.text();

        if (!secret || !stripe) {
          return new Response("Stripe webhook no configurado", { status: 503 });
        }
        if (!signature) return new Response("Falta firma Stripe", { status: 400 });

        let event: { id: string; type: string; data: { object: Record<string, unknown> } };
        try {
          event = stripe.webhooks.constructEvent(rawBody, signature, secret) as never;
        } catch (e) {
          return new Response(`Firma inválida: ${(e as Error).message}`, { status: 400 });
        }

        try {
          await handleStripeEvent(event);
          return Response.json({ received: true });
        } catch (e) {
          return new Response(`Error procesando evento: ${(e as Error).message}`, { status: 500 });
        }
      },
    },
  },
});
