// Mock catalog + data for /approvals module (Buyer only).
// Centro de decisión de cumplimiento y liberación.

export type ApprovalStatus =
  | "POR_REVISAR"
  | "LISTO"
  | "BLOQUEADO"
  | "CORRECCION_SOLICITADA"
  | "APROBADO"
  | "RECHAZADO"
  | "DISPUTA";

export type EvidenceStatus = "COMPLETE" | "PARTIAL" | "MISSING" | "OBSERVED";
export type RiskLevel = "BAJO" | "MEDIO" | "ALTO" | "CRITICO";
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
  POR_REVISAR:           { label: "Por revisar",             dot: "#4F46E5", bg: "#EEF2FF", txt: "#4338CA" },
  LISTO:                 { label: "Listo para liberar",      dot: "#059669", bg: "#ECFDF5", txt: "#047857" },
  BLOQUEADO:             { label: "Bloqueado",               dot: "#D97706", bg: "#FFFBEB", txt: "#B45309" },
  CORRECCION_SOLICITADA: { label: "Corrección solicitada",   dot: "#D97706", bg: "#FFFBEB", txt: "#B45309" },
  APROBADO:              { label: "Aprobado",                dot: "#059669", bg: "#ECFDF5", txt: "#047857" },
  RECHAZADO:             { label: "Rechazado",               dot: "#DC2626", bg: "#FEF2F2", txt: "#B91C1C" },
  DISPUTA:               { label: "En disputa",              dot: "#DC2626", bg: "#FEF2F2", txt: "#B91C1C" },
};

/* ─────────────── Checklist ─────────────── */

export type CheckState = "OK" | "WARNING" | "ERROR" | "PENDING" | "NOT_REQUIRED";

export const CHECK_CFG: Record<CheckState, { label: string; color: string; bg: string; icon: "ok" | "warn" | "err" | "pending" | "na" }> = {
  OK:            { label: "OK",           color: "#047857", bg: "#ECFDF5", icon: "ok" },
  WARNING:       { label: "Advertencia",  color: "#B45309", bg: "#FFFBEB", icon: "warn" },
  ERROR:         { label: "Bloqueo",      color: "#B91C1C", bg: "#FEF2F2", icon: "err" },
  PENDING:       { label: "Pendiente",    color: "#4338CA", bg: "#EEF2FF", icon: "pending" },
  NOT_REQUIRED:  { label: "No aplica",    color: "#71717A", bg: "#F4F4F5", icon: "na" },
};

export type ApprovalChecklist = {
  contract_signed: CheckState;
  cfdi_ppd_accepted: CheckState;
  rep_previous_ok: CheckState;
  required_documents_ok: CheckState;
  evidence_ok: CheckState;
  sector_requirements_ok: CheckState;
  payment_hold_confirmed: CheckState;
  no_active_dispute: CheckState;
  seller_kyc_ok: CheckState;
};

export const CHECKLIST_LABELS: Record<keyof ApprovalChecklist, string> = {
  contract_signed:         "Contrato firmado por ambas partes",
  cfdi_ppd_accepted:       "CFDI PPD aceptado",
  rep_previous_ok:         "REP parcialidad anterior aceptado",
  required_documents_ok:   "Documentos requeridos completos",
  evidence_ok:             "Evidencia física completa",
  sector_requirements_ok:  "Validación sectorial aprobada",
  payment_hold_confirmed:  "Fondos retenidos confirmados en pasarela",
  no_active_dispute:       "Sin disputa activa",
  seller_kyc_ok:           "Vendedor verificado (KYC)",
};

/* ─────────────── Contrato y firmas ─────────────── */

export type ContractStatus =
  | "SIN_CONTRATO"
  | "PENDIENTE_FIRMA"
  | "EN_FIRMA"
  | "FIRMADO_PARCIAL"
  | "FIRMADO_COMPLETO"
  | "RECHAZADO";

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  SIN_CONTRATO:     "Sin contrato",
  PENDIENTE_FIRMA:  "Pendiente de firma",
  EN_FIRMA:         "En proceso de firma",
  FIRMADO_PARCIAL:  "Firmado parcial",
  FIRMADO_COMPLETO: "Firmado completo",
  RECHAZADO:        "Rechazado",
};

export type SignatureMethod = "AUTOGRAFA_DIGITAL_BIOMETRICA" | "EFIRMA_SAT" | "SIN_DEFINIR";

export type ContractSignature = {
  party: "COMPRADOR" | "VENDEDOR";
  name: string;
  method: SignatureMethod;
  signed: boolean;
  signedAt?: string;
  faceMatch?: number;
  rfc?: string;
};

export type ContractInfo = {
  status: ContractStatus;
  method: "PDF_UPLOAD" | "GENERADO_AUTOMATICO";
  templateName?: string;
  version: number;
  hash: string;
  signatures: ContractSignature[];
};

/* ─────────────── Fiscal CFDI / REP ─────────────── */

export type FiscalStatus =
  | "SIN_CFDI"
  | "CFDI_EN_REVISION"
  | "CFDI_ACEPTADO"
  | "CFDI_RECHAZADO"
  | "REP_PENDIENTE"
  | "REP_EN_REVISION"
  | "REP_ACEPTADO"
  | "REP_RECHAZADO";

export const FISCAL_STATUS_LABEL: Record<FiscalStatus, string> = {
  SIN_CFDI:         "Sin CFDI",
  CFDI_EN_REVISION: "CFDI en revisión",
  CFDI_ACEPTADO:    "CFDI aceptado",
  CFDI_RECHAZADO:   "CFDI rechazado",
  REP_PENDIENTE:    "REP pendiente",
  REP_EN_REVISION:  "REP en revisión",
  REP_ACEPTADO:     "REP aceptado",
  REP_RECHAZADO:    "REP rechazado",
};

export type CFDICheck = { label: string; state: CheckState };

export type CFDIInfo = {
  status: FiscalStatus;
  uuid?: string;
  total?: number;
  metodoPago?: "PPD" | "PUE";
  formaPago?: string;
  estadoSAT?: "VIGENTE" | "CANCELADO" | "NO_ENCONTRADO";
  coherenceScore?: number;
  checks: CFDICheck[];
  observacion?: string;
};

export type REPInfo = {
  id: string;
  numParcialidad: number;
  totalParcialidades: number;
  uuidRep?: string;
  uuidCfdiOrigen?: string;
  impSaldoAnt: number;
  impPagado: number;
  impSaldoInsoluto: number;
  formaDePagoP?: string;
  status: FiscalStatus;
  observacion?: string;
};

export type FiscalInfo = {
  emisorRfc: string;
  receptorRfc: string;
  usoCfdi: string;
  cpReceptor: string;
  totalOperacion: number;
  conceptoSugerido: string;
  cfdi: CFDIInfo;
  reps: REPInfo[];
};

/* ─────────────── Requisitos sectoriales ─────────────── */

export type SectorReqStatus = "PENDIENTE" | "EN_PROCESO" | "COMPLETO" | "OBSERVADO" | "RECHAZADO";

export type SectorRequirement = {
  id: string;
  label: string;
  type: "DOCUMENTO" | "EVIDENCIA" | "CHECKLIST" | "VALIDACION_API" | "GPS" | "FOTO";
  status: SectorReqStatus;
  detail?: string;
};

export const SECTOR_REQ_TONE: Record<SectorReqStatus, { bg: string; txt: string; dot: string }> = {
  PENDIENTE:  { bg: "#F4F4F5", txt: "#52525B", dot: "#A1A1AA" },
  EN_PROCESO: { bg: "#EEF2FF", txt: "#4338CA", dot: "#4F46E5" },
  COMPLETO:   { bg: "#ECFDF5", txt: "#047857", dot: "#059669" },
  OBSERVADO:  { bg: "#FFFBEB", txt: "#B45309", dot: "#D97706" },
  RECHAZADO:  { bg: "#FEF2F2", txt: "#B91C1C", dot: "#DC2626" },
};

/* ─────────────── Candados ─────────────── */

export type ApprovalLockType =
  | "CONTRACT_NOT_SIGNED"
  | "CONTRACT_REJECTED"
  | "CFDI_NOT_UPLOADED"
  | "CFDI_NOT_ACCEPTED"
  | "CFDI_REJECTED"
  | "REP_PREVIOUS_PENDING"
  | "DOCUMENT_REQUIRED_MISSING"
  | "EVIDENCE_REQUIRED_MISSING"
  | "SECTOR_REQUIREMENT_PENDING"
  | "PAYMENT_NOT_CONFIRMED"
  | "DISPUTE_ACTIVE"
  | "SELLER_KYC_INCOMPLETE"
  | "MANUAL_REVIEW_REQUIRED";

export const LOCK_LABEL: Record<ApprovalLockType, string> = {
  CONTRACT_NOT_SIGNED:        "Contrato no firmado",
  CONTRACT_REJECTED:          "Contrato rechazado",
  CFDI_NOT_UPLOADED:          "CFDI no subido",
  CFDI_NOT_ACCEPTED:          "CFDI PPD pendiente de aceptación",
  CFDI_REJECTED:              "CFDI rechazado",
  REP_PREVIOUS_PENDING:       "REP de parcialidad anterior pendiente",
  DOCUMENT_REQUIRED_MISSING:  "Documento requerido faltante",
  EVIDENCE_REQUIRED_MISSING:  "Evidencia requerida faltante",
  SECTOR_REQUIREMENT_PENDING: "Requisito sectorial pendiente",
  PAYMENT_NOT_CONFIRMED:      "Pago no confirmado en pasarela",
  DISPUTE_ACTIVE:             "Disputa activa",
  SELLER_KYC_INCOMPLETE:      "KYC del vendedor incompleto",
  MANUAL_REVIEW_REQUIRED:     "Requiere revisión manual del backoffice",
};

export type ApprovalLock = {
  type: ApprovalLockType;
  detail?: string;
  blocksApproval: boolean;
  blocksRelease: boolean;
};

/* ─────────────── Evidencia / condiciones / timeline ─────────────── */

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

/* ─────────────── Approval (item unificado) ─────────────── */

export type Approval = {
  id: string;
  approval_folio: string;
  transaction_id: string;
  transaction_folio: string;
  transaction_title: string;
  seller_name: string;
  seller_rfc: string;
  sector: SectorId;
  milestone_id: string;
  milestone_title: string;
  milestone_order: number;
  associated_amount: number; // cents
  commission_pct: number; // e.g. 0.018 → 1.8%
  vat_pct: number; // 0.16
  held_after_release: number; // cents (saldo retenido restante)
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

  // Nuevas dimensiones
  checklist: ApprovalChecklist;
  contract: ContractInfo;
  fiscal: FiscalInfo;
  sector_requirements: SectorRequirement[];
  locks: ApprovalLock[];

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

export function computeReleaseImpact(a: Approval) {
  const gross = a.associated_amount;
  const commission = Math.round(gross * a.commission_pct);
  const vat = Math.round(commission * a.vat_pct);
  const net = gross - commission - vat;
  return { gross, commission, vat, net, heldAfter: a.held_after_release };
}

/* ─────────────── Fixtures ─────────────── */

const now = Date.now();
const iso = (offsetDays: number) => new Date(now + offsetDays * 86400_000).toISOString();

// Sectoral requirement builders (defaults por sector)
function defaultsFor(sector: SectorId): SectorRequirement[] {
  switch (sector) {
    case "AUTOTRANSPORTE":
      return [
        { id: "cp",   label: "Carta Porte 2.0 validada",     type: "VALIDACION_API", status: "COMPLETO" },
        { id: "gps",  label: "GPS coincide con destino",     type: "GPS",            status: "COMPLETO", detail: "Ruta 412 km" },
        { id: "fc",   label: "Foto de carga",                type: "FOTO",           status: "COMPLETO" },
        { id: "fd",   label: "Foto de descarga",             type: "FOTO",           status: "COMPLETO" },
        { id: "fr",   label: "Firma del receptor",           type: "EVIDENCIA",      status: "COMPLETO" },
      ];
    case "VEHICULOS":
      return [
        { id: "rep",  label: "REPUVE libre de reporte",      type: "VALIDACION_API", status: "COMPLETO" },
        { id: "vin",  label: "VIN/NIV validado",             type: "VALIDACION_API", status: "COMPLETO" },
        { id: "chk",  label: "Checklist 96 puntos",          type: "CHECKLIST",      status: "OBSERVADO", detail: "2 puntos REGULAR" },
        { id: "fot",  label: "25/25 fotos vehículo",         type: "FOTO",           status: "COMPLETO" },
        { id: "fac",  label: "Factura del vehículo",         type: "DOCUMENTO",      status: "COMPLETO" },
      ];
    case "CONSTRUCCION":
      return [
        { id: "rps",  label: "REPSE vigente",                type: "VALIDACION_API", status: "COMPLETO" },
        { id: "est",  label: "Estimación de obra",           type: "DOCUMENTO",      status: "COMPLETO" },
        { id: "fot",  label: "Fotos de avance",              type: "FOTO",           status: "COMPLETO" },
        { id: "sup",  label: "Acta de supervisor",           type: "DOCUMENTO",      status: "PENDIENTE" },
      ];
    case "COMERCIO_EXTERIOR":
      return [
        { id: "bl",   label: "BL / AWB",                     type: "DOCUMENTO",      status: "COMPLETO" },
        { id: "ped",  label: "Pedimento cerrado",            type: "DOCUMENTO",      status: "COMPLETO" },
        { id: "fac",  label: "Factura comercial",            type: "DOCUMENTO",      status: "COMPLETO" },
        { id: "pl",   label: "Packing list",                 type: "DOCUMENTO",      status: "PENDIENTE" },
        { id: "trk",  label: "Tracking de embarque",         type: "EVIDENCIA",      status: "EN_PROCESO" },
      ];
    case "INMOBILIARIO":
      return [
        { id: "esc",  label: "Escritura",                    type: "DOCUMENTO",      status: "COMPLETO" },
        { id: "ava",  label: "Avalúo vigente",               type: "DOCUMENTO",      status: "COMPLETO" },
        { id: "lib",  label: "Libertad de gravamen",         type: "DOCUMENTO",      status: "COMPLETO" },
        { id: "pre",  label: "Predial al corriente",         type: "DOCUMENTO",      status: "PENDIENTE" },
      ];
    case "SERVICIOS":
      return [
        { id: "pro",  label: "Propuesta aprobada",           type: "DOCUMENTO",      status: "COMPLETO" },
        { id: "ent",  label: "Entregable digital",           type: "EVIDENCIA",      status: "COMPLETO" },
        { id: "act",  label: "Acta de aceptación",           type: "DOCUMENTO",      status: "PENDIENTE" },
      ];
  }
}

// Helper: quick contract builder
function contract(status: ContractStatus, both = false): ContractInfo {
  return {
    status,
    method: "GENERADO_AUTOMATICO",
    templateName: "Contrato Cumplex — Servicios",
    version: 2,
    hash: "9f2a…c81e",
    signatures: [
      { party: "COMPRADOR", name: "Comercializadora ABC", method: "EFIRMA_SAT", signed: both || status === "FIRMADO_PARCIAL" || status === "FIRMADO_COMPLETO", signedAt: iso(-3), rfc: "ABC010101XX1" },
      { party: "VENDEDOR",  name: "Vendedor",             method: "AUTOGRAFA_DIGITAL_BIOMETRICA", signed: status === "FIRMADO_COMPLETO", signedAt: status === "FIRMADO_COMPLETO" ? iso(-2) : undefined, faceMatch: 96 },
    ],
  };
}

function defaultCfdiChecks(ok = true): CFDICheck[] {
  return [
    { label: "RFC emisor coincide con vendedor",     state: ok ? "OK" : "ERROR" },
    { label: "RFC receptor coincide con comprador",  state: "OK" },
    { label: "Monto coincide con operación",         state: ok ? "OK" : "WARNING" },
    { label: "MétodoPago PPD correcto",              state: "OK" },
    { label: "FormaPago 99 correcto",                state: "OK" },
    { label: "TFD presente",                         state: "OK" },
    { label: "Concepto suficientemente descriptivo", state: ok ? "OK" : "WARNING" },
  ];
}

function computeChecklist(op: Partial<Approval>): ApprovalChecklist {
  const c = op.contract!;
  const f = op.fiscal!;
  const secs = op.sector_requirements ?? [];
  const evidenceOk = (op.evidence_count ?? 0) >= (op.required_evidence_count ?? 0);
  const anyRepPending = f.reps.some((r) => r.numParcialidad < (op.milestone_order ?? 99) && r.status !== "REP_ACEPTADO");
  return {
    contract_signed:        c.status === "FIRMADO_COMPLETO" ? "OK" : c.status === "RECHAZADO" ? "ERROR" : "PENDING",
    cfdi_ppd_accepted:      f.cfdi.status === "CFDI_ACEPTADO" ? "OK" : f.cfdi.status === "CFDI_RECHAZADO" ? "ERROR" : f.cfdi.status === "SIN_CFDI" ? "PENDING" : "PENDING",
    rep_previous_ok:        f.reps.length === 0 ? "NOT_REQUIRED" : anyRepPending ? "ERROR" : "OK",
    required_documents_ok:  evidenceOk ? "OK" : "WARNING",
    evidence_ok:            evidenceOk ? "OK" : "WARNING",
    sector_requirements_ok: secs.every((s) => s.status === "COMPLETO") ? "OK" : secs.some((s) => s.status === "RECHAZADO") ? "ERROR" : "WARNING",
    payment_hold_confirmed: "OK",
    no_active_dispute:      op.status === "DISPUTA" ? "ERROR" : "OK",
    seller_kyc_ok:          "OK",
  };
}

function computeLocks(op: Partial<Approval>): ApprovalLock[] {
  const locks: ApprovalLock[] = [];
  const c = op.contract!;
  const f = op.fiscal!;
  const secs = op.sector_requirements ?? [];
  if (c.status !== "FIRMADO_COMPLETO") {
    locks.push({ type: c.status === "RECHAZADO" ? "CONTRACT_REJECTED" : "CONTRACT_NOT_SIGNED", blocksApproval: true, blocksRelease: true, detail: "Debe estar firmado por comprador y vendedor." });
  }
  if (f.cfdi.status === "SIN_CFDI") {
    locks.push({ type: "CFDI_NOT_UPLOADED", blocksApproval: true, blocksRelease: true, detail: "El vendedor debe subir el CFDI PPD timbrado." });
  } else if (f.cfdi.status === "CFDI_EN_REVISION") {
    locks.push({ type: "CFDI_NOT_ACCEPTED", blocksApproval: true, blocksRelease: true, detail: "Revisa el CFDI y acéptalo o recházalo para continuar." });
  } else if (f.cfdi.status === "CFDI_RECHAZADO") {
    locks.push({ type: "CFDI_REJECTED", blocksApproval: true, blocksRelease: true, detail: "El vendedor debe subir un CFDI corregido." });
  }
  const previousREPPending = f.reps.some((r) => r.numParcialidad < (op.milestone_order ?? 99) && r.status !== "REP_ACEPTADO");
  if (previousREPPending) {
    locks.push({ type: "REP_PREVIOUS_PENDING", blocksApproval: true, blocksRelease: true, detail: "Acepta el REP de parcialidades previas antes de aprobar esta." });
  }
  if ((op.evidence_count ?? 0) < (op.required_evidence_count ?? 0)) {
    locks.push({ type: "EVIDENCE_REQUIRED_MISSING", blocksApproval: true, blocksRelease: true, detail: `Faltan ${(op.required_evidence_count ?? 0) - (op.evidence_count ?? 0)} evidencia(s).` });
  }
  const pendingSec = secs.filter((s) => s.status !== "COMPLETO");
  if (pendingSec.length > 0) {
    locks.push({ type: "SECTOR_REQUIREMENT_PENDING", blocksApproval: true, blocksRelease: true, detail: `${pendingSec.length} requisito(s) sectorial(es) pendientes.` });
  }
  if (op.status === "DISPUTA") {
    locks.push({ type: "DISPUTE_ACTIVE", blocksApproval: true, blocksRelease: true, detail: "La operación tiene una disputa activa." });
  }
  return locks;
}

type RawApproval = Omit<Approval, "checklist" | "locks" | "status"> & {
  status: ApprovalStatus;
};

const RAW: RawApproval[] = [
  {
    id: "a1", approval_folio: "AP-2026-0041",
    transaction_id: "t1", transaction_folio: "Cumplex-2026-00048", transaction_title: "Transporte de acero estructural",
    seller_name: "Transportes García S.A.", seller_rfc: "TRAGAR010101AAA", sector: "AUTOTRANSPORTE",
    milestone_id: "m1", milestone_title: "Entrega en destino", milestone_order: 2,
    associated_amount: 6_800_000, commission_pct: 0.018, vat_pct: 0.16,
    held_after_release: 1_700_000, currency: "MXN",
    status: "POR_REVISAR", evidence_status: "COMPLETE",
    evidence_count: 5, required_evidence_count: 5,
    compliance_percent: 95, risk_level: "BAJO",
    due_at: iso(3), submitted_at: iso(-1),
    payment_impact: "PARTIAL_RELEASE",
    seller_comment: "Entrega confirmada en planta receptor con firma de acuse.",
    contract: contract("FIRMADO_COMPLETO"),
    fiscal: {
      emisorRfc: "TRAGAR010101AAA", receptorRfc: "ABC010101XX1", usoCfdi: "G03", cpReceptor: "44100",
      totalOperacion: 8_500_000, conceptoSugerido: "Servicio de autotransporte de carga",
      cfdi: { status: "CFDI_ACEPTADO", uuid: "6E0D3B1A-9F71-4A3E-B0A2-2E1C7F5391F2", total: 8_500_000, metodoPago: "PPD", formaPago: "99", estadoSAT: "VIGENTE", coherenceScore: 95, checks: defaultCfdiChecks() },
      reps: [
        { id: "r1", numParcialidad: 1, totalParcialidades: 3, uuidRep: "A91C-…-11A", uuidCfdiOrigen: "6E0D…", impSaldoAnt: 8_500_000, impPagado: 3_000_000, impSaldoInsoluto: 5_500_000, formaDePagoP: "03 — SPEI", status: "REP_ACEPTADO" },
        { id: "r2", numParcialidad: 2, totalParcialidades: 3, uuidRep: undefined,     uuidCfdiOrigen: "6E0D…", impSaldoAnt: 5_500_000, impPagado: 3_000_000, impSaldoInsoluto: 2_500_000, formaDePagoP: "03 — SPEI", status: "REP_EN_REVISION" },
      ],
    },
    sector_requirements: defaultsFor("AUTOTRANSPORTE"),
    conditions: [
      { id: "c1", label: "CFDI de ingreso cargado y validado", type: "DOCUMENT", required: true, status: "FULFILLED", validated_by: "SYSTEM" },
      { id: "c2", label: "Carta Porte vinculada", type: "DOCUMENT", required: true, status: "FULFILLED", validated_by: "SYSTEM" },
      { id: "c3", label: "Fotos de entrega recibidas", type: "EVIDENCE", required: true, status: "FULFILLED", validated_by: "VERIFIER" },
      { id: "c4", label: "Geolocalización coincidente", type: "GPS", required: true, status: "FULFILLED", validated_by: "SYSTEM" },
      { id: "c5", label: "Checklist firmado por receptor", type: "CHECKLIST", required: true, status: "FULFILLED", validated_by: "VERIFIER" },
    ],
    evidence: [
      { id: "e1", kind: "DOCUMENT", title: "CFDI Ingreso · UUID 6E0D…91F2", meta: "XML + PDF · Validado SAT", uploaded_at: iso(-1), ok: true },
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
    transaction_id: "t2", transaction_folio: "Cumplex-2026-00072", transaction_title: "Compra de vehículo seminuevo",
    seller_name: "Automotriz Rivera", seller_rfc: "AUR010101XX0", sector: "VEHICULOS",
    milestone_id: "m2", milestone_title: "Inspección física del vehículo", milestone_order: 1,
    associated_amount: 42_000_000, commission_pct: 0.018, vat_pct: 0.16,
    held_after_release: 0, currency: "MXN",
    status: "POR_REVISAR", evidence_status: "PARTIAL",
    evidence_count: 4, required_evidence_count: 5,
    compliance_percent: 78, risk_level: "MEDIO",
    due_at: iso(1), submitted_at: iso(-2),
    payment_impact: "PARTIAL_RELEASE",
    contract: contract("FIRMADO_PARCIAL"),
    fiscal: {
      emisorRfc: "AUR010101XX0", receptorRfc: "ABC010101XX1", usoCfdi: "G01", cpReceptor: "44100",
      totalOperacion: 42_000_000, conceptoSugerido: "Venta de vehículo automotor",
      cfdi: { status: "CFDI_EN_REVISION", uuid: "3F2A-8B10-4C7D-9E1F-A5C3B8D2E4F0", total: 42_000_000, metodoPago: "PPD", formaPago: "99", estadoSAT: "VIGENTE", coherenceScore: 85, checks: defaultCfdiChecks(false) },
      reps: [],
    },
    sector_requirements: defaultsFor("VEHICULOS"),
    conditions: [], evidence: [], timeline: [{ at: iso(-2), actor: "Vendedor", action: "Envió hito a revisión" }],
  },
  {
    id: "a3", approval_folio: "AP-2026-0043",
    transaction_id: "t3", transaction_folio: "Cumplex-2026-00022", transaction_title: "Importación equipo médico",
    seller_name: "MedGlobal Trade", seller_rfc: "MGT150520AB1", sector: "COMERCIO_EXTERIOR",
    milestone_id: "m3", milestone_title: "Liberación aduanal", milestone_order: 2,
    associated_amount: 18_500_000, commission_pct: 0.02, vat_pct: 0.16,
    held_after_release: 5_000_000, currency: "USD",
    status: "POR_REVISAR", evidence_status: "PARTIAL",
    evidence_count: 4, required_evidence_count: 5,
    compliance_percent: 82, risk_level: "MEDIO",
    due_at: iso(5), submitted_at: iso(-1),
    payment_impact: "PARTIAL_RELEASE",
    contract: contract("FIRMADO_COMPLETO"),
    fiscal: {
      emisorRfc: "MGT150520AB1", receptorRfc: "ABC010101XX1", usoCfdi: "G01", cpReceptor: "44100",
      totalOperacion: 18_500_000, conceptoSugerido: "Importación de equipo médico",
      cfdi: { status: "CFDI_ACEPTADO", uuid: "5C3A-…-99AA", total: 18_500_000, metodoPago: "PPD", formaPago: "99", estadoSAT: "VIGENTE", coherenceScore: 98, checks: defaultCfdiChecks() },
      reps: [{ id: "r1", numParcialidad: 1, totalParcialidades: 2, uuidRep: undefined, uuidCfdiOrigen: "5C3A…", impSaldoAnt: 18_500_000, impPagado: 10_000_000, impSaldoInsoluto: 8_500_000, formaDePagoP: "03 — SPEI", status: "REP_PENDIENTE" }],
    },
    sector_requirements: defaultsFor("COMERCIO_EXTERIOR"),
    conditions: [], evidence: [], timeline: [],
  },
  {
    id: "a4", approval_folio: "AP-2026-0038",
    transaction_id: "t4", transaction_folio: "Cumplex-2026-00009", transaction_title: "Consultoría estratégica Q2",
    seller_name: "Nova Advisors", seller_rfc: "NAD190215XY2", sector: "SERVICIOS",
    milestone_id: "m4", milestone_title: "Entregable Fase 1", milestone_order: 1,
    associated_amount: 4_200_000, commission_pct: 0.02, vat_pct: 0.16,
    held_after_release: 8_400_000, currency: "MXN",
    status: "CORRECCION_SOLICITADA", evidence_status: "OBSERVED",
    evidence_count: 2, required_evidence_count: 3,
    compliance_percent: 55, risk_level: "MEDIO",
    due_at: iso(2), submitted_at: iso(-4),
    payment_impact: "NO_RELEASE",
    contract: contract("FIRMADO_COMPLETO"),
    fiscal: {
      emisorRfc: "NAD190215XY2", receptorRfc: "ABC010101XX1", usoCfdi: "G03", cpReceptor: "44100",
      totalOperacion: 12_600_000, conceptoSugerido: "Servicios de consultoría estratégica",
      cfdi: { status: "SIN_CFDI", checks: [], observacion: "El vendedor aún no ha subido el CFDI PPD." },
      reps: [],
    },
    sector_requirements: defaultsFor("SERVICIOS"),
    conditions: [], evidence: [],
    timeline: [
      { at: iso(-4), actor: "Vendedor", action: "Marcó hito listo" },
      { at: iso(-2), actor: "Comprador", action: "Solicitó corrección de entregable" },
    ],
  },
  {
    id: "a5", approval_folio: "AP-2026-0031",
    transaction_id: "t5", transaction_folio: "Cumplex-2026-00005", transaction_title: "Venta departamento 302",
    seller_name: "Inmobiliaria Palma", seller_rfc: "IPA050718QR3", sector: "INMOBILIARIO",
    milestone_id: "m5", milestone_title: "Escrituración", milestone_order: 3,
    associated_amount: 285_000_000, commission_pct: 0.012, vat_pct: 0.16,
    held_after_release: 0, currency: "MXN",
    status: "APROBADO", evidence_status: "COMPLETE",
    evidence_count: 4, required_evidence_count: 4,
    compliance_percent: 100, risk_level: "BAJO",
    due_at: iso(-3), submitted_at: iso(-7),
    payment_impact: "FULL_RELEASE",
    contract: contract("FIRMADO_COMPLETO"),
    fiscal: {
      emisorRfc: "IPA050718QR3", receptorRfc: "ABC010101XX1", usoCfdi: "I08", cpReceptor: "44100",
      totalOperacion: 285_000_000, conceptoSugerido: "Compraventa inmobiliaria",
      cfdi: { status: "CFDI_ACEPTADO", uuid: "8A1C-…-77BB", total: 285_000_000, metodoPago: "PPD", formaPago: "99", estadoSAT: "VIGENTE", coherenceScore: 100, checks: defaultCfdiChecks() },
      reps: [{ id: "r1", numParcialidad: 1, totalParcialidades: 1, uuidRep: "B4D5…", uuidCfdiOrigen: "8A1C…", impSaldoAnt: 285_000_000, impPagado: 285_000_000, impSaldoInsoluto: 0, formaDePagoP: "03 — SPEI", status: "REP_ACEPTADO" }],
    },
    sector_requirements: defaultsFor("INMOBILIARIO").map((r) => ({ ...r, status: "COMPLETO" as SectorReqStatus })),
    conditions: [], evidence: [], timeline: [],
  },
  {
    id: "a6", approval_folio: "AP-2026-0025",
    transaction_id: "t6", transaction_folio: "Cumplex-2026-00003", transaction_title: "Obra civil fase 2",
    seller_name: "Constructora Delta", seller_rfc: "CDE120830PL4", sector: "CONSTRUCCION",
    milestone_id: "m6", milestone_title: "Avance físico 50%", milestone_order: 2,
    associated_amount: 32_000_000, commission_pct: 0.02, vat_pct: 0.16,
    held_after_release: 18_000_000, currency: "MXN",
    status: "DISPUTA", evidence_status: "OBSERVED",
    evidence_count: 3, required_evidence_count: 5,
    compliance_percent: 40, risk_level: "ALTO",
    due_at: iso(-7), submitted_at: iso(-10),
    payment_impact: "BLOCKED",
    contract: contract("FIRMADO_COMPLETO"),
    fiscal: {
      emisorRfc: "CDE120830PL4", receptorRfc: "ABC010101XX1", usoCfdi: "G03", cpReceptor: "44100",
      totalOperacion: 80_000_000, conceptoSugerido: "Obra civil",
      cfdi: { status: "CFDI_ACEPTADO", uuid: "2B7E-…-33DD", total: 80_000_000, metodoPago: "PPD", formaPago: "99", estadoSAT: "VIGENTE", coherenceScore: 90, checks: defaultCfdiChecks() },
      reps: [{ id: "r1", numParcialidad: 1, totalParcialidades: 3, status: "REP_ACEPTADO", impSaldoAnt: 80_000_000, impPagado: 30_000_000, impSaldoInsoluto: 50_000_000, formaDePagoP: "03 — SPEI" }],
    },
    sector_requirements: defaultsFor("CONSTRUCCION"),
    conditions: [], evidence: [], timeline: [],
  },
];

export const MOCK_APPROVALS: Approval[] = RAW.map((r) => {
  const withoutLocks = { ...r };
  const checklist = computeChecklist(withoutLocks);
  const locks = computeLocks(withoutLocks);
  // Derive display status if not final
  let status = r.status;
  if (!["APROBADO", "RECHAZADO", "DISPUTA", "CORRECCION_SOLICITADA"].includes(status)) {
    status = locks.length === 0 ? "LISTO" : locks.some((l) => l.blocksApproval) ? "BLOQUEADO" : "POR_REVISAR";
    // Preserve POR_REVISAR when the seller submitted recently and no critical blockers exist
    if (r.status === "POR_REVISAR" && locks.length > 0 && locks.every((l) => ["CFDI_NOT_ACCEPTED", "REP_PREVIOUS_PENDING"].includes(l.type))) {
      status = "POR_REVISAR";
    }
  }
  return { ...r, status, checklist, locks };
});
