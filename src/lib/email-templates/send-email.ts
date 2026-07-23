// Cliente Resend vía connector gateway de Lovable.
// Server-only. Nunca importar desde el navegador.
//
// Uso:
//   import { sendTemplateEmail } from "@/lib/email-templates/send-email";
//   await sendTemplateEmail("invitation-to-organization", "user@mail.com", {
//     templateData: { organizationName: "ACME", orgRole: "buyer", acceptUrl: "..." },
//     idempotencyKey: `invitation-${id}`,
//   });

import { renderTemplate, type TemplateName, type TemplateData } from "./templates";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

const DEFAULT_FROM =
  process.env.RESEND_FROM ??
  "CUMPLEX <no-reply@yokto.com.mx>";

export type SendResult = { sent: boolean; reason?: string; id?: string };

export async function sendTemplateEmail<T extends TemplateName>(
  templateName: T,
  to: string,
  opts: {
    templateData: TemplateData[T];
    idempotencyKey?: string;
    from?: string;
    replyTo?: string;
  },
): Promise<SendResult> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey) return { sent: false, reason: "missing_lovable_api_key" };
  if (!resendKey) return { sent: false, reason: "missing_resend_api_key" };

  const { subject, html, text } = renderTemplate(templateName, opts.templateData);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": resendKey,
  };
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  const body: Record<string, unknown> = {
    from: opts.from ?? DEFAULT_FROM,
    to: [to],
    subject,
    html,
    text,
    tags: [{ name: "template", value: templateName }],
  };
  if (opts.replyTo) body.reply_to = opts.replyTo;

  let response: Response;
  try {
    response = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "network_error" };
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.error(`[resend] send failed [${response.status}]: ${errorBody}`);
    return {
      sent: false,
      reason: `resend_${response.status}: ${errorBody.slice(0, 240)}`,
    };
  }

  const json = (await response.json().catch(() => ({}))) as { id?: string };
  return { sent: true, id: json.id };
}
