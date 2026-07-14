// Mock catalog + data for /score (Perfil de Cumplimiento).
// Sustituir por queries reales cuando exista persistencia.

export type ViewRole = "buyer" | "seller";

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

export type DocCategory = "IDENTIDAD" | "FISCAL" | "LEGAL" | "BANCARIO";
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
  score: number; // 0-100
  weight: number; // 0-1
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

export interface ComplianceProfile {
  role: ViewRole;
  score: number;
  level: ComplianceLevel;
  kyc: KycStatus;
  kyb: KycStatus;
  docCompletionPct: number;
  activeAlertsCount: number;
  lastCalculatedAt: string;
  components: ScoreComponent[];
  docs: ComplianceDoc[];
  alerts: ComplianceAlert[];
  history: HistoryEntry[];
  audit: AuditEntry[];
  checklist: ChecklistItem[];
  metrics: { label: string; value: string; state: "good" | "great" | "review" | "bad" }[];
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

export function getMockProfile(role: ViewRole): ComplianceProfile {
  const isBuyer = role === "buyer";
  const score = isBuyer ? 82 : 86;

  const components: ScoreComponent[] = isBuyer
    ? [
        { key: "kyc", label: "Verificación KYC/KYB", score: 100, weight: 0.2, explanation: "Perfil validado y aprobado." },
        { key: "docs", label: "Cumplimiento documental", score: 80, weight: 0.2, explanation: "Documentos vigentes; constancia fiscal por renovar." },
        { key: "sla", label: "Puntualidad en aprobaciones", score: 91, weight: 0.2, explanation: "91% de aprobaciones dentro del SLA pactado." },
        { key: "nodisp", label: "Operaciones sin disputa", score: 88, weight: 0.2, explanation: "88% de operaciones cerradas sin conflicto." },
        { key: "pago", label: "Comportamiento de fondeo", score: 100, weight: 0.15, explanation: "Todos los fondeos completados sin falla." },
        { key: "corr", label: "Respuesta a observaciones", score: 70, weight: 0.05, explanation: "Correcciones atendidas dentro de plazo." },
      ]
    : [
        { key: "kyc", label: "Verificación KYC/KYB", score: 100, weight: 0.2, explanation: "Perfil validado y aprobado." },
        { key: "docs", label: "Cumplimiento documental", score: 92, weight: 0.2, explanation: "Documentos vigentes y aprobados." },
        { key: "hitos", label: "Cumplimiento de hitos", score: 87, weight: 0.25, explanation: "87% de hitos entregados a tiempo." },
        { key: "evid", label: "Evidencia aceptada", score: 79, weight: 0.15, explanation: "79% de evidencias aprobadas sin corrección." },
        { key: "nodisp", label: "Operaciones sin disputa", score: 85, weight: 0.15, explanation: "85% de operaciones cerradas sin controversia." },
        { key: "corr", label: "Respuesta a correcciones", score: 92, weight: 0.05, explanation: "Tiempo promedio de respuesta: 9h." },
      ];

  const docs: ComplianceDoc[] = [
    { id: "d1", name: "Identificación oficial (INE)", category: "IDENTIDAD", status: "APPROVED", updatedAt: iso(45), reviewedBy: "Compliance YOKTO", hash: "a1f2…9c7d" },
    { id: "d2", name: "Constancia de situación fiscal", category: "FISCAL", status: "APPROVED", expiresAt: isoFuture(15), updatedAt: iso(30), reviewedBy: "Automático", hash: "b8e1…4a2c" },
    { id: "d3", name: "Comprobante de domicilio", category: "IDENTIDAD", status: "PENDING", updatedAt: iso(2), reviewedBy: "—" },
    { id: "d4", name: "Carátula bancaria", category: "BANCARIO", status: "APPROVED", updatedAt: iso(60), reviewedBy: "Compliance YOKTO" },
    { id: "d5", name: "Opinión de cumplimiento SAT", category: "FISCAL", status: "EXPIRED", expiresAt: iso(5), updatedAt: iso(120), reviewedBy: "Compliance YOKTO", notes: "Renovar y adjuntar nueva versión." },
  ];
  if (!isBuyer) {
    docs.splice(1, 0, { id: "d0", name: "Acta constitutiva", category: "LEGAL", status: "APPROVED", updatedAt: iso(90), reviewedBy: "Compliance YOKTO" });
  }

  const alerts: ComplianceAlert[] = [
    { id: "a1", severity: "WARN", title: "Documento próximo a vencer", message: "Tu constancia fiscal vence en 15 días.", status: "ACTIVE", createdAt: iso(1), actionLabel: "Actualizar documento" },
    { id: "a2", severity: "ERROR", title: "Documento vencido", message: "La opinión de cumplimiento SAT venció hace 5 días.", status: "ACTIVE", createdAt: iso(5), actionLabel: "Subir versión vigente" },
    { id: "a3", severity: "OK", title: "Subiste de nivel", message: `Alcanzaste el nivel ${isBuyer ? "Confiable" : "Confiable"}.`, status: "ACTIVE", createdAt: iso(3) },
    { id: "a4", severity: "INFO", title: "Score actualizado", message: "Tu score se recalculó tras la aprobación de un hito.", status: "RESOLVED", createdAt: iso(1) },
  ];

  const history: HistoryEntry[] = [
    { date: iso(0), score, level: levelForScore(score), reason: "Hito aprobado sin corrección", delta: +3 },
    { date: iso(4), score: score - 3, level: levelForScore(score - 3), reason: "Documento actualizado", delta: +5 },
    { date: iso(12), score: score - 8, level: levelForScore(score - 8), reason: "Disputa abierta", delta: -4 },
    { date: iso(20), score: score - 4, level: levelForScore(score - 4), reason: "KYC aprobado", delta: +8 },
    { date: iso(35), score: score - 12, level: levelForScore(score - 12), reason: "Perfil inicial", delta: 0 },
  ];

  const audit: AuditEntry[] = [
    { date: iso(0), event: "Score recalculado", user: "Sistema", module: "Perfil", result: `${score - 3} → ${score}` },
    { date: iso(1), event: "Documento aprobado", user: "Compliance YOKTO", module: "Documentos", result: "Aprobado" },
    { date: iso(4), event: "Documento reemplazado", user: "Usuario", module: "Documentos", result: "En revisión" },
    { date: iso(20), event: "KYC aprobado", user: "Compliance YOKTO", module: "Verificación", result: "Aprobado" },
    { date: iso(30), event: "Perfil creado", user: "Sistema", module: "Perfil", result: "Creado" },
  ];

  const checklist: ChecklistItem[] = isBuyer
    ? [
        { id: "c1", label: "Completar KYC/KYB", done: true },
        { id: "c2", label: "Mantener documentos fiscales vigentes", done: false },
        { id: "c3", label: "Aprobar hitos dentro del SLA pactado", done: true },
        { id: "c4", label: "Cerrar 2 operaciones sin disputa", done: false },
        { id: "c5", label: "Reducir solicitudes de corrección improcedentes", done: false },
      ]
    : [
        { id: "c1", label: "Completar KYC/KYB", done: true },
        { id: "c2", label: "Mantener constancia fiscal vigente", done: false },
        { id: "c3", label: "Subir evidencia completa en próximos 3 hitos", done: false },
        { id: "c4", label: "Reducir correcciones documentales", done: true },
        { id: "c5", label: "Cerrar 2 operaciones sin disputa", done: false },
      ];

  const metrics = isBuyer
    ? [
        { label: "Aprobaciones dentro de SLA", value: "91%", state: "good" as const },
        { label: "Operaciones sin disputa", value: "88%", state: "good" as const },
        { label: "Fondeos completados sin fallo", value: "100%", state: "great" as const },
        { label: "Documentos fiscales vigentes", value: "80%", state: "review" as const },
        { label: "Tiempo promedio de aprobación", value: "18h", state: "good" as const },
      ]
    : [
        { label: "Hitos entregados en tiempo", value: "87%", state: "good" as const },
        { label: "Evidencia aprobada sin corrección", value: "79%", state: "review" as const },
        { label: "Documentos vigentes", value: "92%", state: "good" as const },
        { label: "Operaciones sin disputa", value: "85%", state: "good" as const },
        { label: "Tiempo promedio de respuesta", value: "9h", state: "great" as const },
      ];

  return {
    role,
    score,
    level: levelForScore(score),
    kyc: "APPROVED",
    kyb: isBuyer ? "APPROVED" : "APPROVED",
    docCompletionPct: 82,
    activeAlertsCount: alerts.filter((a) => a.status === "ACTIVE" && (a.severity === "WARN" || a.severity === "ERROR")).length,
    lastCalculatedAt: iso(0),
    components,
    docs,
    alerts,
    history,
    audit,
    checklist,
    metrics,
  };
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}
export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
