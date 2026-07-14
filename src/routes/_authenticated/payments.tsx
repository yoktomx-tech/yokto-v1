import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useViewRole } from "@/hooks/use-view-role";
import { listPaymentsForCenter } from "@/lib/payments-list.functions";
import { PaymentsMetricsGrid } from "@/components/payments/payments-metrics-grid";
import { PaymentsFilters, type PaymentsFiltersState } from "@/components/payments/payments-filters";
import { PaymentsTabs } from "@/components/payments/payments-tabs";
import { PaymentsTable } from "@/components/payments/payments-table";
import { NoCustodyBanner } from "@/components/payments/ui/no-custody-banner";
import { matchesTab, type TabId } from "@/lib/payments-catalog";
import { PageHeader } from "@/components/page-header";
import { Banknote } from "lucide-react";

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
  const listFn = useServerFn(listPaymentsForCenter);

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
      <div className="mx-auto max-w-[1400px] p-6 space-y-6">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-yo-t1">Centro de Pagos</h1>
            <p className="text-sm text-yo-t2 mt-1">
              Vista {role === "buyer" ? "de comprador" : "de vendedor"} — pagos, retenciones y liberaciones procesados por la pasarela.
            </p>
          </div>
        </header>

        <NoCustodyBanner />

        <PaymentsMetricsGrid role={role} rows={rows} />

        <div className="space-y-3">
          <PaymentsFilters value={filters} onChange={setFilters} />
          <PaymentsTabs role={role} rows={rows} active={tab} onChange={setTab} />
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-yo-border bg-yo-card p-10 text-center text-sm text-yo-t2">
            Cargando pagos…
          </div>
        ) : (
          <PaymentsTable rows={filtered} role={role} />
        )}
      </div>
    </>
  );
}
