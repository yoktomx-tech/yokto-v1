// Mock catalog + data for /score (Perfil de Cumplimiento).
// Sustituir por queries reales cuando exista persistencia.

export type ViewRole = "buyer" | "seller";

// Tipo de perfil de cumplimiento (dinámico)
export type PersonType = "PF" | "PFAE" | "PM";

export const PERSON_TYPE_CFG: Record<
  PersonType,
  { label: string; short: string; tone: "info" | "accent" | "ok"; bg: string; text: string; description: string }
> = {
  PF: {
    label: "Persona Física",
    short: "PF",
    tone: "info",
    bg: "bg-[#EEF2FF]",
    text: "text-[#3730A3]",
    description: "Perfil individual sin actividad empresarial registrada.",
  },
  PFAE: {
    label: "Persona Física con Actividad Empresarial",
    short: "PFAE",
    tone: "accent",
    bg: "bg-yo-ac-bg",
    text: "text-yo-ac-txt",
    description: "Persona física con capacidad de emitir CFDI y actividad económica registrada.",
  },
  PM: {
    label: "Persona Moral",
    short: "PM",
    tone: "ok",
    bg: "bg-[#ECFDF5]",
    text: "text-[#064E3B]",
    description: "Empresa constituida con representante legal y documentación corporativa.",
  },
};

export type ComplianceLevel =
  | "NUEVO"
  | "EN_VALIDACION"
  | "VERIFICADO"
  | "CONFIABLE"
  | "ALTO"
  | "OBSERVADO"
  | "RESTRINGIDO";

export const LEVEL_CFG: Record<ComplianceLevel, { label: string; tone: "neutral" | "info" | "accent" | "ok" | "warn" | "err"; range: string }> = {
  NUEVO: { label: "Nuevo", tone: "neutral", range: "0–39" },
  EN_VALIDACION: { label: "En validación", tone: "info", range: "40–59" },
  VERIFICADO: { label: "Verificado", tone: "accent", range: "60–79" },
  CONFIABLE: { label: "Confiable", tone: "ok", range: "80–94" },
  ALTO: { label: "Alto cumplimiento", tone: "ok", range: "95–100" },
  OBSERVADO: { label: "Observado", tone: "warn", range: "—" },
  RESTRINGIDO: { label: "Restringido", tone: "err", range: "—" },
};

export const TONE_CLASSES: Record<string, { bg: string; text: string; dot: string }> = {
  neutral: { bg: "bg-yo-raised", text: "text-yo-txt-2", dot: "bg-yo-txt-3" },
  info: { bg: "bg-[#F0F9FF]", text: "text-[#0284C7]", dot: "bg-[#0284C7]" },
  accent: { bg: "bg-yo-ac-bg", text: "text-yo-ac-txt", dot: "bg-yo-ac" },
  ok: { bg: "bg-[#ECFDF5]", text: "text-[#059669]", dot: "bg-[#059669]" },
  warn: { bg: "bg-[#FFFBEB]", text: "text-[#D97706]", dot: "bg-[#D97706]" },
  err: { bg: "bg-[#FEF2F2]", text: "text-[#DC2626]", dot: "bg-[#DC2626]" },
};

export type KycStatus = "NOT_STARTED" | "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "EXPIRED";
export const KYC_CFG: Record<KycStatus, { label: string; tone: string }> = {
  NOT_STARTED: { label: "No iniciado", tone: "neutral" },
  PENDING: { label: "Pendiente", tone: "warn" },
  IN_REVIEW: { label: "En revisión", tone: "info" },
  APPROVED: { label: "Aprobado", tone: "ok" },
  REJECTED: { label: "Rechazado", tone: "err" },
  EXPIRED: { label: "Vencido", tone: "warn" },
};

// Categorías ampliadas por tipo de persona
export type DocCategory =
  | "IDENTIDAD"
  | "FISCAL"
  | "LEGAL"
  | "BANCARIO"
  | "CORPORATIVO"
  | "OPERATIVO"
  | "SECTORIAL";

export const DOC_CATEGORY_LABEL: Record<DocCategory, string> = {
  IDENTIDAD: "Identidad",
  FISCAL: "Fiscal",
  LEGAL: "Legal",
  BANCARIO: "Bancario",
  CORPORATIVO: "Corporativo",
  OPERATIVO: "Operativo",
  SECTORIAL: "Sectorial",
};

export type DocStatus = "APPROVED" | "PENDING" | "REJECTED" | "EXPIRED";

export const DOC_STATUS_CFG: Record<DocStatus, { label: string; tone: string }> = {
  APPROVED: { label: "Aprobado", tone: "ok" },
  PENDING: { label: "Pendiente", tone: "warn" },
  REJECTED: { label: "Rechazado", tone: "err" },
  EXPIRED: { label: "Vencido", tone: "warn" },
};

export interface ComplianceDoc {
  id: string;
  name: string;
  category: DocCategory;
  status: DocStatus;
  expiresAt?: string;
  updatedAt: string;
  reviewedBy: string;
  hash?: string;
  notes?: string;
  required?: boolean;
}

export type AlertSeverity = "INFO" | "OK" | "WARN" | "ERROR";
export interface ComplianceAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  status: "ACTIVE" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  actionLabel?: string;
}

export const ALERT_TONE: Record<AlertSeverity, string> = {
  INFO: "info",
  OK: "ok",
  WARN: "warn",
  ERROR: "err",
};

export interface ScoreComponent {
  key: string;
  label: string;
  score: number;
  weight: number;
  explanation: string;
}

export interface HistoryEntry {
  date: string;
  score: number;
  level: ComplianceLevel;
  reason: string;
  delta: number;
}

export interface AuditEntry {
  date: string;
  event: string;
  user: string;
  module: string;
  result: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

// Bloque de identidad / empresa (dinámico por tipo de persona)
export interface IdentityField {
  label: string;
  value: string;
  mono?: boolean;
  sensitive?: boolean;
}

// Representantes / autorizados (Persona Moral)
export interface Representative {
  id: string;
  name: string;
  role: string;
  document: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
  isLegal?: boolean;
}

// Visibilidad ante contrapartes
export interface VisibilityRow {
  field: string;
  visibleForCounterparty: string;
  visibleForBackoffice: string;
  editable: string;
}

export interface ComplianceProfile {
  role: ViewRole;
  personType: PersonType;
  displayName: string;
  rfc: string;
  score: number;
  level: ComplianceLevel;
  kyc: KycStatus;
  kyb: KycStatus;
  docCompletionPct: number;
  activeAlertsCount: number;
  lastCalculatedAt: string;
  identityFields: IdentityField[];
  representatives: Representative[];
  components: ScoreComponent[];
  docs: ComplianceDoc[];
  alerts: ComplianceAlert[];
  history: HistoryEntry[];
  audit: AuditEntry[];
  checklist: ChecklistItem[];
  metrics: { label: string; value: string; state: "good" | "great" | "review" | "bad" }[];
  visibility: VisibilityRow[];
}

const now = new Date();
const iso = (daysAgo: number) => {
  const d = new Date(now); d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};
const isoFuture = (days: number) => {
  const d = new Date(now); d.setDate(d.getDate() + days);
  return d.toISOString();
};

export function levelForScore(s: number): ComplianceLevel {
  if (s >= 95) return "ALTO";
  if (s >= 80) return "CONFIABLE";
  if (s >= 60) return "VERIFICADO";
  if (s >= 40) return "EN_VALIDACION";
  return "NUEVO";
}

// -------- Identity fields por tipo de persona --------

function identityFieldsFor(personType: PersonType): IdentityField[] {
  if (personType === "PF") {
    return [
      { label: "Nombre completo", value: "Luis Hernández Barrera" },
      { label: "CURP", value: "HEBL850214HDFRNS03", mono: true, sensitive: true },
      { label: "RFC", value: "HEBL850214XX9", mono: true },
      { label: "Fecha de nacimiento", value: "14 feb 1985", sensitive: true },
      { label: "Nacionalidad", value: "Mexicana" },
      { label: "Teléfono", value: "+52 55 1234 5678" },
      { label: "Correo", value: "luis@ejemplo.com" },
      { label: "Régimen fiscal", value: "605 — Sueldos y Salarios" },
      { label: "Domicilio fiscal", value: "CDMX, México" },
    ];
  }
  if (personType === "PFAE") {
    return [
      { label: "Nombre completo", value: "María González Ruiz" },
      { label: "Nombre comercial", value: "MG Consultoría" },
      { label: "CURP", value: "GORM880505MDFRNS04", mono: true, sensitive: true },
      { label: "RFC", value: "GORM880505QW1", mono: true },
      { label: "Régimen fiscal", value: "612 — Personas Físicas con Actividad Empresarial" },
      { label: "Actividad económica", value: "Servicios profesionales de consultoría" },
      { label: "Uso de CFDI habitual", value: "G03 — Gastos en general" },
      { label: "Teléfono", value: "+52 55 8765 4321" },
      { label: "Correo", value: "maria@mgconsultoria.mx" },
      { label: "Domicilio fiscal", value: "Guadalajara, Jalisco" },
    ];
  }
  // PM
  return [
    { label: "Razón social", value: "Constructora Ejemplo S.A. de C.V." },
    { label: "Nombre comercial", value: "Constructora Ejemplo" },
    { label: "RFC", value: "CEJ200101ABC", mono: true },
    { label: "Régimen fiscal", value: "601 — General de Ley Personas Morales" },
    { label: "Fecha de constitución", value: "12 mar 2015" },
    { label: "Objeto social", value: "Construcción y desarrollo de obra civil e industrial." },
    { label: "Representante legal", value: "Luis Hernández Barrera" },
    { label: "Domicilio fiscal", value: "Av. Insurgentes Sur 1234, CDMX" },
    { label: "Contacto operativo", value: "operaciones@constructora.mx" },
    { label: "Contacto fiscal", value: "fiscal@constructora.mx" },
  ];
}

function representativesFor(personType: PersonType): Representative[] {
  if (personType !== "PM") return [];
  return [
    { id: "r1", name: "Luis Hernández Barrera", role: "Representante legal", document: "INE + Poder notarial", status: "APPROVED", isLegal: true },
    { id: "r2", name: "Ana López Torres", role: "Contacto fiscal", document: "Usuario invitado", status: "PENDING" },
    { id: "r3", name: "Carlos Méndez", role: "Contacto operativo", document: "Usuario invitado", status: "APPROVED" },
  ];
}

// -------- Documentos requeridos por tipo de persona --------

function docsFor(personType: PersonType, role: ViewRole): ComplianceDoc[] {
  const base: ComplianceDoc[] = [
    { id: "d1", name: "Identificación oficial (INE)", category: "IDENTIDAD", status: "APPROVED", updatedAt: iso(45), reviewedBy: "Compliance Cumplex", hash: "a1f2…9c7d", required: true },
    { id: "d2", name: "Constancia de Situación Fiscal", category: "FISCAL", status: "APPROVED", expiresAt: isoFuture(15), updatedAt: iso(30), reviewedBy: "Automático", hash: "b8e1…4a2c", required: true },
    { id: "d3", name: "Comprobante de domicilio", category: "IDENTIDAD", status: "PENDING", updatedAt: iso(2), reviewedBy: "—", required: true },
  ];

  if (personType === "PF") {
    return [
      ...base,
      { id: "d4", name: "CURP validada (RENAPO)", category: "IDENTIDAD", status: "APPROVED", updatedAt: iso(10), reviewedBy: "Automático" },
      { id: "d5", name: "Opinión de cumplimiento SAT", category: "FISCAL", status: "EXPIRED", expiresAt: iso(5), updatedAt: iso(120), reviewedBy: "Compliance Cumplex", notes: "Renovar y adjuntar nueva versión." },
    ];
  }

  if (personType === "PFAE") {
    return [
      ...base,
      { id: "d4", name: "CURP validada (RENAPO)", category: "IDENTIDAD", status: "APPROVED", updatedAt: iso(10), reviewedBy: "Automático" },
      { id: "d5", name: "Opinión de cumplimiento SAT", category: "FISCAL", status: "PENDING", updatedAt: iso(1), reviewedBy: "—", notes: "Requerido para operaciones de mayor monto." },
      { id: "d6", name: "Comprobante de actividad económica", category: "OPERATIVO", status: "APPROVED", updatedAt: iso(20), reviewedBy: "Compliance Cumplex" },
      ...(role === "seller"
        ? [{ id: "d7", name: "Carátula bancaria", category: "BANCARIO" as DocCategory, status: "APPROVED" as DocStatus, updatedAt: iso(60), reviewedBy: "Compliance Cumplex", required: true }]
        : []),
    ];
  }

  // PM
  const pmDocs: ComplianceDoc[] = [
    { id: "d1", name: "Constancia de Situación Fiscal", category: "FISCAL", status: "APPROVED", expiresAt: isoFuture(15), updatedAt: iso(30), reviewedBy: "Automático", hash: "b8e1…4a2c", required: true },
    { id: "d2", name: "Acta constitutiva", category: "CORPORATIVO", status: "APPROVED", updatedAt: iso(90), reviewedBy: "Compliance Cumplex", required: true },
    { id: "d3", name: "Poder del representante legal", category: "LEGAL", status: "PENDING", updatedAt: iso(3), reviewedBy: "—", required: true, notes: "Validando facultades." },
    { id: "d4", name: "Identificación del representante legal", category: "IDENTIDAD", status: "APPROVED", updatedAt: iso(45), reviewedBy: "Compliance Cumplex", required: true },
    { id: "d5", name: "Comprobante de domicilio fiscal", category: "FISCAL", status: "APPROVED", updatedAt: iso(20), reviewedBy: "Compliance Cumplex", required: true },
    { id: "d6", name: "Opinión de cumplimiento SAT", category: "FISCAL", status: "PENDING", updatedAt: iso(1), reviewedBy: "—", notes: "Recomendado para operaciones B2B." },
  ];
  if (role === "seller") {
    pmDocs.push(
      { id: "d7", name: "Carátula bancaria / cuenta receptora", category: "BANCARIO", status: "APPROVED", updatedAt: iso(60), reviewedBy: "Compliance Cumplex", required: true },
      { id: "d8", name: "Carta Porte (permiso sectorial)", category: "SECTORIAL", status: "EXPIRED", expiresAt: iso(2), updatedAt: iso(180), reviewedBy: "Compliance Cumplex", notes: "Renovar antes de operar en transporte." },
    );
  }
  return pmDocs;
}

// -------- Score components por tipo de persona --------

function componentsFor(personType: PersonType, role: ViewRole): ScoreComponent[] {
  const isBuyer = role === "buyer";
  if (personType === "PM") {
    return [
      { key: "kyb", label: "Verificación empresarial", score: 100, weight: 0.2, explanation: "RFC, CSF, razón social y domicilio validados." },
      { key: "rep", label: "Representación legal", score: 90, weight: 0.2, explanation: "Representante identificado; poder en revisión." },
      { key: "corp", label: "Documentación corporativa", score: 85, weight: 0.2, explanation: "Acta y poderes vigentes; documento sectorial por renovar." },
      { key: "ops", label: "Cumplimiento operativo", score: isBuyer ? 91 : 87, weight: 0.25, explanation: isBuyer ? "91% de aprobaciones dentro del SLA." : "87% de hitos entregados a tiempo." },
      { key: "disp", label: "Incidencias y disputas", score: 88, weight: 0.15, explanation: "Historial estable de operaciones sin controversia." },
    ];
  }
  // PF y PFAE
  return [
    { key: "id", label: "Identidad validada", score: 100, weight: 0.2, explanation: "Identificación, CURP, teléfono y correo verificados." },
    { key: "fiscal", label: "Datos fiscales completos", score: personType === "PFAE" ? 92 : 80, weight: 0.2, explanation: personType === "PFAE" ? "RFC, régimen 612 y CSF alineados." : "RFC y CSF válidos; régimen actualizable." },
    { key: "docs", label: "Cumplimiento documental", score: 82, weight: 0.2, explanation: "Documentos aprobados y vigentes." },
    { key: "ops", label: "Cumplimiento operativo", score: isBuyer ? 91 : 87, weight: 0.25, explanation: isBuyer ? "91% de aprobaciones dentro del SLA." : "87% de hitos entregados a tiempo." },
    { key: "disp", label: "Incidencias y disputas", score: 88, weight: 0.15, explanation: "Sin disputas activas en operaciones recientes." },
  ];
}

// -------- Alertas por tipo de persona --------

function alertsFor(personType: PersonType): ComplianceAlert[] {
  const common: ComplianceAlert[] = [
    { id: "a1", severity: "WARN", title: "Documento próximo a vencer", message: "Tu Constancia de Situación Fiscal vence en 15 días.", status: "ACTIVE", createdAt: iso(1), actionLabel: "Actualizar documento" },
  ];
  if (personType === "PF") {
    return [
      ...common,
      { id: "a2", severity: "INFO", title: "CURP no validada", message: "Valida tu CURP para fortalecer tu perfil de identidad.", status: "ACTIVE", createdAt: iso(3), actionLabel: "Validar CURP" },
      { id: "a3", severity: "INFO", title: "Opinión SAT pendiente", message: "Para operaciones de mayor monto puede solicitarse opinión de cumplimiento.", status: "ACTIVE", createdAt: iso(4) },
      { id: "a4", severity: "OK", title: "Subiste de nivel", message: "Alcanzaste el nivel Confiable.", status: "RESOLVED", createdAt: iso(6) },
    ];
  }
  if (personType === "PFAE") {
    return [
      ...common,
      { id: "a2", severity: "WARN", title: "Comprobante de actividad", message: "Verifica que tu actividad económica coincida con la de tu régimen 612.", status: "ACTIVE", createdAt: iso(2), actionLabel: "Revisar" },
      { id: "a3", severity: "INFO", title: "Capacidad de emitir CFDI", message: "Perfil habilitado para emitir CFDI y REP dentro de operaciones.", status: "RESOLVED", createdAt: iso(6) },
    ];
  }
  // PM
  return [
    ...common,
    { id: "a2", severity: "WARN", title: "Poder no validado", message: "El poder del representante legal está pendiente de validación.", status: "ACTIVE", createdAt: iso(2), actionLabel: "Revisar documento" },
    { id: "a3", severity: "ERROR", title: "Documento sectorial vencido", message: "La Carta Porte requiere renovación antes de operar.", status: "ACTIVE", createdAt: iso(2), actionLabel: "Renovar" },
    { id: "a4", severity: "INFO", title: "Opinión SAT recomendada", message: "Para operaciones B2B de mayor valor puede solicitarse opinión de cumplimiento.", status: "ACTIVE", createdAt: iso(5) },
  ];
}

// -------- Checklist por tipo de persona --------

function checklistFor(personType: PersonType, role: ViewRole): ChecklistItem[] {
  if (personType === "PF") {
    return [
      { id: "c1", label: "Identificación oficial cargada", done: true },
      { id: "c2", label: "Constancia de Situación Fiscal vigente", done: true },
      { id: "c3", label: "Comprobante de domicilio actualizado", done: false },
      { id: "c4", label: "Teléfono verificado", done: true },
      { id: "c5", label: "CURP validada (RENAPO)", done: false },
    ];
  }
  if (personType === "PFAE") {
    return [
      { id: "c1", label: "Régimen 612 confirmado", done: true },
      { id: "c2", label: "Constancia de Situación Fiscal vigente", done: true },
      { id: "c3", label: "Comprobante de actividad económica", done: true },
      { id: "c4", label: "Opinión de cumplimiento SAT", done: false },
      ...(role === "seller" ? [{ id: "c5", label: "Cuenta receptora configurada", done: true }] : []),
    ];
  }
  // PM
  return [
    { id: "c1", label: "Constancia de Situación Fiscal aprobada", done: true },
    { id: "c2", label: "Acta constitutiva aprobada", done: true },
    { id: "c3", label: "Poder del representante legal validado", done: false },
    { id: "c4", label: "Identificación del representante validada", done: true },
    { id: "c5", label: "Contacto operativo asignado", done: true },
    ...(role === "seller" ? [{ id: "c6", label: "Cuenta receptora configurada", done: true }] : []),
  ];
}

// -------- Métricas rápidas por tipo de persona --------

function metricsFor(personType: PersonType, role: ViewRole) {
  const isBuyer = role === "buyer";
  if (personType === "PM") {
    return isBuyer
      ? [
          { label: "Empresa verificada", value: "Sí", state: "great" as const },
          { label: "Representante validado", value: "Sí", state: "good" as const },
          { label: "Poderes vigentes", value: "En revisión", state: "review" as const },
          { label: "Aprobaciones dentro de SLA", value: "91%", state: "good" as const },
          { label: "Operaciones sin disputa", value: "88%", state: "good" as const },
        ]
      : [
          { label: "Empresa verificada", value: "Sí", state: "great" as const },
          { label: "Representante validado", value: "Sí", state: "good" as const },
          { label: "Poderes vigentes", value: "En revisión", state: "review" as const },
          { label: "Documentos fiscales completos", value: "92%", state: "good" as const },
          { label: "Hitos entregados en tiempo", value: "87%", state: "good" as const },
          { label: "SLA de respuesta", value: "9h", state: "great" as const },
        ];
  }
  // PF & PFAE
  return isBuyer
    ? [
        { label: "Identidad validada", value: "Sí", state: "great" as const },
        { label: "Datos fiscales completos", value: personType === "PFAE" ? "100%" : "85%", state: personType === "PFAE" ? ("great" as const) : ("good" as const) },
        { label: "Aprobaciones dentro de SLA", value: "91%", state: "good" as const },
        { label: "Fondeos completados sin fallo", value: "100%", state: "great" as const },
        { label: "Tiempo promedio de aprobación", value: "18h", state: "good" as const },
      ]
    : [
        { label: "Identidad validada", value: "Sí", state: "great" as const },
        { label: "Datos fiscales completos", value: personType === "PFAE" ? "100%" : "85%", state: personType === "PFAE" ? ("great" as const) : ("good" as const) },
        { label: "Documentos vigentes", value: "92%", state: "good" as const },
        { label: "Operaciones sin incidencia", value: "88%", state: "good" as const },
        { label: "Tiempo promedio de respuesta", value: "9h", state: "great" as const },
      ];
}

// -------- Visibilidad ante contrapartes por tipo --------

function visibilityFor(personType: PersonType): VisibilityRow[] {
  if (personType === "PM") {
    return [
      { field: "Razón social", visibleForCounterparty: "Sí", visibleForBackoffice: "Sí", editable: "No" },
      { field: "Nombre comercial", visibleForCounterparty: "Sí", visibleForBackoffice: "Sí", editable: "Sí" },
      { field: "RFC", visibleForCounterparty: "Sí", visibleForBackoffice: "Sí", editable: "No" },
      { field: "Nivel de cumplimiento", visibleForCounterparty: "Sí", visibleForBackoffice: "Sí", editable: "No" },
      { field: "Score de cumplimiento", visibleForCounterparty: "Sí, resumido", visibleForBackoffice: "Sí", editable: "No" },
      { field: "Representante legal", visibleForCounterparty: "Parcial (nombre y estatus)", visibleForBackoffice: "Sí", editable: "No" },
      { field: "Documentos corporativos", visibleForCounterparty: "Solo estatus", visibleForBackoffice: "Sí", editable: "Sí" },
      { field: "Domicilio fiscal completo", visibleForCounterparty: "Según operación", visibleForBackoffice: "Sí", editable: "Sí" },
      { field: "Observaciones internas", visibleForCounterparty: "No", visibleForBackoffice: "Sí", editable: "No" },
    ];
  }
  // PF & PFAE
  const rows: VisibilityRow[] = [
    { field: "Nombre", visibleForCounterparty: "Sí", visibleForBackoffice: "Sí", editable: "No" },
    { field: "RFC (parcial)", visibleForCounterparty: "Sí, ej. HEBL****XX9", visibleForBackoffice: "Sí", editable: "No" },
    { field: "Nivel de cumplimiento", visibleForCounterparty: "Sí", visibleForBackoffice: "Sí", editable: "No" },
    { field: "Score de cumplimiento", visibleForCounterparty: "Sí, resumido", visibleForBackoffice: "Sí", editable: "No" },
    { field: "Documentos verificados", visibleForCounterparty: "Solo estatus", visibleForBackoffice: "Sí", editable: "Sí" },
    { field: "CURP", visibleForCounterparty: "No", visibleForBackoffice: "Sí", editable: "No" },
    { field: "Fecha de nacimiento", visibleForCounterparty: "No", visibleForBackoffice: "Sí", editable: "No" },
    { field: "Domicilio completo", visibleForCounterparty: "No por defecto", visibleForBackoffice: "Sí", editable: "Sí" },
  ];
  if (personType === "PFAE") {
    rows.splice(1, 0,
      { field: "Nombre comercial", visibleForCounterparty: "Sí", visibleForBackoffice: "Sí", editable: "Sí" },
      { field: "Régimen fiscal", visibleForCounterparty: "Sí", visibleForBackoffice: "Sí", editable: "No" },
    );
  }
  return rows;
}

function displayNameFor(personType: PersonType): { name: string; rfc: string } {
  if (personType === "PF") return { name: "Luis Hernández Barrera", rfc: "HEBL850214XX9" };
  if (personType === "PFAE") return { name: "María González Ruiz — MG Consultoría", rfc: "GORM880505QW1" };
  return { name: "Constructora Ejemplo S.A. de C.V.", rfc: "CEJ200101ABC" };
}

export function getMockProfile(role: ViewRole, personType: PersonType = "PM"): ComplianceProfile {
  const components = componentsFor(personType, role);
  const weightedScore = components.reduce((acc, c) => acc + c.score * c.weight, 0);
  const totalWeight = components.reduce((acc, c) => acc + c.weight, 0);
  const score = Math.round(weightedScore / (totalWeight || 1));

  const docs = docsFor(personType, role);
  const alerts = alertsFor(personType);
  const checklist = checklistFor(personType, role);
  const metrics = metricsFor(personType, role);
  const visibility = visibilityFor(personType);
  const identityFields = identityFieldsFor(personType);
  const representatives = representativesFor(personType);
  const dn = displayNameFor(personType);

  const requiredDocs = docs.filter((d) => d.required);
  const approvedRequired = requiredDocs.filter((d) => d.status === "APPROVED").length;
  const docCompletionPct =
    requiredDocs.length === 0 ? 100 : Math.round((approvedRequired / requiredDocs.length) * 100);

  const history: HistoryEntry[] = [
    { date: iso(0), score, level: levelForScore(score), reason: "Hito aprobado sin corrección", delta: +3 },
    { date: iso(4), score: score - 3, level: levelForScore(score - 3), reason: "Documento actualizado", delta: +5 },
    { date: iso(12), score: score - 8, level: levelForScore(score - 8), reason: "Disputa abierta", delta: -4 },
    { date: iso(20), score: score - 4, level: levelForScore(score - 4), reason: personType === "PM" ? "KYB aprobado" : "KYC aprobado", delta: +8 },
    { date: iso(35), score: Math.max(0, score - 12), level: levelForScore(Math.max(0, score - 12)), reason: "Perfil inicial", delta: 0 },
  ];

  const audit: AuditEntry[] = [
    { date: iso(0), event: "Score recalculado", user: "Sistema", module: "Perfil", result: `${score - 3} → ${score}` },
    { date: iso(1), event: "Documento aprobado", user: "Compliance Cumplex", module: "Documentos", result: "Aprobado" },
    { date: iso(4), event: "Documento reemplazado", user: "Usuario", module: "Documentos", result: "En revisión" },
    { date: iso(20), event: personType === "PM" ? "KYB aprobado" : "KYC aprobado", user: "Compliance Cumplex", module: "Verificación", result: "Aprobado" },
    { date: iso(30), event: "Perfil creado", user: "Sistema", module: "Perfil", result: "Creado" },
  ];

  return {
    role,
    personType,
    displayName: dn.name,
    rfc: dn.rfc,
    score,
    level: levelForScore(score),
    kyc: "APPROVED",
    kyb: personType === "PM" ? "APPROVED" : "NOT_STARTED",
    docCompletionPct,
    activeAlertsCount: alerts.filter((a) => a.status === "ACTIVE" && (a.severity === "WARN" || a.severity === "ERROR")).length,
    lastCalculatedAt: iso(0),
    identityFields,
    representatives,
    components,
    docs,
    alerts,
    history,
    audit,
    checklist,
    metrics,
    visibility,
  };
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}
export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
