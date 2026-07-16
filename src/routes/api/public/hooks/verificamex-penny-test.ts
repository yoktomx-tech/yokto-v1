// Webhook público de Verificamex Penny Test.
// URL: /api/public/hooks/verificamex-penny-test?token=<VERIFICAMEX_WEBHOOK_TOKEN>
import { createFileRoute } from "@tanstack/react-router";
import { decideBankAccountOwnership, mapProviderStatus } from "@/lib/bank-verification/decision";

export const Route = createFileRoute("/api/public/hooks/verificamex-penny-test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? "";
        const expected = process.env.VERIFICAMEX_WEBHOOK_TOKEN ?? "";
        if (!expected || token !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const penny = ((payload as { data?: unknown }).data ?? payload) as {
          uuid?: string;
          status?: string;
          name_receiver?: string | null;
          rfc_curp_receiver?: string | null;
        };
        const providerUuid = penny.uuid;
        if (!providerUuid) return new Response("Missing uuid", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: record } = await supabaseAdmin
          .from("bank_account_penny_tests")
          .select("*, bank_accounts(*)")
          .eq("provider_uuid", providerUuid)
          .maybeSingle();
        if (!record) return new Response("Penny test not found", { status: 404 });

        const events = Array.isArray(record.webhook_events) ? record.webhook_events : [];
        events.push({ received_at: new Date().toISOString(), payload: JSON.parse(JSON.stringify(payload)) });

        const providerStatus = penny.status ?? "UNKNOWN";
        if (providerStatus !== "FINISHED") {
          const mapped = mapProviderStatus(providerStatus);
          await supabaseAdmin
            .from("bank_account_penny_tests")
            .update({
              status: mapped === "ERROR" ? "ERROR" : "WAITING_RESULT",
              provider_status: providerStatus,
              webhook_events: events as never,
              raw_response: JSON.parse(JSON.stringify(payload)),
            })
            .eq("id", record.id);
          if (mapped === "ERROR") {
            await supabaseAdmin.from("bank_accounts").update({ verification_status: "ERROR" }).eq("id", record.bank_account_id);
          }
          return Response.json({ ok: true });
        }

        const acc = (record as unknown as {
          bank_accounts: { id: string; holder_expected_name: string; holder_expected_rfc: string | null; holder_expected_curp: string | null };
        }).bank_accounts;

        const decision = decideBankAccountOwnership({
          expectedName: acc.holder_expected_name,
          expectedRfc: acc.holder_expected_rfc,
          expectedCurp: acc.holder_expected_curp,
          receivedName: penny.name_receiver ?? null,
          receivedRfcCurp: penny.rfc_curp_receiver ?? null,
        });

        await supabaseAdmin
          .from("bank_account_penny_tests")
          .update({
            status: decision.decision,
            provider_status: providerStatus,
            name_receiver: penny.name_receiver ?? null,
            rfc_curp_receiver: penny.rfc_curp_receiver ?? null,
            name_similarity: decision.name_similarity,
            rfc_curp_match: decision.rfc_curp_match,
            decision_reasons: decision.reasons,
            finished_at: new Date().toISOString(),
            webhook_events: events as never,
            raw_response: JSON.parse(JSON.stringify(payload)),
          })
          .eq("id", record.id);

        await supabaseAdmin
          .from("bank_accounts")
          .update({
            verification_status: decision.decision,
            can_receive_payouts: decision.decision === "APPROVED",
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", acc.id);

        return Response.json({ ok: true, decision: decision.decision });
      },
    },
  },
});
