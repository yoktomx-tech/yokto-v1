// Catálogo extendido para el wizard "Crear operación protegida"
// Sectores con paleta índigo/sectorial, subtipos, documentos por sector, evidencias

import type { SectorId } from "@/lib/sectors";

export type SectorCfg = {
  color: string;
  bg: string;
  txt: string;
  emoji: string;
  subtipos: string[];
};

export const SECTOR_CFG: Record<SectorId, SectorCfg> = {
  AUTOTRANSPORTE: {
    color: "#4F46E5", bg: "#EEF2FF", txt: "#3730A3", emoji: "🚛",
    subtipos: ["Flete nacional", "Flete internacional", "Transporte especializado", "Carga consolidada", "Transporte de maquinaria"],
  },
  CONSTRUCCION: {
    color: "#F97316", bg: "#FFF7ED", txt: "#9A3412", emoji: "🏗️",
    subtipos: ["Obra civil", "Remodelación", "Suministro e instalación", "Estimaciones de obra", "Mantenimiento industrial"],
  },
  COMERCIO_EXTERIOR: {
    color: "#0EA5E9", bg: "#F0F9FF", txt: "#0C4A6E", emoji: "🌐",
    subtipos: ["Importación", "Exportación", "Compra internacional", "Servicio aduanal", "Logística internacional"],
  },
  INMOBILIARIO: {
    color: "#8B5CF6", bg: "#F5F3FF", txt: "#4C1D95", emoji: "🏠",
    subtipos: ["Compraventa de inmueble", "Apartado condicionado", "Due diligence documental", "Escrituración condicionada"],
  },
  VEHICULOS: {
    color: "#10B981", bg: "#ECFDF5", txt: "#064E3B", emoji: "🚗",
    subtipos: ["Auto seminuevo", "Camión / tractocamión", "Maquinaria pesada", "Motocicleta", "Flotilla"],
  },
  SERVICIOS: {
    color: "#F43F5E", bg: "#FFF1F2", txt: "#881337", emoji: "💼",
    subtipos: ["Proyecto profesional", "Desarrollo de software", "Consultoría", "Diseño / branding", "Mantenimiento / soporte"],
  },
};

// Documentos base fiscales + por sector
export const DOC_BASE = [
  "CFDI Factura",
  "CFDI Complemento de Pago (REP)",
  "XML CFDI",
  "Constancia de situación fiscal",
];

export const DOC_BY_SECTOR: Record<SectorId, string[]> = {
  AUTOTRANSPORTE: ["Carta Porte", "CFDI con complemento Carta Porte", "Acuse de entrega", "Orden de carga", "Remisión"],
  CONSTRUCCION: ["Contrato de obra", "Estimación de obra", "Generadores", "Bitácora", "Acta entrega-recepción", "REPSE"],
  COMERCIO_EXTERIOR: ["Pedimento", "Bill of Lading (BL)", "AWB", "Factura comercial", "Packing list", "Certificado de origen", "DODA"],
  INMOBILIARIO: ["Escritura pública", "Cert. libertad de gravamen", "Avalúo", "Boleta predial", "Contrato promesa"],
  VEHICULOS: ["Factura de vehículo", "Tarjeta de circulación", "REPUVE", "Baja / alta vehicular", "Contrato compraventa"],
  SERVICIOS: ["Propuesta aprobada", "Contrato de prestación", "Entregable", "Acta de aceptación", "Reporte de avance"],
};

export const EVIDENCE_TYPES = [
  "Foto",
  "Video",
  "GPS",
  "Firma del receptor",
  "Checklist",
  "Captura de pantalla",
  "Documento firmado",
  "Evidencia de empaque",
  "Evidencia de entrega",
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
