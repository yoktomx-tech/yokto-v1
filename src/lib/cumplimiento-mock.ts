// Mock data + catalog for Cumplimiento operativo module.
// UI-first module. Backend wiring can replace these fixtures later.

export type HitoStatus =
  | "NO_INICIADO"
  | "PENDIENTE"
  | "EN_CARGA"
  | "LISTO_REVISION"
  | "EN_REVISION"
  | "APROBADO"
  | "RECHAZADO"
  | "VENCIDO"
  | "EN_DISPUTA"
  | "CANCELADO";

export type DocStatus =
  | "REQUERIDO"
  | "CARGADO"
  | "INCOMPLETO"
  | "EN_VALIDACION"
  | "VALIDADO"
  | "RECHAZADO"
  | "VENCIDO"
  | "REEMPLAZADO"
  | "ARCHIVADO";

type Tone = "neutral" | "info" | "ok" | "warn" | "err" | "ac";

export const HITO_STATUS_CFG: Record<HitoStatus, { label: string; tone: Tone }> = {
  NO_INICIADO:    { label: "No iniciado",       tone: "neutral" },
  PENDIENTE:      { label: "Pendiente",         tone: "neutral" },
  EN_CARGA:       { label: "En carga",          tone: "info" },
  LISTO_REVISION: { label: "Listo para revisión", tone: "ac" },
  EN_REVISION:    { label: "En revisión",       tone: "info" },
  APROBADO:       { label: "Aprobado",          tone: "ok" },
  RECHAZADO:      { label: "Por corregir",      tone: "err" },
  VENCIDO:        { label: "Vencido",           tone: "warn" },
  EN_DISPUTA:     { label: "En disputa",        tone: "err" },
  CANCELADO:      { label: "Cancelado",         tone: "neutral" },
};

export const DOC_STATUS_CFG: Record<DocStatus, { label: string; tone: Tone }> = {
  REQUERIDO:     { label: "Requerido",     tone: "neutral" },
  CARGADO:       { label: "Cargado",       tone: "info" },
  INCOMPLETO:    { label: "Incompleto",    tone: "warn" },
  EN_VALIDACION: { label: "En validación", tone: "info" },
  VALIDADO:      { label: "Validado",      tone: "ok" },
  RECHAZADO:     { label: "Rechazado",     tone: "err" },
  VENCIDO:       { label: "Vencido",       tone: "warn" },
  REEMPLAZADO:   { label: "Reemplazado",   tone: "neutral" },
  ARCHIVADO:     { label: "Archivado",     tone: "neutral" },
};

export const TONE_BADGE: Record<Tone, string> = {
  neutral: "bg-yo-raised text-yo-txt-2",
  info:    "bg-[#F0F9FF] text-[#0284C7]",
  ok:      "bg-[#ECFDF5] text-[#059669]",
  warn:    "bg-[#FFFBEB] text-[#D97706]",
  err:     "bg-[#FEF2F2] text-[#DC2626]",
  ac:      "bg-yo-ac-bg text-yo-ac-txt",
};

export const TONE_ACCENT: Record<Tone, string> = {
  neutral: "#D8D8E0",
  info:    "#0284C7",
  ok:      "#059669",
  warn:    "#D97706",
  err:     "#DC2626",
  ac:      "#4F46E5",
};

export type DocVersion = {
  version: string;
  hash: string;
  uploadedAt: string;
  uploadedBy: string;
  status: DocStatus;
  note?: string;
};

export type Document = {
  id: string;
  name: string;
  type: string;
  status: DocStatus;
  version: string;
  hash: string;
  uploadedAt?: string;
  dueDate?: string;
  observation?: string;
  history?: DocVersion[];
};

export type Evidence = {
  id: string;
  title: string;
  type: "Fotografía" | "Video" | "GPS" | "Checklist" | "PDF" | "XML";
  status: DocStatus;
  hasGps: boolean;
  capturedAt: string;
  uploadedAt: string;
};

export type Observation = {
  id: string;
  severity: "Informativa" | "Corrección menor" | "Corrección obligatoria" | "Bloqueante";
  targetLabel: string;
  message: string;
  author: string;
  date: string;
  status: "Abierta" | "Respondida" | "Resuelta";
};

export type Hito = {
  id: string;
  name: string;
  description: string;
  status: HitoStatus;
  dueDate: string;
  amountLinked: number;
  priority: "BAJA" | "MEDIA" | "ALTA";
  requirementsTotal: number;
  requirementsCompleted: number;
  observationsOpen: number;
  hasPendingPayment: boolean;
  documents: Document[];
  evidences: Evidence[];
  observations: Observation[];
  checklist: { label: string; state: "ok" | "pending" | "reject" | "opt" }[];
};

export type ContractStatus =
  | "NO_CONFIGURADO" | "PENDIENTE_CARGA" | "PENDIENTE_GENERACION"
  | "GENERADO" | "SUBIDO" | "EN_FIRMA"
  | "FIRMADO_PARCIAL" | "FIRMADO_COMPLETO" | "RECHAZADO" | "VERSIONADO";

export type SignatureMethod = "AUTOGRAFA_DIGITAL_BIOMETRICA" | "EFIRMA_SAT";

export type ContractInfo = {
  status: ContractStatus;
  method: "SUBIDO_PDF" | "GENERADO_AUTOMATICO";
  version: string;
  hash: string;
  templateName?: string;
  signatures: {
    party: "COMPRADOR" | "VENDEDOR";
    name: string;
    method?: SignatureMethod;
    signed: boolean;
    signedAt?: string;
  }[];
};

export type FiscalStatus =
  | "SIN_CFDI" | "CFDI_SUBIDO" | "CFDI_VALIDANDO" | "CFDI_EN_REVISION"
  | "CFDI_ACEPTADO" | "CFDI_RECHAZADO"
  | "REP_PENDIENTE" | "REP_SUBIDO" | "REP_VALIDANDO" | "REP_EN_REVISION"
  | "REP_ACEPTADO" | "REP_RECHAZADO" | "FISCAL_COMPLETO";

export type CFDIInfo = {
  status: FiscalStatus;
  uuid?: string;
  amount?: number;
  method?: "PPD";
  formaPago?: "99";
  emisorRfc?: string;
  receptorRfc?: string;
  usoCfdi?: string;
  timbradoAt?: string;
  observacion?: string;
};

export type REPInfo = {
  id: string;
  hitoId: string;
  numParcialidad: number;
  impSaldoAnt: number;
  impPagado: number;
  impSaldoInsoluto: number;
  formaDePagoP?: "03";
  status: FiscalStatus;
  uuid?: string;
  observacion?: string;
};

export type FiscalInfo = {
  cfdi: CFDIInfo;
  reps: REPInfo[];
  emisorRfc: string;
  receptorRfc: string;
  usoCfdi: string;
  cpReceptor: string;
  totalOperacion: number;
  conceptoSugerido: string;
};

export type SectorRequirement = {
  id: string;
  label: string;
  type: "DOCUMENTO" | "EVIDENCIA" | "CHECKLIST" | "API";
  status: "PENDIENTE" | "EN_PROCESO" | "COMPLETO" | "RECHAZADO";
  hint?: string;
};

export type ComplianceLockType =
  | "CONTRACT_NOT_SIGNED" | "CFDI_NOT_ACCEPTED" | "REP_PREVIOUS_PENDING"
  | "REQUIRED_DOCUMENT_MISSING" | "EVIDENCE_MISSING" | "SECTOR_VALIDATION_PENDING"
  | "DISPUTE_ACTIVE" | "KYC_INCOMPLETE" | "COUNTERPARTY_PENDING";

export type ComplianceLock = {
  type: ComplianceLockType;
  label: string;
  detail: string;
  blocksApproval: boolean;
  blocksRelease: boolean;
  actionLabel?: string;
};

export type Operation = {
  id: string;
  name: string;
  buyer: string;
  sector: string;
  totalAmount: number;
  heldAmount: number;
  currency: string;
  progress: number;
  status: "EN_CUMPLIMIENTO" | "EN_REVISION" | "COMPLETADA";
  nextDueDate: string;
  risk: "BAJO" | "MEDIO" | "ALTO";
  hitos: Hito[];
  contract: ContractInfo;
  fiscal: FiscalInfo;
  sectorRequirements: SectorRequirement[];
  locks: ComplianceLock[];
};

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  NO_CONFIGURADO: "Sin configurar",
  PENDIENTE_CARGA: "Pendiente de carga",
  PENDIENTE_GENERACION: "Pendiente de generación",
  GENERADO: "Generado",
  SUBIDO: "Subido",
  EN_FIRMA: "En firma",
  FIRMADO_PARCIAL: "Firmado parcialmente",
  FIRMADO_COMPLETO: "Firmado completo",
  RECHAZADO: "Rechazado",
  VERSIONADO: "Nueva versión",
};

export const FISCAL_STATUS_LABEL: Record<FiscalStatus, string> = {
  SIN_CFDI: "Sin CFDI",
  CFDI_SUBIDO: "CFDI subido",
  CFDI_VALIDANDO: "CFDI validando",
  CFDI_EN_REVISION: "CFDI en revisión",
  CFDI_ACEPTADO: "CFDI aceptado",
  CFDI_RECHAZADO: "CFDI rechazado",
  REP_PENDIENTE: "REP pendiente",
  REP_SUBIDO: "REP subido",
  REP_VALIDANDO: "REP validando",
  REP_EN_REVISION: "REP en revisión",
  REP_ACEPTADO: "REP aceptado",
  REP_RECHAZADO: "REP rechazado",
  FISCAL_COMPLETO: "Fiscal completo",
};

export function computeOpLocks(op: Operation): ComplianceLock[] {
  const locks: ComplianceLock[] = [];
  const contractSigned = op.contract.signatures.every((s) => s.signed);
  if (!contractSigned && op.contract.status !== "FIRMADO_COMPLETO") {
    const pendVendedor = op.contract.signatures.find((s) => s.party === "VENDEDOR" && !s.signed);
    locks.push({
      type: "CONTRACT_NOT_SIGNED",
      label: "Contrato sin firmar",
      detail: pendVendedor
        ? "Falta tu firma en el contrato."
        : "Falta firma del comprador en el contrato.",
      blocksApproval: true, blocksRelease: true,
      actionLabel: pendVendedor ? "Firmar contrato" : undefined,
    });
  }
  if (op.fiscal.cfdi.status !== "CFDI_ACEPTADO" && op.fiscal.cfdi.status !== "FISCAL_COMPLETO") {
    locks.push({
      type: "CFDI_NOT_ACCEPTED",
      label: "CFDI PPD pendiente",
      detail: op.fiscal.cfdi.status === "SIN_CFDI"
        ? "Debes subir el CFDI PPD timbrado."
        : "El CFDI aún no es aceptado por el comprador.",
      blocksApproval: false, blocksRelease: true,
      actionLabel: op.fiscal.cfdi.status === "SIN_CFDI" ? "Subir CFDI XML" : undefined,
    });
  }
  const repPend = op.fiscal.reps.find((r) => r.status === "REP_PENDIENTE" || r.status === "REP_RECHAZADO");
  if (repPend) {
    locks.push({
      type: "REP_PREVIOUS_PENDING",
      label: `REP parcialidad ${repPend.numParcialidad} pendiente`,
      detail: "Debes emitir el REP por la parcialidad anterior antes de liberar la siguiente.",
      blocksApproval: false, blocksRelease: true,
      actionLabel: "Subir REP XML",
    });
  }
  const sectPend = op.sectorRequirements.filter((s) => s.status !== "COMPLETO");
  if (sectPend.length > 0) {
    locks.push({
      type: "SECTOR_VALIDATION_PENDING",
      label: `Requisitos sectoriales (${sectPend.length})`,
      detail: sectPend.slice(0, 2).map((s) => s.label).join(" · "),
      blocksApproval: true, blocksRelease: false,
      actionLabel: "Completar requisitos",
    });
  }
  return locks;
}


/** Compute VENCIDO client-side (72h alerts + overdue). */
export function withComputedDueStatus(op: Operation): Operation {
  const now = Date.now();
  const hitos = op.hitos.map((h) => {
    const isOverdue = new Date(h.dueDate).getTime() < now;
    if (isOverdue && !["APROBADO", "CANCELADO", "EN_DISPUTA"].includes(h.status)) {
      return { ...h, status: "VENCIDO" as HitoStatus };
    }
    return h;
  });
  return { ...op, hitos };
}

export function daysUntil(dateStr: string): number {
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(ms / (24 * 3600 * 1000));
}

const RAW_OPS: Array<Omit<Operation, "contract" | "fiscal" | "sectorRequirements" | "locks">> = [
  {
    id: "OP-2026-00124",
    name: "Suministro de materiales etapa 2",
    buyer: "Constructora Norte S.A. de C.V.",
    sector: "Construcción",
    totalAmount: 420000,
    heldAmount: 420000,
    currency: "MXN",
    progress: 67,
    status: "EN_CUMPLIMIENTO",
    nextDueDate: "2026-07-18",
    risk: "MEDIO",
    hitos: [
      {
        id: "MILE-001",
        name: "Anticipo documental",
        description: "Contrato firmado y CFDI de anticipo timbrado.",
        status: "APROBADO",
        dueDate: "2026-06-30",
        amountLinked: 100000,
        requirementsTotal: 3,
        requirementsCompleted: 3,
        observationsOpen: 0,
        priority: "ALTA",
        hasPendingPayment: true,
        documents: [
          { id: "DOC-8801", name: "Contrato firmado", type: "Contrato", status: "VALIDADO", version: "v1", hash: "sha256:11ab...cd82", uploadedAt: "2026-06-20" },
          { id: "DOC-8802", name: "CFDI anticipo", type: "CFDI_INGRESO", status: "VALIDADO", version: "v1", hash: "sha256:22bc...ef91", uploadedAt: "2026-06-21" },
        ],
        evidences: [],
        observations: [],
        checklist: [
          { label: "Contrato firmado", state: "ok" },
          { label: "CFDI anticipo timbrado", state: "ok" },
          { label: "Orden de compra referenciada", state: "ok" },
        ],
      },
      {
        id: "MILE-002",
        name: "Entrega parcial de obra",
        description: "Evidencia fotográfica, checklist firmado y CFDI relacionado.",
        status: "RECHAZADO",
        dueDate: "2026-07-18",
        amountLinked: 185000,
        requirementsTotal: 6,
        requirementsCompleted: 4,
        observationsOpen: 1,
        priority: "ALTA",
        hasPendingPayment: true,
        documents: [
          { id: "DOC-8831", name: "CFDI entrega parcial", type: "CFDI_INGRESO", status: "RECHAZADO", version: "v2", hash: "sha256:9d7c...a24f", uploadedAt: "2026-07-14", observation: "El XML no corresponde al monto pactado del hito." , history: [{ version: "v2", hash: "sha256:9d7c...a24f", uploadedAt: "2026-07-14", uploadedBy: "Tú", status: "RECHAZADO", note: "Monto no coincide con hito" }, { version: "v1", hash: "sha256:8a01...11bd", uploadedAt: "2026-07-10", uploadedBy: "Tú", status: "REEMPLAZADO", note: "Sustituido por v2" }]},
          { id: "DOC-8832", name: "Checklist entrega", type: "Checklist", status: "EN_VALIDACION", version: "v1", hash: "sha256:5f2a...bb10", uploadedAt: "2026-07-14" },
        ],
        evidences: [
          { id: "EV-3311", title: "Fotos avance zona A", type: "Fotografía", status: "VALIDADO", hasGps: true, capturedAt: "2026-07-13 10:22", uploadedAt: "2026-07-14 09:10" },
          { id: "EV-3312", title: "Video recorrido zona B", type: "Video", status: "EN_VALIDACION", hasGps: false, capturedAt: "2026-07-13 11:00", uploadedAt: "2026-07-14 09:12" },
        ],
        observations: [
          { id: "OBS-991", severity: "Corrección obligatoria", targetLabel: "CFDI entrega parcial", message: "El monto del XML no coincide con el hito pactado ($185,000).", author: "Verificador Yokto", date: "2026-07-14", status: "Abierta" },
        ],
        checklist: [
          { label: "CFDI cargado y validado", state: "reject" },
          { label: "Fotografías cargadas", state: "ok" },
          { label: "Checklist firmado", state: "pending" },
          { label: "Video de entrega", state: "pending" },
          { label: "GPS de sitio de entrega", state: "ok" },
          { label: "Nota técnica (opcional)", state: "opt" },
        ],
      },
      {
        id: "MILE-003",
        name: "Evidencia final y acuse",
        description: "Cierre de obra con acuse firmado del comprador.",
        status: "NO_INICIADO",
        dueDate: "2026-08-05",
        amountLinked: 135000,
        requirementsTotal: 4,
        requirementsCompleted: 0,
        observationsOpen: 0,
        priority: "MEDIA",
        hasPendingPayment: true,
        documents: [],
        evidences: [],
        observations: [],
        checklist: [
          { label: "Acuse de recepción", state: "pending" },
          { label: "CFDI de cierre", state: "pending" },
          { label: "Fotografías finales", state: "pending" },
          { label: "Reporte técnico", state: "pending" },
        ],
      },
    ],
  },
  {
    id: "OP-2026-00131",
    name: "Servicio de mantenimiento planta 3",
    buyer: "Industrias del Bajío S.A.",
    sector: "Servicios industriales",
    totalAmount: 240000,
    heldAmount: 240000,
    currency: "MXN",
    progress: 25,
    status: "EN_CUMPLIMIENTO",
    nextDueDate: "2026-07-22",
    risk: "BAJO",
    hitos: [
      {
        id: "MILE-010",
        name: "Levantamiento en sitio",
        description: "Reporte técnico con fotografías y checklist.",
        status: "EN_CARGA",
        dueDate: "2026-07-22",
        amountLinked: 60000,
        requirementsTotal: 4,
        requirementsCompleted: 2,
        observationsOpen: 0,
        priority: "MEDIA",
        hasPendingPayment: true,
        documents: [
          { id: "DOC-9001", name: "Reporte técnico", type: "Nota técnica", status: "CARGADO", version: "v1", hash: "sha256:aa11...ff22", uploadedAt: "2026-07-12" },
        ],
        evidences: [
          { id: "EV-4001", title: "Fotos planta 3", type: "Fotografía", status: "CARGADO", hasGps: true, capturedAt: "2026-07-12 08:12", uploadedAt: "2026-07-12 12:00" },
        ],
        observations: [],
        checklist: [
          { label: "Reporte técnico", state: "ok" },
          { label: "Fotografías", state: "ok" },
          { label: "Checklist firmado", state: "pending" },
          { label: "CFDI parcial", state: "pending" },
        ],
      },
      {
        id: "MILE-011",
        name: "Ejecución de mantenimiento",
        description: "Bitácora diaria y evidencia fotográfica por sesión.",
        status: "PENDIENTE",
        dueDate: "2026-08-10",
        amountLinked: 120000,
        requirementsTotal: 5,
        requirementsCompleted: 0,
        observationsOpen: 0,
        priority: "BAJA",
        hasPendingPayment: false,
        documents: [],
        evidences: [],
        observations: [],
        checklist: [
          { label: "Bitácora diaria", state: "pending" },
          { label: "Evidencia fotográfica", state: "pending" },
          { label: "Checklist SST", state: "pending" },
          { label: "Reporte de horas", state: "pending" },
          { label: "CFDI parcial", state: "pending" },
        ],
      },
      {
        id: "MILE-012",
        name: "Entrega final y CFDI",
        description: "Acta de cierre firmada y CFDI final timbrado.",
        status: "NO_INICIADO",
        dueDate: "2026-08-25",
        amountLinked: 60000,
        requirementsTotal: 2,
        requirementsCompleted: 0,
        observationsOpen: 0,
        priority: "MEDIA",
        hasPendingPayment: false,
        documents: [],
        evidences: [],
        observations: [],
        checklist: [
          { label: "Acta de cierre", state: "pending" },
          { label: "CFDI final", state: "pending" },
        ],
      },
    ],
  },
  {
    id: "OP-2026-00142",
    name: "Consultoría estratégica Q3",
    buyer: "Grupo Palmera S.A. de C.V.",
    sector: "Consultoría",
    totalAmount: 180000,
    heldAmount: 180000,
    currency: "MXN",
    progress: 100,
    status: "EN_REVISION",
    nextDueDate: "2026-07-16",
    risk: "BAJO",
    hitos: [
      {
        id: "MILE-020",
        name: "Entrega final del reporte",
        description: "PDF final y presentación ejecutiva.",
        status: "LISTO_REVISION",
        dueDate: "2026-07-16",
        amountLinked: 180000,
        requirementsTotal: 2,
        requirementsCompleted: 2,
        observationsOpen: 0,
        priority: "BAJA",
        hasPendingPayment: false,
        documents: [
          { id: "DOC-9500", name: "Reporte final", type: "PDF", status: "EN_VALIDACION", version: "v3", hash: "sha256:beef...cafe", uploadedAt: "2026-07-15" },
          { id: "DOC-9501", name: "CFDI final", type: "CFDI_INGRESO", status: "EN_VALIDACION", version: "v1", hash: "sha256:1234...5678", uploadedAt: "2026-07-15" },
        ],
        evidences: [],
        observations: [],
        checklist: [
          { label: "Reporte final entregado", state: "ok" },
          { label: "CFDI timbrado", state: "ok" },
        ],
      },
    ],
  },
];

function defaultContract(op: Omit<Operation, "contract" | "fiscal" | "sectorRequirements" | "locks">, i: number): ContractInfo {
  // vary across ops to showcase different states
  if (i === 0) return {
    status: "EN_FIRMA", method: "GENERADO_AUTOMATICO", version: "v2",
    hash: "sha256:9f2a...c81e", templateName: "Construcción — Suministro y obra",
    signatures: [
      { party: "COMPRADOR", name: op.buyer, method: "AUTOGRAFA_DIGITAL_BIOMETRICA", signed: true, signedAt: "2026-06-25 11:20" },
      { party: "VENDEDOR", name: "Tu organización", method: "AUTOGRAFA_DIGITAL_BIOMETRICA", signed: false },
    ],
  };
  if (i === 1) return {
    status: "FIRMADO_COMPLETO", method: "SUBIDO_PDF", version: "v1",
    hash: "sha256:3c1d...ab72",
    signatures: [
      { party: "COMPRADOR", name: op.buyer, method: "EFIRMA_SAT", signed: true, signedAt: "2026-07-05 09:00" },
      { party: "VENDEDOR", name: "Tu organización", method: "EFIRMA_SAT", signed: true, signedAt: "2026-07-05 09:14" },
    ],
  };
  return {
    status: "PENDIENTE_CARGA", method: "SUBIDO_PDF", version: "—", hash: "—",
    signatures: [
      { party: "COMPRADOR", name: op.buyer, signed: false },
      { party: "VENDEDOR", name: "Tu organización", signed: false },
    ],
  };
}

function defaultFiscal(op: Omit<Operation, "contract" | "fiscal" | "sectorRequirements" | "locks">, i: number): FiscalInfo {
  const base = {
    emisorRfc: "XAXX010101000",
    receptorRfc: i === 0 ? "CNO900101ABC" : i === 1 ? "IDB050203DEF" : "GPA110515GHI",
    usoCfdi: "G03 — Gastos en general",
    cpReceptor: i === 0 ? "64000" : i === 1 ? "37000" : "11000",
    totalOperacion: op.totalAmount,
    conceptoSugerido: op.name,
  };
  if (i === 0) return {
    ...base,
    cfdi: {
      status: "CFDI_ACEPTADO", uuid: "A1B2C3D4-E5F6-7890-ABCD-1234567890EF",
      amount: op.totalAmount, method: "PPD", formaPago: "99",
      emisorRfc: base.emisorRfc, receptorRfc: base.receptorRfc, usoCfdi: base.usoCfdi,
      timbradoAt: "2026-06-22",
    },
    reps: [
      { id: "REP-1", hitoId: "MILE-001", numParcialidad: 1, impSaldoAnt: op.totalAmount, impPagado: 100000, impSaldoInsoluto: op.totalAmount - 100000, formaDePagoP: "03", status: "REP_ACEPTADO", uuid: "REP-UUID-001" },
      { id: "REP-2", hitoId: "MILE-002", numParcialidad: 2, impSaldoAnt: op.totalAmount - 100000, impPagado: 185000, impSaldoInsoluto: op.totalAmount - 285000, formaDePagoP: "03", status: "REP_PENDIENTE" },
    ],
  };
  if (i === 1) return {
    ...base,
    cfdi: { status: "SIN_CFDI", method: "PPD", formaPago: "99" },
    reps: [],
  };
  return {
    ...base,
    cfdi: { status: "CFDI_EN_REVISION", uuid: "ZZ99-AA88", amount: op.totalAmount, method: "PPD", formaPago: "99", emisorRfc: base.emisorRfc, receptorRfc: base.receptorRfc, usoCfdi: base.usoCfdi, timbradoAt: "2026-07-15" },
    reps: [],
  };
}

function defaultSectorReqs(op: Omit<Operation, "contract" | "fiscal" | "sectorRequirements" | "locks">): SectorRequirement[] {
  const s = op.sector.toLowerCase();
  if (s.includes("construc")) return [
    { id: "SR-1", label: "REPSE vigente", type: "API", status: "COMPLETO" },
    { id: "SR-2", label: "Estimación de obra firmada", type: "DOCUMENTO", status: "EN_PROCESO" },
    { id: "SR-3", label: "Evidencia de avance de obra", type: "EVIDENCIA", status: "PENDIENTE" },
    { id: "SR-4", label: "Acta de entrega parcial", type: "DOCUMENTO", status: "PENDIENTE" },
  ];
  if (s.includes("autotransporte") || s.includes("flete")) return [
    { id: "SR-1", label: "Carta Porte 2.0 timbrada", type: "DOCUMENTO", status: "PENDIENTE" },
    { id: "SR-2", label: "Foto de carga", type: "EVIDENCIA", status: "PENDIENTE" },
    { id: "SR-3", label: "Foto de descarga", type: "EVIDENCIA", status: "PENDIENTE" },
    { id: "SR-4", label: "Evidencia GPS de ruta", type: "API", status: "EN_PROCESO" },
  ];
  if (s.includes("vehic")) return [
    { id: "SR-1", label: "Consulta REPUVE", type: "API", status: "PENDIENTE", hint: "VIN requerido" },
    { id: "SR-2", label: "Checklist 96 puntos", type: "CHECKLIST", status: "EN_PROCESO" },
    { id: "SR-3", label: "25 fotografías obligatorias", type: "EVIDENCIA", status: "PENDIENTE" },
    { id: "SR-4", label: "Tarjeta de circulación", type: "DOCUMENTO", status: "PENDIENTE" },
  ];
  if (s.includes("comercio") || s.includes("exterior")) return [
    { id: "SR-1", label: "Bill of Lading / AWB", type: "DOCUMENTO", status: "PENDIENTE" },
    { id: "SR-2", label: "Pedimento aduanal", type: "DOCUMENTO", status: "PENDIENTE" },
    { id: "SR-3", label: "Factura comercial", type: "DOCUMENTO", status: "EN_PROCESO" },
    { id: "SR-4", label: "Tracking de embarque", type: "API", status: "EN_PROCESO" },
  ];
  if (s.includes("inmobil")) return [
    { id: "SR-1", label: "Escritura pública", type: "DOCUMENTO", status: "COMPLETO" },
    { id: "SR-2", label: "Avalúo vigente", type: "DOCUMENTO", status: "EN_PROCESO" },
    { id: "SR-3", label: "Certificado libertad de gravamen", type: "DOCUMENTO", status: "PENDIENTE" },
    { id: "SR-4", label: "Due diligence completa", type: "CHECKLIST", status: "PENDIENTE" },
  ];
  // Servicios / Consultoría default
  return [
    { id: "SR-1", label: "Propuesta aprobada", type: "DOCUMENTO", status: "COMPLETO" },
    { id: "SR-2", label: "Entregable digital", type: "DOCUMENTO", status: "EN_PROCESO" },
    { id: "SR-3", label: "Acta de aceptación", type: "DOCUMENTO", status: "PENDIENTE" },
  ];
}

export const MOCK_OPS: Operation[] = RAW_OPS.map((op, i) => {
  const full: Operation = {
    ...op,
    contract: defaultContract(op, i),
    fiscal: defaultFiscal(op, i),
    sectorRequirements: defaultSectorReqs(op),
    locks: [],
  };
  full.locks = computeOpLocks(full);
  return full;
});

export function formatMXN(cents: number, currency = "MXN") {
  return `$${cents.toLocaleString("es-MX", { minimumFractionDigits: 0 })} ${currency}`;
}

