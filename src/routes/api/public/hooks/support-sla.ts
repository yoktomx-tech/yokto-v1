import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Cron hook: notifica SLA próximo/vencido y escalados nuevos.
// Se llama desde pg_cron cada 5 min con apikey del proyecto.
export const Route = createFileRoute("/api/public/hooks/support-sla")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        if (!apikey || apikey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }

        const admin = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        const now = new Date();
        const warnWindow = new Date(now.getTime() + 30 * 60 * 1000); // +30 min
        const summary = { warn: 0, breach: 0, escalation: 0, emails_sent: 0, emails_failed: 0 };

        // 1) SLA próximo a vencer (aviso).
        const { data: warnTickets } = await admin
          .from("support_tickets")
          .select("id, numero, subject, module, priority, plan, user_id, assigned_to, sla_first_response_at, first_response_at")
          .is("first_response_at", null)
          .is("sla_warn_notified_at", null)
          .not("sla_first_response_at", "is", null)
          .lte("sla_first_response_at", warnWindow.toISOString())
          .gte("sla_first_response_at", now.toISOString())
          .neq("status", "closed")
          .limit(200);

        for (const t of warnTickets ?? []) {
          await notifyTicket(admin, t, "warn", summary);
          await admin.from("support_tickets").update({ sla_warn_notified_at: now.toISOString() }).eq("id", t.id);
          summary.warn++;
        }

        // 2) SLA vencido (incumplimiento).
        const { data: breachTickets } = await admin
          .from("support_tickets")
          .select("id, numero, subject, module, priority, plan, user_id, assigned_to, sla_first_response_at, first_response_at")
          .is("first_response_at", null)
          .is("sla_breach_notified_at", null)
          .not("sla_first_response_at", "is", null)
          .lt("sla_first_response_at", now.toISOString())
          .neq("status", "closed")
          .limit(200);

        for (const t of breachTickets ?? []) {
          await notifyTicket(admin, t, "breach", summary);
          await admin.from("support_tickets").update({ sla_breach_notified_at: now.toISOString() }).eq("id", t.id);
          summary.breach++;
        }

        // 3) Escalado nuevo (aviso una sola vez).
        const { data: escTickets } = await admin
          .from("support_tickets")
          .select("id, numero, subject, module, priority, plan, user_id, assigned_to, escalation, escalation_reason, escalated_at")
          .neq("escalation", "none")
          .is("escalation_notified_at", null)
          .not("escalated_at", "is", null)
          .neq("status", "closed")
          .limit(200);

        for (const t of escTickets ?? []) {
          await notifyTicket(admin, t, "escalation", summary);
          await admin.from("support_tickets").update({ escalation_notified_at: now.toISOString() }).eq("id", t.id);
          summary.escalation++;
        }

        return new Response(JSON.stringify({ ok: true, ...summary }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

type TicketLite = {
  id: string; numero: string | null; subject: string;
  module?: string | null; priority?: string | null; plan?: string | null;
  user_id: string; assigned_to?: string | null;
  escalation?: string | null; escalation_reason?: string | null;
};
type Kind = "warn" | "breach" | "escalation";
type Sum = { warn: number; breach: number; escalation: number; emails_sent: number; emails_failed: number };

async function notifyTicket(
  admin: ReturnType<typeof createClient<Database>>,
  t: TicketLite,
  kind: Kind,
  sum: Sum,
) {
  const { title, body } = renderCopy(t, kind);
  const link = `/admin/support/${t.id}`;

  // Destinatarios internos: asignado + agentes de soporte + super admins activos.
  const staffIds = new Set<string>();
  if (t.assigned_to) staffIds.add(t.assigned_to);
  const { data: staff } = await admin
    .from("internal_role_assignments")
    .select("user_id, rol")
    .eq("activo", true)
    .in("rol", ["AGENTE_SOPORTE", "CUMPLEX_SUPER_ADMIN"] as never)
    .limit(50);
  for (const s of staff ?? []) if (s.user_id) staffIds.add(s.user_id as string);

  const notifRows = Array.from(staffIds).map((uid) => ({
    user_id: uid,
    type: `support.${kind}`,
    title,
    body,
    link,
    metadata: {
      ticket_id: t.id, numero: t.numero, module: t.module,
      priority: t.priority, plan: t.plan, kind,
      escalation: t.escalation, escalation_reason: t.escalation_reason,
    },
  }));
  if (notifRows.length) await admin.from("notifications").insert(notifRows as never);

  // Emails: uno por destinatario staff (mejor esfuerzo).
  if (staffIds.size) {
    const { data: profs } = await admin.from("profiles")
      .select("id, email, first_name").in("id", Array.from(staffIds));
    for (const p of profs ?? []) {
      if (!p.email) continue;
      const ok = await sendEmail(p.email, title, renderHtml(t, kind, p.first_name as string | null));
      if (ok) sum.emails_sent++; else sum.emails_failed++;
    }
  }
}

function renderCopy(t: TicketLite, kind: Kind): { title: string; body: string } {
  const tag = `[${t.numero ?? t.id.slice(0, 8)}]`;
  if (kind === "warn") return {
    title: `${tag} SLA próximo a vencer: ${t.subject}`,
    body: `El SLA de primera respuesta vence en menos de 30 minutos. Módulo: ${t.module ?? "—"}. Prioridad: ${t.priority ?? "—"}.`,
  };
  if (kind === "breach") return {
    title: `${tag} SLA vencido: ${t.subject}`,
    body: `El ticket superó el SLA de primera respuesta y requiere atención inmediata.`,
  };
  return {
    title: `${tag} Ticket escalado (${t.escalation}): ${t.subject}`,
    body: `Motivo del escalamiento: ${t.escalation_reason ?? "—"}.`,
  };
}

function renderHtml(t: TicketLite, kind: Kind, name: string | null): string {
  const { title, body } = renderCopy(t, kind);
  const color = kind === "breach" ? "#B91C1C" : kind === "warn" ? "#B45309" : "#4338CA";
  const url = `https://secure-trust-mx.lovable.app/admin/support/${t.id}`;
  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;background:#fff;color:#18181B;padding:24px;">
    <div style="max-width:560px;margin:0 auto;">
      <div style="border-left:4px solid ${color};padding:8px 16px;margin-bottom:16px;">
        <p style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:${color};font-weight:700;">CUMPLEX · Soporte</p>
        <h1 style="margin:6px 0 0;font-size:18px;">${escape(title)}</h1>
      </div>
      <p>Hola ${escape(name ?? "equipo")},</p>
      <p>${escape(body)}</p>
      <p><a href="${url}" style="display:inline-block;background:#18181B;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;font-size:13px;">Abrir ticket</a></p>
      <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;" />
      <p style="font-size:11px;color:#6B7280;">Notificación automática de CUMPLEX. No responder a este correo.</p>
    </div>
  </body></html>`;
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return false;
  try {
    const res = await fetch("https://email.lovable.dev/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ to, subject, html }),
    });
    return res.ok;
  } catch { return false; }
}
