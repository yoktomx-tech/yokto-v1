import type { ViewRole } from "@/hooks/use-view-role";

// ============= UI PAYMENT STATUS =============

export type UiPaymentStatus =
  | "PENDING_FUNDING"
  | "PAYMENT_PROCESSING"
  | "HELD_BY_PROCESSOR"
  | "READY_TO_RELEASE"
  | "RELEASE_ORDERED"
  | "RELEASED"
  | "PARTIALLY_RELEASED"
  | "REFUND_REQUESTED"
  | "REFUNDED"
  | "DISPUTED"
  | "FAILED"
  | "CANCELLED"
  | "RECONCILIATION_PENDING"
  | "RECONCILED";

export type StatusTone = "neutral" | "accent" | "ok" | "warn" | "err" | "info";

export const UI_PAYMENT_STATUS: Record<
  UiPaymentStatus,
  { label: string; tone: StatusTone; description: string }
> = {
  PENDING_FUNDING:       { label: "Pendiente de fondeo",     tone: "warn",    description: "La operación aún no ha sido fondeada por el comprador." },
  PAYMENT_PROCESSING:    { label: "Pago procesando",         tone: "info",    description: "El pago fue enviado a la pasarela y está en proceso." },
  HELD_BY_PROCESSOR:     { label: "Retenido por pasarela",   tone: "accent",  description: "Los fondos están retenidos por la pasarela conforme a las reglas de la operación." },
  READY_TO_RELEASE:      { label: "Listo para liberar",      tone: "info",    description: "Las condiciones se cumplieron. El comprador puede ordenar la liberación." },
  RELEASE_ORDERED:       { label: "Liberación ordenada",     tone: "info",    description: "La orden de liberación fue enviada a la pasarela." },
  RELEASED:              { label: "Liberado",                tone: "ok",      description: "La pasarela confirmó la liberación de los fondos." },
  PARTIALLY_RELEASED:    { label: "Liberado parcialmente",   tone: "ok",      description: "Se liberó parte del monto retenido." },
  REFUND_REQUESTED:      { label: "Reembolso solicitado",    tone: "warn",    description: "Se solicitó un reembolso a la pasarela." },
  REFUNDED:              { label: "Reembolsado",             tone: "ok",      description: "La pasarela confirmó el reembolso." },
  DISPUTED:              { label: "En disputa",              tone: "warn",    description: "Existe una disputa activa vinculada al pago." },
  FAILED:                { label: "Fallido",                 tone: "err",     description: "La pasarela reportó un error en el movimiento." },
  CANCELLED:             { label: "Cancelado",               tone: "neutral", description: "El movimiento fue cancelado." },
  RECONCILIATION_PENDING:{ label: "Conciliación pendiente",  tone: "warn",    description: "Existen diferencias que requieren conciliación con la pasarela." },
  RECONCILED:            { label: "Conciliado",              tone: "ok",      description: "El movimiento fue conciliado con la pasarela." },
};

// ============= DERIVATION =============

export type PaymentRow = {
  id: string;                 // payment intent id
  transactionId: string;
  numero: string | null;
  title: string | null;
  sector: string | null;
  buyerId: string | null;
  sellerId: string | null;
  buyerName: string | null;
  sellerName: string | null;
  amountCents: number;
  releasedCents: number;
  refundedCents: number;
  currency: string;
  provider: string | null;
  providerRef: string | null;
  method: string | null;
  status: UiPaymentStatus;
  txStatus: string;
  hasDispute: boolean;
  hitoLabel: string | null;   // "Hito 2/3" cuando aplica
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  reference: string | null;
  clabe: string | null;
};

export function derivePaymentStatus(input: {
  intentStatus: string | null;
  txStatus: string | null;
  amountCents: number;
  releasedCents: number;
  refundedCents: number;
  hasDispute: boolean;
}): UiPaymentStatus {
  const { intentStatus, txStatus, amountCents, releasedCents, refundedCents, hasDispute } = input;

  if (hasDispute) return "DISPUTED";
  if (intentStatus === "failed") return "FAILED";
  if (intentStatus === "cancelled" || intentStatus === "canceled") return "CANCELLED";
  if (intentStatus === "refunded" || txStatus === "refunded") return "REFUNDED";
  if (intentStatus === "refund_requested") return "REFUND_REQUESTED";

  if (txStatus === "released" || refundedCents === 0 && releasedCents >= amountCents && amountCents > 0) return "RELEASED";
  if (releasedCents > 0 && releasedCents < amountCents) return "PARTIALLY_RELEASED";

  if (txStatus === "release_ordered") return "RELEASE_ORDERED";
  if (txStatus === "conditions_met" || txStatus === "ready_to_release") return "READY_TO_RELEASE";

  if (intentStatus === "succeeded" || txStatus === "funded" || txStatus === "in_progress" || txStatus === "en_verificacion") {
    return "HELD_BY_PROCESSOR";
  }

  if (intentStatus === "processing" || intentStatus === "requires_payment_method" || intentStatus === "requires_confirmation") {
    return "PAYMENT_PROCESSING";
  }

  if (txStatus === "awaiting_funding" || txStatus === "pending_funding" || !intentStatus) return "PENDING_FUNDING";
  return "PENDING_FUNDING";
}

// ============= TABS PER ROLE =============

export type TabId =
  | "ALL"
  | "PENDING_FUNDING"
  | "HELD"
  | "READY"
  | "RELEASED"
  | "REFUNDS"
  | "DISPUTED"
  | "FAILED";

export const TABS_BUYER: { id: TabId; label: string }[] = [
  { id: "ALL",              label: "Todos" },
  { id: "PENDING_FUNDING",  label: "Pendiente de fondeo" },
  { id: "HELD",             label: "Fondos retenidos" },
  { id: "READY",            label: "Listos para liberar" },
  { id: "RELEASED",         label: "Liberados" },
  { id: "REFUNDS",          label: "Reembolsos" },
  { id: "DISPUTED",         label: "Con disputa" },
  { id: "FAILED",           label: "Fallidos" },
];

export const TABS_SELLER: { id: TabId; label: string }[] = [
  { id: "ALL",              label: "Todos" },
  { id: "PENDING_FUNDING",  label: "Por cobrar" },
  { id: "HELD",             label: "Retenido por cumplimiento" },
  { id: "READY",            label: "Listos para liberar" },
  { id: "RELEASED",         label: "Recibidos" },
  { id: "REFUNDS",          label: "Ajustes" },
  { id: "DISPUTED",         label: "Con disputa" },
  { id: "FAILED",           label: "Fallidos" },
];

export function tabsForRole(role: ViewRole) {
  return role === "buyer" ? TABS_BUYER : TABS_SELLER;
}

export function matchesTab(row: PaymentRow, tab: TabId): boolean {
  if (tab === "ALL") return true;
  switch (tab) {
    case "PENDING_FUNDING":  return row.status === "PENDING_FUNDING" || row.status === "PAYMENT_PROCESSING";
    case "HELD":             return row.status === "HELD_BY_PROCESSOR";
    case "READY":            return row.status === "READY_TO_RELEASE" || row.status === "RELEASE_ORDERED";
    case "RELEASED":         return row.status === "RELEASED" || row.status === "PARTIALLY_RELEASED";
    case "REFUNDS":          return row.status === "REFUND_REQUESTED" || row.status === "REFUNDED";
    case "DISPUTED":         return row.status === "DISPUTED";
    case "FAILED":           return row.status === "FAILED" || row.status === "CANCELLED";
  }
  return true;
}

// ============= MONEY =============

export function formatMoney(cents: number, currency = "MXN"): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}

// ============= LEGAL COPY =============

export const LEGAL_COPY = {
  noCustody:
    "Cumplex no custodia fondos. Los pagos, retenciones, liberaciones y reembolsos son procesados por la pasarela certificada configurada para cada operación. Cumplex solo verifica condiciones y ordena la acción correspondiente conforme a las reglas pactadas.",
  disputeActive:
    "Esta operación tiene una disputa activa. Las liberaciones relacionadas permanecerán pausadas hasta que exista resolución o acuerdo registrado.",
  processorError:
    "La pasarela no confirmó el último movimiento. Revisa el detalle del pago o intenta sincronizar nuevamente.",
  conditionsPending:
    "Este pago no puede liberarse todavía. Existen condiciones pendientes de cumplimiento o validación.",
  readyToRelease:
    "Las condiciones requeridas fueron cumplidas. Puedes revisar la evidencia y ordenar la liberación conforme a las reglas pactadas.",
  releasedOk:
    "La pasarela confirmó la liberación del pago. Puedes consultar el comprobante y el ledger del movimiento.",
  refundInfo:
    "El reembolso será procesado por la pasarela. Los tiempos pueden variar según el método de pago utilizado.",
  releaseConfirm:
    "Esta acción enviará una orden de liberación a la pasarela configurada. Cumplex no transfiere fondos directamente; la pasarela procesará la liberación conforme a sus tiempos y reglas.",
  fiscalNote:
    "Los comprobantes fiscales asociados al pago deben reflejar la forma de pago real utilizada por el comprador y, cuando aplique, el complemento de pago correspondiente. Cumplex muestra la trazabilidad documental, pero la emisión fiscal corresponde a las partes obligadas.",
  ledgerNote:
    "El ledger muestra movimientos registrados y conciliados con la pasarela. No representa una cuenta de depósito ni custodia de fondos por parte de Cumplex.",
};

// ============= TONE CLASSES =============

export const TONE_PILL: Record<StatusTone, { bg: string; text: string; dot: string; border?: string }> = {
  neutral: { bg: "bg-[#F4F4F5]", text: "text-[#71717A]", dot: "bg-[#71717A]", border: "border border-yo-border" },
  accent:  { bg: "bg-yo-ac-bg",   text: "text-yo-ac-txt", dot: "bg-yo-ac" },
  ok:      { bg: "bg-yo-ok-bg",   text: "text-yo-ok",     dot: "bg-yo-ok" },
  warn:    { bg: "bg-yo-warn-bg", text: "text-[#B45309]", dot: "bg-yo-warn" },
  err:     { bg: "bg-yo-err-bg",  text: "text-yo-err",    dot: "bg-yo-err" },
  info:    { bg: "bg-yo-info-bg", text: "text-yo-info",   dot: "bg-yo-info" },
};

export const TONE_ACCENT_LINE: Record<StatusTone, string> = {
  neutral: "var(--yo-border-s)",
  accent:  "var(--yo-ac)",
  ok:      "var(--yo-ok)",
  warn:    "var(--yo-warn)",
  err:     "var(--yo-err)",
  info:    "var(--yo-info)",
};
