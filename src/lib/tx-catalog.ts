// Catálogo de presentación de Transacciones (Módulo /transactions)
// Cubre la spec completa: 14 estados de operación, 9 estados de hito, 7 sectores
// (incluye BIENES), niveles de riesgo y cumplimiento.
//
// Los estados internos de BD (src/lib/tx.ts, snake_case) se mapean a los
// UiStatus definidos por la spec (SCREAMING_SNAKE_CASE) mediante `toUiStatus`.

import type { TxStatus } from "./tx";
import type { SectorId } from "./sectors";

// ─── Estados de operación (UI) ──────────────────────────────────────────────
export type UiStatus =
  | "DRAFT"
  | "INVITED"
  | "ACCEPTED"
  | "PENDING_FUNDING"
  | "FUNDED"
  | "IN_PROGRESS"
  | "IN_VERIFICATION"
  | "READY_FOR_APPROVAL"
  | "READY_TO_RELEASE"
  | "PARTIALLY_RELEASED"
  | "RELEASED"
  | "REFUNDED"
  | "DISPUTED"
  | "CANCELLED"
  | "CLOSED";

export type StatusTone = "neutral" | "info" | "warn" | "accent" | "ok" | "err";

export type StatusCfg = {
  label: string;
  tone: StatusTone;
  description: string;
};

export const STATUS_CFG: Record<UiStatus, StatusCfg> = {
  DRAFT:              { label: "Borrador",             tone: "neutral", description: "Transacción creada, aún no enviada o aceptada." },
  INVITED:            { label: "Invitación enviada",   tone: "info",    description: "La contraparte fue invitada." },
  ACCEPTED:           { label: "Aceptada",             tone: "info",    description: "Ambas partes aceptaron condiciones." },
  PENDING_FUNDING:    { label: "Por fondear",          tone: "warn",    description: "El comprador debe realizar el pago." },
  FUNDED:             { label: "Fondos retenidos",     tone: "accent",  description: "El pago fue procesado por la pasarela certificada." },
  IN_PROGRESS:        { label: "En curso",             tone: "accent",  description: "Existen hitos pendientes de cumplimiento." },
  IN_VERIFICATION:    { label: "En verificación",      tone: "info",    description: "Yokto/verificador revisa evidencia o documentos." },
  READY_FOR_APPROVAL: { label: "Lista para aprobar",   tone: "info",    description: "Evidencia enviada, esperando aprobación del comprador." },
  READY_TO_RELEASE:   { label: "Lista para liberar",   tone: "ok",      description: "Condiciones cumplidas para liberar fondos." },
  PARTIALLY_RELEASED: { label: "Liberación parcial",   tone: "ok",      description: "Ya se liberó una parcialidad al vendedor." },
  RELEASED:           { label: "Liberada",             tone: "ok",      description: "Se liberó el monto total al vendedor." },
  REFUNDED:           { label: "Devuelta",             tone: "neutral", description: "Fondos devueltos al comprador." },
  DISPUTED:           { label: "En disputa",           tone: "err",     description: "Operación congelada por controversia." },
  CANCELLED:          { label: "Cancelada",            tone: "neutral", description: "Operación cancelada antes de cierre." },
  CLOSED:             { label: "Cerrada",              tone: "neutral", description: "Operación finalizada." },
};

// Mapa DB (snake_case en src/lib/tx.ts) → UI (spec SCREAMING_SNAKE_CASE)
export const DB_TO_UI_STATUS: Record<TxStatus, UiStatus> = {
  draft:              "DRAFT",
  pending_signature:  "INVITED",
  awaiting_funding:   "PENDING_FUNDING",
  funded:             "FUNDED",
  in_progress:        "IN_PROGRESS",
  en_verificacion:    "IN_VERIFICATION",
  conditions_met:     "READY_TO_RELEASE",
  partial_release:    "PARTIALLY_RELEASED",
  released:           "RELEASED",
  disputed:           "DISPUTED",
  cancelled:          "CANCELLED",
  refunded:           "REFUNDED",
};

export function toUiStatus(status: string | null | undefined): UiStatus {
  if (!status) return "DRAFT";
  if (status in STATUS_CFG) return status as UiStatus;
  return DB_TO_UI_STATUS[status as TxStatus] ?? "DRAFT";
}

export function getStatusCfg(status: string | null | undefined): StatusCfg {
  return STATUS_CFG[toUiStatus(status)];
}

// Clases utilitarias por tono
export const TONE_CLASSES: Record<StatusTone, { pill: string; dot: string; text: string }> = {
  neutral: { pill: "bg-yo-raised text-yo-txt-2",                dot: "bg-yo-txt-3",              text: "text-yo-txt-2" },
  info:    { pill: "bg-yo-info-bg text-[color:var(--yo-info)]", dot: "bg-[color:var(--yo-info)]", text: "text-[color:var(--yo-info)]" },
  warn:    { pill: "bg-yo-warn-bg text-[color:var(--yo-warn)]", dot: "bg-[color:var(--yo-warn)]", text: "text-[color:var(--yo-warn)]" },
  accent:  { pill: "bg-yo-ac-bg text-yo-ac-txt",                dot: "bg-yo-ac",                  text: "text-yo-ac-txt" },
  ok:      { pill: "bg-yo-ok-bg text-[color:var(--yo-ok)]",     dot: "bg-[color:var(--yo-ok)]",   text: "text-[color:var(--yo-ok)]" },
  err:     { pill: "bg-yo-err-bg text-[color:var(--yo-err)]",   dot: "bg-[color:var(--yo-err)]",  text: "text-[color:var(--yo-err)]" },
};

// ─── Estados de hito (§13.2) ────────────────────────────────────────────────
export type MilestoneStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "EVIDENCE_UPLOADED"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED"
  | "OVERDUE"
  | "DISPUTED";

export const MILESTONE_STATUS_CFG: Record<MilestoneStatus, StatusCfg> = {
  PENDING:            { label: "Pendiente",             tone: "neutral", description: "Aún no iniciado." },
  IN_PROGRESS:        { label: "En progreso",           tone: "accent",  description: "Trabajo en ejecución." },
  EVIDENCE_UPLOADED:  { label: "Evidencia cargada",     tone: "info",    description: "El vendedor cargó evidencia." },
  IN_REVIEW:          { label: "En revisión",           tone: "info",    description: "En revisión por comprador o verificador." },
  APPROVED:           { label: "Aprobado",              tone: "ok",      description: "Hito aprobado." },
  REJECTED:           { label: "Rechazado",             tone: "err",     description: "Hito rechazado." },
  CHANGES_REQUESTED:  { label: "Corrección solicitada", tone: "warn",    description: "Se solicitó corrección." },
  OVERDUE:            { label: "Vencido",               tone: "err",     description: "Fecha límite superada." },
  DISPUTED:           { label: "En disputa",            tone: "err",     description: "Congelado por controversia." },
};

// ─── Riesgo (§sidebar detalle) ──────────────────────────────────────────────
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export const RISK_CFG: Record<RiskLevel, StatusCfg> = {
  LOW:    { label: "Riesgo bajo",   tone: "ok",   description: "Operación sin señales adversas." },
  MEDIUM: { label: "Riesgo medio",  tone: "warn", description: "Existen señales que requieren atención." },
  HIGH:   { label: "Riesgo alto",   tone: "err",  description: "Requiere revisión inmediata." },
};

// ─── Cumplimiento (badge de fila) ───────────────────────────────────────────
export type ComplianceStatus = "COMPLETE" | "INCOMPLETE" | "AT_RISK";

export const COMPLIANCE_CFG: Record<ComplianceStatus, StatusCfg> = {
  COMPLETE:   { label: "Completo",   tone: "ok",   description: "Cumplimiento al día." },
  INCOMPLETE: { label: "Incompleto", tone: "warn", description: "Faltan documentos o evidencias." },
  AT_RISK:    { label: "En riesgo",  tone: "err",  description: "Existen documentos vencidos o rechazados." },
};

// ─── Sectores (UI: color, bg, texto, emoji, label corto) ────────────────────
export type SectorUiId = SectorId | "BIENES";

export type SectorUiCfg = {
  color: string;
  bg: string;
  txt: string;
  emoji: string;
  label: string;
};

export const SECTOR_UI_CFG: Record<SectorUiId, SectorUiCfg> = {
  AUTOTRANSPORTE:    { color: "#4F46E5", bg: "#EEF2FF", txt: "#3730A3", emoji: "🚛", label: "Autotransporte" },
  CONSTRUCCION:      { color: "#F97316", bg: "#FFF7ED", txt: "#9A3412", emoji: "🏗️", label: "Construcción" },
  COMERCIO_EXTERIOR: { color: "#0EA5E9", bg: "#F0F9FF", txt: "#0C4A6E", emoji: "🌐", label: "Comercio exterior" },
  INMOBILIARIO:      { color: "#8B5CF6", bg: "#F5F3FF", txt: "#4C1D95", emoji: "🏠", label: "Inmobiliario" },
  VEHICULOS:         { color: "#10B981", bg: "#ECFDF5", txt: "#064E3B", emoji: "🚗", label: "Vehículos" },
  SERVICIOS:         { color: "#F43F5E", bg: "#FFF1F2", txt: "#881337", emoji: "💼", label: "Servicios" },
  BIENES:            { color: "#0284C7", bg: "#F0F9FF", txt: "#075985", emoji: "📦", label: "Compraventa de bienes" },
};

export function getSectorUi(sector: string | null | undefined): SectorUiCfg {
  const key = (sector ?? "SERVICIOS") as SectorUiId;
  return SECTOR_UI_CFG[key] ?? SECTOR_UI_CFG.SERVICIOS;
}

// ─── Cajas informativas legales reutilizables (§20) ─────────────────────────
export const LEGAL_COPY = {
  fundsCustody:
    "Yokto no custodia fondos. Los recursos se procesan y retienen exclusivamente mediante pasarelas certificadas. Yokto ordena liberaciones o devoluciones conforme al cumplimiento validado.",
  conditionalRelease:
    "Una liberación solo puede ejecutarse cuando las condiciones del hito estén cumplidas, la evidencia esté validada y no exista una disputa activa.",
  activeDispute:
    "Mientras una operación esté en disputa, las liberaciones relacionadas quedan pausadas hasta que exista una resolución.",
  missingDocuments:
    "Esta operación tiene documentos o evidencias pendientes. Completa los requisitos para avanzar al siguiente estado.",
  ledgerNotice:
    "El ledger interno refleja eventos y referencias de la pasarela. No representa custodia directa de fondos por parte de Yokto.",
} as const;
