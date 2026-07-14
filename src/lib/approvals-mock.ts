// Mock catalog + data for /approvals module (Buyer only).
// Cuando exista persistencia real, sustituir por queries a Supabase.

export type ApprovalStatus =
  | "PENDING"
  | "DUE_SOON"
  | "IN_REVIEW"
  | "CORRECTION_REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "DISPUTED";

export type EvidenceStatus = "COMPLETE" | "PARTIAL" | "MISSING" | "OBSERVED";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type PaymentImpact =
  | "NO_RELEASE"
  | "PARTIAL_RELEASE"
  | "FULL_RELEASE"
  | "INTERNAL_REVIEW"
  | "BLOCKED";

export type SectorId =
  | "AUTOTRANSPORTE"
  | "CONSTRUCCION"
  | "COMERCIO_EXTERIOR"
  | "INMOBILIARIO"
  | "VEHICULOS"
  | "SERVICIOS";

export const SECTOR_CFG: Record<SectorId, { color: string; bg: string; txt: string; emoji: string; label: string }> = {
  AUTOTRANSPORTE:    { color: "#4F46E5", bg: "#EEF2FF", txt: "#3730A3", emoji: "🚛", label: "Autotransporte" },
  CONSTRUCCION:      { color: "#F97316", bg: "#FFF7ED", txt: "#9A3412", emoji: "🏗️", label: "Construcción" },
  COMERCIO_EXTERIOR: { color: "#0EA5E9", bg: "#F0F9FF", txt: "#0C4A6E", emoji: "🌐", label: "Comercio exterior" },
  INMOBILIARIO:      { color: "#8B5CF6", bg: "#F5F3FF", txt: "#4C1D95", emoji: "🏠", label: "Inmobiliario" },
  VEHICULOS:         { color: "#10B981", bg: "#ECFDF5", txt: "#064E3B", emoji: "🚗", label: "Vehículos" },
  SERVICIOS:         { color: "#F43F5E", bg: "#FFF1F2", txt: "#881337", emoji: "💼", label: "Servicios" },
};

export const STATUS_CFG: Record<ApprovalStatus, { label: string; dot: string; bg: string; txt: string }> = {
  PENDING:              { label: "Pendiente",             dot: "#4F46E5", bg: "#EEF2FF", txt: "#4338CA" },
  DUE_SOON:             { label: "Por vencer",            dot: "#D97706", bg: "#FFFBEB", txt: "#B45309" },
  IN_REVIEW:            { label: "En revisión",           dot: "#0284C7", bg: "#F0F9FF", txt: "#075985" },
  CORRECTION_REQUESTED: { label: "Corrección solicitada", dot: "#D97706", bg: "#FFFBEB", txt: "#B45309" },
  APPROVED:             { label: "Aprobado",              dot: "#059669", bg: "#ECFDF5", txt: "#047857" },
  REJECTED:             { label: "Rechazado",             dot: "#DC2626", bg: "#FEF2F2", txt: "#B91C1C" },
  DISPUTED:             { label: "En disputa",            dot: "#DC2626", bg: "#FEF2F2", txt: "#B91C1C" },
};

export type ApprovalCondition = {
  id: string;
  label: string;
  type: "DOCUMENT" | "EVIDENCE" | "DATE" | "GPS" | "CHECKLIST" | "PAYMENT" | "MANUAL";
  required: boolean;
  status: "FULFILLED" | "PENDING" | "OBSERVED" | "NOT_REQUIRED";
  validated_by?: "SYSTEM" | "VERIFIER" | "BUYER";
  comment?: string;
};

export type EvidenceItem = {
  id: string;
  kind: "DOCUMENT" | "IMAGE" | "GPS" | "VIDEO";
  title: string;
  meta: string;
  uploaded_at: string;
  ok: boolean;
};

export type TimelineEvent = {
  at: string;
  actor: string;
  action: string;
};

export type Approval = {
  id: string;
  approval_folio: string;
  transaction_id: string;
  transaction_folio: string;
  transaction_title: string;
  seller_name: string;
  sector: SectorId;
  milestone_id: string;
  milestone_title: string;
  associated_amount: number;
  currency: "MXN" | "USD";
  status: ApprovalStatus;
  evidence_status: EvidenceStatus;
  evidence_count: number;
  required_evidence_count: number;
  compliance_percent: number;
  risk_level: RiskLevel;
  due_at: string;
  submitted_at: string;
  payment_impact: PaymentImpact;
  seller_comment?: string;
  conditions: ApprovalCondition[];
  evidence: EvidenceItem[];
  timeline: TimelineEvent[];
};

export function formatMoney(cents: number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(cents / 100);
}

export function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

const now = Date.now();
const iso = (offsetDays: number) => new Date(now + offsetDays * 86400_000).toISOString();

export const MOCK_APPROVALS: Approval[] = [
  {
    id: "a1", approval_folio: "AP-2026-0041",
    transaction_id: "t1", transaction_folio: "OP-2026-0012", transaction_title: "Entrega de acero estructural",
    seller_name: "Transportes Norte S.A.", sector: "AUTOTRANSPORTE",
    milestone_id: "m1", milestone_title: "Entrega en destino",
    associated_amount: 8_500_000, currency: "MXN",
    status: "PENDING", evidence_status: "COMPLETE",
    evidence_count: 5, required_evidence_count: 5,
    compliance_percent: 100, risk_level: "LOW",
    due_at: iso(3), submitted_at: iso(-1),
    payment_impact: "PARTIAL_RELEASE",
    seller_comment: "Entrega confirmada en planta receptor con firma de acuse.",
    conditions: [
      { id: "c1", label: "CFDI de ingreso cargado y validado", type: "DOCUMENT", required: true, status: "FULFILLED", validated_by: "SYSTEM" },
      { id: "c2", label: "Carta Porte vinculada", type: "DOCUMENT", required: true, status: "FULFILLED", validated_by: "SYSTEM" },
      { id: "c3", label: "Fotos de entrega recibidas", type: "EVIDENCE", required: true, status: "FULFILLED", validated_by: "VERIFIER" },
      { id: "c4", label: "Geolocalización coincidente", type: "GPS", required: true, status: "FULFILLED", validated_by: "SYSTEM" },
      { id: "c5", label: "Checklist firmado por receptor", type: "CHECKLIST", required: true, status: "FULFILLED", validated_by: "VERIFIER" },
    ],
    evidence: [
      { id: "e1", kind: "DOCUMENT", title: "CFDI Ingreso · UUID a1b2-c3d4-...", meta: "XML + PDF · Validado SAT", uploaded_at: iso(-1), ok: true },
      { id: "e2", kind: "DOCUMENT", title: "Carta Porte 2.0", meta: "PDF · Vinculada al CFDI", uploaded_at: iso(-1), ok: true },
      { id: "e3", kind: "IMAGE", title: "Foto entrega 01", meta: "GPS coincidente", uploaded_at: iso(-1), ok: true },
      { id: "e4", kind: "IMAGE", title: "Foto entrega 02", meta: "GPS coincidente", uploaded_at: iso(-1), ok: true },
      { id: "e5", kind: "GPS", title: "Traza GPS", meta: "Ruta completa · 412 km", uploaded_at: iso(-1), ok: true },
    ],
    timeline: [
      { at: iso(-3), actor: "Vendedor", action: "Hito iniciado" },
      { at: iso(-1), actor: "Vendedor", action: "Subió CFDI + Carta Porte" },
      { at: iso(-1), actor: "Vendedor", action: "Marcó hito como listo para revisión" },
    ],
  },
  {
    id: "a2", approval_folio: "AP-2026-0042",
    transaction_id: "t2", transaction_folio: "OP-2026-0017", transaction_title: "Obra civil fase 2",
    seller_name: "Constructora Delta", sector: "CONSTRUCCION",
    milestone_id: "m2", milestone_title: "Avance físico 50%",
    associated_amount: 32_000_000, currency: "MXN",
    status: "DUE_SOON", evidence_status: "PARTIAL",
    evidence_count: 3, required_evidence_count: 5,
    compliance_percent: 72, risk_level: "MEDIUM",
    due_at: iso(0), submitted_at: iso(-2),
    payment_impact: "PARTIAL_RELEASE",
    conditions: [
      { id: "c1", label: "Reporte de avance firmado", type: "DOCUMENT", required: true, status: "FULFILLED" },
      { id: "c2", label: "Fotos por área", type: "EVIDENCE", required: true, status: "FULFILLED" },
      { id: "c3", label: "Bitácora de obra", type: "DOCUMENT", required: true, status: "OBSERVED", comment: "Falta firma del residente" },
      { id: "c4", label: "CFDI de anticipo aplicado", type: "DOCUMENT", required: true, status: "PENDING" },
      { id: "c5", label: "Checklist de calidad", type: "CHECKLIST", required: false, status: "NOT_REQUIRED" },
    ],
    evidence: [
      { id: "e1", kind: "DOCUMENT", title: "Reporte de avance", meta: "PDF · Firmado por director", uploaded_at: iso(-2), ok: true },
      { id: "e2", kind: "IMAGE", title: "Fotos por área (24)", meta: "Galería fotográfica", uploaded_at: iso(-2), ok: true },
      { id: "e3", kind: "DOCUMENT", title: "Bitácora obra", meta: "Falta firma residente", uploaded_at: iso(-2), ok: false },
    ],
    timeline: [
      { at: iso(-2), actor: "Vendedor", action: "Marcó hito listo para revisión" },
    ],
  },
  {
    id: "a3", approval_folio: "AP-2026-0043",
    transaction_id: "t3", transaction_folio: "OP-2026-0022", transaction_title: "Importación equipo médico",
    seller_name: "MedGlobal Trade", sector: "COMERCIO_EXTERIOR",
    milestone_id: "m3", milestone_title: "Liberación aduanal",
    associated_amount: 18_500_000, currency: "USD",
    status: "IN_REVIEW", evidence_status: "COMPLETE",
    evidence_count: 6, required_evidence_count: 6,
    compliance_percent: 95, risk_level: "LOW",
    due_at: iso(5), submitted_at: iso(-1),
    payment_impact: "FULL_RELEASE",
    conditions: [
      { id: "c1", label: "Pedimento cerrado", type: "DOCUMENT", required: true, status: "FULFILLED" },
      { id: "c2", label: "Factura comercial", type: "DOCUMENT", required: true, status: "FULFILLED" },
      { id: "c3", label: "BL / AWB", type: "DOCUMENT", required: true, status: "FULFILLED" },
    ],
    evidence: [],
    timeline: [],
  },
  {
    id: "a4", approval_folio: "AP-2026-0038",
    transaction_id: "t4", transaction_folio: "OP-2026-0009", transaction_title: "Consultoría estratégica Q2",
    seller_name: "Nova Advisors", sector: "SERVICIOS",
    milestone_id: "m4", milestone_title: "Entregable Fase 1",
    associated_amount: 4_200_000, currency: "MXN",
    status: "CORRECTION_REQUESTED", evidence_status: "OBSERVED",
    evidence_count: 2, required_evidence_count: 3,
    compliance_percent: 55, risk_level: "MEDIUM",
    due_at: iso(2), submitted_at: iso(-4),
    payment_impact: "NO_RELEASE",
    conditions: [],
    evidence: [],
    timeline: [
      { at: iso(-4), actor: "Vendedor", action: "Marcó hito listo" },
      { at: iso(-2), actor: "Comprador", action: "Solicitó corrección de entregable" },
    ],
  },
  {
    id: "a5", approval_folio: "AP-2026-0031",
    transaction_id: "t5", transaction_folio: "OP-2026-0005", transaction_title: "Venta departamento 302",
    seller_name: "Inmobiliaria Palma", sector: "INMOBILIARIO",
    milestone_id: "m5", milestone_title: "Escrituración",
    associated_amount: 285_000_000, currency: "MXN",
    status: "APPROVED", evidence_status: "COMPLETE",
    evidence_count: 4, required_evidence_count: 4,
    compliance_percent: 100, risk_level: "LOW",
    due_at: iso(-3), submitted_at: iso(-7),
    payment_impact: "FULL_RELEASE",
    conditions: [], evidence: [], timeline: [],
  },
  {
    id: "a6", approval_folio: "AP-2026-0025",
    transaction_id: "t6", transaction_folio: "OP-2026-0003", transaction_title: "Compra flotilla",
    seller_name: "AutoPlaza MX", sector: "VEHICULOS",
    milestone_id: "m6", milestone_title: "Entrega de unidades",
    associated_amount: 62_000_000, currency: "MXN",
    status: "DISPUTED", evidence_status: "OBSERVED",
    evidence_count: 3, required_evidence_count: 5,
    compliance_percent: 40, risk_level: "HIGH",
    due_at: iso(-7), submitted_at: iso(-10),
    payment_impact: "BLOCKED",
    conditions: [], evidence: [], timeline: [],
  },
];
