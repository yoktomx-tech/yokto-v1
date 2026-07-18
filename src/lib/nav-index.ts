// Static navigation index for the global search bar.
// Each entry is a screen/action a user can navigate to.
export type NavEntry = {
  label: string;
  to: string;
  group: string;
  keywords: string; // extra searchable text (aliases, synonyms)
};

export const NAV_INDEX: NavEntry[] = [
  // Panel
  { label: "Dashboard", to: "/dashboard", group: "Panel", keywords: "inicio home resumen tablero" },

  // Operaciones
  { label: "Operaciones", to: "/transactions", group: "Operaciones", keywords: "escrow pagos contra cumplimiento" },
  { label: "Nueva operación", to: "/transactions/new", group: "Operaciones", keywords: "crear escrow nuevo wizard" },
  { label: "Aprobaciones", to: "/approvals", group: "Operaciones", keywords: "comprador liberar fondos autorizar" },

  // Pagos y fiscal
  { label: "Centro de pagos", to: "/payments", group: "Pagos", keywords: "spei stripe ledger movimientos" },
  { label: "Documentos fiscales (CFDI)", to: "/payments/fiscal", group: "Pagos", keywords: "cfdi ppd rep complemento sat factura" },

  // Cumplimiento
  { label: "Cumplimiento (Vendedor)", to: "/cumplimiento", group: "Cumplimiento", keywords: "locks candados evidencia" },
  { label: "Perfil de cumplimiento (Score)", to: "/score", group: "Cumplimiento", keywords: "pld ft riesgo score puntaje" },
  { label: "Cuentas bancarias", to: "/compliance/bank-accounts", group: "Cumplimiento", keywords: "clabe banco depósito" },

  // Disputas
  { label: "Disputas", to: "/disputes", group: "Disputas", keywords: "controversia queja mediación" },
  { label: "Nueva disputa", to: "/disputes/new", group: "Disputas", keywords: "abrir disputa reclamación" },

  // CRM
  { label: "CRM (Contrapartes)", to: "/crm", group: "CRM", keywords: "contrapartes clientes proveedores confianza" },
  { label: "Buscar contrapartes", to: "/crm/search", group: "CRM", keywords: "buscar rfc empresa" },
  { label: "Invitaciones CRM", to: "/crm/invitations", group: "CRM", keywords: "invitar contraparte" },

  // Analytics
  { label: "Analytics", to: "/analytics", group: "Analytics", keywords: "reportes métricas kpi" },
  { label: "Analytics · Operaciones", to: "/analytics/operaciones", group: "Analytics", keywords: "operaciones reporte" },
  { label: "Analytics · Pagos", to: "/analytics/pagos", group: "Analytics", keywords: "pagos flujo" },
  { label: "Analytics · Disputas", to: "/analytics/disputas", group: "Analytics", keywords: "disputas reporte" },
  { label: "Analytics · Fiscal", to: "/analytics/fiscal", group: "Analytics", keywords: "cfdi fiscal" },
  { label: "Analytics · Cumplimiento", to: "/analytics/cumplimiento", group: "Analytics", keywords: "score pld cumplimiento" },
  { label: "Analytics · Aprobaciones", to: "/analytics/aprobaciones", group: "Analytics", keywords: "aprobaciones tiempos" },
  { label: "Analytics · Contratos", to: "/analytics/contratos", group: "Analytics", keywords: "contratos firmas" },
  { label: "Analytics · Sectores", to: "/analytics/sectores", group: "Analytics", keywords: "sector industria" },
  { label: "Analytics · Equipo", to: "/analytics/equipo", group: "Analytics", keywords: "equipo miembros" },
  { label: "Analytics · Exportaciones", to: "/analytics/exportaciones", group: "Analytics", keywords: "exportar csv pdf" },
  { label: "Analytics · Personalizado", to: "/analytics/custom", group: "Analytics", keywords: "custom personalizado" },

  // Teams
  { label: "Equipo", to: "/teams", group: "Equipo", keywords: "team miembros usuarios" },
  { label: "Miembros del equipo", to: "/teams/members", group: "Equipo", keywords: "invitar miembro" },
  { label: "Aprobaciones (Equipo)", to: "/teams/approvals", group: "Equipo", keywords: "flujo aprobación equipo" },
  { label: "Workflows", to: "/teams/workflows", group: "Equipo", keywords: "automatización flujos" },
  { label: "API Keys (Equipo)", to: "/teams/api-keys", group: "Equipo", keywords: "api key token" },
  { label: "Integraciones (Equipo)", to: "/teams/integrations", group: "Equipo", keywords: "integraciones" },
  { label: "Reportes (Equipo)", to: "/teams/reports", group: "Equipo", keywords: "reportes equipo" },
  { label: "Ajustes de equipo", to: "/teams/settings", group: "Equipo", keywords: "configuración equipo" },

  // Configuración
  { label: "Configuración", to: "/settings", group: "Configuración", keywords: "ajustes preferencias" },
  { label: "Perfil", to: "/settings", group: "Configuración", keywords: "mi perfil datos" },
  { label: "Organización", to: "/settings/organization", group: "Configuración", keywords: "organización empresa" },
  { label: "Nueva organización", to: "/settings/organization/new", group: "Configuración", keywords: "crear organización" },
  { label: "Equipo (Config)", to: "/settings/team", group: "Configuración", keywords: "usuarios roles" },
  { label: "Seguridad", to: "/settings/security", group: "Configuración", keywords: "mfa 2fa contraseña" },
  { label: "Sesiones", to: "/settings/sessions", group: "Configuración", keywords: "sesión dispositivos" },
  { label: "Notificaciones", to: "/settings/notifications", group: "Configuración", keywords: "email push notif" },
  { label: "Preferencias", to: "/settings/preferences", group: "Configuración", keywords: "idioma tema preferencia" },
  { label: "Integraciones", to: "/settings/integrations", group: "Configuración", keywords: "integraciones apis" },
  { label: "Webhooks", to: "/settings/webhooks", group: "Configuración", keywords: "webhook evento" },
  { label: "Soporte (Config)", to: "/settings/support", group: "Configuración", keywords: "soporte plan" },
  { label: "Zona de peligro", to: "/settings/danger-zone", group: "Configuración", keywords: "eliminar cuenta cerrar" },
  { label: "API Clients", to: "/api-clients", group: "Configuración", keywords: "api client credenciales" },

  // Soporte
  { label: "Centro de ayuda", to: "/help", group: "Soporte", keywords: "help faq preguntas" },
  { label: "Mis tickets", to: "/support/tickets", group: "Soporte", keywords: "tickets soporte" },
  { label: "Nuevo ticket", to: "/support/tickets/new", group: "Soporte", keywords: "crear ticket contactar" },
  { label: "Estado de plataforma", to: "/support/status", group: "Soporte", keywords: "status incidentes health" },
];
