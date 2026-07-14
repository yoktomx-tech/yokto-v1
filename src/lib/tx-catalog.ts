// Catálogo de presentación de Transacciones (Módulo /transactions)
// Mapea estados internos (snake_case, definidos en src/lib/tx.ts) a la UI de la
// spec Yokto: label ES, color semántico y descripción corta.

import type { TxStatus } from "./tx";
import type { SectorId } from "./sectors";

// ─── Estados ────────────────────────────────────────────────────────────────
export type StatusTone = "neutral" | "info" | "warn" | "accent" | "ok" | "err";

export type StatusCfg = {
  label: string;
  tone: StatusTone;
  description: string;
};

export const STATUS_CFG: Record<TxStatus, StatusCfg> = {
  draft:              { label: "Borrador",             tone: "neutral", description: "Transacción creada, aún no enviada o aceptada." },
  pending_signature:  { label: "Invitación enviada",   tone: "info",    description: "La contraparte fue invitada." },
  awaiting_funding:   { label: "Por fondear",          tone: "warn",    description: "El comprador debe realizar el pago." },
  funded:             { label: "Fondos retenidos",     tone: "accent",  description: "El pago fue procesado por la pasarela certificada." },
  in_progress:        { label: "En curso",             tone: "accent",  description: "Existen hitos pendientes de cumplimiento." },
  en_verificacion:    { label: "En verificación",      tone: "info",    description: "Yokto revisa evidencia o documentos." },
  conditions_met:     { label: "Lista para liberar",   tone: "ok",      description: "Condiciones cumplidas para liberar fondos." },
  partial_release:    { label: "Liberación parcial",   tone: "ok",      description: "Ya se liberó una parcialidad al vendedor." },
  released:           { label: "Liberada",             tone: "ok",      description: "Se liberó el monto total al vendedor." },
  refunded:           { label: "Devuelta",             tone: "neutral", description: "Fondos devueltos al comprador." },
  disputed:           { label: "En disputa",           tone: "err",     description: "Operación congelada por controversia." },
  cancelled:          { label: "Cancelada",            tone: "neutral", description: "Operación cancelada antes de cierre." },
};

// Clases utilitarias para cada tono (bg claro + texto + punto)
export const TONE_CLASSES: Record<StatusTone, { pill: string; dot: string; text: string }> = {
  neutral: { pill: "bg-yo-raised text-yo-txt-2",        dot: "bg-yo-txt-3", text: "text-yo-txt-2" },
  info:    { pill: "bg-yo-info-bg text-[color:var(--yo-info)]", dot: "bg-[color:var(--yo-info)]", text: "text-[color:var(--yo-info)]" },
  warn:    { pill: "bg-yo-warn-bg text-[color:var(--yo-warn)]", dot: "bg-[color:var(--yo-warn)]", text: "text-[color:var(--yo-warn)]" },
  accent:  { pill: "bg-yo-ac-bg text-yo-ac-txt",        dot: "bg-yo-ac",    text: "text-yo-ac-txt" },
  ok:      { pill: "bg-yo-ok-bg text-[color:var(--yo-ok)]",     dot: "bg-[color:var(--yo-ok)]",   text: "text-[color:var(--yo-ok)]" },
  err:     { pill: "bg-yo-err-bg text-[color:var(--yo-err)]",   dot: "bg-[color:var(--yo-err)]",  text: "text-[color:var(--yo-err)]" },
};

// ─── Sectores (UI: color, bg, texto, emoji, label corto) ────────────────────
export type SectorUiCfg = {
  color: string;
  bg: string;
  txt: string;
  emoji: string;
  label: string;
};

export const SECTOR_UI_CFG: Record<SectorId | "BIENES", SectorUiCfg> = {
  AUTOTRANSPORTE:    { color: "#4F46E5", bg: "#EEF2FF", txt: "#3730A3", emoji: "🚛", label: "Autotransporte" },
  CONSTRUCCION:      { color: "#F97316", bg: "#FFF7ED", txt: "#9A3412", emoji: "🏗️", label: "Construcción" },
  COMERCIO_EXTERIOR: { color: "#0EA5E9", bg: "#F0F9FF", txt: "#0C4A6E", emoji: "🌐", label: "Comercio exterior" },
  INMOBILIARIO:      { color: "#8B5CF6", bg: "#F5F3FF", txt: "#4C1D95", emoji: "🏠", label: "Inmobiliario" },
  VEHICULOS:         { color: "#10B981", bg: "#ECFDF5", txt: "#064E3B", emoji: "🚗", label: "Vehículos" },
  SERVICIOS:         { color: "#F43F5E", bg: "#FFF1F2", txt: "#881337", emoji: "💼", label: "Servicios" },
  BIENES:            { color: "#0284C7", bg: "#F0F9FF", txt: "#075985", emoji: "📦", label: "Bienes" },
};

export function getStatusCfg(status: string | null | undefined): StatusCfg {
  const s = (status ?? "draft") as TxStatus;
  return STATUS_CFG[s] ?? STATUS_CFG.draft;
}

export function getSectorUi(sector: string | null | undefined): SectorUiCfg {
  const key = (sector ?? "SERVICIOS") as keyof typeof SECTOR_UI_CFG;
  return SECTOR_UI_CFG[key] ?? SECTOR_UI_CFG.SERVICIOS;
}
