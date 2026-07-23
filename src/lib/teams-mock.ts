// Mock data & types for Teams & Enterprise module
export type TeamPlan = "BASICO" | "PROFESIONAL" | "ENTERPRISE";
export type TeamRole = "ADMIN" | "FINANZAS" | "OPERADOR" | "READONLY" | "AUDITOR";
export type MemberStatus = "ACTIVO" | "PENDIENTE" | "EXPIRADA" | "DESACTIVADO";

export type Member = {
  id: string;
  nombre: string;
  email: string;
  rol: TeamRole;
  estado: MemberStatus;
  limite_mxn: number | null; // null = sin límite
  sectores: string[]; // ['*'] = todos
  mfa: boolean;
  ultimo_acceso: string; // ISO
  operaciones_creadas: number;
  aprobaciones: number;
  avatar_iniciales: string;
};

export type WorkflowRule = {
  nivel: number;
  desde_mxn: number;
  hasta_mxn: number | null;
  rol: TeamRole;
  aprobaciones: number;
  sla_horas: number;
};
export type Workflow = {
  id: string;
  nombre: string;
  descripcion: string;
  action_type: "CREATE_OPERATION" | "APPROVE_MILESTONE" | "RELEASE_FUNDS" | "REFUND_FUNDS" | "RESOLVE_DISPUTE";
  sectores: string[];
  activo: boolean;
  default: boolean;
  reglas: WorkflowRule[];
};

export type ApprovalInstanceStatus = "PENDIENTE" | "EN_PROGRESO" | "APROBADO" | "RECHAZADO" | "EXPIRADO" | "CANCELADO";
export type ApprovalInstance = {
  id: string;
  action_type: Workflow["action_type"];
  action_label: string;
  operacion_numero: string;
  operacion_descripcion: string;
  solicitante: string;
  monto_mxn: number;
  nivel_actual: number;
  total_niveles: number;
  aprobador_rol: TeamRole;
  sla_horas_restantes: number;
  estado: ApprovalInstanceStatus;
  motivo: string;
  checklist: { label: string; ok: boolean; warn?: boolean }[];
  created_at: string;
};

export type ApiKey = {
  id: string;
  nombre: string;
  prefix: string;
  environment: "sandbox" | "production";
  permisos: string[];
  ip_whitelist: string[];
  ultimo_uso: string;
  requests: number;
  activa: boolean;
  webhook_url?: string;
  webhook_events?: string[];
  expira?: string | null;
};

export type Integration = {
  id: string;
  nombre: string;
  descripcion: string;
  estado: "CONFIGURADO" | "NO_CONFIGURADO" | "ERROR";
  detalle?: string;
  eventos_activos?: number;
};

export type AuditEvent = {
  id: string;
  fecha: string;
  actor: string;
  rol: TeamRole;
  action: string;
  entity: string;
  operacion?: string;
  ip: string;
  result: "SUCCESS" | "DENIED" | "ERROR";
};

export type TeamInfo = {
  id: string;
  nombre: string;
  razon_social: string;
  rfc: string;
  regimen_fiscal: string;
  cp_fiscal: string;
  domicilio_fiscal: string;
  representante_legal: string;
  email_admin: string;
  telefono: string;
  plan: TeamPlan;
  score_empresa: number;
  max_miembros: number;
  color_marca: string;
  require_mfa: boolean;
};

export const TEAM: TeamInfo = {
  id: "team_01H8XYZ",
  nombre: "Comercializadora del Pacífico",
  razon_social: "Comercializadora del Pacífico S. de R.L. de C.V.",
  rfc: "CPM240101AB1",
  regimen_fiscal: "601 — General de Ley Personas Morales",
  cp_fiscal: "82100",
  domicilio_fiscal: "Av. del Mar 1500, Mazatlán, Sinaloa",
  representante_legal: "Luis Alberto Hernández",
  email_admin: "admin@copacifico.mx",
  telefono: "+52 669 123 4567",
  plan: "PROFESIONAL",
  score_empresa: 842,
  max_miembros: 25,
  color_marca: "#4F46E5",
  require_mfa: true,
};

export const SECTORES = [
  "Autotransporte", "Construcción", "Comercio exterior",
  "Inmobiliario", "Vehículos", "Servicios",
];

export const MOCK_MEMBERS: Member[] = [
  {
    id: "u1", nombre: "Luis Alberto Hernández", email: "luis@copacifico.mx",
    rol: "ADMIN", estado: "ACTIVO", limite_mxn: null, sectores: ["*"], mfa: true,
    ultimo_acceso: "2026-07-15T10:45:00Z", operaciones_creadas: 12, aprobaciones: 48,
    avatar_iniciales: "LA",
  },
  {
    id: "u2", nombre: "Ana Sofía Ruiz", email: "ana.ruiz@copacifico.mx",
    rol: "FINANZAS", estado: "ACTIVO", limite_mxn: 5_000_000, sectores: ["*"], mfa: true,
    ultimo_acceso: "2026-07-15T09:12:00Z", operaciones_creadas: 3, aprobaciones: 74,
    avatar_iniciales: "AR",
  },
  {
    id: "u3", nombre: "María García", email: "maria@copacifico.mx",
    rol: "OPERADOR", estado: "ACTIVO", limite_mxn: 200_000,
    sectores: ["Autotransporte", "Comercio exterior"], mfa: true,
    ultimo_acceso: "2026-07-15T11:03:00Z", operaciones_creadas: 34, aprobaciones: 12,
    avatar_iniciales: "MG",
  },
  {
    id: "u4", nombre: "Juan Pablo Mora", email: "jp.mora@copacifico.mx",
    rol: "OPERADOR", estado: "ACTIVO", limite_mxn: 150_000,
    sectores: ["Construcción"], mfa: false,
    ultimo_acceso: "2026-07-14T16:20:00Z", operaciones_creadas: 21, aprobaciones: 5,
    avatar_iniciales: "JM",
  },
  {
    id: "u5", nombre: "Carla Estrada", email: "carla@copacifico.mx",
    rol: "READONLY", estado: "ACTIVO", limite_mxn: 0, sectores: ["*"], mfa: true,
    ultimo_acceso: "2026-07-13T08:44:00Z", operaciones_creadas: 0, aprobaciones: 0,
    avatar_iniciales: "CE",
  },
  {
    id: "u6", nombre: "Roberto Salinas", email: "auditor@ext-firma.com",
    rol: "AUDITOR", estado: "ACTIVO", limite_mxn: 0, sectores: ["*"], mfa: true,
    ultimo_acceso: "2026-07-10T14:30:00Z", operaciones_creadas: 0, aprobaciones: 0,
    avatar_iniciales: "RS",
  },
  {
    id: "u7", nombre: "Pendiente", email: "nuevo.operador@copacifico.mx",
    rol: "OPERADOR", estado: "PENDIENTE", limite_mxn: 100_000,
    sectores: ["Servicios"], mfa: true,
    ultimo_acceso: "", operaciones_creadas: 0, aprobaciones: 0,
    avatar_iniciales: "NO",
  },
  {
    id: "u8", nombre: "Invitación expirada", email: "vencido@copacifico.mx",
    rol: "READONLY", estado: "EXPIRADA", limite_mxn: 0, sectores: ["*"], mfa: true,
    ultimo_acceso: "", operaciones_creadas: 0, aprobaciones: 0,
    avatar_iniciales: "IE",
  },
];

export const MOCK_WORKFLOWS: Workflow[] = [
  {
    id: "wf1",
    nombre: "Workflow general de liberaciones",
    descripcion: "Aplica a todas las liberaciones de fondos sin importar sector.",
    action_type: "RELEASE_FUNDS",
    sectores: ["*"],
    activo: true,
    default: true,
    reglas: [
      { nivel: 1, desde_mxn: 0, hasta_mxn: 50_000, rol: "OPERADOR", aprobaciones: 1, sla_horas: 24 },
      { nivel: 2, desde_mxn: 50_001, hasta_mxn: 200_000, rol: "FINANZAS", aprobaciones: 1, sla_horas: 24 },
      { nivel: 3, desde_mxn: 200_001, hasta_mxn: null, rol: "ADMIN", aprobaciones: 1, sla_horas: 24 },
    ],
  },
  {
    id: "wf2",
    nombre: "Alta de operaciones sensibles",
    descripcion: "Sectores con requisitos regulatorios reforzados.",
    action_type: "CREATE_OPERATION",
    sectores: ["Inmobiliario", "Comercio exterior"],
    activo: true,
    default: false,
    reglas: [
      { nivel: 1, desde_mxn: 0, hasta_mxn: null, rol: "FINANZAS", aprobaciones: 1, sla_horas: 48 },
      { nivel: 2, desde_mxn: 0, hasta_mxn: null, rol: "ADMIN", aprobaciones: 1, sla_horas: 24 },
    ],
  },
  {
    id: "wf3",
    nombre: "Resolución de disputas mayores",
    descripcion: "Toda disputa >$100k requiere doble aprobación.",
    action_type: "RESOLVE_DISPUTE",
    sectores: ["*"],
    activo: true,
    default: false,
    reglas: [
      { nivel: 1, desde_mxn: 100_001, hasta_mxn: null, rol: "FINANZAS", aprobaciones: 1, sla_horas: 24 },
      { nivel: 2, desde_mxn: 100_001, hasta_mxn: null, rol: "ADMIN", aprobaciones: 1, sla_horas: 24 },
    ],
  },
];

export const MOCK_APPROVAL_INSTANCES: ApprovalInstance[] = [
  {
    id: "ai1", action_type: "RELEASE_FUNDS", action_label: "Liberar hito",
    operacion_numero: "Cumplex-2026-00045", operacion_descripcion: "Flete DF → Monterrey (10 t)",
    solicitante: "María García", monto_mxn: 320_000,
    nivel_actual: 2, total_niveles: 3, aprobador_rol: "FINANZAS",
    sla_horas_restantes: 6, estado: "EN_PROGRESO",
    motivo: "Hito 3 de 4 con evidencia completa. Cliente confirmó recepción sin observaciones.",
    checklist: [
      { label: "Contrato firmado", ok: true },
      { label: "CFDI PPD aceptado", ok: true },
      { label: "Evidencia validada", ok: true },
      { label: "Sin disputa activa", ok: true },
      { label: "REP pendiente posterior a liberación", ok: false, warn: true },
    ],
    created_at: "2026-07-14T10:00:00Z",
  },
  {
    id: "ai2", action_type: "APPROVE_MILESTONE", action_label: "Aprobar hito",
    operacion_numero: "Cumplex-2026-00051", operacion_descripcion: "Servicio de consultoría fiscal",
    solicitante: "Juan Pablo Mora", monto_mxn: 180_000,
    nivel_actual: 1, total_niveles: 2, aprobador_rol: "FINANZAS",
    sla_horas_restantes: 22, estado: "PENDIENTE",
    motivo: "Solicita aprobación de hito 2 de 3 según SOW firmado.",
    checklist: [
      { label: "Contrato firmado", ok: true },
      { label: "CFDI PPD aceptado", ok: true },
      { label: "Entregables validados", ok: true },
      { label: "Aceptación del comprador", ok: true },
    ],
    created_at: "2026-07-15T08:30:00Z",
  },
  {
    id: "ai3", action_type: "CREATE_OPERATION", action_label: "Crear operación",
    operacion_numero: "BORRADOR-2026-00007", operacion_descripcion: "Compraventa inmueble Polanco",
    solicitante: "Ana Sofía Ruiz", monto_mxn: 4_500_000,
    nivel_actual: 1, total_niveles: 2, aprobador_rol: "ADMIN",
    sla_horas_restantes: 40, estado: "PENDIENTE",
    motivo: "Operación inmobiliaria requiere workflow reforzado.",
    checklist: [
      { label: "Escritura preliminar cargada", ok: true },
      { label: "Avalúo vigente", ok: true },
      { label: "Libertad de gravamen", ok: true },
      { label: "Due diligence", ok: false, warn: true },
    ],
    created_at: "2026-07-15T07:00:00Z",
  },
  {
    id: "ai4", action_type: "REFUND_FUNDS", action_label: "Devolver fondos",
    operacion_numero: "Cumplex-2026-00028", operacion_descripcion: "Materiales de construcción",
    solicitante: "María García", monto_mxn: 78_000,
    nivel_actual: 1, total_niveles: 1, aprobador_rol: "FINANZAS",
    sla_horas_restantes: -2, estado: "EXPIRADO",
    motivo: "Cancelación acordada entre partes por incumplimiento de plazo.",
    checklist: [
      { label: "Cancelación firmada", ok: true },
      { label: "Sin CFDI emitido", ok: true },
    ],
    created_at: "2026-07-12T09:00:00Z",
  },
  {
    id: "ai5", action_type: "RELEASE_FUNDS", action_label: "Liberar hito",
    operacion_numero: "Cumplex-2026-00033", operacion_descripcion: "Suministro de refacciones",
    solicitante: "Juan Pablo Mora", monto_mxn: 42_000,
    nivel_actual: 1, total_niveles: 1, aprobador_rol: "OPERADOR",
    sla_horas_restantes: 18, estado: "APROBADO",
    motivo: "Aprobado por Operador dentro de su límite.",
    checklist: [
      { label: "Contrato firmado", ok: true },
      { label: "CFDI PPD aceptado", ok: true },
      { label: "Evidencia validada", ok: true },
    ],
    created_at: "2026-07-14T15:00:00Z",
  },
];

export const MOCK_API_KEYS: ApiKey[] = [
  {
    id: "ak1", nombre: "Integración SAP", prefix: "yk_live_8f3a",
    environment: "production",
    permisos: ["transactions:read", "payments:read", "fiscal:read"],
    ip_whitelist: ["201.120.10.4"],
    ultimo_uso: "2026-07-15T09:41:00Z",
    requests: 12_430, activa: true,
    webhook_url: "https://erp.copacifico.mx/hooks/yokto",
    webhook_events: ["milestone.approved", "payment.released", "cfdi.accepted"],
    expira: null,
  },
  {
    id: "ak2", nombre: "TMS logística", prefix: "yk_live_c92e",
    environment: "production",
    permisos: ["transactions:read", "milestones:complete"],
    ip_whitelist: ["189.203.44.10", "189.203.44.11"],
    ultimo_uso: "2026-07-15T04:12:00Z",
    requests: 3_820, activa: true,
    expira: "2026-12-31T23:59:59Z",
  },
  {
    id: "ak3", nombre: "Sandbox pruebas QA", prefix: "yk_test_11b0",
    environment: "sandbox",
    permisos: ["transactions:read", "transactions:create", "reports:read"],
    ip_whitelist: [],
    ultimo_uso: "2026-07-10T13:00:00Z",
    requests: 220, activa: true,
    expira: null,
  },
];

export const AVAILABLE_PERMISSIONS = [
  "transactions:read", "transactions:create", "transactions:update", "transactions:cancel",
  "milestones:read", "milestones:complete",
  "payments:read", "fiscal:read", "contracts:read", "reports:read",
  "webhooks:manage",
];

export const WEBHOOK_EVENTS = [
  "operation.created", "operation.activated", "operation.funded",
  "milestone.ready", "milestone.approved", "milestone.rejected",
  "payment.released", "payment.refunded",
  "dispute.opened", "dispute.resolved",
  "contract.signed", "cfdi.accepted", "rep.accepted",
  "approval.required", "approval.completed",
];

export const MOCK_INTEGRATIONS: Integration[] = [
  { id: "int1", nombre: "Webhooks", descripcion: "Envía eventos de operación a tu sistema.", estado: "CONFIGURADO", eventos_activos: 8, detalle: "Último envío hace 2 h" },
  { id: "int2", nombre: "ERP genérico (API)", descripcion: "Conecta tu ERP mediante la API REST de Cumplex.", estado: "CONFIGURADO", detalle: "SAP · 12,430 requests" },
  { id: "int3", nombre: "Contabilidad y fiscal", descripcion: "Exporta CFDI, REP y ledger a tu contabilidad.", estado: "NO_CONFIGURADO" },
  { id: "int4", nombre: "TMS / GPS logística", descripcion: "Comparte tracking en tiempo real con la operación.", estado: "CONFIGURADO", detalle: "2 vehículos activos" },
  { id: "int5", nombre: "CRM", descripcion: "Sincroniza contrapartes y contactos con tu CRM.", estado: "NO_CONFIGURADO" },
  { id: "int6", nombre: "Slack / Email alerts", descripcion: "Recibe alertas críticas en canales elegidos.", estado: "ERROR", detalle: "Token de Slack expirado" },
];

export const MOCK_AUDIT: AuditEvent[] = [
  { id: "ae1", fecha: "2026-07-15T10:45:00Z", actor: "Luis Hernández", rol: "ADMIN", action: "Miembro invitado", entity: "nuevo.operador@copacifico.mx", ip: "201.120.10.4", result: "SUCCESS" },
  { id: "ae2", fecha: "2026-07-15T09:30:00Z", actor: "Ana Ruiz", rol: "FINANZAS", action: "Hito aprobado", entity: "Cumplex-2026-00045 · Hito 2", operacion: "Cumplex-2026-00045", ip: "187.144.90.2", result: "SUCCESS" },
  { id: "ae3", fecha: "2026-07-15T09:12:00Z", actor: "María García", rol: "OPERADOR", action: "Aprobación bloqueada por límite", entity: "Cumplex-2026-00045", operacion: "Cumplex-2026-00045", ip: "10.0.0.32", result: "DENIED" },
  { id: "ae4", fecha: "2026-07-14T18:00:00Z", actor: "Luis Hernández", rol: "ADMIN", action: "Workflow editado", entity: "Workflow general de liberaciones", ip: "201.120.10.4", result: "SUCCESS" },
  { id: "ae5", fecha: "2026-07-14T15:30:00Z", actor: "Sistema", rol: "ADMIN", action: "API Key creada", entity: "yk_live_c92e (TMS logística)", ip: "—", result: "SUCCESS" },
  { id: "ae6", fecha: "2026-07-14T11:00:00Z", actor: "Ana Ruiz", rol: "FINANZAS", action: "Fondos liberados", entity: "Cumplex-2026-00033 · $42,000 MXN", operacion: "Cumplex-2026-00033", ip: "187.144.90.2", result: "SUCCESS" },
  { id: "ae7", fecha: "2026-07-13T08:44:00Z", actor: "Carla Estrada", rol: "READONLY", action: "Exportación denegada", entity: "Reporte operaciones", ip: "10.0.0.15", result: "DENIED" },
  { id: "ae8", fecha: "2026-07-12T16:20:00Z", actor: "Luis Hernández", rol: "ADMIN", action: "API Key revocada", entity: "yk_live_legacy…", ip: "201.120.10.4", result: "SUCCESS" },
];

// ─── Helpers ─────────────────────────────────────────────
export function formatMoney(v: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(v);
}
export function formatDateTime(iso: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export const ROLE_LABEL: Record<TeamRole, string> = {
  ADMIN: "Administrador", FINANZAS: "Finanzas", OPERADOR: "Operador",
  READONLY: "Solo lectura", AUDITOR: "Auditor",
};

export const ROLE_TONE: Record<TeamRole, string> = {
  ADMIN: "bg-yo-ac-bg text-yo-ac-txt",
  FINANZAS: "bg-emerald-50 text-emerald-700",
  OPERADOR: "bg-sky-50 text-sky-700",
  READONLY: "bg-yo-raised text-yo-txt-2",
  AUDITOR: "bg-amber-50 text-amber-700",
};

export const STATUS_TONE: Record<MemberStatus, { label: string; dot: string; bg: string; text: string }> = {
  ACTIVO:      { label: "Activo",       dot: "bg-emerald-500", bg: "bg-emerald-50",  text: "text-emerald-700" },
  PENDIENTE:   { label: "Pendiente",    dot: "bg-amber-500",   bg: "bg-amber-50",    text: "text-amber-700" },
  EXPIRADA:    { label: "Expirada",     dot: "bg-red-500",     bg: "bg-red-50",      text: "text-red-700" },
  DESACTIVADO: { label: "Desactivado",  dot: "bg-zinc-400",    bg: "bg-yo-raised",   text: "text-yo-txt-3" },
};

export const APPROVAL_STATUS_TONE: Record<ApprovalInstanceStatus, { label: string; bg: string; text: string; dot: string }> = {
  PENDIENTE:    { label: "Pendiente",    bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-500" },
  EN_PROGRESO:  { label: "En progreso",  bg: "bg-sky-50",     text: "text-sky-700",     dot: "bg-sky-500" },
  APROBADO:     { label: "Aprobado",     bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  RECHAZADO:    { label: "Rechazado",    bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-500" },
  EXPIRADO:     { label: "Expirado",     bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-500" },
  CANCELADO:    { label: "Cancelado",    bg: "bg-yo-raised",  text: "text-yo-txt-3",    dot: "bg-zinc-400" },
};

export const PLAN_TONE: Record<TeamPlan, { label: string; bg: string; text: string }> = {
  BASICO:       { label: "Básico",       bg: "bg-yo-raised",  text: "text-yo-txt-2" },
  PROFESIONAL:  { label: "Profesional",  bg: "bg-yo-ac-bg",   text: "text-yo-ac-txt" },
  ENTERPRISE:   { label: "Enterprise",   bg: "bg-emerald-50", text: "text-emerald-700" },
};

// Feature gate helper
export function planAllows(plan: TeamPlan, feature: "workflows" | "apiKeys" | "customReports" | "advancedAudit"): boolean {
  if (feature === "workflows") return plan !== "BASICO";
  if (feature === "apiKeys") return plan === "ENTERPRISE";
  if (feature === "customReports") return plan === "ENTERPRISE";
  if (feature === "advancedAudit") return plan !== "BASICO";
  return false;
}
