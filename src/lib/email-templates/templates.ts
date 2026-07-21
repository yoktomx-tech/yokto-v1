// Plantillas de correo YOKTO. Por ahora solo existe una plantilla: invitación
// a una organización. Cada plantilla recibe `data` tipado y devuelve
// { subject, html, text }.

export type TemplateName = "invitation-to-organization";

export type TemplateData = {
  "invitation-to-organization": {
    inviteeName?: string;
    organizationName: string;
    orgRole: string;
    acceptUrl: string;
    expiresAt?: string | null;
  };
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Propietario",
  admin: "Administrador",
  operator: "Operador",
  viewer: "Observador",
  buyer: "Comprador",
  seller: "Vendedor",
};

function esc(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInvitation(d: TemplateData["invitation-to-organization"]) {
  const roleLabel = ROLE_LABEL[d.orgRole] ?? d.orgRole;
  const expires = d.expiresAt
    ? new Date(d.expiresAt).toLocaleString("es-MX", {
        dateStyle: "long",
        timeStyle: "short",
      })
    : "48 horas";
  const subject = `Te invitaron a ${d.organizationName} en YOKTO`;
  const text = [
    `Hola ${d.inviteeName ?? ""}`.trim() + ",",
    "",
    `${d.organizationName} te invitó a colaborar en YOKTO con el rol de ${roleLabel}.`,
    "",
    "Acepta la invitación y completa tu enrolamiento:",
    d.acceptUrl,
    "",
    `Vigencia: ${expires}.`,
    "",
    "Si no reconoces esta invitación, puedes ignorar este correo.",
    "— YOKTO · Pago Seguro contra Cumplimiento",
  ].join("\n");

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="background:#8B5CF6;padding:20px 28px;color:#ffffff;font-weight:700;font-size:18px;letter-spacing:0.5px;">YOKTO</td></tr>
        <tr><td style="padding:32px 28px 8px 28px;">
          <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;color:#09090b;">Te invitaron a ${esc(d.organizationName)}</h1>
          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#3f3f46;">
            Hola ${esc(d.inviteeName ?? "")},<br/>
            <strong>${esc(d.organizationName)}</strong> te invitó a colaborar en YOKTO con el rol de <strong>${esc(roleLabel)}</strong>.
          </p>
          <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#3f3f46;">
            YOKTO es una plataforma de <em>Pago Seguro contra Cumplimiento</em>: los fondos se liberan solo cuando se verifican las condiciones acordadas entre las partes.
          </p>
          <p style="margin:0 0 28px 0;">
            <a href="${esc(d.acceptUrl)}" style="display:inline-block;background:#8B5CF6;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:15px;">Aceptar invitación</a>
          </p>
          <p style="margin:0 0 8px 0;font-size:13px;color:#71717a;">O copia y pega este enlace en tu navegador:</p>
          <p style="margin:0 0 24px 0;font-size:13px;color:#3f3f46;word-break:break-all;"><a href="${esc(d.acceptUrl)}" style="color:#8B5CF6;">${esc(d.acceptUrl)}</a></p>
          <p style="margin:0 0 24px 0;font-size:13px;color:#71717a;">Vigencia: ${esc(expires)}.</p>
        </td></tr>
        <tr><td style="padding:16px 28px 28px 28px;border-top:1px solid #e4e4e7;font-size:12px;color:#a1a1aa;">
          Si no reconoces esta invitación puedes ignorar este correo.<br/>
          © YOKTO · Pago Seguro contra Cumplimiento
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}

export function renderTemplate<T extends TemplateName>(
  name: T,
  data: TemplateData[T],
): { subject: string; html: string; text: string } {
  switch (name) {
    case "invitation-to-organization":
      return renderInvitation(data as TemplateData["invitation-to-organization"]);
    default:
      throw new Error(`Plantilla desconocida: ${String(name)}`);
  }
}
