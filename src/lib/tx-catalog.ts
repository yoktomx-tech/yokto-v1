// Catálogo de presentación de Transacciones (Módulo /transactions)
// Cubre la spec completa: 14 estados de operación, 9 estados de hito, 7 sectores
// (incluye BIENES), niveles de riesgo y cumplimiento.
//
// Los estados internos de BD (src/lib/tx.ts, snake_case) se mapean a los
// UiStatus definidos por la spec (SCREAMING_SNAKE_CASE) mediante `toUiStatus`.

import type { TxStatus } from "./tx";
import type { SectorId } from "./sectors";

// ─── Estados de operación (UI) ──────────────────────────────────────────────
// 15 estados oficiales de la operación. Los "principales" se muestran siempre
// en tabs/filters; los específicos (aprobación, cambios, firma parcial, etc.)
// aparecen únicamente cuando ocurre el evento correspondiente.
export type UiStatus =
  | "DRAFT"                 // BORRADOR
  | "PENDING_APPROVAL"      // PENDIENTE_APROBACION_CONTRAPARTE
  | "CHANGES_REQUESTED"     // CAMBIOS_SOLICITADOS
  | "ACCEPTED"              // APROBADA_POR_CONTRAPARTE
  | "PENDING_SIGNATURE"     // PENDIENTE_FIRMA
  | "PARTIALLY_SIGNED"      // FIRMADA_PARCIALMENTE
  | "FULLY_SIGNED"          // FIRMADA_TOTALMENTE
  | "PENDING_FUNDING"       // ESPERANDO_FONDEO
  | "FUNDED"                // FONDOS_RETENIDOS
  | "IN_PROGRESS"           // EN_CUMPLIMIENTO / ACTIVA
  | "IN_VERIFICATION"       // EN_VERIFICACION
  // sub-estado técnico: sigue formando parte de "En verificación" para tabs
  | "READY_FOR_APPROVAL"
  | "READY_TO_RELEASE"
  | "PARTIALLY_RELEASED"
  | "RELEASED"              // COMPLETADA
  | "REFUNDED"
  | "DISPUTED"              // DISPUTA
  | "CANCELLED"             // CANCELADA
  | "CLOSED";               // COMPLETADA (cerrada administrativamente)

export type StatusTone = "neutral" | "info" | "warn" | "accent" | "ok" | "err";

export type StatusCfg = {
  label: string;
  tone: StatusTone;
  description: string;
};

export const STATUS_CFG: Record<UiStatus, StatusCfg> = {
  DRAFT:              { label: "Borrador",                        tone: "neutral", description: "Transacción creada, aún no enviada o aceptada." },
  PENDING_APPROVAL:   { label: "Pendiente de aprobación",         tone: "warn",    description: "Esperando que la contraparte revise y acepte las condiciones." },
  CHANGES_REQUESTED:  { label: "Cambios solicitados",             tone: "warn",    description: "La contraparte solicitó ajustes antes de aceptar." },
  ACCEPTED:           { label: "Aprobada por contraparte",        tone: "info",    description: "Ambas partes aceptaron condiciones; sigue firma." },
  PENDING_SIGNATURE:  { label: "Pendiente de firma",              tone: "warn",    description: "Contrato listo, esperando firmas." },
  PARTIALLY_SIGNED:   { label: "Firmada parcialmente",            tone: "info",    description: "Al menos una parte firmó el contrato." },
  FULLY_SIGNED:       { label: "Firmada totalmente",              tone: "ok",      description: "Contrato firmado por todas las partes." },
  PENDING_FUNDING:    { label: "Esperando fondeo",                tone: "warn",    description: "El comprador debe realizar el pago." },
  FUNDED:             { label: "Fondos retenidos",                tone: "accent",  description: "El pago fue procesado por la pasarela certificada." },
  IN_PROGRESS:        { label: "En cumplimiento",                 tone: "accent",  description: "Operación activa con hitos en ejecución." },
  IN_VERIFICATION:    { label: "En verificación",                 tone: "info",    description: "Cumplex/verificador revisa evidencia o documentos." },
  READY_FOR_APPROVAL: { label: "Lista para aprobar",              tone: "info",    description: "Evidencia enviada, esperando aprobación del comprador." },
  READY_TO_RELEASE:   { label: "Lista para liberar",              tone: "ok",      description: "Condiciones cumplidas para liberar fondos." },
  PARTIALLY_RELEASED: { label: "Liberación parcial",              tone: "ok",      description: "Ya se liberó una parcialidad al vendedor." },
  RELEASED:           { label: "Completada",                      tone: "ok",      description: "Se liberó el monto total al vendedor." },
  REFUNDED:           { label: "Devuelta",                        tone: "neutral", description: "Fondos devueltos al comprador." },
  DISPUTED:           { label: "En disputa",                      tone: "err",     description: "Operación congelada por controversia." },
  CANCELLED:          { label: "Cancelada",                       tone: "neutral", description: "Operación cancelada antes de cierre." },
  CLOSED:             { label: "Completada",                      tone: "neutral", description: "Operación finalizada administrativamente." },
};

// Mapa DB (snake_case en src/lib/tx.ts) → UI
export const DB_TO_UI_STATUS: Record<TxStatus, UiStatus> = {
  draft:              "DRAFT",
  pending_signature:  "PENDING_SIGNATURE",
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

// Compat: aliases previos usados por código legado
const LEGACY_ALIAS: Record<string, UiStatus> = {
  INVITED: "PENDING_APPROVAL",
};

export function toUiStatus(status: string | null | undefined): UiStatus {
  if (!status) return "DRAFT";
  if (status in STATUS_CFG) return status as UiStatus;
  if (status in LEGACY_ALIAS) return LEGACY_ALIAS[status];
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
    "Cumplex no custodia fondos. Los recursos se procesan y retienen exclusivamente mediante pasarelas certificadas. Cumplex ordena liberaciones o devoluciones conforme al cumplimiento validado.",
  conditionalRelease:
    "Una liberación solo puede ejecutarse cuando las condiciones del hito estén cumplidas, la evidencia esté validada y no exista una disputa activa.",
  activeDispute:
    "Mientras una operación esté en disputa, las liberaciones relacionadas quedan pausadas hasta que exista una resolución.",
  missingDocuments:
    "Esta operación tiene documentos o evidencias pendientes. Completa los requisitos para avanzar al siguiente estado.",
  ledgerNotice:
    "El ledger interno refleja eventos y referencias de la pasarela. No representa custodia directa de fondos por parte de Cumplex.",
} as const;
