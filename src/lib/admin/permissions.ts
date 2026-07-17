// Matriz de permisos del backoffice interno YOKTO — fuente única de verdad.
// Se usa tanto en UI (ocultar menús) como en API (requirePermission).

export type InternalRole =
  | "YOKTO_SUPER_ADMIN"
  | "ANALISTA_KYC"
  | "ANALISTA_DOCUMENTAL"
  | "OFICIAL_CUMPLIMIENTO"
  | "AGENTE_ESCROW"
  | "AGENTE_SOPORTE"
  | "ANALISTA_FINANCIERO";

export type Resource =
  | "admin_dashboard"
  | "kyc"
  | "documentos"
  | "compliance"
  | "disputas"
  | "soporte"
  | "finanzas"
  | "usuarios"
  | "plataforma"
  | "roles"
  | "auditoria"
  | "health";

export type Action =
  | "ver"
  | "actuar"
  | "aprobar"
  | "rechazar"
  | "validar"
  | "resolver"
  | "reconciliar"
  | "configurar"
  | "gestionar"
  | "override";

export type PermissionLevel = "NONE" | "VIEW" | "ACT";

export const INTERNAL_ROLE_LABEL: Record<InternalRole, string> = {
  YOKTO_SUPER_ADMIN: "Super Administrador",
  ANALISTA_KYC: "Analista KYC",
  ANALISTA_DOCUMENTAL: "Analista Documental",
  OFICIAL_CUMPLIMIENTO: "Oficial de Cumplimiento",
  AGENTE_ESCROW: "Agente Escrow",
  AGENTE_SOPORTE: "Agente de Soporte",
  ANALISTA_FINANCIERO: "Analista Financiero",
};

export const INTERNAL_ROLES: InternalRole[] = [
  "YOKTO_SUPER_ADMIN",
  "ANALISTA_KYC",
  "ANALISTA_DOCUMENTAL",
  "OFICIAL_CUMPLIMIENTO",
  "AGENTE_ESCROW",
  "AGENTE_SOPORTE",
  "ANALISTA_FINANCIERO",
];

export const INTERNAL_ROLE_PERMISSIONS: Record<InternalRole, Partial<Record<Resource, PermissionLevel>>> = {
  YOKTO_SUPER_ADMIN: {
    admin_dashboard: "ACT", kyc: "ACT", documentos: "ACT", compliance: "ACT",
    disputas: "ACT", soporte: "ACT", finanzas: "ACT", usuarios: "ACT",
    plataforma: "ACT", roles: "ACT", auditoria: "ACT", health: "ACT",
  },
  ANALISTA_KYC: {
    admin_dashboard: "VIEW", kyc: "ACT", usuarios: "VIEW",
  },
  ANALISTA_DOCUMENTAL: {
    admin_dashboard: "VIEW", documentos: "ACT", disputas: "VIEW",
  },
  OFICIAL_CUMPLIMIENTO: {
    admin_dashboard: "VIEW", compliance: "ACT", kyc: "VIEW", documentos: "VIEW",
    disputas: "VIEW", finanzas: "VIEW", usuarios: "ACT", auditoria: "VIEW",
  },
  AGENTE_ESCROW: {
    admin_dashboard: "VIEW", disputas: "ACT", kyc: "VIEW", documentos: "VIEW",
    compliance: "VIEW", soporte: "VIEW", finanzas: "VIEW",
  },
  AGENTE_SOPORTE: {
    admin_dashboard: "VIEW", soporte: "ACT", disputas: "VIEW", usuarios: "VIEW",
  },
  ANALISTA_FINANCIERO: {
    admin_dashboard: "VIEW", finanzas: "ACT", compliance: "VIEW", disputas: "VIEW",
    health: "VIEW", auditoria: "VIEW",
  },
};

export function hasPermission(
  role: InternalRole | null | undefined,
  resource: Resource,
  action: Action = "ver",
): boolean {
  if (!role) return false;
  if (role === "YOKTO_SUPER_ADMIN") return true;
  const level = INTERNAL_ROLE_PERMISSIONS[role]?.[resource] ?? "NONE";
  if (action === "ver") return level === "VIEW" || level === "ACT";
  return level === "ACT";
}

export function describePermissions(role: InternalRole): { resource: Resource; level: PermissionLevel }[] {
  const all: Resource[] = [
    "admin_dashboard", "kyc", "documentos", "compliance", "disputas",
    "soporte", "finanzas", "usuarios", "plataforma", "roles", "auditoria", "health",
  ];
  return all.map((r) => ({
    resource: r,
    level: (role === "YOKTO_SUPER_ADMIN" ? "ACT" : (INTERNAL_ROLE_PERMISSIONS[role]?.[r] ?? "NONE")) as PermissionLevel,
  }));
}

export const RESOURCE_LABEL: Record<Resource, string> = {
  admin_dashboard: "Dashboard interno",
  kyc: "KYC",
  documentos: "Documentos",
  compliance: "PLD/FT",
  disputas: "Disputas",
  soporte: "Soporte",
  finanzas: "Finanzas",
  usuarios: "Usuarios",
  plataforma: "Configuración plataforma",
  roles: "Roles internos",
  auditoria: "Auditoría",
  health: "Salud del sistema",
};
