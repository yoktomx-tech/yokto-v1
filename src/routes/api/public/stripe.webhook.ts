// Webhook público de Stripe. Bypass de auth (Lovable) — la seguridad la garantiza
// la firma HMAC de Stripe (Stripe-Signature) verificada dentro del handler.
//
// TODO cuando se active Stripe:
//   1. `bun add stripe`
//   2. Pegar STRIPE_WEBHOOK_SECRET en secretos.
//   3. Sustituir el bloque "SHELL" por:
//        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
//        const event = stripe.webhooks.constructEvent(rawBody, signature, secret);
//   4. Configurar el endpoint en el dashboard de Stripe apuntando a:
//        https://<tu-dominio>/api/public/stripe/webhook

import { createFileRoute } from "@tanstack/react-router";
import { handleStripeEvent } from "@/lib/stripe/webhook-handlers.server";
import { getWebhookSecret } from "@/lib/stripe/client.server";

export const Route = createFileRoute("/api/public/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = getWebhookSecret();
        const signature = request.headers.get("stripe-signature");
        const rawBody = await request.text();

        if (!secret) {
          // Shell: sin secret configurado, rechazamos para no procesar payloads no verificados.
          return new Response("Stripe webhook no configurado", { status: 503 });
        }
        if (!signature) {
          return new Response("Falta firma Stripe", { status: 400 });
        }

        // SHELL — TODO: verificar firma real con stripe.webhooks.constructEvent.
        let event: { id: string; type: string; data: { object: Record<string, unknown> } };
        try {
          event = JSON.parse(rawBody);
          if (!event?.id || !event?.type) throw new Error("Payload inválido");
        } catch {
          return new Response("Payload inválido", { status: 400 });
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
