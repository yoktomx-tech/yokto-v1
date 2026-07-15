import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Banknote, Lock, Send, RotateCcw, Landmark, Percent, BookOpen,
  Scale, Webhook, ExternalLink, Copy, AlertCircle, CheckCircle2,
} from "lucide-react";
import type { PaymentRow } from "@/lib/payments-catalog";
import { formatMoney, LEGAL_COPY } from "@/lib/payments-catalog";
import type { ViewRole } from "@/hooks/use-view-role";
import { listLedgerEntries } from "@/lib/ledger.functions";
import {
  listPaymentMovements, ensureConnectedAccount, simulateAccountVerified,
  getOnboardingLink,
} from "@/lib/payments.functions";
import { supabase } from "@/integrations/supabase/client";
import { SPEIInstructionsCard } from "./spei-instructions-card";
import { StripeConnectOnboarding } from "./stripe-connect-onboarding";
import { PaymentStatusBadge } from "./ui/payment-status-badge";
import { MoneyCell } from "./ui/money-cell";
import { InfoBox } from "@/components/tx/ui/info-box";

// =============================================================================
// Shared shell
// =============================================================================

function SectionShell({
  icon: Icon, title, subtitle, children, action,
}: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 grid size-9 place-items-center rounded-md bg-yo-ac-bg text-yo-ac">
            <Icon className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-xl text-yo-t1 leading-tight">{title}</h2>
            {subtitle && <p className="text-sm text-yo-t2 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-yo-border bg-yo-card p-10 text-center text-sm text-yo-t2">
      {children}
    </div>
  );
}

function RowsTable({
  rows, columns, onOpen,
}: {
  rows: PaymentRow[];
  columns: Array<"amount" | "status" | "provider" | "reference" | "hito" | "counterparty" | "updated">;
  onOpen: (r: PaymentRow) => void;
}) {
  if (rows.length === 0) return <EmptyState>Sin movimientos en esta categoría.</EmptyState>;
  return (
    <div className="overflow-hidden rounded-xl border border-yo-border bg-yo-card">
      <table className="w-full text-sm">
        <thead className="bg-yo-bg2 text-[11px] uppercase tracking-wider text-yo-t2">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium">Operación</th>
            {columns.includes("counterparty") && <th className="text-left px-4 py-2.5 font-medium">Contraparte</th>}
            {columns.includes("provider") && <th className="text-left px-4 py-2.5 font-medium">Pasarela</th>}
            {columns.includes("reference") && <th className="text-left px-4 py-2.5 font-medium">Referencia</th>}
            {columns.includes("hito") && <th className="text-left px-4 py-2.5 font-medium">Hito</th>}
            {columns.includes("amount") && <th className="text-right px-4 py-2.5 font-medium">Monto</th>}
            {columns.includes("status") && <th className="text-left px-4 py-2.5 font-medium">Estado</th>}
            {columns.includes("updated") && <th className="text-left px-4 py-2.5 font-medium">Actualizado</th>}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-yo-border">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-yo-hover cursor-pointer" onClick={() => onOpen(r)}>
              <td className="px-4 py-3">
                <div className="font-mono text-xs text-yo-ac">{r.numero ?? "—"}</div>
                <div className="text-yo-t1 truncate max-w-[240px]">{r.title ?? "—"}</div>
              </td>
              {columns.includes("counterparty") && <td className="px-4 py-3 text-yo-t2">{r.sellerName ?? r.buyerName ?? "—"}</td>}
              {columns.includes("provider") && <td className="px-4 py-3 text-yo-t2">{r.provider ?? "—"}{r.method ? ` · ${r.method}` : ""}</td>}
              {columns.includes("reference") && <td className="px-4 py-3 font-mono text-xs text-yo-t2">{r.reference ?? r.providerRef ?? "—"}</td>}
              {columns.includes("hito") && <td className="px-4 py-3 text-yo-t2">{r.hitoLabel ?? "—"}</td>}
              {columns.includes("amount") && <td className="px-4 py-3 text-right"><MoneyCell cents={r.amountCents} currency={r.currency} /></td>}
              {columns.includes("status") && <td className="px-4 py-3"><PaymentStatusBadge status={r.status} /></td>}
              {columns.includes("updated") && <td className="px-4 py-3 text-yo-t2 text-xs">{new Date(r.updatedAt).toLocaleString("es-MX")}</td>}
              <td className="px-2"><ExternalLink className="size-4 text-yo-t2" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// Depósitos SPEI
// =============================================================================

export function DepositosSpeiSection({ rows, role }: { rows: PaymentRow[]; role: ViewRole }) {
  const pending = rows.filter((r) => r.status === "PENDING_FUNDING" || r.status === "PAYMENT_PROCESSING");
  const withClabe = pending.filter((r) => r.clabe);
  const withoutClabe = pending.filter((r) => !r.clabe);
  const [openId, setOpenId] = useState<string | null>(withClabe[0]?.id ?? null);

  return (
    <SectionShell
      icon={Banknote}
      title="Depósitos SPEI"
      subtitle={role === "buyer"
        ? "CLABEs virtuales generadas por la pasarela para fondear tus operaciones."
        : "Instrucciones de depósito activas para operaciones donde eres beneficiario."}
    >
      <InfoBox tone="info" title="Depósito directo a la pasarela">
        La CLABE mostrada es virtual y única por operación. El SPEI llega directamente a la pasarela certificada;
        YOKTO no recibe ni retiene los fondos.
      </InfoBox>

      {withClabe.length === 0 && withoutClabe.length === 0 ? (
        <EmptyState>No hay depósitos SPEI pendientes.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-yo-t2">Con CLABE ({withClabe.length})</p>
            {withClabe.map((r) => (
              <button
                key={r.id}
                onClick={() => setOpenId(r.id)}
                className={`w-full text-left rounded-lg border p-3 hover:bg-yo-hover transition-colors ${
                  openId === r.id ? "border-yo-ac bg-yo-ac-bg/30" : "border-yo-border bg-yo-card"
                }`}
              >
                <div className="font-mono text-xs text-yo-ac">{r.numero}</div>
                <div className="text-sm text-yo-t1 truncate">{r.title}</div>
                <div className="mt-1 text-xs text-yo-t2">{formatMoney(r.amountCents, r.currency)}</div>
              </button>
            ))}
            {withoutClabe.length > 0 && (
              <>
                <p className="mt-4 text-[11px] uppercase tracking-wider text-yo-t2">Sin CLABE generada ({withoutClabe.length})</p>
                {withoutClabe.map((r) => (
                  <div key={r.id} className="rounded-lg border border-yo-border bg-yo-card p-3">
                    <div className="font-mono text-xs text-yo-ac">{r.numero}</div>
                    <div className="text-sm text-yo-t1 truncate">{r.title}</div>
                    <Link to="/payments/$id" params={{ id: r.id }} className="mt-1 inline-flex items-center gap-1 text-xs text-yo-ac hover:underline">
                      Generar CLABE <ExternalLink className="size-3" />
                    </Link>
                  </div>
                ))}
              </>
            )}
          </div>
          <div>
            {(() => {
              const active = withClabe.find((r) => r.id === openId);
              if (!active || !active.clabe) return <EmptyState>Selecciona una operación para ver instrucciones SPEI.</EmptyState>;
              return (
                <SPEIInstructionsCard
                  clabe={active.clabe}
                  beneficiary={active.sellerName ?? "Beneficiario"}
                  bank="STP / Pasarela"
                  amountCents={active.amountCents}
                  currency={active.currency}
                  reference={active.reference ?? active.providerRef ?? active.numero ?? ""}
                />
              );
            })()}
          </div>
        </div>
      )}
    </SectionShell>
  );
}

// =============================================================================
// Retenciones
// =============================================================================

export function RetencionesSection({ rows, role, onOpen }: { rows: PaymentRow[]; role: ViewRole; onOpen: (r: PaymentRow) => void }) {
  const held = rows.filter((r) => r.status === "HELD_BY_PROCESSOR" || r.status === "READY_TO_RELEASE");
  const total = held.reduce((s, r) => s + r.amountCents, 0);
  return (
    <SectionShell
      icon={Lock}
      title="Retenciones"
      subtitle={role === "buyer"
        ? "Fondos retenidos por la pasarela en espera de cumplimiento."
        : "Fondos retenidos a tu favor, sujetos a la verificación de condiciones."}
    >
      <div className="rounded-xl border border-yo-border bg-yo-card p-5">
        <p className="text-[11px] uppercase tracking-wider text-yo-t2">Total retenido</p>
        <p className="font-mono text-3xl text-yo-t1 mt-1">{formatMoney(total)}</p>
        <p className="text-xs text-yo-t2 mt-1">{held.length} operación(es) con fondos en la pasarela.</p>
      </div>
      <RowsTable rows={held} columns={["counterparty", "provider", "hito", "amount", "status", "updated"]} onOpen={onOpen} />
    </SectionShell>
  );
}

// =============================================================================
// Liberaciones
// =============================================================================

export function LiberacionesSection({ rows, onOpen }: { rows: PaymentRow[]; onOpen: (r: PaymentRow) => void }) {
  const released = rows.filter((r) =>
    r.status === "RELEASED" || r.status === "PARTIALLY_RELEASED" || r.status === "RELEASE_ORDERED"
  );
  return (
    <SectionShell
      icon={Send}
      title="Liberaciones"
      subtitle="Órdenes de liberación enviadas a la pasarela y confirmaciones recibidas."
    >
      <InfoBox tone="info">{LEGAL_COPY.releaseConfirm}</InfoBox>
      <RowsTable rows={released} columns={["counterparty", "provider", "reference", "amount", "status", "updated"]} onOpen={onOpen} />
    </SectionShell>
  );
}

// =============================================================================
// Devoluciones
// =============================================================================

export function DevolucionesSection({ rows, onOpen }: { rows: PaymentRow[]; onOpen: (r: PaymentRow) => void }) {
  const refunds = rows.filter((r) => r.status === "REFUND_REQUESTED" || r.status === "REFUNDED");
  return (
    <SectionShell
      icon={RotateCcw}
      title="Devoluciones"
      subtitle="Reembolsos procesados por la pasarela hacia el comprador."
    >
      <InfoBox tone="info">{LEGAL_COPY.refundInfo}</InfoBox>
      <RowsTable rows={refunds} columns={["counterparty", "provider", "reference", "amount", "status", "updated"]} onOpen={onOpen} />
    </SectionShell>
  );
}

// =============================================================================
// Payouts / Cuenta receptora
// =============================================================================

type ConnectedAccount = {
  provider: string;
  provider_account_id: string;
  status: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  requirements: { onboarding_url?: string | null } | null;
};

export function PayoutsSection({ role }: { role: ViewRole }) {
  const ensureFn = useServerFn(ensureConnectedAccount);
  const simulateFn = useServerFn(simulateAccountVerified);
  const linkFn = useServerFn(getOnboardingLink);
  const [busy, setBusy] = useState(false);

  const { data: account, refetch } = useQuery<ConnectedAccount | null>({
    queryKey: ["connected-account"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return null;
      const { data } = await supabase
        .from("connected_accounts")
        .select("provider, provider_account_id, status, charges_enabled, payouts_enabled, requirements")
        .eq("user_id", userRes.user.id)
        .maybeSingle();
      return data as ConnectedAccount | null;
    },
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ["payouts-list"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return [];
      const { data } = await supabase
        .from("payouts")
        .select("id, provider, provider_ref, gross_cents, commission_cents, net_cents, currency, status, created_at, paid_at, transaction:transactions!inner(numero, title)")
        .eq("seller_id", userRes.user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  if (role !== "seller") {
    return (
      <SectionShell icon={Landmark} title="Payouts / Cuenta receptora" subtitle="Disponible únicamente para el rol Vendedor.">
        <EmptyState>Cambia a la vista de Vendedor para gestionar tu cuenta receptora de payouts.</EmptyState>
      </SectionShell>
    );
  }

  async function handleCreate() {
    setBusy(true);
    try {
      await ensureFn();
      const acct = await refetch();
      const url = acct.data?.requirements?.onboarding_url;
      if (url) window.open(url, "_blank");
    } finally { setBusy(false); }
  }
  async function handleVerify() {
    await simulateFn();
    refetch();
  }
  async function handleContinue() {
    if (!account) return;
    setBusy(true);
    try {
      const { url } = await linkFn({ data: { returnUrl: window.location.href } });
      if (url) window.open(url, "_blank");
    } finally { setBusy(false); }
  }

  return (
    <SectionShell
      icon={Landmark}
      title="Payouts / Cuenta receptora"
      subtitle="Cuenta bancaria configurada con la pasarela para recibir liberaciones."
    >
      <StripeConnectOnboarding
        status={account?.status ?? "not_started"}
        chargesEnabled={account?.charges_enabled ?? false}
        payoutsEnabled={account?.payouts_enabled ?? false}
        onboardingUrl={account?.requirements?.onboarding_url ?? null}
        onCreate={account ? handleContinue : handleCreate}
        onVerify={handleVerify}
        busy={busy}
        stripeReal={false}
      />

      <div>
        <h3 className="font-display text-lg text-yo-t1 mb-2">Historial de payouts</h3>
        {payouts.length === 0 ? (
          <EmptyState>Aún no has recibido payouts.</EmptyState>
        ) : (
          <div className="overflow-hidden rounded-xl border border-yo-border bg-yo-card">
            <table className="w-full text-sm">
              <thead className="bg-yo-bg2 text-[11px] uppercase tracking-wider text-yo-t2">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Fecha</th>
                  <th className="text-left px-4 py-2.5 font-medium">Operación</th>
                  <th className="text-left px-4 py-2.5 font-medium">Pasarela</th>
                  <th className="text-right px-4 py-2.5 font-medium">Bruto</th>
                  <th className="text-right px-4 py-2.5 font-medium">Comisión</th>
                  <th className="text-right px-4 py-2.5 font-medium">Neto</th>
                  <th className="text-left px-4 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-yo-border">
                {payouts.map((p) => {
                  const tx = Array.isArray(p.transaction) ? p.transaction[0] : p.transaction;
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-3 text-yo-t2 text-xs">{new Date(p.paid_at ?? p.created_at).toLocaleString("es-MX")}</td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-yo-ac">{tx?.numero ?? "—"}</div>
                        <div className="text-yo-t1 truncate max-w-[240px]">{tx?.title ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-yo-t2 text-xs">{p.provider} · {p.provider_ref?.slice(0, 12) ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{formatMoney(p.gross_cents ?? 0, p.currency)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-yo-t2">−{formatMoney(p.commission_cents ?? 0, p.currency)}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-yo-t1">{formatMoney(p.net_cents ?? 0, p.currency)}</td>
                      <td className="px-4 py-3"><StatusPill status={p.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SectionShell>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { c: string; l: string }> = {
    paid:       { c: "bg-yo-ok-bg text-yo-ok",       l: "Pagado" },
    processing: { c: "bg-yo-info-bg text-yo-info",   l: "En proceso" },
    pending:    { c: "bg-yo-warn-bg text-yo-warn",   l: "Pendiente" },
    failed:     { c: "bg-yo-err-bg text-yo-err",     l: "Fallido" },
  };
  const s = map[status] ?? { c: "bg-yo-bg2 text-yo-t2", l: status };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${s.c}`}>{s.l}</span>;
}

// =============================================================================
// Comisiones
// =============================================================================

export function ComisionesSection() {
  const fn = useServerFn(listPaymentMovements);
  const { data: moves = [], isLoading } = useQuery({ queryKey: ["payment-movements"], queryFn: () => fn() });
  const comisiones = moves.filter((m) => m.kind === "comision");
  const total = comisiones.reduce((s, m) => s + m.amount_cents, 0);

  return (
    <SectionShell
      icon={Percent}
      title="Comisiones"
      subtitle="Comisiones cobradas por YOKTO al liquidarse cada operación."
    >
      <div className="rounded-xl border border-yo-border bg-yo-card p-5">
        <p className="text-[11px] uppercase tracking-wider text-yo-t2">Comisiones acumuladas</p>
        <p className="font-mono text-3xl text-yo-t1 mt-1">{formatMoney(total)}</p>
        <p className="text-xs text-yo-t2 mt-1">{comisiones.length} operación(es) liquidada(s).</p>
      </div>
      {isLoading ? (
        <EmptyState>Cargando…</EmptyState>
      ) : comisiones.length === 0 ? (
        <EmptyState>Sin comisiones cobradas todavía.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-yo-border bg-yo-card">
          <table className="w-full text-sm">
            <thead className="bg-yo-bg2 text-[11px] uppercase tracking-wider text-yo-t2">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Fecha</th>
                <th className="text-left px-4 py-2.5 font-medium">Operación</th>
                <th className="text-left px-4 py-2.5 font-medium">Referencia</th>
                <th className="text-right px-4 py-2.5 font-medium">Comisión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yo-border">
              {comisiones.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3 text-yo-t2 text-xs">{new Date(m.created_at).toLocaleString("es-MX")}</td>
                  <td className="px-4 py-3 font-mono text-xs text-yo-ac">{m.transaction_numero ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-yo-t2">{m.provider_ref?.slice(0, 20) ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-yo-t1">{formatMoney(m.amount_cents, m.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionShell>
  );
}

// =============================================================================
// Movimientos / Ledger
// =============================================================================

export function LedgerSection() {
  const fn = useServerFn(listLedgerEntries);
  const { data: entries = [], isLoading } = useQuery({ queryKey: ["ledger-entries"], queryFn: () => fn() });

  const KIND: Record<string, { label: string; c: string }> = {
    FONDEO:         { label: "Fondeo",         c: "bg-yo-info-bg text-yo-info" },
    LIBERACION:     { label: "Liberación",     c: "bg-yo-ok-bg text-yo-ok" },
    COMISION_YOKTO: { label: "Comisión YOKTO", c: "bg-yo-ac-bg text-yo-ac-txt" },
    REEMBOLSO:      { label: "Reembolso",      c: "bg-yo-warn-bg text-yo-warn" },
  };

  return (
    <SectionShell
      icon={BookOpen}
      title="Movimientos / Ledger"
      subtitle="Registro contable de todos los movimientos procesados por la pasarela."
    >
      <InfoBox tone="info">{LEGAL_COPY.ledgerNote}</InfoBox>
      {isLoading ? (
        <EmptyState>Cargando ledger…</EmptyState>
      ) : entries.length === 0 ? (
        <EmptyState>Sin movimientos registrados.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-yo-border bg-yo-card">
          <table className="w-full text-sm">
            <thead className="bg-yo-bg2 text-[11px] uppercase tracking-wider text-yo-t2">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Fecha</th>
                <th className="text-left px-4 py-2.5 font-medium">Tipo</th>
                <th className="text-left px-4 py-2.5 font-medium">Operación</th>
                <th className="text-left px-4 py-2.5 font-medium">Contraparte</th>
                <th className="text-left px-4 py-2.5 font-medium">Referencia</th>
                <th className="text-right px-4 py-2.5 font-medium">Débito</th>
                <th className="text-right px-4 py-2.5 font-medium">Crédito</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yo-border">
              {entries.map((e) => {
                const k = KIND[e.kind] ?? { label: e.kind, c: "bg-yo-bg2 text-yo-t2" };
                return (
                  <tr key={e.id}>
                    <td className="px-4 py-3 text-yo-t2 text-xs">{new Date(e.date).toLocaleString("es-MX")}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${k.c}`}>{k.label}</span></td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-yo-ac">{e.txNumero ?? "—"}</div>
                      <div className="text-yo-t1 truncate max-w-[220px]">{e.txTitle ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-yo-t2 text-xs">{e.counterparty ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-yo-t2">{e.reference?.slice(0, 18) ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{e.debitCents ? formatMoney(e.debitCents, e.currency) : "—"}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{e.creditCents ? formatMoney(e.creditCents, e.currency) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionShell>
  );
}

// =============================================================================
// Conciliación
// =============================================================================

export function ConciliacionSection({ rows }: { rows: PaymentRow[] }) {
  const pendientes = rows.filter((r) => r.status === "RECONCILIATION_PENDING" || r.status === "FAILED");
  return (
    <SectionShell
      icon={Scale}
      title="Conciliación"
      subtitle="Diferencias detectadas entre el registro interno y los reportes de la pasarela."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-yo-border bg-yo-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-yo-t2">Operaciones conciliadas</p>
          <p className="font-mono text-2xl text-yo-ok mt-1 flex items-center gap-2">
            <CheckCircle2 className="size-5" /> {rows.length - pendientes.length}
          </p>
        </div>
        <div className="rounded-xl border border-yo-border bg-yo-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-yo-t2">Requieren atención</p>
          <p className="font-mono text-2xl text-yo-warn mt-1 flex items-center gap-2">
            <AlertCircle className="size-5" /> {pendientes.length}
          </p>
        </div>
        <div className="rounded-xl border border-yo-border bg-yo-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-yo-t2">Última sincronización</p>
          <p className="text-sm text-yo-t1 mt-2">{new Date().toLocaleString("es-MX")}</p>
        </div>
      </div>
      {pendientes.length === 0 ? (
        <EmptyState>Todos los movimientos están conciliados con la pasarela.</EmptyState>
      ) : (
        <div className="rounded-xl border border-yo-warn/30 bg-yo-warn-bg/40 p-4 space-y-2">
          {pendientes.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm">
              <div>
                <span className="font-mono text-xs text-yo-ac">{r.numero}</span>
                <span className="ml-2 text-yo-t1">{r.title}</span>
              </div>
              <PaymentStatusBadge status={r.status} />
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

// =============================================================================
// Webhooks / Auditoría (backoffice)
// =============================================================================

export function WebhooksSection() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["stripe-webhook-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stripe_webhook_events")
        .select("event_id, event_type, processed, processed_at, error, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  return (
    <SectionShell
      icon={Webhook}
      title="Webhooks / Auditoría"
      subtitle="Eventos recibidos desde la pasarela. Visibilidad interna del backoffice."
    >
      <InfoBox tone="warn" title="Sólo backoffice">
        Este panel muestra la traza de eventos de la pasarela procesados por YOKTO. Los efectos
        contables ya se aplicaron en las secciones de retenciones, liberaciones y payouts.
      </InfoBox>
      {isLoading ? (
        <EmptyState>Cargando eventos…</EmptyState>
      ) : events.length === 0 ? (
        <EmptyState>Aún no se han recibido webhooks de la pasarela.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-yo-border bg-yo-card">
          <table className="w-full text-sm">
            <thead className="bg-yo-bg2 text-[11px] uppercase tracking-wider text-yo-t2">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Recibido</th>
                <th className="text-left px-4 py-2.5 font-medium">Evento</th>
                <th className="text-left px-4 py-2.5 font-medium">Event ID</th>
                <th className="text-left px-4 py-2.5 font-medium">Estado</th>
                <th className="text-left px-4 py-2.5 font-medium">Procesado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yo-border">
              {events.map((e) => (
                <tr key={e.event_id}>
                  <td className="px-4 py-3 text-yo-t2 text-xs">{new Date(e.created_at).toLocaleString("es-MX")}</td>
                  <td className="px-4 py-3 font-mono text-xs text-yo-t1">{e.event_type}</td>
                  <td className="px-4 py-3 font-mono text-xs text-yo-t2 flex items-center gap-1">
                    {e.event_id.slice(0, 22)}…
                    <button onClick={() => navigator.clipboard.writeText(e.event_id)} className="text-yo-t2 hover:text-yo-ac"><Copy className="size-3" /></button>
                  </td>
                  <td className="px-4 py-3">
                    {e.processed ? <StatusPill status="paid" /> : e.error ? <StatusPill status="failed" /> : <StatusPill status="pending" />}
                  </td>
                  <td className="px-4 py-3 text-yo-t2 text-xs">{e.processed_at ? new Date(e.processed_at).toLocaleString("es-MX") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionShell>
  );
}
