export type TxStatus =
  | "draft"
  | "awaiting_funding"
  | "funded"
  | "in_progress"
  | "conditions_met"
  | "released"
  | "disputed"
  | "cancelled"
  | "refunded";

export const STATUS_LABEL: Record<TxStatus, string> = {
  draft: "Borrador",
  awaiting_funding: "Esperando fondeo",
  funded: "Fondeada",
  in_progress: "En progreso",
  conditions_met: "Condiciones cumplidas",
  released: "Liberada",
  disputed: "En disputa",
  cancelled: "Cancelada",
  refunded: "Reembolsada",
};

export const STATUS_ACCENT: Record<TxStatus, string> = {
  draft: "bg-yo-bg border-yo-border text-foreground",
  awaiting_funding: "bg-background border-yo-border text-foreground",
  funded: "bg-yokto-yellow border-yo-border text-yokto-black",
  in_progress: "bg-yokto-yellow border-yo-border text-yokto-black",
  conditions_met: "bg-yokto-yellow border-yo-border text-yokto-black",
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
