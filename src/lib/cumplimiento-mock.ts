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
};

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

export const MOCK_OPS: Operation[] = [
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

export function formatMXN(cents: number, currency = "MXN") {
  return `$${cents.toLocaleString("es-MX", { minimumFractionDigits: 0 })} ${currency}`;
}
