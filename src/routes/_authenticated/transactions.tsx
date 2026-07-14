import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, LayoutGrid, List as ListIcon, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useViewRole } from "@/hooks/use-view-role";
import { toUiStatus, type UiStatus, type SectorUiId } from "@/lib/tx-catalog";
import { TransactionsMetricsGrid, type TxMetricsData } from "@/components/tx/transactions-metrics-grid";
import { TransactionsFilters, type TxFiltersState } from "@/components/tx/transactions-filters";
import { TransactionsTabs, getTabs, countByTab, type TabId } from "@/components/tx/transactions-tabs";
import { TransactionsTable, type TxRow } from "@/components/tx/transactions-table";
import { TransactionCardMobile } from "@/components/tx/transaction-card-mobile";
import { EmptyState } from "@/components/tx/ui";

type SearchParams = {
  tab?: TabId;
  q?: string;
  status?: UiStatus | "ALL";
  sector?: SectorUiId | "ALL";
  date?: TxFiltersState["dateRange"];
  view?: "table" | "cards";
};

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({ meta: [{ title: "Transacciones — YOKTO" }, { name: "robots", content: "noindex" }] }),
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    tab: (s.tab as TabId) || undefined,
    q: typeof s.q === "string" ? s.q : undefined,
    status: (s.status as SearchParams["status"]) || undefined,
    sector: (s.sector as SearchParams["sector"]) || undefined,
    date: (s.date as SearchParams["date"]) || undefined,
    view: (s.view as SearchParams["view"]) || undefined,
  }),
  component: TransactionsList,
});

type MilestoneRow = { transaction_id: string; estado: string };

function nextActionFor(status: string, role: "buyer" | "seller"): TxRow["next_action"] {
  const ui = toUiStatus(status);
  if (role === "buyer") {
    if (ui === "PENDING_FUNDING") return { label: "Fondear ahora", tone: "warn" };
    if (ui === "READY_FOR_APPROVAL") return { label: "Aprobar hito", tone: "warn" };
    if (ui === "READY_TO_RELEASE") return { label: "Liberar pago", tone: "info" };
    if (ui === "DISPUTED") return { label: "Responder disputa", tone: "err" };
    return null;
  }
  if (ui === "INVITED") return { label: "Aceptar invitación", tone: "info" };
  if (ui === "FUNDED" || ui === "IN_PROGRESS") return { label: "Subir evidencia", tone: "warn" };
  if (ui === "IN_VERIFICATION") return { label: "En revisión", tone: "info" };
  if (ui === "DISPUTED") return { label: "Responder disputa", tone: "err" };
  return null;
}

function TransactionsList() {
  const { user } = Route.useRouteContext();
  const { role } = useViewRole();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/transactions" });
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [kycOk, setKycOk] = useState<boolean | null>(null);

  // Filters + tab + view derived from URL search params (shareable state)
  const filters: TxFiltersState = useMemo(() => ({
    q: search.q ?? "",
    status: search.status ?? "ALL",
    sector: search.sector ?? "ALL",
    dateRange: search.date ?? "ALL",
  }), [search.q, search.status, search.sector, search.date]);
  const tab: TabId = search.tab ?? "ALL";
  const view: "cards" | "table" = search.view ?? "table";

  const setFilters = useCallback((v: TxFiltersState) => {
    navigate({
      search: (s: SearchParams) => ({
        ...s,
        q: v.q || undefined,
        status: v.status === "ALL" ? undefined : v.status,
        sector: v.sector === "ALL" ? undefined : v.sector,
        date: v.dateRange === "ALL" ? undefined : v.dateRange,
      }),
      replace: true,
    });
  }, [navigate]);
  const setTab = useCallback((t: TabId) => {
    navigate({ search: (s: SearchParams) => ({ ...s, tab: t === "ALL" ? undefined : t }), replace: true });
  }, [navigate]);
  const setView = useCallback((v: "cards" | "table") => {
    navigate({ search: (s: SearchParams) => ({ ...s, view: v === "table" ? undefined : v }), replace: true });
  }, [navigate]);

  const fetchAll = useCallback(async () => {
    const [{ data: txs }, { data: prof }] = await Promise.all([
      supabase
        .from("transactions")
        .select("id,numero,title,sector,amount_cents,currency,status,buyer_id,seller_id,counterparty_email,beneficiario_nombre,created_at,delivery_deadline,funding_deadline")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("kyc_status").eq("id", user.id).maybeSingle(),
    ]);

    const txList = (txs ?? []) as TxRow[];
    const ids = txList.map((t) => t.id);

    let hitos: MilestoneRow[] = [];
    if (ids.length > 0) {
      const { data: h } = await supabase
        .from("transaction_hitos")
        .select("transaction_id,estado,monto_cents")
        .in("transaction_id", ids);
      hitos = (h ?? []) as MilestoneRow[];
    }

    const withDerived: TxRow[] = txList.map((t) => {
      const own = hitos.filter((m) => m.transaction_id === t.id);
      const total = own.length;
      const done = own.filter((m) => ["released", "approved", "completed"].includes(m.estado)).length;
      const ui = toUiStatus(t.status);
      const isBuyer = t.buyer_id === user.id;
      const held = ["FUNDED", "IN_PROGRESS", "IN_VERIFICATION", "READY_FOR_APPROVAL", "READY_TO_RELEASE", "DISPUTED", "PARTIALLY_RELEASED"].includes(ui) ? t.amount_cents : 0;
      const releasable = ["READY_TO_RELEASE", "READY_FOR_APPROVAL", "PARTIALLY_RELEASED"].includes(ui) ? t.amount_cents : 0;
      return {
        ...t,
        milestones_total: total,
        milestones_done: done,
        held_cents: held,
        releasable_cents: releasable,
        next_action: nextActionFor(t.status, isBuyer ? "buyer" : "seller"),
      };
    });

    setRows(withDerived);
    setKycOk(prof?.kyc_status === "approved");
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    setLoading(true);
    fetchAll();
  }, [fetchAll]);

  // Realtime: refetch on any change to my transactions or their hitos
  useEffect(() => {
    const ch = supabase
      .channel(`tx-list-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `buyer_id=eq.${user.id}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `seller_id=eq.${user.id}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "transaction_hitos" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user.id, fetchAll]);

  // Keyboard shortcuts: "/" focus search, "n" new transaction
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isEditable) return;
      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key.toLowerCase() === "n" && kycOk) {
        e.preventDefault();
        navigate({ to: "/transactions/new" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, kycOk]);


  // Filtering by tab + filters
  const filtered = useMemo(() => {
    const tabs = getTabs(role);
    const tabDef = tabs.find((t) => t.id === tab)!;

    const now = Date.now();
    const cutoffDays: Record<TxFiltersState["dateRange"], number | null> = {
      ALL: null, "7D": 7, "30D": 30, "90D": 90,
    };
    const cutoff = cutoffDays[filters.dateRange];
    const q = filters.q.trim().toLowerCase();

    return rows.filter((r) => {
      const ui = toUiStatus(r.status);
      if (!tabDef.match(ui)) return false;
      if (filters.status !== "ALL" && ui !== filters.status) return false;
      if (filters.sector !== "ALL" && r.sector !== filters.sector) return false;
      if (cutoff != null) {
        const age = (now - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (age > cutoff) return false;
      }
      if (q) {
        const hay = [r.numero, r.title, r.counterparty_email, r.beneficiario_nombre, String(r.amount_cents / 100)]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, tab, filters, role]);

  const metrics: TxMetricsData = useMemo(() => {
    const acc: TxMetricsData = {
      active: 0, heldAmount: 0, pendingApproval: 0, disputed: 0, releasable: 0, closed: 0,
      readyToRelease: 0, pendingDeliverables: 0, changesRequested: 0, evidenceInReview: 0, releasedTotal: 0,
    };
    for (const r of rows) {
      const ui = toUiStatus(r.status);
      const amt = r.amount_cents / 100;
      if (["ACCEPTED", "PENDING_FUNDING", "FUNDED", "IN_PROGRESS", "IN_VERIFICATION", "READY_FOR_APPROVAL", "READY_TO_RELEASE", "PARTIALLY_RELEASED"].includes(ui)) acc.active++;
      if (["FUNDED", "IN_PROGRESS", "IN_VERIFICATION", "READY_FOR_APPROVAL", "READY_TO_RELEASE", "DISPUTED", "PARTIALLY_RELEASED"].includes(ui)) acc.heldAmount += amt;
      if (ui === "READY_FOR_APPROVAL") acc.pendingApproval++;
      if (ui === "DISPUTED") acc.disputed++;
      if (["READY_TO_RELEASE", "READY_FOR_APPROVAL", "PARTIALLY_RELEASED"].includes(ui)) { acc.releasable += amt; acc.readyToRelease += amt; }
      if (["RELEASED", "CLOSED", "REFUNDED", "CANCELLED"].includes(ui)) acc.closed++;
      if (["FUNDED", "IN_PROGRESS"].includes(ui)) acc.pendingDeliverables++;
      if (ui === "IN_VERIFICATION") { acc.changesRequested++; acc.evidenceInReview++; }
      if (["RELEASED", "PARTIALLY_RELEASED"].includes(ui)) acc.releasedTotal += amt;
    }
    return acc;
  }, [rows]);

  const tabCounts = useMemo(() => countByTab(rows, getTabs(role)), [rows, role]);

  const exportCsv = useCallback(() => {
    const headers = ["numero","titulo","sector","estado","monto","moneda","contraparte","creado","limite_entrega"];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of filtered) {
      lines.push([
        r.numero ?? r.id.slice(0, 8),
        r.title,
        r.sector ?? "",
        toUiStatus(r.status),
        (r.amount_cents / 100).toFixed(2),
        r.currency,
        r.counterparty_email ?? r.beneficiario_nombre ?? "",
        r.created_at,
        r.delivery_deadline ?? "",
      ].map(esc).join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yokto-transacciones-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);


  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-medium">Transacciones</p>
            <h1 className="mt-1 text-2xl font-semibold text-yo-txt">
              {role === "buyer" ? "Mis compras" : "Mis ventas"}
            </h1>
            <p className="mt-1 text-sm text-yo-txt-2">
              Vista {role === "buyer" ? "de comprador" : "de vendedor"} — {rows.length} operaciones en total.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:inline-flex border border-yo-border rounded-md p-0.5 bg-yo-surface">
              <button
                onClick={() => setView("table")}
                className={`px-2 py-1.5 rounded ${view === "table" ? "bg-yo-raised text-yo-txt" : "text-yo-txt-2 hover:text-yo-txt"}`}
                aria-label="Vista tabla"
              >
                <ListIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView("cards")}
                className={`px-2 py-1.5 rounded ${view === "cards" ? "bg-yo-raised text-yo-txt" : "text-yo-txt-2 hover:text-yo-txt"}`}
                aria-label="Vista tarjetas"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-yo-border text-sm font-medium rounded-md text-yo-txt-2 hover:bg-yo-raised hover:text-yo-txt disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Exportar filtrados a CSV"
            >
              <Download className="h-4 w-4" />
              <span className="hidden lg:inline">CSV</span>
            </button>
            {kycOk ? (
              <Link
                to="/transactions/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-yo-ac text-white text-sm font-medium rounded-md hover:bg-yo-ac-h transition-colors"
              >
                <Plus className="h-4 w-4" />
                Nueva transacción
              </Link>
            ) : (
              <Link
                to="/kyc"
                className="inline-flex items-center px-4 py-2 border border-yo-border text-sm font-medium rounded-md hover:bg-yo-raised"
              >
                Completar KYC
              </Link>
            )}
          </div>
        </div>

        {/* Metrics */}
        <TransactionsMetricsGrid role={role} data={metrics} />

        {/* Filters */}
        <TransactionsFilters ref={searchInputRef} value={filters} onChange={setFilters} />

        {/* Tabs */}
        <TransactionsTabs active={tab} onChange={setTab} role={role} counts={tabCounts} />

        {/* List */}
        {loading ? (
          <div className="surface-card p-8 text-sm text-yo-txt-2 text-center">Cargando…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Sin resultados"
            description={rows.length === 0
              ? "Aún no participas en operaciones YOKTO."
              : "No hay operaciones que coincidan con los filtros actuales."}
          />
        ) : (
          <>
            {/* Mobile: siempre tarjetas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden">
              {filtered.map((r) => (
                <TransactionCardMobile key={r.id} row={r} role={role} currentUserId={user.id} />
              ))}
            </div>
            {/* Desktop: tabla o tarjetas */}
            <div className="hidden md:block">
              {view === "table" ? (
                <TransactionsTable rows={filtered} role={role} currentUserId={user.id} />
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {filtered.map((r) => (
                    <TransactionCardMobile key={r.id} row={r} role={role} currentUserId={user.id} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
