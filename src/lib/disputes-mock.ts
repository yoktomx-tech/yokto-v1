// Catálogo + datos mock para /disputes (Comprador y Vendedor).
// Sustituir por queries reales a Supabase (tabla disputes, dispute_evidence, dispute_messages, dispute_resolutions).

export type DisputeStatus =
  | "OPENED"
  | "AWAITING_RESPONSE"
  | "EVIDENCE_REQUESTED"
  | "UNDER_REVIEW"
  | "MEDIATION"
  | "RESOLUTION_PROPOSED"
  | "RESOLVED_RELEASE"
  | "RESOLVED_PARTIAL"
  | "RESOLVED_REFUND"
  | "CANCELLED";

export type DisputePriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type DisputeReason =
  | "NON_DELIVERY"
  | "PARTIAL_DELIVERY"
  | "LATE_DELIVERY"
  | "EVIDENCE_INSUFFICIENT"
  | "DOCUMENT_REJECTED"
  | "QUALITY_ISSUE"
  | "PAYMENT_RELEASE_OBJECTION"
  | "REFUND_REQUEST"
  | "OTHER";

export type SectorId =
  | "AUTOTRANSPORTE"
  | "CONSTRUCCION"
  | "COMERCIO_EXTERIOR"
  | "INMOBILIARIO"
  | "VEHICULOS"
  | "SERVICIOS";

export type PartyRole = "buyer" | "seller" | "internal";

export const SECTOR_CFG: Record<SectorId, { label: string; emoji: string; bg: string; txt: string }> = {
  AUTOTRANSPORTE:    { label: "Autotransporte",     emoji: "🚛", bg: "#EEF2FF", txt: "#3730A3" },
  CONSTRUCCION:      { label: "Construcción",       emoji: "🏗️", bg: "#FFF7ED", txt: "#9A3412" },
  COMERCIO_EXTERIOR: { label: "Comercio exterior",  emoji: "🌐", bg: "#F0F9FF", txt: "#0C4A6E" },
  INMOBILIARIO:      { label: "Inmobiliario",       emoji: "🏠", bg: "#F5F3FF", txt: "#4C1D95" },
  VEHICULOS:         { label: "Vehículos",          emoji: "🚗", bg: "#ECFDF5", txt: "#064E3B" },
  SERVICIOS:         { label: "Servicios",          emoji: "💼", bg: "#FFF1F2", txt: "#881337" },
};

export const STATUS_CFG: Record<DisputeStatus, { label: string; dot: string; bg: string; txt: string }> = {
  OPENED:              { label: "Abierta",              dot: "#D97706", bg: "#FFFBEB", txt: "#B45309" },
  AWAITING_RESPONSE:   { label: "Respuesta pendiente",  dot: "#DC2626", bg: "#FEF2F2", txt: "#B91C1C" },
  EVIDENCE_REQUESTED:  { label: "Evidencia solicitada", dot: "#0284C7", bg: "#F0F9FF", txt: "#075985" },
  UNDER_REVIEW:        { label: "En revisión",          dot: "#4F46E5", bg: "#EEF2FF", txt: "#3730A3" },
  MEDIATION:           { label: "En mediación",         dot: "#D97706", bg: "#FFFBEB", txt: "#B45309" },
  RESOLUTION_PROPOSED: { label: "Resolución propuesta", dot: "#0284C7", bg: "#F0F9FF", txt: "#075985" },
  RESOLVED_RELEASE:    { label: "Resuelta: liberar",    dot: "#059669", bg: "#ECFDF5", txt: "#047857" },
  RESOLVED_PARTIAL:    { label: "Resuelta: parcial",    dot: "#D97706", bg: "#FFFBEB", txt: "#B45309" },
  RESOLVED_REFUND:     { label: "Resuelta: devolución", dot: "#DC2626", bg: "#FEF2F2", txt: "#B91C1C" },
  CANCELLED:           { label: "Cancelada",            dot: "#71717A", bg: "#F4F4F7", txt: "#52525B" },
};

export const PRIORITY_CFG: Record<DisputePriority, { label: string; dot: string; bg: string; txt: string }> = {
  LOW:      { label: "Baja",     dot: "#71717A", bg: "#F4F4F7", txt: "#52525B" },
  MEDIUM:   { label: "Media",    dot: "#0284C7", bg: "#F0F9FF", txt: "#075985" },
  HIGH:     { label: "Alta",     dot: "#D97706", bg: "#FFFBEB", txt: "#B45309" },
  CRITICAL: { label: "Crítica",  dot: "#DC2626", bg: "#FEF2F2", txt: "#B91C1C" },
};

export const REASON_LABEL: Record<DisputeReason, string> = {
  NON_DELIVERY:              "No entrega",
  PARTIAL_DELIVERY:          "Entrega parcial",
  LATE_DELIVERY:             "Entrega tardía",
  EVIDENCE_INSUFFICIENT:     "Evidencia insuficiente",
  DOCUMENT_REJECTED:         "Documento rechazado",
  QUALITY_ISSUE:             "Calidad no conforme",
  PAYMENT_RELEASE_OBJECTION: "Objeción a liberación",
  REFUND_REQUEST:            "Solicitud de devolución",
  OTHER:                     "Otro motivo",
};

export type EvidenceKind = "DOCUMENT" | "PHOTO" | "VIDEO" | "GPS" | "CHECKLIST";
export type EvidenceValidation = "PENDING" | "VALIDATED" | "REJECTED";

export type DisputeEvidence = {
  id: string;
  kind: EvidenceKind;
  title: string;
  uploaded_by_role: PartyRole;
  uploaded_by_name: string;
  uploaded_at: string;
  milestone_id?: string | null;
  milestone_label?: string | null;
  hash: string;
  validation: EvidenceValidation;
  comments?: string;
};

export type MessageVisibility = "public" | "internal" | "to_buyer" | "to_seller";
export type DisputeMessage = {
  id: string;
  sender_role: PartyRole;
  sender_name: string;
  visibility: MessageVisibility;
  body: string;
  attachments?: string[];
  created_at: string;
};

export type DisputeMilestone = {
  id: string;
  label: string;
  status: "EN_DISPUTA" | "EVIDENCIA_INSUFICIENTE" | "PENDIENTE_CORRECCION" | "LISTO_REVISION" | "RESUELTO";
  affected_amount_cents: number;
  evidence_state: "COMPLETA" | "INCOMPLETA";
  due_at: string;
};

export type TimelineEvent = {
  at: string;
  actor: string;
  action: string;
  hash?: string;
};

export type DisputeResolution = {
  resolution_type: "RELEASE" | "REFUND" | "PARTIAL" | "CORRECTION" | "AGREEMENT" | "IMPROCEDENT";
  amount_release_cents: number;
  amount_refund_cents: number;
  rationale: string;
  proposed_by: string;
  proposed_at: string;
  accepted_by_buyer: boolean;
  accepted_by_seller: boolean;
  finalized_at?: string;
  execution_status: "PENDING" | "PROCESSED" | "FAILED";
};

export type Dispute = {
  id: string;
  code: string;                 // DSP-1048
  transaction_id: string;
  transaction_folio: string;    // OP-2091
  transaction_title: string;
  sector: SectorId;
  buyer_name: string;
  seller_name: string;
  opened_by_role: PartyRole;
  against_role: PartyRole;
  reason: DisputeReason;
  description: string;
  requested_outcome: "release" | "refund" | "correction" | "partial";
  status: DisputeStatus;
  priority: DisputePriority;
  affected_amount_cents: number;
  held_amount_cents: number;
  total_amount_cents: number;
  currency: string;
  sla_due_at: string;
  created_at: string;
  updated_at: string;
  last_activity_by: string;
  milestones: DisputeMilestone[];
  evidence: DisputeEvidence[];
  messages: DisputeMessage[];
  timeline: TimelineEvent[];
  resolution?: DisputeResolution;
};

// ---------- Utilidades ----------

export function slaLabel(sla: string): { text: string; tone: "ok" | "warn" | "err" } {
  const ms = new Date(sla).getTime() - Date.now();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  if (ms < 0) return { text: `Vencido hace ${Math.abs(days)}d`, tone: "err" };
  if (days <= 1) return { text: `Vence hoy`, tone: "warn" };
  if (days <= 3) return { text: `${days}d restantes`, tone: "warn" };
  return { text: `${days}d restantes`, tone: "ok" };
}

export function isResolved(s: DisputeStatus) {
  return s === "RESOLVED_RELEASE" || s === "RESOLVED_PARTIAL" || s === "RESOLVED_REFUND";
}
export function isClosed(s: DisputeStatus) {
  return isResolved(s) || s === "CANCELLED";
}

// ---------- Mock data ----------

const now = Date.now();
const iso = (d: number) => new Date(d).toISOString();
const days = (n: number) => 1000 * 60 * 60 * 24 * n;

export const MOCK_DISPUTES: Dispute[] = [
  {
    id: "d-1048",
    code: "DSP-1048",
    transaction_id: "t-2091",
    transaction_folio: "OP-2091",
    transaction_title: "Traslado industrial CDMX → Monterrey",
    sector: "AUTOTRANSPORTE",
    buyer_name: "Industrias Norte SA",
    seller_name: "Transportes Delta",
    opened_by_role: "buyer",
    against_role: "seller",
    reason: "EVIDENCE_INSUFFICIENT",
    description:
      "La carta porte entregada no contiene sellos de destino ni evidencia GPS del último tramo. Solicitamos completar el expediente.",
    requested_outcome: "correction",
    status: "MEDIATION",
    priority: "HIGH",
    affected_amount_cents: 8_450_000,
    held_amount_cents: 8_450_000,
    total_amount_cents: 12_800_000,
    currency: "MXN",
    sla_due_at: iso(now + days(2)),
    created_at: iso(now - days(4)),
    updated_at: iso(now - days(0.2)),
    last_activity_by: "Transportes Delta",
    milestones: [
      { id: "m1", label: "Hito 1 · Recolección origen", status: "RESUELTO",             affected_amount_cents: 2_000_000, evidence_state: "COMPLETA",   due_at: iso(now - days(6)) },
      { id: "m2", label: "Hito 2 · Entrega final",      status: "EVIDENCIA_INSUFICIENTE", affected_amount_cents: 6_450_000, evidence_state: "INCOMPLETA", due_at: iso(now + days(2)) },
    ],
    evidence: [
      { id: "ev1", kind: "DOCUMENT", title: "Carta Porte v1.pdf", uploaded_by_role: "seller", uploaded_by_name: "Transportes Delta", uploaded_at: iso(now - days(3)), milestone_id: "m2", milestone_label: "Hito 2", hash: "9AF3...82C1", validation: "REJECTED", comments: "Falta sello destino." },
      { id: "ev2", kind: "PHOTO",    title: "Foto contenedor origen.jpg", uploaded_by_role: "seller", uploaded_by_name: "Transportes Delta", uploaded_at: iso(now - days(3)), milestone_id: "m1", milestone_label: "Hito 1", hash: "B2C4...11A9", validation: "VALIDATED" },
      { id: "ev3", kind: "GPS",      title: "Traza GPS tramo 1.geojson", uploaded_by_role: "seller", uploaded_by_name: "Transportes Delta", uploaded_at: iso(now - days(3)), hash: "77E2...4488", validation: "VALIDATED" },
      { id: "ev4", kind: "DOCUMENT", title: "Objeción documental.pdf", uploaded_by_role: "buyer", uploaded_by_name: "Industrias Norte SA", uploaded_at: iso(now - days(4)), hash: "12FA...9931", validation: "VALIDATED" },
    ],
    messages: [
      { id: "msg1", sender_role: "buyer",  sender_name: "Industrias Norte SA", visibility: "public", body: "Abrimos disputa por documentación incompleta en la entrega final.", created_at: iso(now - days(4)) },
      { id: "msg2", sender_role: "seller", sender_name: "Transportes Delta",   visibility: "public", body: "Adjuntamos la carta porte y evidencia GPS del primer tramo.", created_at: iso(now - days(3)) },
      { id: "msg3", sender_role: "internal", sender_name: "Mediación CUMPLEX", visibility: "public", body: "Solicitamos al vendedor entregar sellos del destino final.", created_at: iso(now - days(1)) },
    ],
    timeline: [
      { at: iso(now - days(4)), actor: "Industrias Norte SA", action: "Disputa abierta" },
      { at: iso(now - days(3)), actor: "Transportes Delta",   action: "Evidencia agregada: Carta Porte v1.pdf", hash: "9AF3...82C1" },
      { at: iso(now - days(1)), actor: "Mediación CUMPLEX",     action: "Evidencia adicional solicitada" },
      { at: iso(now - days(0.2)), actor: "Transportes Delta", action: "Comentario enviado" },
    ],
  },
  {
    id: "d-1050",
    code: "DSP-1050",
    transaction_id: "t-2107",
    transaction_folio: "OP-2107",
    transaction_title: "Suministro varilla estructural obra Polanco",
    sector: "CONSTRUCCION",
    buyer_name: "Constructora Vega",
    seller_name: "Acero MX",
    opened_by_role: "buyer",
    against_role: "seller",
    reason: "PARTIAL_DELIVERY",
    description: "Entrega parcial: se recibieron 12 de 20 toneladas pactadas.",
    requested_outcome: "partial",
    status: "AWAITING_RESPONSE",
    priority: "CRITICAL",
    affected_amount_cents: 22_000_000,
    held_amount_cents: 55_000_000,
    total_amount_cents: 55_000_000,
    currency: "MXN",
    sla_due_at: iso(now - days(1)),
    created_at: iso(now - days(6)),
    updated_at: iso(now - days(2)),
    last_activity_by: "Constructora Vega",
    milestones: [
      { id: "m1", label: "Hito 1 · Entrega total 20T", status: "EN_DISPUTA", affected_amount_cents: 22_000_000, evidence_state: "INCOMPLETA", due_at: iso(now - days(2)) },
    ],
    evidence: [
      { id: "ev1", kind: "PHOTO", title: "Recepción obra 12T.jpg", uploaded_by_role: "buyer", uploaded_by_name: "Constructora Vega", uploaded_at: iso(now - days(2)), hash: "AA11...BB22", validation: "VALIDATED" },
    ],
    messages: [
      { id: "msg1", sender_role: "buyer", sender_name: "Constructora Vega", visibility: "public", body: "Se recibieron 12 de 20 toneladas. Solicitamos devolución parcial del monto no entregado.", created_at: iso(now - days(6)) },
    ],
    timeline: [
      { at: iso(now - days(6)), actor: "Constructora Vega", action: "Disputa abierta" },
      { at: iso(now - days(2)), actor: "Constructora Vega", action: "Evidencia agregada: Recepción obra 12T.jpg" },
    ],
  },
  {
    id: "d-1051",
    code: "DSP-1051",
    transaction_id: "t-2110",
    transaction_folio: "OP-2110",
    transaction_title: "Consultoría de arquitectura fase 2",
    sector: "SERVICIOS",
    buyer_name: "Grupo Alfa",
    seller_name: "Estudio Nova",
    opened_by_role: "buyer",
    against_role: "seller",
    reason: "QUALITY_ISSUE",
    description: "Los entregables no cumplen las especificaciones del anexo técnico.",
    requested_outcome: "correction",
    status: "RESOLUTION_PROPOSED",
    priority: "MEDIUM",
    affected_amount_cents: 4_500_000,
    held_amount_cents: 4_500_000,
    total_amount_cents: 9_000_000,
    currency: "MXN",
    sla_due_at: iso(now + days(1)),
    created_at: iso(now - days(9)),
    updated_at: iso(now - days(0.5)),
    last_activity_by: "Mediación CUMPLEX",
    milestones: [
      { id: "m1", label: "Hito 2 · Entregables fase 2", status: "LISTO_REVISION", affected_amount_cents: 4_500_000, evidence_state: "COMPLETA", due_at: iso(now - days(2)) },
    ],
    evidence: [],
    messages: [],
    timeline: [
      { at: iso(now - days(9)), actor: "Grupo Alfa",       action: "Disputa abierta" },
      { at: iso(now - days(0.5)), actor: "Mediación CUMPLEX", action: "Resolución propuesta: parcial" },
    ],
    resolution: {
      resolution_type: "PARTIAL",
      amount_release_cents: 2_500_000,
      amount_refund_cents: 2_000_000,
      rationale: "Se acredita cumplimiento parcial. Se libera monto proporcional a entregables aceptados.",
      proposed_by: "Mediación CUMPLEX",
      proposed_at: iso(now - days(0.5)),
      accepted_by_buyer: false,
      accepted_by_seller: false,
      execution_status: "PENDING",
    },
  },
  {
    id: "d-1042",
    code: "DSP-1042",
    transaction_id: "t-2081",
    transaction_folio: "OP-2081",
    transaction_title: "Importación equipo industrial (COMEX)",
    sector: "COMERCIO_EXTERIOR",
    buyer_name: "Manufactura Sigma",
    seller_name: "Global Traders BV",
    opened_by_role: "buyer",
    against_role: "seller",
    reason: "DOCUMENT_REJECTED",
    description: "BL con inconsistencias en descripción de mercancía.",
    requested_outcome: "correction",
    status: "RESOLVED_RELEASE",
    priority: "MEDIUM",
    affected_amount_cents: 18_500_000,
    held_amount_cents: 0,
    total_amount_cents: 32_000_000,
    currency: "MXN",
    sla_due_at: iso(now - days(15)),
    created_at: iso(now - days(30)),
    updated_at: iso(now - days(10)),
    last_activity_by: "Mediación CUMPLEX",
    milestones: [
      { id: "m1", label: "Hito 3 · Liberación aduanal", status: "RESUELTO", affected_amount_cents: 18_500_000, evidence_state: "COMPLETA", due_at: iso(now - days(20)) },
    ],
    evidence: [],
    messages: [],
    timeline: [
      { at: iso(now - days(30)), actor: "Manufactura Sigma", action: "Disputa abierta" },
      { at: iso(now - days(10)), actor: "Mediación CUMPLEX",   action: "Resolución final: liberar" },
    ],
    resolution: {
      resolution_type: "RELEASE",
      amount_release_cents: 18_500_000,
      amount_refund_cents: 0,
      rationale: "Documentación corregida y validada. Procede liberación total.",
      proposed_by: "Mediación CUMPLEX",
      proposed_at: iso(now - days(12)),
      accepted_by_buyer: true,
      accepted_by_seller: true,
      finalized_at: iso(now - days(10)),
      execution_status: "PROCESSED",
    },
  },
];

// ---------- Permisos ----------

export type ActorRole = "buyer" | "seller" | "backoffice" | "auditor";

export function canOpenDispute(role: ActorRole) {
  return role === "buyer" || role === "seller";
}
export function canRespond(role: ActorRole, d: Dispute) {
  if (isClosed(d.status)) return false;
  if (role === "seller" && d.against_role === "seller") return true;
  if (role === "buyer" && d.status === "EVIDENCE_REQUESTED") return true;
  return false;
}
export function canAddEvidence(role: ActorRole, d: Dispute) {
  return (role === "buyer" || role === "seller") && !isClosed(d.status);
}
export function canProposeResolution(role: ActorRole) {
  return role === "backoffice";
}
export function canAcceptResolution(role: ActorRole, d: Dispute) {
  return (role === "buyer" || role === "seller") && d.status === "RESOLUTION_PROPOSED";
}
export function canRequestReview(role: ActorRole, d: Dispute) {
  return (role === "buyer" || role === "seller") && d.status === "RESOLUTION_PROPOSED";
}
