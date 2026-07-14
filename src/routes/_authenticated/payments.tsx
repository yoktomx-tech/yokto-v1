import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useViewRole } from "@/hooks/use-view-role";
import { listPaymentsForCenter } from "@/lib/payments-list.functions";
import { PaymentsMetricsGrid } from "@/components/payments/payments-metrics-grid";
import { PaymentsFilters, type PaymentsFiltersState } from "@/components/payments/payments-filters";
import { PaymentsTabs } from "@/components/payments/payments-tabs";
import { PaymentsTable } from "@/components/payments/payments-table";
import { NoCustodyBanner } from "@/components/payments/ui/no-custody-banner";
import { FundingWizard } from "@/components/payments/funding-wizard";
import { ReleaseCalendar } from "@/components/payments/release-calendar";
import { matchesTab, type TabId } from "@/lib/payments-catalog";
import { PageHeader } from "@/components/page-header";
import { Banknote, Plus, Download } from "lucide-react";
import { exportPaymentsCsv } from "@/lib/payments-csv";
import { usePaymentsRealtime } from "@/hooks/use-payments-realtime";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({ meta: [{ title: "Centro de Pagos — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: PaymentsPage,
});

function withinRange(iso: string, range: string): boolean {
  if (range === "all") return true;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const d = new Date(iso).getTime();
  return Date.now() - d <= days * 86400_000;
}

function PaymentsPage() {
  const { role } = useViewRole();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listPaymentsForCenter);
  const [fundingOpen, setFundingOpen] = useState(false);
  usePaymentsRealtime();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["payments-center"],
    queryFn: () => listFn(),
  });

  const [tab, setTab] = useState<TabId>("ALL");
  const [filters, setFilters] = useState<PaymentsFiltersState>({
    q: "", provider: "all", method: "all", range: "30d",
  });

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return rows.filter((r) => {
      if (!matchesTab(r, tab)) return false;
      if (filters.provider !== "all" && (r.provider ?? "").toLowerCase() !== filters.provider) return false;
      if (filters.method !== "all" && (r.method ?? "").toLowerCase() !== filters.method) return false;
      if (!withinRange(r.updatedAt, filters.range)) return false;
      if (q) {
        const hay = [r.numero, r.title, r.reference, r.sellerName, r.buyerName]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, tab, filters]);

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          icon={Banknote}
          title="Centro de Pagos"
          subtitle={`Vista ${role === "buyer" ? "de comprador" : "de vendedor"} — pagos, retenciones y liberaciones procesados por la pasarela.`}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportPaymentsCsv(filtered)}
                disabled={filtered.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-yo-card border border-yo-border text-yo-t1 text-sm font-medium rounded-md hover:bg-yo-hover disabled:opacity-50"
              >
                <Download className="size-4" /> Exportar CSV
              </button>
              {role === "buyer" ? (
                <button
                  onClick={() => setFundingOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-yo-ac text-white text-sm font-medium rounded-md hover:bg-yo-ac-h"
                >
                  <Plus className="size-4" /> Fondear transacción
                </button>
              ) : null}
            </div>
          }
        />


        <NoCustodyBanner />

        <PaymentsMetricsGrid role={role} rows={rows} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <PaymentsFilters value={filters} onChange={setFilters} />
            <div className="mt-3">
              <PaymentsTabs role={role} rows={rows} active={tab} onChange={setTab} />
            </div>
          </div>
          <div className="lg:col-span-1">
            <ReleaseCalendar rows={rows} />
          </div>
        </div>

        <div className="space-y-3">
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-yo-border bg-yo-card p-10 text-center text-sm text-yo-t2">
            Cargando pagos…
          </div>
        ) : (
          <PaymentsTable rows={filtered} role={role} onOpen={(r) => { if (!r.id.startsWith("tx-")) navigate({ to: "/payments/$id", params: { id: r.id } }); else navigate({ to: "/transactions/$id", params: { id: r.transactionId } }); }} />
        )}
      </div>
      <FundingWizard
        open={fundingOpen}
        onClose={() => setFundingOpen(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["payments-center"] })}
      />
    </>
  );
}
