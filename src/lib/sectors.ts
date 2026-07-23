// Catálogo de sectores CUMPLEX + configuración de comisiones (Módulo C)

export const SECTOR_IDS = [
  "AUTOTRANSPORTE",
  "CONSTRUCCION",
  "COMERCIO_EXTERIOR",
  "INMOBILIARIO",
  "VEHICULOS",
  "SERVICIOS",
] as const;

export type SectorId = (typeof SECTOR_IDS)[number];

export type SectorDef = {
  id: SectorId;
  emoji: string;
  titulo: string;
  descripcion: string;
  ejemplos: string[];
  tiempo_tipico: string;
  monto_tipico: string;
  placeholder_descripcion: string;
  metodos_pago: Array<"SPEI" | "TARJETA" | "OXXO">;
};

export const SECTORES: readonly SectorDef[] = [
  {
    id: "AUTOTRANSPORTE",
    emoji: "🚛",
    titulo: "Autotransporte",
    descripcion: "Fletes, carga, logística nacional e internacional",
    ejemplos: ["Flete terrestre", "Transporte de maquinaria", "Carga consolidada"],
    tiempo_tipico: "1–7 días",
    monto_tipico: "$15,000 – $500,000 MXN",
    placeholder_descripcion: "Ej: Flete CDMX–Monterrey, 5 toneladas de mercancía electrónica",
    metodos_pago: ["SPEI", "TARJETA"],
  },
  {
    id: "CONSTRUCCION",
    emoji: "🏗️",
    titulo: "Construcción y Obra",
    descripcion: "Obras, remodelaciones, proyectos de construcción",
    ejemplos: ["Remodelación de oficina", "Nave industrial", "Obra civil"],
    tiempo_tipico: "30–365 días",
    monto_tipico: "$50,000 – $10,000,000 MXN",
    placeholder_descripcion: "Ej: Remodelación de oficinas piso 3, Torre Reforma, CDMX",
    metodos_pago: ["SPEI"],
  },
  {
    id: "COMERCIO_EXTERIOR",
    emoji: "🌐",
    titulo: "Comercio Exterior",
    descripcion: "Importaciones, exportaciones, operaciones aduanales",
    ejemplos: ["Importación de maquinaria", "Exportación de mercancía", "Compra internacional"],
    tiempo_tipico: "15–60 días",
    monto_tipico: "$100,000 – $5,000,000 MXN",
    placeholder_descripcion: "Ej: Importación de 20 tornos CNC desde Shanghái vía LZC",
    metodos_pago: ["SPEI"],
  },
  {
    id: "INMOBILIARIO",
    emoji: "🏠",
    titulo: "Inmobiliario",
    descripcion: "Compraventa de inmuebles, escrituración, due diligence",
    ejemplos: ["Venta de casa", "Compra de local comercial", "Terreno"],
    tiempo_tipico: "30–120 días",
    monto_tipico: "$500,000 – $50,000,000 MXN",
    placeholder_descripcion: "Ej: Compraventa casa habitación, Col. Del Valle, CDMX",
    metodos_pago: ["SPEI"],
  },
  {
    id: "VEHICULOS",
    emoji: "🚗",
    titulo: "Vehículos",
    descripcion: "Compraventa de autos, motos, camiones, maquinaria",
    ejemplos: ["Auto seminuevo", "Camión de carga", "Maquinaria pesada"],
    tiempo_tipico: "3–15 días",
    monto_tipico: "$50,000 – $3,000,000 MXN",
    placeholder_descripcion: "Ej: Venta Honda CR-V 2022, color gris, 45,000 km",
    metodos_pago: ["SPEI", "TARJETA"],
  },
  {
    id: "SERVICIOS",
    emoji: "💼",
    titulo: "Servicios Profesionales",
    descripcion: "Proyectos, freelance, consultoría, desarrollo de software",
    ejemplos: ["Desarrollo de app", "Consultoría", "Diseño de marca"],
    tiempo_tipico: "7–180 días",
    monto_tipico: "$5,000 – $500,000 MXN",
    placeholder_descripcion: "Ej: Desarrollo de app móvil iOS/Android — MVP en 90 días",
    metodos_pago: ["SPEI", "TARJETA"],
  },
] as const;

// Configuración de comisiones por sector
type FeeConfig = {
  porcentaje_base: number;      // 0-1 (ej. 0.018 = 1.8%)
  fee_fijo_threshold: number;   // MXN
  fee_fijo_monto: number;       // MXN
};

export const FEES: Record<SectorId, FeeConfig> = {
  AUTOTRANSPORTE: { porcentaje_base: 0.018, fee_fijo_threshold: 50_000, fee_fijo_monto: 890 },
  CONSTRUCCION: { porcentaje_base: 0.022, fee_fijo_threshold: 100_000, fee_fijo_monto: 1_800 },
  COMERCIO_EXTERIOR: { porcentaje_base: 0.015, fee_fijo_threshold: 200_000, fee_fijo_monto: 2_500 },
  INMOBILIARIO: { porcentaje_base: 0.012, fee_fijo_threshold: 375_000, fee_fijo_monto: 4_500 },
  VEHICULOS: { porcentaje_base: 0.025, fee_fijo_threshold: 80_000, fee_fijo_monto: 1_500 },
  SERVICIOS: { porcentaje_base: 0.030, fee_fijo_threshold: 30_000, fee_fijo_monto: 750 },
};

export const DESCUENTOS_VOLUMETRICOS: Array<{ desde: number; hasta: number; descuento: number }> = [
  { desde: 0, hasta: 500_000, descuento: 0 },
  { desde: 500_000, hasta: 2_000_000, descuento: 0.05 },
  { desde: 2_000_000, hasta: 10_000_000, descuento: 0.10 },
  { desde: 10_000_000, hasta: Number.POSITIVE_INFINITY, descuento: 0.15 },
];

export type FeeCalculation = {
  monto_operacion: number;
  comision_base: number;
  descuento_aplicado: number;
  comision_final: number;
  iva_comision: number;
  total_a_depositar: number;
  porcentaje_efectivo: number;
  fee_tipo: "FIJO" | "PORCENTUAL";
};

export function calcularFee(sector: SectorId, monto: number, volumenHistorico = 0): FeeCalculation {
  const cfg = FEES[sector];
  const fee_tipo: "FIJO" | "PORCENTUAL" = monto >= cfg.fee_fijo_threshold ? "FIJO" : "PORCENTUAL";
  const comisionBruta = fee_tipo === "FIJO" ? cfg.fee_fijo_monto : monto * cfg.porcentaje_base;

  const nivel = DESCUENTOS_VOLUMETRICOS.find((n) => volumenHistorico >= n.desde && volumenHistorico < n.hasta);
  const descuento = nivel?.descuento ?? 0;
  const comision_final = comisionBruta * (1 - descuento);
  const iva_comision = comision_final * 0.16;
  const total_a_depositar = monto + comision_final + iva_comision;

  return {
    monto_operacion: monto,
    comision_base: comisionBruta,
    descuento_aplicado: descuento,
    comision_final,
    iva_comision,
    total_a_depositar,
    porcentaje_efectivo: monto > 0 ? ((comision_final + iva_comision) / monto) * 100 : 0,
    fee_tipo,
  };
}

export function getSector(id: string): SectorDef | undefined {
  return SECTORES.find((s) => s.id === id);
}

// ─── Plantillas de hitos por sector ─────────────────────────────────────────
export type HitoPlantilla = {
  titulo: string;
  descripcion?: string;
  monto_porcentaje: number;
  dias_desde_inicio: number;
  tipo_verificacion: "DOCUMENTAL" | "EVIDENCIA_FISICA" | "GPS" | "CHECKLIST" | "AUTOMATICO" | "MANUAL_YOKTO";
  documentos_requeridos: string[];
  evidencia_requerida: string[];
  responsable: "PAGADOR" | "BENEFICIARIO";
  auto_release: boolean;
};

export const PLANTILLAS_HITOS: Record<SectorId, HitoPlantilla[]> = {
  AUTOTRANSPORTE: [
    { titulo: "Carga y salida de origen", descripcion: "Confirmación de recolección y salida del punto de origen", monto_porcentaje: 30, dias_desde_inicio: 1, tipo_verificacion: "EVIDENCIA_FISICA", documentos_requeridos: ["Carta porte", "Foto de carga"], evidencia_requerida: ["Foto unidad cargada"], responsable: "BENEFICIARIO", auto_release: false },
    { titulo: "Tránsito y monitoreo GPS", descripcion: "Ruta cumplida sin desviaciones mayores", monto_porcentaje: 20, dias_desde_inicio: 3, tipo_verificacion: "GPS", documentos_requeridos: [], evidencia_requerida: ["Track GPS"], responsable: "BENEFICIARIO", auto_release: true },
    { titulo: "Entrega en destino", descripcion: "Descarga y acuse de recibo firmado", monto_porcentaje: 50, dias_desde_inicio: 7, tipo_verificacion: "DOCUMENTAL", documentos_requeridos: ["Remisión firmada", "Fotos de entrega"], evidencia_requerida: ["Firma destinatario"], responsable: "PAGADOR", auto_release: false },
  ],
  CONSTRUCCION: [
    { titulo: "Anticipo y arranque de obra", descripcion: "Movilización, permisos, inicio de trabajos", monto_porcentaje: 30, dias_desde_inicio: 7, tipo_verificacion: "DOCUMENTAL", documentos_requeridos: ["Bitácora inicial", "Permisos"], evidencia_requerida: [], responsable: "BENEFICIARIO", auto_release: false },
    { titulo: "Avance 50% verificado", descripcion: "Inspección de avance físico y financiero", monto_porcentaje: 40, dias_desde_inicio: 60, tipo_verificacion: "EVIDENCIA_FISICA", documentos_requeridos: ["Estimación", "Fotos avance"], evidencia_requerida: ["Visita de obra"], responsable: "PAGADOR", auto_release: false },
    { titulo: "Entrega final y finiquito", descripcion: "Acta de entrega-recepción, garantías", monto_porcentaje: 30, dias_desde_inicio: 120, tipo_verificacion: "DOCUMENTAL", documentos_requeridos: ["Acta entrega", "Garantía", "Factura final"], evidencia_requerida: [], responsable: "PAGADOR", auto_release: false },
  ],
  COMERCIO_EXTERIOR: [
    { titulo: "Anticipo y booking", monto_porcentaje: 30, dias_desde_inicio: 3, tipo_verificacion: "DOCUMENTAL", documentos_requeridos: ["Proforma", "Booking"], evidencia_requerida: [], responsable: "BENEFICIARIO", auto_release: false },
    { titulo: "Embarque y B/L", descripcion: "Bill of Lading emitido", monto_porcentaje: 40, dias_desde_inicio: 20, tipo_verificacion: "DOCUMENTAL", documentos_requeridos: ["B/L", "Packing list", "Factura comercial"], evidencia_requerida: [], responsable: "BENEFICIARIO", auto_release: false },
    { titulo: "Despacho aduanal y entrega", monto_porcentaje: 30, dias_desde_inicio: 45, tipo_verificacion: "DOCUMENTAL", documentos_requeridos: ["Pedimento", "Acuse recibo"], evidencia_requerida: [], responsable: "PAGADOR", auto_release: false },
  ],
  INMOBILIARIO: [
    { titulo: "Firma de contrato de promesa", monto_porcentaje: 10, dias_desde_inicio: 5, tipo_verificacion: "DOCUMENTAL", documentos_requeridos: ["Contrato promesa"], evidencia_requerida: [], responsable: "PAGADOR", auto_release: false },
    { titulo: "Due diligence y avalúo", monto_porcentaje: 20, dias_desde_inicio: 30, tipo_verificacion: "DOCUMENTAL", documentos_requeridos: ["Avalúo", "Cert. libertad gravámenes"], evidencia_requerida: [], responsable: "PAGADOR", auto_release: false },
    { titulo: "Firma de escrituras", monto_porcentaje: 70, dias_desde_inicio: 90, tipo_verificacion: "DOCUMENTAL", documentos_requeridos: ["Escritura pública", "Boleta predial", "Constancia notarial"], evidencia_requerida: [], responsable: "PAGADOR", auto_release: false },
  ],
  VEHICULOS: [
    { titulo: "Inspección física y prueba", monto_porcentaje: 20, dias_desde_inicio: 2, tipo_verificacion: "CHECKLIST", documentos_requeridos: ["Checklist inspección"], evidencia_requerida: ["Fotos vehículo"], responsable: "PAGADOR", auto_release: false },
    { titulo: "Documentos y verificación de origen", monto_porcentaje: 30, dias_desde_inicio: 5, tipo_verificacion: "DOCUMENTAL", documentos_requeridos: ["Factura original", "Tarjeta circulación", "REPUVE"], evidencia_requerida: [], responsable: "PAGADOR", auto_release: false },
    { titulo: "Endoso y entrega", monto_porcentaje: 50, dias_desde_inicio: 10, tipo_verificacion: "DOCUMENTAL", documentos_requeridos: ["Factura endosada", "Contrato compraventa"], evidencia_requerida: [], responsable: "PAGADOR", auto_release: false },
  ],
  SERVICIOS: [
    { titulo: "Kick-off y alcance firmado", monto_porcentaje: 30, dias_desde_inicio: 3, tipo_verificacion: "DOCUMENTAL", documentos_requeridos: ["SOW", "Minuta kick-off"], evidencia_requerida: [], responsable: "BENEFICIARIO", auto_release: false },
    { titulo: "Entregable intermedio", monto_porcentaje: 40, dias_desde_inicio: 45, tipo_verificacion: "DOCUMENTAL", documentos_requeridos: ["Entregable revisado"], evidencia_requerida: ["Aprobación cliente"], responsable: "PAGADOR", auto_release: false },
    { titulo: "Entrega final y aceptación", monto_porcentaje: 30, dias_desde_inicio: 90, tipo_verificacion: "DOCUMENTAL", documentos_requeridos: ["Entregable final", "Acta aceptación"], evidencia_requerida: [], responsable: "PAGADOR", auto_release: true },
  ],
};

export type HitoDraft = {
  orden: number;
  titulo: string;
  descripcion: string;
  monto_porcentaje: number;
  fecha_limite: string;
  tipo_verificacion: HitoPlantilla["tipo_verificacion"];
  documentos_requeridos: string[];
  evidencia_requerida: string[];
  responsable: "PAGADOR" | "BENEFICIARIO";
  auto_release: boolean;
};

export function plantillaToDraft(p: HitoPlantilla, orden: number, fechaBaseISO: string): HitoDraft {
  const base = new Date(fechaBaseISO);
  base.setDate(base.getDate() + p.dias_desde_inicio);
  return {
    orden,
    titulo: p.titulo,
    descripcion: p.descripcion ?? "",
    monto_porcentaje: p.monto_porcentaje,
    fecha_limite: base.toISOString().slice(0, 10),
    tipo_verificacion: p.tipo_verificacion,
    documentos_requeridos: [...p.documentos_requeridos],
    evidencia_requerida: [...p.evidencia_requerida],
    responsable: p.responsable,
    auto_release: p.auto_release,
  };
}

