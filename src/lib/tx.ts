export type TxStatus =
  | "draft"
  | "pending_signature"
  | "awaiting_funding"
  | "funded"
  | "in_progress"
  | "en_verificacion"
  | "conditions_met"
  | "partial_release"
  | "released"
  | "disputed"
  | "cancelled"
  | "refunded";

export const STATUS_LABEL: Record<TxStatus, string> = {
  draft: "Borrador",
  pending_signature: "Pendiente de firma",
  awaiting_funding: "Esperando fondeo",
  funded: "Fondeada",
  in_progress: "En progreso",
  en_verificacion: "En verificación",
  conditions_met: "Condiciones cumplidas",
  partial_release: "Liberación parcial",
  released: "Liberada",
  disputed: "En disputa",
  cancelled: "Cancelada",
  refunded: "Reembolsada",
};

export const STATUS_ACCENT: Record<TxStatus, string> = {
  draft: "bg-yo-bg border-yo-border text-foreground",
  pending_signature: "bg-background border-yo-border text-foreground",
  awaiting_funding: "bg-background border-yo-border text-foreground",
  funded: "bg-yokto-yellow border-yo-border text-yokto-black",
  in_progress: "bg-yokto-yellow border-yo-border text-yokto-black",
  en_verificacion: "bg-yokto-yellow border-yo-border text-yokto-black",
  conditions_met: "bg-yokto-yellow border-yo-border text-yokto-black",
  partial_release: "bg-yo-ac border-yo-border text-yokto-cream",
  released: "bg-yo-ac border-yo-border text-yokto-cream",
  disputed: "bg-[#FF3B3B] border-yo-border text-yokto-cream",
  cancelled: "bg-background border-yo-border text-muted-foreground",
  refunded: "bg-background border-yo-border text-muted-foreground",
};

export const SECTORS = [
  "Servicios profesionales",
  "Construcción",
  "Inmobiliario",
  "Manufactura",
  "Tecnología / SaaS",
  "Comercio internacional",
  "Marketing / Agencias",
  "Otro",
];

export function formatMoney(cents: number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(cents / 100);
}

export function commissionAmount(cents: number, bps: number) {
  return Math.round((cents * bps) / 10000);
}
