// Cron endpoint: procesa vencimientos de disputas.
// Reglas:
// - awaiting_response con counterparty_response_due_at vencido -> in_review + evento "auto_response_expired"
// - in_review/in_mediation con evidence_due_at vencido -> nota "evidence_window_closed" (solo se registra una vez)
// - resolution_due_at vencido sin resolver -> escalated + evento "auto_escalated"
import { createFileRoute } from "@tanstack/react-router";

type DisputeRow = {
  id: string;
  numero: string | null;
  status: string;
  transaction_id: string;
  counterparty_response_due_at: string | null;
  evidence_due_at: string | null;
  resolution_due_at: string | null;
  evidence_closed_at: string | null;
  escalated_at: string | null;
};

export const Route = createFileRoute("/api/public/hooks/dispute-deadlines")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("apikey") ?? request.headers.get("authorization")?.replace("Bearer ", "");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!authHeader || !expected || authHeader !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date().toISOString();

        const { data: rows, error } = await supabaseAdmin
          .from("disputes")
          .select(
            "id, numero, status, transaction_id, counterparty_response_due_at, evidence_due_at, resolution_due_at, evidence_closed_at, escalated_at"
          )
          .in("status", ["awaiting_response", "in_review", "in_mediation"]);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        const disputes = (rows ?? []) as DisputeRow[];
        const results: Array<{ id: string; action: string }> = [];

        for (const d of disputes) {
          // 1) Sin respuesta de contraparte -> pasa a revisión
          if (
            d.status === "awaiting_response" &&
            d.counterparty_response_due_at &&
            d.counterparty_response_due_at < now
          ) {
            await supabaseAdmin
              .from("disputes")
              .update({ status: "in_review", updated_at: now })
              .eq("id", d.id);
            await supabaseAdmin.from("transaction_events").insert({
              transaction_id: d.transaction_id,
              event_type: "dispute_auto_response_expired",
              payload: { dispute_id: d.id, numero: d.numero },
            });
            results.push({ id: d.id, action: "response_expired->in_review" });
            continue;
          }

          // 2) Ventana de evidencia cerrada (solo evento, marca timestamp)
          if (
            (d.status === "in_review" || d.status === "in_mediation") &&
            d.evidence_due_at &&
            d.evidence_due_at < now &&
            !d.evidence_closed_at
          ) {
            await supabaseAdmin
              .from("disputes")
              .update({ evidence_closed_at: now, updated_at: now })
              .eq("id", d.id);
            await supabaseAdmin.from("transaction_events").insert({
              transaction_id: d.transaction_id,
              event_type: "dispute_evidence_window_closed",
              payload: { dispute_id: d.id, numero: d.numero },
            });
            results.push({ id: d.id, action: "evidence_closed" });
          }

          // 3) Plazo de resolución vencido -> escalated
          if (
            (d.status === "in_review" || d.status === "in_mediation") &&
            d.resolution_due_at &&
            d.resolution_due_at < now &&
            !d.escalated_at
          ) {
            await supabaseAdmin
              .from("disputes")
              .update({
                status: "escalated",
                escalated_at: now,
                escalation_reason: "Plazo de resolución vencido (auto-escalado)",
                updated_at: now,
              })
              .eq("id", d.id);
            await supabaseAdmin.from("transaction_events").insert({
              transaction_id: d.transaction_id,
              event_type: "dispute_auto_escalated",
              payload: { dispute_id: d.id, numero: d.numero, reason: "resolution_deadline" },
            });
            results.push({ id: d.id, action: "auto_escalated" });
          }
        }

        return Response.json({
          ok: true,
          checked: disputes.length,
          actions: results,
          ran_at: now,
        });
      },
    },
  },
});
