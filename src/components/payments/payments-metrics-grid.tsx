import {
  ShieldCheck, UnlockKeyhole, CreditCard, RotateCcw, Receipt,
  Timer, CheckCircle2, FileWarning, ArrowDownUp, ReceiptText,
} from "lucide-react";
import type { ViewRole } from "@/hooks/use-view-role";
import type { PaymentRow } from "@/lib/payments-catalog";
import { PaymentMetricCard } from "@/components/payments/ui/payment-metric-card";

export type MetricsSummary = {
  role: ViewRole;
  rows: PaymentRow[];
  currency?: string;
};

function sumBy(rows: PaymentRow[], predicate: (r: PaymentRow) => boolean, field: (r: PaymentRow) => number = (r) => r.amountCents) {
  return rows.filter(predicate).reduce((s, r) => s + field(r), 0);
}

export function PaymentsMetricsGrid({ role, rows, currency = "MXN" }: MetricsSummary) {
  if (role === "buyer") {
    const held      = sumBy(rows, (r) => r.status === "HELD_BY_PROCESSOR");
    const ready     = sumBy(rows, (r) => r.status === "READY_TO_RELEASE" || r.status === "RELEASE_ORDERED");
    const pending   = sumBy(rows, (r) => r.status === "PENDING_FUNDING" || r.status === "PAYMENT_PROCESSING");
    const refunds   = sumBy(rows, (r) => r.status === "REFUND_REQUESTED" || r.status === "REFUNDED");
    const feesEst   = Math.round(rows.reduce((s, r) => s + r.amountCents * 0.015, 0));

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <PaymentMetricCard title="Fondos retenidos por pasarela" amountCents={held} currency={currency} icon={ShieldCheck} tone="accent" hint="Confirmados por pasarela" />
        <PaymentMetricCard title="Por liberar" amountCents={ready} currency={currency} icon={UnlockKeyhole} tone="ok" hint="Condiciones cumplidas" />
        <PaymentMetricCard title="Pendiente de fondeo" amountCents={pending} currency={currency} icon={CreditCard} tone="warn" hint="Requiere pago" />
        <PaymentMetricCard title="Reembolsos en proceso" amountCents={refunds} currency={currency} icon={RotateCcw} tone="info" hint="Reversos activos" />
        <PaymentMetricCard title="Comisiones estimadas" amountCents={feesEst} currency={currency} icon={Receipt} tone="neutral" hint="Aprox. 1.5%" />
      </div>
    );
  }

  const porLiberar   = sumBy(rows, (r) => r.status === "READY_TO_RELEASE" || r.status === "RELEASE_ORDERED" || r.status === "HELD_BY_PROCESSOR");
  const liberados    = sumBy(rows, (r) => r.status === "RELEASED" || r.status === "PARTIALLY_RELEASED", (r) => r.releasedCents || r.amountCents);
  const cumplPending = sumBy(rows, (r) => r.status === "HELD_BY_PROCESSOR" && !!r.hitoLabel);
  const ajustes      = sumBy(rows, (r) => r.status === "REFUND_REQUESTED" || r.status === "REFUNDED");
  const feesDesc     = Math.round(rows.filter((r) => r.status === "RELEASED").reduce((s, r) => s + r.amountCents * 0.015, 0));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <PaymentMetricCard title="Pagos por liberar" amountCents={porLiberar} currency={currency} icon={Timer} tone="accent" hint="Condiciones en revisión" />
      <PaymentMetricCard title="Pagos liberados" amountCents={liberados} currency={currency} icon={CheckCircle2} tone="ok" hint="Confirmados por pasarela" />
      <PaymentMetricCard title="Retenido por cumplimiento pendiente" amountCents={cumplPending} currency={currency} icon={FileWarning} tone="warn" hint="Falta evidencia o docs" />
      <PaymentMetricCard title="Ajustes / devoluciones" amountCents={ajustes} currency={currency} icon={ArrowDownUp} tone="info" hint="Movimientos correctivos" />
      <PaymentMetricCard title="Comisiones descontadas" amountCents={feesDesc} currency={currency} icon={ReceiptText} tone="neutral" hint="Aplicadas en liberaciones" />
    </div>
  );
}
