import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useViewRole } from "@/hooks/use-view-role";
import { listPaymentsForCenter } from "@/lib/payments-list.functions";
import { isCurrentUserAdmin } from "@/lib/admin.functions";
import { PaymentsMetricsGrid } from "@/components/payments/payments-metrics-grid";
import { PaymentsFilters, type PaymentsFiltersState } from "@/components/payments/payments-filters";
import { PaymentsTabs } from "@/components/payments/payments-tabs";
import { PaymentsTable } from "@/components/payments/payments-table";
import { NoCustodyBanner } from "@/components/payments/ui/no-custody-banner";
import { FundingWizard } from "@/components/payments/funding-wizard";
import { ReleaseCalendar } from "@/components/payments/release-calendar";
import { matchesTab, type TabId, type PaymentRow } from "@/lib/payments-catalog";
import { PageHeader } from "@/components/page-header";
import { Banknote, RefreshCw } from "lucide-react";
import { usePaymentsRealtime } from "@/hooks/use-payments-realtime";
import { PaymentsSectionTabs, type SectionId } from "@/components/payments/payments-section-tabs";
import {
  DepositosSpeiSection, RetencionesSection, LiberacionesSection,
  DevolucionesSection, PayoutsSection, ComisionesSection,
  LedgerSection, ConciliacionSection, WebhooksSection,
} from "@/components/payments/sections";

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
  const adminFn = useServerFn(isCurrentUserAdmin);
  const [fundingOpen, setFundingOpen] = useState(false);
  const [section, setSection] = useState<SectionId>("resumen");
  usePaymentsRealtime();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["payments-center"],
    queryFn: () => listFn(),
  });

  const { data: adminInfo } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => adminFn(),
  });
  const isAdmin = adminInfo?.isAdmin ?? false;

  const openRow = (r: PaymentRow) => {
    if (!r.id.startsWith("tx-")) navigate({ to: "/payments/$id", params: { id: r.id } });
    else navigate({ to: "/transactions/$id", params: { id: r.transactionId } });
  };

  const counts = useMemo(() => ({
    depositos:    rows.filter((r) => r.status === "PENDING_FUNDING" || r.status === "PAYMENT_PROCESSING").length,
    retenciones:  rows.filter((r) => r.status === "HELD_BY_PROCESSOR" || r.status === "READY_TO_RELEASE").length,
    liberaciones: rows.filter((r) => r.status === "RELEASED" || r.status === "PARTIALLY_RELEASED" || r.status === "RELEASE_ORDERED").length,
    devoluciones: rows.filter((r) => r.status === "REFUND_REQUESTED" || r.status === "REFUNDED").length,
    conciliacion: rows.filter((r) => r.status === "RECONCILIATION_PENDING" || r.status === "FAILED").length,
  }), [rows]);

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          icon={Banknote}
          title="Centro de Pagos"
          subtitle={`Vista ${role === "buyer" ? "de comprador" : "de vendedor"} — pagos, retenciones y liberaciones procesados por la pasarela.`}
          actions={
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ["payments-center"] })}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-yo-card border border-yo-border text-yo-t1 text-sm font-medium rounded-md hover:bg-yo-hover disabled:opacity-50"
            >
              <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} /> Actualizar
            </button>
          }
        />

        <PaymentsSectionTabs active={section} onChange={setSection} isAdmin={isAdmin} counts={counts} />

        {section === "resumen" && (
          <ResumenSection
            role={role} rows={rows} isLoading={isLoading}
            onOpen={openRow}
          />
        )}
        {section === "depositos"    && <DepositosSpeiSection rows={rows} role={role} />}
        {section === "retenciones"  && <RetencionesSection rows={rows} role={role} onOpen={openRow} />}
        {section === "liberaciones" && <LiberacionesSection rows={rows} onOpen={openRow} />}
        {section === "devoluciones" && <DevolucionesSection rows={rows} onOpen={openRow} />}
        {section === "payouts"      && <PayoutsSection role={role} />}
        {section === "comisiones"   && <ComisionesSection />}
        {section === "ledger"       && <LedgerSection />}
        {section === "conciliacion" && <ConciliacionSection rows={rows} />}
        {section === "webhooks" && isAdmin && <WebhooksSection />}

        <NoCustodyBanner />
      </div>
      <FundingWizard
        open={fundingOpen}
        onClose={() => setFundingOpen(false)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["payments-center"] })}
      />
    </>
  );
}

function ResumenSection({
  role, rows, isLoading, onOpen,
}: { role: "buyer" | "seller"; rows: PaymentRow[]; isLoading: boolean; onOpen: (r: PaymentRow) => void }) {
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
    <div className="space-y-6">
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
      {isLoading ? (
        <div className="rounded-xl border border-yo-border bg-yo-card p-10 text-center text-sm text-yo-t2">
          Cargando pagos…
        </div>
      ) : (
        <PaymentsTable rows={filtered} role={role} onOpen={onOpen} />
      )}
    </div>
  );
}
