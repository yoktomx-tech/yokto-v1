// Mock catalog + data para /relationships (CRM de contrapartes).
// Sin creación manual: contrapartes provienen de operaciones, búsqueda o invitación.

export type PersonType = "PF" | "PFAE" | "PM";
export type CounterpartyRole = "BUYER" | "SELLER" | "BOTH";
export type RelationshipStatus =
  | "ACTIVA"
  | "FRECUENTE"
  | "OCASIONAL"
  | "PAUSADA"
  | "BLOQUEADA"
  | "OCULTA";

export type SectorId =
  | "AUTOTRANSPORTE"
  | "CONSTRUCCION"
  | "COMERCIO_EXTERIOR"
  | "INMOBILIARIO"
  | "VEHICULOS"
  | "SERVICIOS";

export const SECTOR_CFG: Record<SectorId, { label: string; emoji: string; bg: string; txt: string }> = {
  AUTOTRANSPORTE:    { label: "Autotransporte",     emoji: "🚛", bg: "#EEF2FF", txt: "#3730A3" },
  CONSTRUCCION:      { label: "Construcción",       emoji: "🏗️", bg: "#FFF7ED", txt: "#9A3412" },
  COMERCIO_EXTERIOR: { label: "Comercio exterior",  emoji: "🌐", bg: "#F0F9FF", txt: "#0C4A6E" },
  INMOBILIARIO:      { label: "Inmobiliario",       emoji: "🏠", bg: "#F5F3FF", txt: "#4C1D95" },
  VEHICULOS:         { label: "Vehículos",          emoji: "🚗", bg: "#ECFDF5", txt: "#064E3B" },
  SERVICIOS:         { label: "Servicios",          emoji: "💼", bg: "#FFF1F2", txt: "#881337" },
};

export const STATUS_CFG: Record<RelationshipStatus, { label: string; bg: string; txt: string; dot: string }> = {
  ACTIVA:    { label: "Activa",     bg: "#ECFDF5", txt: "#047857", dot: "#10B981" },
  FRECUENTE: { label: "Frecuente",  bg: "#EEF2FF", txt: "#3730A3", dot: "#4F46E5" },
  OCASIONAL: { label: "Ocasional",  bg: "#F4F4F5", txt: "#3F3F46", dot: "#71717A" },
  PAUSADA:   { label: "Pausada",    bg: "#FFFBEB", txt: "#B45309", dot: "#F59E0B" },
  BLOQUEADA: { label: "Bloqueada",  bg: "#FEF2F2", txt: "#B91C1C", dot: "#EF4444" },
  OCULTA:    { label: "Oculta",     bg: "#F4F4F5", txt: "#71717A", dot: "#A1A1AA" },
};

export type TrustLevel = "AAA" | "AA" | "A" | "B" | "C";
export const TRUST_CFG: Record<TrustLevel, { bg: string; txt: string; label: string }> = {
  AAA: { bg: "#ECFDF5", txt: "#047857", label: "Confianza excepcional" },
  AA:  { bg: "#EEF2FF", txt: "#3730A3", label: "Confianza alta" },
  A:   { bg: "#F0F9FF", txt: "#0C4A6E", label: "Confianza sólida" },
  B:   { bg: "#FFFBEB", txt: "#B45309", label: "Confianza moderada" },
  C:   { bg: "#FEF2F2", txt: "#B91C1C", label: "Confianza limitada" },
};

export type Counterparty = {
  id: string;                // UUID mock
  yoktoId: string;           // YKT-XXXX
  displayName: string;
  legalName?: string;
  personType: PersonType;
  rfc: string;
  curp?: string;
  email: string;
  phone?: string;
  city?: string;
  state?: string;
  role: CounterpartyRole;
  status: RelationshipStatus;
  sectors: SectorId[];
  trustScore: number;         // 0-100
  trustLevel: TrustLevel;
  kycVerified: boolean;
  linkedAt: string;           // ISO
  lastInteractionAt: string;
  metrics: {
    totalOps: number;
    activeOps: number;
    completedOps: number;
    disputedOps: number;
    totalVolumeMxn: number;
    avgTicketMxn: number;
    onTimeRate: number;         // 0-1
    complianceRate: number;     // 0-1
  };
  starred?: boolean;
  hidden?: boolean;
  source: "OPERATION" | "SEARCH" | "INVITATION";
};

export type Invitation = {
  id: string;
  email: string;
  displayName?: string;
  rfcHint?: string;
  sector?: SectorId;
  message?: string;
  linkedTxId?: string;
  status: "PENDIENTE" | "ACEPTADA" | "RECHAZADA" | "EXPIRADA" | "CANCELADA";
  invitedAt: string;
  expiresAt: string;
  invitedBy: string;
};

export type Interaction = {
  id: string;
  counterpartyId: string;
  kind: "OPERACION_CREADA" | "OPERACION_LIBERADA" | "DOCUMENTO_SOLICITADO" | "DOCUMENTO_RECIBIDO" |
        "CFDI_RECIBIDO" | "REP_RECIBIDO" | "APROBACION" | "CORRECCION_SOLICITADA" |
        "DISPUTA_ABIERTA" | "DISPUTA_RESUELTA" | "PAGO_RECIBIDO" | "PAGO_LIBERADO" | "MENSAJE";
  at: string;
  actor: string;
  detail: string;
  txId?: string;
};

export type DocumentRequest = {
  id: string;
  counterpartyId: string;
  docType: "CFDI" | "REP" | "CONTRATO" | "IDENT" | "COMPROBANTE_DOMICILIO" | "CONSTANCIA_FISCAL" | "OTRO";
  status: "SOLICITADO" | "RECIBIDO" | "OBSERVADO" | "RECHAZADO";
  requestedAt: string;
  dueAt?: string;
  note?: string;
};

/* ─────────────── Mock data ─────────────── */

const iso = (d: Date) => d.toISOString();
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const daysAhead = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

export const MOCK_COUNTERPARTIES: Counterparty[] = [
  {
    id: "cp-01a2b3c4-1111-4a1b-8c2d-000000000001",
    yoktoId: "YKT-00421",
    displayName: "Transportes Norteños del Bajío",
    legalName: "Transportes Norteños del Bajío SA de CV",
    personType: "PM",
    rfc: "TNB120315AA1",
    email: "cxc@tnbajio.mx",
    phone: "+52 477 555 0121",
    city: "León",
    state: "Guanajuato",
    role: "SELLER",
    status: "FRECUENTE",
    sectors: ["AUTOTRANSPORTE"],
    trustScore: 92,
    trustLevel: "AAA",
    kycVerified: true,
    linkedAt: daysAgo(420),
    lastInteractionAt: daysAgo(3),
    metrics: { totalOps: 34, activeOps: 3, completedOps: 30, disputedOps: 1, totalVolumeMxn: 12_450_000, avgTicketMxn: 366_000, onTimeRate: 0.97, complianceRate: 0.98 },
    starred: true,
    source: "OPERATION",
  },
  {
    id: "cp-01a2b3c4-2222-4a1b-8c2d-000000000002",
    yoktoId: "YKT-01288",
    displayName: "Constructora Bahía Verde",
    legalName: "Constructora Bahía Verde S.A.P.I. de C.V.",
    personType: "PM",
    rfc: "CBV180922Q40",
    email: "admin@bahiaverde.com",
    phone: "+52 998 555 0910",
    city: "Cancún",
    state: "Quintana Roo",
    role: "BUYER",
    status: "ACTIVA",
    sectors: ["CONSTRUCCION", "INMOBILIARIO"],
    trustScore: 84,
    trustLevel: "AA",
    kycVerified: true,
    linkedAt: daysAgo(210),
    lastInteractionAt: daysAgo(9),
    metrics: { totalOps: 12, activeOps: 2, completedOps: 9, disputedOps: 1, totalVolumeMxn: 8_900_000, avgTicketMxn: 742_000, onTimeRate: 0.88, complianceRate: 0.91 },
    source: "OPERATION",
  },
  {
    id: "cp-01a2b3c4-3333-4a1b-8c2d-000000000003",
    yoktoId: "YKT-02901",
    displayName: "María López Serrano",
    personType: "PFAE",
    rfc: "LOSM880412H23",
    curp: "LOSM880412MDFPRR07",
    email: "maria@lopezserrano.mx",
    phone: "+52 55 555 0132",
    city: "CDMX",
    state: "Ciudad de México",
    role: "SELLER",
    status: "ACTIVA",
    sectors: ["SERVICIOS"],
    trustScore: 78,
    trustLevel: "A",
    kycVerified: true,
    linkedAt: daysAgo(120),
    lastInteractionAt: daysAgo(14),
    metrics: { totalOps: 8, activeOps: 1, completedOps: 7, disputedOps: 0, totalVolumeMxn: 640_000, avgTicketMxn: 80_000, onTimeRate: 0.94, complianceRate: 0.96 },
    source: "OPERATION",
  },
  {
    id: "cp-01a2b3c4-4444-4a1b-8c2d-000000000004",
    yoktoId: "YKT-03150",
    displayName: "Global Trade Aduanas",
    legalName: "Global Trade Aduanas S.C.",
    personType: "PM",
    rfc: "GTA210105KL8",
    email: "operaciones@gtaduanas.com",
    city: "Manzanillo",
    state: "Colima",
    role: "BOTH",
    status: "OCASIONAL",
    sectors: ["COMERCIO_EXTERIOR"],
    trustScore: 71,
    trustLevel: "B",
    kycVerified: true,
    linkedAt: daysAgo(75),
    lastInteractionAt: daysAgo(31),
    metrics: { totalOps: 4, activeOps: 0, completedOps: 4, disputedOps: 0, totalVolumeMxn: 1_820_000, avgTicketMxn: 455_000, onTimeRate: 0.82, complianceRate: 0.85 },
    source: "SEARCH",
  },
  {
    id: "cp-01a2b3c4-5555-4a1b-8c2d-000000000005",
    yoktoId: "YKT-03599",
    displayName: "Autos Premium Polanco",
    legalName: "Automotriz Polanco Premium SA de CV",
    personType: "PM",
    rfc: "APP150310TR1",
    email: "ventas@autospolanco.mx",
    city: "CDMX",
    state: "Ciudad de México",
    role: "SELLER",
    status: "PAUSADA",
    sectors: ["VEHICULOS"],
    trustScore: 58,
    trustLevel: "B",
    kycVerified: true,
    linkedAt: daysAgo(180),
    lastInteractionAt: daysAgo(62),
    metrics: { totalOps: 6, activeOps: 0, completedOps: 5, disputedOps: 1, totalVolumeMxn: 3_150_000, avgTicketMxn: 525_000, onTimeRate: 0.71, complianceRate: 0.74 },
    source: "OPERATION",
  },
  {
    id: "cp-01a2b3c4-6666-4a1b-8c2d-000000000006",
    yoktoId: "YKT-04102",
    displayName: "Juan Pablo Herrera",
    personType: "PF",
    rfc: "HEJP910822L01",
    curp: "HEJP910822HDFRRB05",
    email: "jp.herrera@gmail.com",
    city: "Guadalajara",
    state: "Jalisco",
    role: "BUYER",
    status: "BLOQUEADA",
    sectors: ["INMOBILIARIO"],
    trustScore: 34,
    trustLevel: "C",
    kycVerified: false,
    linkedAt: daysAgo(45),
    lastInteractionAt: daysAgo(38),
    metrics: { totalOps: 2, activeOps: 0, completedOps: 1, disputedOps: 1, totalVolumeMxn: 780_000, avgTicketMxn: 390_000, onTimeRate: 0.5, complianceRate: 0.55 },
    source: "INVITATION",
  },
];

export const MOCK_INVITATIONS: Invitation[] = [
  {
    id: "inv-000001", email: "compras@marinamex.com", displayName: "Marina Distribución MX",
    rfcHint: "MDM", sector: "COMERCIO_EXTERIOR",
    message: "Formalicemos las importaciones Q4 mediante YOKTO.",
    status: "PENDIENTE", invitedAt: daysAgo(2), expiresAt: daysAhead(12), invitedBy: "admin@yokto.mx",
  },
  {
    id: "inv-000002", email: "legal@arqverde.mx", displayName: "Arquitectura Verde",
    sector: "CONSTRUCCION", linkedTxId: "YOKTO-2026-00187",
    status: "PENDIENTE", invitedAt: daysAgo(5), expiresAt: daysAhead(9), invitedBy: "ops@yokto.mx",
  },
  {
    id: "inv-000003", email: "vendedor@refaccionesmx.com", displayName: "Refacciones MX",
    sector: "AUTOTRANSPORTE",
    status: "ACEPTADA", invitedAt: daysAgo(21), expiresAt: daysAhead(-7), invitedBy: "admin@yokto.mx",
  },
  {
    id: "inv-000004", email: "test@expirada.com",
    status: "EXPIRADA", invitedAt: daysAgo(45), expiresAt: daysAgo(30), invitedBy: "admin@yokto.mx",
  },
];

export const MOCK_INTERACTIONS: Interaction[] = [
  { id: "ix-1", counterpartyId: MOCK_COUNTERPARTIES[0].id, kind: "OPERACION_LIBERADA", at: daysAgo(3), actor: "Comprador", detail: "Liberación total operación YOKTO-2026-00312 por $520,000", txId: "YOKTO-2026-00312" },
  { id: "ix-2", counterpartyId: MOCK_COUNTERPARTIES[0].id, kind: "CFDI_RECIBIDO", at: daysAgo(4), actor: "Sistema", detail: "CFDI PPD folio A-1284 validado contra SAT", txId: "YOKTO-2026-00312" },
  { id: "ix-3", counterpartyId: MOCK_COUNTERPARTIES[0].id, kind: "OPERACION_CREADA", at: daysAgo(11), actor: "María López", detail: "Nueva operación de transporte León → Monterrey", txId: "YOKTO-2026-00318" },
  { id: "ix-4", counterpartyId: MOCK_COUNTERPARTIES[1].id, kind: "APROBACION", at: daysAgo(9), actor: "Comprador", detail: "Hito 2 aprobado con observaciones menores", txId: "YOKTO-2026-00287" },
  { id: "ix-5", counterpartyId: MOCK_COUNTERPARTIES[1].id, kind: "DOCUMENTO_SOLICITADO", at: daysAgo(12), actor: "Equipo YOKTO", detail: "Solicitud de bitácora fotográfica" },
  { id: "ix-6", counterpartyId: MOCK_COUNTERPARTIES[4].id, kind: "DISPUTA_RESUELTA", at: daysAgo(62), actor: "Mediador YOKTO", detail: "Resolución parcial a favor del comprador (60/40)" },
];

export const MOCK_DOC_REQUESTS: DocumentRequest[] = [
  { id: "dr-1", counterpartyId: MOCK_COUNTERPARTIES[0].id, docType: "REP", status: "RECIBIDO", requestedAt: daysAgo(6) },
  { id: "dr-2", counterpartyId: MOCK_COUNTERPARTIES[1].id, docType: "CONTRATO", status: "SOLICITADO", requestedAt: daysAgo(2), dueAt: daysAhead(3), note: "Anexo técnico revisión 3" },
  { id: "dr-3", counterpartyId: MOCK_COUNTERPARTIES[3].id, docType: "CONSTANCIA_FISCAL", status: "OBSERVADO", requestedAt: daysAgo(15), note: "Domicilio no coincide con expediente" },
];

/* ─────────────── Helpers ─────────────── */

export function formatMoney(mxn: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(mxn);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.round(diffMs / 86400000);
  if (Math.abs(days) < 1) return "hoy";
  if (days === 1) return "ayer";
  if (days > 0 && days < 30) return `hace ${days} días`;
  if (days >= 30 && days < 365) return `hace ${Math.floor(days / 30)} meses`;
  if (days < 0) return `en ${Math.abs(days)} días`;
  return `hace ${Math.floor(days / 365)} años`;
}

export function maskRfc(rfc: string, canView: boolean): string {
  if (canView) return rfc;
  if (rfc.length < 4) return "•••";
  return rfc.slice(0, 3) + "•".repeat(Math.max(0, rfc.length - 6)) + rfc.slice(-3);
}

export function maskEmail(email: string, canView: boolean): string {
  if (canView) return email;
  const [u, d] = email.split("@");
  if (!u || !d) return "•••@•••";
  return u.slice(0, 2) + "•••@" + d;
}

export function getCounterparty(id: string) {
  return MOCK_COUNTERPARTIES.find((c) => c.id === id);
}
export function getInteractionsFor(id: string) {
  return MOCK_INTERACTIONS.filter((i) => i.counterpartyId === id);
}
export function getDocRequestsFor(id: string) {
  return MOCK_DOC_REQUESTS.filter((d) => d.counterpartyId === id);
}

export type ComplianceLevel = "NUEVO" | "BASICO" | "VERIFICADO" | "CONFIABLE";

export function complianceLevelOf(c: Counterparty): ComplianceLevel {
  if (!c.kycVerified) return "NUEVO";
  if (c.trustScore >= 85 && c.metrics.completedOps >= 5) return "CONFIABLE";
  if (c.trustScore >= 70) return "VERIFICADO";
  return "BASICO";
}

export const COMPLIANCE_CFG: Record<ComplianceLevel, { label: string; bg: string; txt: string }> = {
  NUEVO:      { label: "Nuevo",       bg: "#F4F4F5", txt: "#3F3F46" },
  BASICO:     { label: "Básico",      bg: "#FFFBEB", txt: "#B45309" },
  VERIFICADO: { label: "Verificado",  bg: "#EEF2FF", txt: "#3730A3" },
  CONFIABLE:  { label: "Confiable",   bg: "#ECFDF5", txt: "#047857" },
};

export function hasAlert(c: Counterparty): boolean {
  return (
    c.metrics.disputedOps > 0 && c.status !== "OCULTA"
      ? true
      : c.status === "BLOQUEADA" || c.status === "PAUSADA" || !c.kycVerified
  );
}

export function computeMetrics(all: Counterparty[], invitations: Invitation[] = MOCK_INVITATIONS) {
  const totalCounterparties = all.length;
  const activas = all.filter((c) => c.status === "ACTIVA" || c.status === "FRECUENTE").length;
  const kycVerified = all.filter((c) => c.kycVerified).length;
  const trustPromedio = Math.round(all.reduce((s, c) => s + c.trustScore, 0) / Math.max(1, all.length));
  const opsActivas = all.reduce((s, c) => s + c.metrics.activeOps, 0);
  const volTotal = all.reduce((s, c) => s + c.metrics.totalVolumeMxn, 0);
  const disputadas = all.reduce((s, c) => s + c.metrics.disputedOps, 0);
  const frecuentes = all.filter((c) => c.status === "FRECUENTE").length;
  const invitacionesPendientes = invitations.filter((i) => i.status === "PENDIENTE").length;
  const invitacionesVencenHoy = invitations.filter((i) => {
    if (i.status !== "PENDIENTE") return false;
    const days = Math.round((new Date(i.expiresAt).getTime() - Date.now()) / 86400000);
    return days <= 1 && days >= 0;
  }).length;
  const conAlerta = all.filter(hasAlert).length;
  return {
    totalCounterparties, activas, kycVerified, trustPromedio, opsActivas, volTotal,
    disputadas, frecuentes, invitacionesPendientes, invitacionesVencenHoy, conAlerta,
  };
}
