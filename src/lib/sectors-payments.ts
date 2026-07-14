// Reglas de método de pago y duración máxima por sector (spec Módulo D).
export type MetodoPago = "spei" | "card" | "oxxo";

export interface MetodoPagoConfig {
  metodos: MetodoPago[];
  duracion_max_dias: number;
  recomendado: MetodoPago;
  razon: string;
}

export const METODO_PAGO_POR_SECTOR: Record<string, MetodoPagoConfig> = {
  "Autotransporte": {
    metodos: ["spei", "card"],
    duracion_max_dias: 30,
    recomendado: "spei",
    razon: "Flexibilidad para operaciones de hasta 30 días.",
  },
  "Construcción": {
    metodos: ["spei"],
    duracion_max_dias: 365,
    recomendado: "spei",
    razon: "Obras de larga duración requieren SPEI. Tarjeta máx 30 días.",
  },
  "Comercio internacional": {
    metodos: ["spei"],
    duracion_max_dias: 90,
    recomendado: "spei",
    razon: "Tiempos de tránsito internacional requieren SPEI.",
  },
  "Inmobiliario": {
    metodos: ["spei"],
    duracion_max_dias: 180,
    recomendado: "spei",
    razon: "Due diligence y escrituración requieren retenciones largas.",
  },
  "Vehículos": {
    metodos: ["spei", "card"],
    duracion_max_dias: 15,
    recomendado: "spei",
    razon: "Inspección y transferencia de título en pocos días.",
  },
  "Servicios profesionales": {
    metodos: ["spei", "card", "oxxo"],
    duracion_max_dias: 180,
    recomendado: "card",
    razon: "Proyectos cortos pueden usar tarjeta; largos SPEI.",
  },
  "Manufactura": {
    metodos: ["spei"],
    duracion_max_dias: 180,
    recomendado: "spei",
    razon: "Ciclos productivos largos, SPEI preferido.",
  },
  "Tecnología / SaaS": {
    metodos: ["spei", "card"],
    duracion_max_dias: 90,
    recomendado: "card",
    razon: "Suscripciones y milestones cortos.",
  },
  "Marketing / Agencias": {
    metodos: ["spei", "card"],
    duracion_max_dias: 90,
    recomendado: "card",
    razon: "Retainers y entregables trimestrales.",
  },
  "Otro": {
    metodos: ["spei", "card"],
    duracion_max_dias: 180,
    recomendado: "spei",
    razon: "Por defecto SPEI para B2B.",
  },
};

export function getSectorConfig(sector: string | null | undefined): MetodoPagoConfig {
  return METODO_PAGO_POR_SECTOR[sector ?? "Otro"] ?? METODO_PAGO_POR_SECTOR["Otro"];
}

export const METODO_LABEL: Record<MetodoPago, string> = {
  spei: "SPEI",
  card: "Tarjeta",
  oxxo: "OXXO",
};
