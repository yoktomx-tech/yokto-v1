// Analytics — datos mock consolidados para todas las pantallas.
// Reemplazar por RPCs reales cuando exista persistencia analítica.

export type Period = "7d" | "30d" | "90d" | "12m" | "ytd" | "custom";

export const PERIOD_LABEL: Record<Period, string> = {
  "7d": "7 días",
  "30d": "30 días",
  "90d": "90 días",
  "12m": "12 meses",
  ytd: "Año actual",
  custom: "Personalizado",
};

export type Plan = "BASICO" | "PROFESIONAL" | "ENTERPRISE";

export const CURRENT_PLAN: Plan = "PROFESIONAL";

export type AnalyticsFeature =
  | "ANALYTICS_OVERVIEW" | "ANALYTICS_OPERATIONS" | "ANALYTICS_PAYMENTS"
  | "ANALYTICS_FISCAL" | "ANALYTICS_COMPLIANCE" | "ANALYTICS_CONTRACTS"
  | "ANALYTICS_DISPUTES" | "ANALYTICS_TEAM" | "ANALYTICS_CUSTOM"
  | "EXPORT_CSV" | "EXPORT_XLSX" | "EXPORT_PDF" | "EXPORT_MASSIVE" | "ANALYTICS_API";

export const FEATURES_BY_PLAN: Record<Plan, AnalyticsFeature[]> = {
  BASICO: ["ANALYTICS_OVERVIEW", "ANALYTICS_OPERATIONS", "ANALYTICS_PAYMENTS", "EXPORT_CSV"],
  PROFESIONAL: [
    "ANALYTICS_OVERVIEW", "ANALYTICS_OPERATIONS", "ANALYTICS_PAYMENTS",
    "ANALYTICS_FISCAL", "ANALYTICS_COMPLIANCE", "ANALYTICS_CONTRACTS",
    "ANALYTICS_DISPUTES", "ANALYTICS_TEAM",
    "EXPORT_CSV", "EXPORT_XLSX", "EXPORT_PDF",
  ],
  ENTERPRISE: [
    "ANALYTICS_OVERVIEW", "ANALYTICS_OPERATIONS", "ANALYTICS_PAYMENTS",
    "ANALYTICS_FISCAL", "ANALYTICS_COMPLIANCE", "ANALYTICS_CONTRACTS",
    "ANALYTICS_DISPUTES", "ANALYTICS_TEAM", "ANALYTICS_CUSTOM",
    "EXPORT_CSV", "EXPORT_XLSX", "EXPORT_PDF", "EXPORT_MASSIVE", "ANALYTICS_API",
  ],
};

export function hasFeature(f: AnalyticsFeature, plan: Plan = CURRENT_PLAN): boolean {
  return FEATURES_BY_PLAN[plan].includes(f);
}

// ============ SECTORES ============
export const SECTOR_CFG = {
  AUTOTRANSPORTE:    { color: "#4F46E5", bg: "#EEF2FF", txt: "#3730A3", emoji: "🚛", label: "Autotransporte" },
  CONSTRUCCION:      { color: "#F97316", bg: "#FFF7ED", txt: "#9A3412", emoji: "🏗️", label: "Construcción" },
  COMERCIO_EXTERIOR: { color: "#0EA5E9", bg: "#F0F9FF", txt: "#0C4A6E", emoji: "🌐", label: "Comercio exterior" },
  INMOBILIARIO:      { color: "#8B5CF6", bg: "#F5F3FF", txt: "#4C1D95", emoji: "🏠", label: "Inmobiliario" },
  VEHICULOS:         { color: "#10B981", bg: "#ECFDF5", txt: "#064E3B", emoji: "🚗", label: "Vehículos" },
  SERVICIOS:         { color: "#F43F5E", bg: "#FFF1F2", txt: "#881337", emoji: "💼", label: "Servicios" },
} as const;

export type SectorKey = keyof typeof SECTOR_CFG;

// ============ KPIs ============
export type Kpi = {
  key: string;
  label: string;
  value: string;
  raw: number;
  delta?: number;
  format: "number" | "currency" | "percent" | "days";
  positive?: boolean;
};

export function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function fmtMoneyFull(n: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

export function overviewKpis(): Kpi[] {
  return [
    { key: "ops_total", label: "Operaciones totales", value: "128", raw: 128, delta: 12.4, format: "number", positive: true },
    { key: "volume", label: "Volumen operado", value: fmtMoney(8_400_000), raw: 8_400_000, delta: 8.1, format: "currency", positive: true },
    { key: "held", label: "Fondos retenidos", value: fmtMoney(1_200_000), raw: 1_200_000, delta: -2.3, format: "currency" },
    { key: "released", label: "Fondos liberados", value: fmtMoney(5_100_000), raw: 5_100_000, delta: 14.2, format: "currency", positive: true },
    { key: "compliance", label: "Tasa de cumplimiento", value: "92%", raw: 92, delta: 3.1, format: "percent", positive: true },
    { key: "disputes", label: "Tasa de disputa", value: "2.1%", raw: 2.1, delta: -0.4, format: "percent", positive: true },
    { key: "active", label: "Operaciones activas", value: "14", raw: 14, format: "number" },
    { key: "close_time", label: "Tiempo promedio de cierre", value: "9.2 d", raw: 9.2, delta: -1.1, format: "days", positive: true },
  ];
}

// ============ TENDENCIAS ============
export type TrendPoint = { periodo: string; total: number; completadas: number; disputas: number };
export function operationsTrend(): TrendPoint[] {
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return months.slice(0, 8).map((m, i) => ({
    periodo: m,
    total: 12 + i * 3 + Math.floor(Math.sin(i) * 4),
    completadas: 10 + i * 2 + Math.floor(Math.cos(i) * 3),
    disputas: Math.max(0, Math.floor(Math.sin(i * 1.7) * 2) + 1),
  }));
}

export type FundsPoint = { periodo: string; retenido: number; liberado: number; disputa: number; reembolso: number };
export function fundsTrend(): FundsPoint[] {
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago"];
  return months.map((m, i) => ({
    periodo: m,
    retenido: 400_000 + i * 80_000 + Math.floor(Math.sin(i) * 100_000),
    liberado: 300_000 + i * 120_000,
    disputa: 20_000 + Math.floor(Math.sin(i * 2) * 30_000 + 30_000),
    reembolso: 10_000 + Math.floor(Math.cos(i) * 15_000 + 15_000),
  }));
}

// ============ DISTRIBUCIÓN SECTOR ============
export type SectorRow = {
  sector: SectorKey; pct: number; volume: number; ops: number;
  compliance: number; disputes: number; ticket: number; cierre: number;
};
export function sectorBreakdown(): SectorRow[] {
  return [
    { sector: "AUTOTRANSPORTE", pct: 45, volume: 3_800_000, ops: 42, compliance: 94, disputes: 2.1, ticket: 90_476, cierre: 6.5 },
    { sector: "CONSTRUCCION", pct: 29, volume: 2_400_000, ops: 24, compliance: 88, disputes: 4.1, ticket: 100_000, cierre: 14.2 },
    { sector: "COMERCIO_EXTERIOR", pct: 12, volume: 1_000_000, ops: 12, compliance: 91, disputes: 1.9, ticket: 83_333, cierre: 11.8 },
    { sector: "INMOBILIARIO", pct: 8, volume: 680_000, ops: 6, compliance: 96, disputes: 0.0, ticket: 113_333, cierre: 22.5 },
    { sector: "VEHICULOS", pct: 4, volume: 340_000, ops: 8, compliance: 90, disputes: 3.2, ticket: 42_500, cierre: 4.1 },
    { sector: "SERVICIOS", pct: 2, volume: 180_000, ops: 36, compliance: 89, disputes: 2.4, ticket: 5_000, cierre: 5.3 },
  ];
}

// ============ OPERACIONES ============
export type UiOpStatus =
  | "DRAFT" | "PENDING_SIGN" | "ACTIVE" | "HELD" | "COMPLIANCE" | "VERIFY"
  | "DISPUTE" | "PARTIAL" | "COMPLETED" | "CANCELED";

export const OP_STATUS_CFG: Record<UiOpStatus, { label: string; tone: "neutral" | "info" | "accent" | "warn" | "err" | "ok" }> = {
  DRAFT:         { label: "Borrador", tone: "neutral" },
  PENDING_SIGN:  { label: "Pendiente firma", tone: "warn" },
  ACTIVE:        { label: "Activa", tone: "info" },
  HELD:          { label: "Fondos retenidos", tone: "accent" },
  COMPLIANCE:    { label: "En cumplimiento", tone: "info" },
  VERIFY:        { label: "En verificación", tone: "warn" },
  DISPUTE:       { label: "Disputa", tone: "err" },
  PARTIAL:       { label: "Liberación parcial", tone: "accent" },
  COMPLETED:     { label: "Completada", tone: "ok" },
  CANCELED:      { label: "Cancelada", tone: "neutral" },
};

export type FiscalStatus = "COMPLETE" | "CFDI_PENDING" | "REP_PENDING" | "REJECTED" | "NOT_REQUIRED";
export const FISCAL_CFG: Record<FiscalStatus, { label: string; tone: "ok" | "warn" | "err" | "neutral" }> = {
  COMPLETE:      { label: "Completo", tone: "ok" },
  CFDI_PENDING:  { label: "CFDI pendiente", tone: "warn" },
  REP_PENDING:   { label: "REP pendiente", tone: "warn" },
  REJECTED:      { label: "Rechazado", tone: "err" },
  NOT_REQUIRED:  { label: "No requerido", tone: "neutral" },
};

export type ContractStatus = "SIGNED" | "PENDING_BUYER" | "PENDING_SELLER" | "REJECTED" | "EXPIRED" | "REPLACED";
export const CONTRACT_CFG: Record<ContractStatus, { label: string; tone: "ok" | "warn" | "err" | "neutral" }> = {
  SIGNED:         { label: "Firmado", tone: "ok" },
  PENDING_BUYER:  { label: "Pend. comprador", tone: "warn" },
  PENDING_SELLER: { label: "Pend. vendedor", tone: "warn" },
  REJECTED:       { label: "Rechazado", tone: "err" },
  EXPIRED:        { label: "Vencido", tone: "err" },
  REPLACED:       { label: "Reemplazado", tone: "neutral" },
};

export type ComplianceStatus = "OK" | "RISK" | "OVERDUE";
export const COMPLIANCE_CFG: Record<ComplianceStatus, { label: string; tone: "ok" | "warn" | "err" }> = {
  OK:      { label: "Al día", tone: "ok" },
  RISK:    { label: "En riesgo", tone: "warn" },
  OVERDUE: { label: "Vencido", tone: "err" },
};

export type OperationRow = {
  id: string;
  numero: string;
  sector: SectorKey;
  rol: "buyer" | "seller";
  contraparte: string;
  status: UiOpStatus;
  amount: number;
  hitos: { done: number; total: number };
  cumplimiento: number;
  fiscal: FiscalStatus;
  contrato: ContractStatus;
  disputa: boolean;
  ultima: string;
};

export function operationsList(): OperationRow[] {
  return [
    { id: "op-1", numero: "YOKTO-2026-0012", sector: "AUTOTRANSPORTE", rol: "buyer", contraparte: "TransRegio SA", status: "VERIFY", amount: 85_000, hitos: { done: 2, total: 3 }, cumplimiento: 67, fiscal: "COMPLETE", contrato: "SIGNED", disputa: false, ultima: "hace 2h" },
    { id: "op-2", numero: "YOKTO-2026-0013", sector: "CONSTRUCCION", rol: "seller", contraparte: "Constructora Norte", status: "COMPLIANCE", amount: 420_000, hitos: { done: 2, total: 5 }, cumplimiento: 40, fiscal: "REP_PENDING", contrato: "PENDING_BUYER", disputa: false, ultima: "hace 5h" },
    { id: "op-3", numero: "YOKTO-2026-0014", sector: "VEHICULOS", rol: "buyer", contraparte: "AutoTop MX", status: "HELD", amount: 320_000, hitos: { done: 1, total: 2 }, cumplimiento: 50, fiscal: "CFDI_PENDING", contrato: "SIGNED", disputa: false, ultima: "hace 1d" },
    { id: "op-4", numero: "YOKTO-2026-0015", sector: "COMERCIO_EXTERIOR", rol: "buyer", contraparte: "GlobalTrade", status: "DISPUTE", amount: 640_000, hitos: { done: 1, total: 4 }, cumplimiento: 25, fiscal: "REJECTED", contrato: "SIGNED", disputa: true, ultima: "hace 3h" },
    { id: "op-5", numero: "YOKTO-2026-0016", sector: "INMOBILIARIO", rol: "seller", contraparte: "Inmuebles Sur", status: "PARTIAL", amount: 1_250_000, hitos: { done: 3, total: 4 }, cumplimiento: 75, fiscal: "COMPLETE", contrato: "SIGNED", disputa: false, ultima: "hace 6h" },
    { id: "op-6", numero: "YOKTO-2026-0017", sector: "SERVICIOS", rol: "seller", contraparte: "AgencyMX", status: "COMPLETED", amount: 45_000, hitos: { done: 3, total: 3 }, cumplimiento: 100, fiscal: "COMPLETE", contrato: "SIGNED", disputa: false, ultima: "hace 1d" },
    { id: "op-7", numero: "YOKTO-2026-0018", sector: "AUTOTRANSPORTE", rol: "buyer", contraparte: "Logistix", status: "COMPLIANCE", amount: 128_000, hitos: { done: 1, total: 3 }, cumplimiento: 33, fiscal: "CFDI_PENDING", contrato: "SIGNED", disputa: false, ultima: "hace 8h" },
    { id: "op-8", numero: "YOKTO-2026-0019", sector: "CONSTRUCCION", rol: "buyer", contraparte: "ObraCivil", status: "ACTIVE", amount: 890_000, hitos: { done: 0, total: 6 }, cumplimiento: 15, fiscal: "NOT_REQUIRED", contrato: "PENDING_SELLER", disputa: false, ultima: "hace 30m" },
  ];
}

// ============ FISCAL ============
export type FiscalRow = {
  id: string;
  tipo: "CFDI" | "REP";
  uuid: string;
  operacion: string;
  emisor: string;
  receptor: string;
  total: number;
  metodo: string;
  forma: string;
  sat: "VIGENTE" | "CANCELADO" | "VALIDANDO";
  coherencia: number;
  estado: "ACEPTADO" | "PENDIENTE" | "RECHAZADO" | "VALIDANDO";
  parcialidad?: string;
};
export function fiscalList(): FiscalRow[] {
  return [
    { id: "f1", tipo: "CFDI", uuid: "6E0D3B1A-9F12-4A5C-B821-8E0D3B1A9F12", operacion: "YOKTO-2026-0012", emisor: "TRE180101ABC", receptor: "YOK180101XYZ", total: 85_000, metodo: "PPD", forma: "99", sat: "VIGENTE", coherencia: 96, estado: "ACEPTADO" },
    { id: "f2", tipo: "REP", uuid: "8B2F1CDE-0A9B-4C1E-8F2D-1CDE0A9B4C1E", operacion: "YOKTO-2026-0012", emisor: "TRE180101ABC", receptor: "YOK180101XYZ", total: 30_000, metodo: "PUE", forma: "03", sat: "VIGENTE", coherencia: 91, estado: "ACEPTADO", parcialidad: "1/3" },
    { id: "f3", tipo: "REP", uuid: "9C3E2DFE-1BAC-4D2F-9E3E-2DFE1BAC4D2F", operacion: "YOKTO-2026-0012", emisor: "TRE180101ABC", receptor: "YOK180101XYZ", total: 35_000, metodo: "PUE", forma: "03", sat: "VALIDANDO", coherencia: 74, estado: "PENDIENTE", parcialidad: "2/3" },
    { id: "f4", tipo: "CFDI", uuid: "1A4F3E0F-2CBD-4E3A-A4F3-3E0F2CBD4E3A", operacion: "YOKTO-2026-0015", emisor: "GLB180101XYZ", receptor: "YOK180101XYZ", total: 640_000, metodo: "PPD", forma: "01", sat: "VIGENTE", coherencia: 45, estado: "RECHAZADO" },
    { id: "f5", tipo: "CFDI", uuid: "2B5A4F1B-3DCE-4F4B-B5A4-4F1B3DCE4F4B", operacion: "YOKTO-2026-0014", emisor: "ATP180101MMM", receptor: "YOK180101XYZ", total: 320_000, metodo: "PPD", forma: "99", sat: "VIGENTE", coherencia: 88, estado: "VALIDANDO" },
    { id: "f6", tipo: "CFDI", uuid: "3C6B5A2C-4EDF-405C-C6B5-5A2C4EDF405C", operacion: "YOKTO-2026-0016", emisor: "INM180101ABC", receptor: "YOK180101XYZ", total: 1_250_000, metodo: "PPD", forma: "99", sat: "VIGENTE", coherencia: 98, estado: "ACEPTADO" },
  ];
}

// ============ PAGOS ============
export type PaymentRow = {
  id: string;
  fecha: string;
  operacion: string;
  tipo: "DEPOSIT" | "HOLD" | "RELEASE" | "PARTIAL" | "REFUND" | "COMMISSION" | "VAT" | "ADJUSTMENT";
  amount: number;
  metodo: "SPEI" | "STRIPE" | "CLABE";
  estado: "PROCESSING" | "COMPLETED" | "FAILED" | "REVERSED" | "PENDING_RECON";
  ref: string;
  hito?: string;
  cfdi?: string;
};

const PAY_TIPO: Record<PaymentRow["tipo"], string> = {
  DEPOSIT: "Depósito comprador", HOLD: "Retención pasarela", RELEASE: "Liberación hito",
  PARTIAL: "Liberación parcial", REFUND: "Reembolso", COMMISSION: "Comisión YOKTO",
  VAT: "IVA comisión", ADJUSTMENT: "Ajuste manual",
};
export function paymentsTipoLabel(t: PaymentRow["tipo"]): string { return PAY_TIPO[t]; }

const PAY_EST: Record<PaymentRow["estado"], { label: string; tone: "ok" | "warn" | "err" | "info" | "neutral" }> = {
  PROCESSING:      { label: "Procesando", tone: "info" },
  COMPLETED:       { label: "Completado", tone: "ok" },
  FAILED:          { label: "Fallido", tone: "err" },
  REVERSED:        { label: "Revertido", tone: "err" },
  PENDING_RECON:   { label: "Pend. conciliación", tone: "warn" },
};
export function paymentsEstadoCfg(e: PaymentRow["estado"]) { return PAY_EST[e]; }

export function paymentsList(): PaymentRow[] {
  return [
    { id: "p1", fecha: "2026-07-14", operacion: "YOKTO-2026-0012", tipo: "DEPOSIT", amount: 85_000, metodo: "SPEI", estado: "COMPLETED", ref: "SPEI-98A2F", hito: "Inicio" },
    { id: "p2", fecha: "2026-07-14", operacion: "YOKTO-2026-0012", tipo: "HOLD", amount: 85_000, metodo: "SPEI", estado: "COMPLETED", ref: "HOLD-98A2F" },
    { id: "p3", fecha: "2026-07-13", operacion: "YOKTO-2026-0012", tipo: "RELEASE", amount: 30_000, metodo: "SPEI", estado: "COMPLETED", ref: "REL-1", hito: "Hito 1", cfdi: "REP 1/3" },
    { id: "p4", fecha: "2026-07-12", operacion: "YOKTO-2026-0015", tipo: "DEPOSIT", amount: 640_000, metodo: "STRIPE", estado: "COMPLETED", ref: "pi_2ABc", hito: "Inicio" },
    { id: "p5", fecha: "2026-07-11", operacion: "YOKTO-2026-0016", tipo: "PARTIAL", amount: 250_000, metodo: "SPEI", estado: "COMPLETED", ref: "REL-2", hito: "Hito 3" },
    { id: "p6", fecha: "2026-07-11", operacion: "YOKTO-2026-0016", tipo: "COMMISSION", amount: 3_750, metodo: "SPEI", estado: "COMPLETED", ref: "COM-2" },
    { id: "p7", fecha: "2026-07-10", operacion: "YOKTO-2026-0018", tipo: "REFUND", amount: 12_000, metodo: "SPEI", estado: "PROCESSING", ref: "REF-3" },
    { id: "p8", fecha: "2026-07-09", operacion: "YOKTO-2026-0014", tipo: "HOLD", amount: 320_000, metodo: "STRIPE", estado: "PENDING_RECON", ref: "pi_9XyZ" },
  ];
}

// ============ CONTRATOS ============
export type ContractRow = {
  id: string; operacion: string; tipo: string; origen: "GENERADO" | "PDF" | "REEMPLAZADO";
  estado: ContractStatus; comprador: string; vendedor: string;
  metodo: "EFIRMA" | "AUTOGRAFA" | "MIXTO" | "PENDIENTE"; hash: string; ultimaFirma?: string;
};
export function contractsList(): ContractRow[] {
  return [
    { id: "c1", operacion: "YOKTO-2026-0012", tipo: "Autotransporte estándar", origen: "GENERADO", estado: "SIGNED", comprador: "Firmado", vendedor: "Firmado", metodo: "EFIRMA", hash: "9f12a3b4c5", ultimaFirma: "15 Jul 2026" },
    { id: "c2", operacion: "YOKTO-2026-0013", tipo: "Construcción REPSE", origen: "PDF", estado: "PENDING_BUYER", comprador: "Pendiente", vendedor: "Firmado", metodo: "AUTOGRAFA", hash: "1b2c3d4e5f", ultimaFirma: "14 Jul 2026" },
    { id: "c3", operacion: "YOKTO-2026-0018", tipo: "Construcción llave en mano", origen: "GENERADO", estado: "PENDING_SELLER", comprador: "Firmado", vendedor: "Pendiente", metodo: "AUTOGRAFA", hash: "8e7d6c5b4a", ultimaFirma: "13 Jul 2026" },
    { id: "c4", operacion: "YOKTO-2026-0016", tipo: "Compraventa inmobiliaria", origen: "PDF", estado: "SIGNED", comprador: "Firmado", vendedor: "Firmado", metodo: "MIXTO", hash: "aa11bb22cc", ultimaFirma: "12 Jul 2026" },
    { id: "c5", operacion: "YOKTO-2026-0017", tipo: "Servicios profesionales", origen: "GENERADO", estado: "SIGNED", comprador: "Firmado", vendedor: "Firmado", metodo: "EFIRMA", hash: "dd44ee55ff", ultimaFirma: "10 Jul 2026" },
  ];
}

// ============ DISPUTAS ============
export type DisputeRow = {
  id: string; folio: string; operacion: string; sector: SectorKey;
  iniciadaPor: "buyer" | "seller"; motivo: string; monto: number;
  estado: "ABIERTA" | "MEDIACION" | "RESUELTA_COMPRADOR" | "RESUELTA_VENDEDOR" | "RESUELTA_DIVIDIDA" | "CANCELADA";
  sla: string; resultado?: string;
};
export function disputesList(): DisputeRow[] {
  return [
    { id: "d1", folio: "DIS-2026-00023", operacion: "YOKTO-2026-0015", sector: "COMERCIO_EXTERIOR", iniciadaPor: "buyer", motivo: "Documento inválido", monto: 640_000, estado: "MEDIACION", sla: "36h restantes" },
    { id: "d2", folio: "DIS-2026-00022", operacion: "YOKTO-2026-0018", sector: "CONSTRUCCION", iniciadaPor: "buyer", motivo: "Entrega incompleta", monto: 890_000, estado: "ABIERTA", sla: "70h restantes" },
    { id: "d3", folio: "DIS-2026-00021", operacion: "YOKTO-2026-0011", sector: "VEHICULOS", iniciadaPor: "buyer", motivo: "Daño físico", monto: 220_000, estado: "RESUELTA_DIVIDIDA", sla: "cerrada", resultado: "50/50" },
    { id: "d4", folio: "DIS-2026-00020", operacion: "YOKTO-2026-0010", sector: "AUTOTRANSPORTE", iniciadaPor: "seller", motivo: "Retraso", monto: 45_000, estado: "RESUELTA_VENDEDOR", sla: "cerrada", resultado: "A favor vendedor" },
  ];
}

// ============ APROBACIONES ============
export type ApprovalRow = {
  id: string; fecha: string; operacion: string; hito: string; vendedor: string;
  monto: number; estado: "PENDIENTE" | "APROBADO" | "CORRECCION" | "RECHAZADO" | "DISPUTA";
  decision?: string; tiempo?: string; impacto: number;
};
export function approvalsList(): ApprovalRow[] {
  return [
    { id: "a1", fecha: "2026-07-14", operacion: "YOKTO-2026-0012", hito: "Entrega en destino", vendedor: "TransRegio SA", monto: 30_000, estado: "PENDIENTE", impacto: 29_700 },
    { id: "a2", fecha: "2026-07-13", operacion: "YOKTO-2026-0016", hito: "Anticipo notarial", vendedor: "Inmuebles Sur", monto: 250_000, estado: "APROBADO", decision: "Liberado", tiempo: "3h 12m", impacto: 247_500 },
    { id: "a3", fecha: "2026-07-13", operacion: "YOKTO-2026-0018", hito: "Estimación 1", vendedor: "ObraCivil", monto: 148_000, estado: "CORRECCION", decision: "Falta evidencia GPS", tiempo: "1h 45m", impacto: 146_520 },
    { id: "a4", fecha: "2026-07-11", operacion: "YOKTO-2026-0015", hito: "Embarque", vendedor: "GlobalTrade", monto: 160_000, estado: "DISPUTA", decision: "Abrió disputa", tiempo: "5h 30m", impacto: 158_400 },
  ];
}

// ============ EQUIPO ============
export type TeamRow = {
  id: string; nombre: string; rol: string; operaciones: number;
  monto: number; aprobaciones: number; documentos: number; fiscal: number; disputas: number; ultima: string;
};
export function teamList(): TeamRow[] {
  return [
    { id: "t1", nombre: "Ana Martínez", rol: "Comprador Admin", operaciones: 42, monto: 3_100_000, aprobaciones: 38, documentos: 124, fiscal: 22, disputas: 1, ultima: "hace 10m" },
    { id: "t2", nombre: "Luis Hernández", rol: "Finanzas", operaciones: 28, monto: 2_400_000, aprobaciones: 0, documentos: 12, fiscal: 45, disputas: 0, ultima: "hace 1h" },
    { id: "t3", nombre: "Karla Ruiz", rol: "Compliance", operaciones: 128, monto: 8_400_000, aprobaciones: 0, documentos: 210, fiscal: 88, disputas: 4, ultima: "hace 2h" },
    { id: "t4", nombre: "Diego Vera", rol: "Vendedor Admin", operaciones: 22, monto: 1_800_000, aprobaciones: 0, documentos: 96, fiscal: 34, disputas: 2, ultima: "ayer" },
  ];
}

// ============ EXPORTACIONES ============
export type ExportRow = {
  id: string; fecha: string; usuario: string; formato: "CSV" | "XLSX" | "PDF" | "ZIP" | "JSON";
  reporte: string; periodo: string;
  estado: "GENERANDO" | "DISPONIBLE" | "FALLIDO" | "EXPIRADO" | "CANCELADO";
  size: string; expira: string;
};
export function exportsList(): ExportRow[] {
  return [
    { id: "e1", fecha: "2026-07-14 12:20", usuario: "Ana Martínez", formato: "XLSX", reporte: "Reporte completo", periodo: "30 días", estado: "DISPONIBLE", size: "128 KB", expira: "21 Jul 2026" },
    { id: "e2", fecha: "2026-07-14 09:05", usuario: "Luis Hernández", formato: "CSV", reporte: "Pagos", periodo: "90 días", estado: "DISPONIBLE", size: "42 KB", expira: "21 Jul 2026" },
    { id: "e3", fecha: "2026-07-13 18:14", usuario: "Karla Ruiz", formato: "PDF", reporte: "Ejecutivo", periodo: "30 días", estado: "GENERANDO", size: "—", expira: "—" },
    { id: "e4", fecha: "2026-07-12 11:30", usuario: "Ana Martínez", formato: "CSV", reporte: "Fiscal CFDI/REP", periodo: "12 meses", estado: "EXPIRADO", size: "88 KB", expira: "vencido" },
    { id: "e5", fecha: "2026-07-10 08:41", usuario: "Karla Ruiz", formato: "XLSX", reporte: "Cumplimiento", periodo: "90 días", estado: "FALLIDO", size: "—", expira: "—" },
  ];
}

// ============ COMPLIANCE HEALTH ============
export function complianceHealth() {
  return [
    { label: "Hitos cumplidos", pct: 92 },
    { label: "Documentos aprobados", pct: 88 },
    { label: "Fiscal completo", pct: 76 },
    { label: "Contratos firmados", pct: 94 },
    { label: "Evidencia completa", pct: 85 },
    { label: "SLA en verde", pct: 81 },
  ];
}

// ============ INSIGHTS ============
export function topInsights(): string[] {
  return [
    "La tasa de aprobación bajó 8% vs el periodo anterior.",
    "El sector Construcción concentra 42% del volumen operado.",
    "3 operaciones tienen REP pendiente después de liberación.",
    "2 contratos están firmados por una sola parte.",
    "Autotransporte tuvo el menor tiempo de cierre promedio.",
  ];
}

export function complianceAlerts(): string[] {
  return [
    "3 operaciones tienen REP pendiente después de liberación.",
    "2 CFDI fueron rechazados por método de pago incorrecto.",
    "1 contrato está pendiente de firma del vendedor.",
    "4 hitos vencen en las próximas 48 horas.",
  ];
}

// ============ PERFIL COMPLIANCE HISTORY ============
export function scoreHistory() {
  const points = ["Feb", "Mar", "Abr", "May", "Jun", "Jul"];
  return points.map((p, i) => ({ periodo: p, score: 62 + i * 5 + Math.floor(Math.sin(i) * 3) }));
}

export function scoreBreakdown() {
  return [
    { label: "Documental", value: 92 },
    { label: "Fiscal", value: 86 },
    { label: "Contractual", value: 94 },
    { label: "Operativo", value: 89 },
    { label: "Incidencias/disputas", value: 78 },
  ];
}

export function scoreEvents() {
  return [
    { delta: +12, label: "CFDI aceptado" },
    { delta: +8, label: "Hito aprobado a tiempo" },
    { delta: -15, label: "Disputa abierta" },
    { delta: -10, label: "REP rechazado" },
    { delta: +20, label: "Contrato firmado con e.firma" },
  ];
}
