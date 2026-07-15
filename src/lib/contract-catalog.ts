// Contratos: plantillas por sector, métodos de firma y helpers.
// Este módulo es puramente client-side (UI-first). La persistencia real
// vive en las tablas transaction_contracts y contract_signatures.

import type { SectorId } from "@/lib/sectors";

export type ContractMethod = "UPLOADED_PDF" | "GENERATED";
export type SignatureMethod = "AUTOGRAFA_BIOMETRICA" | "EFIRMA_SAT";
export type SignerRole = "PAGADOR" | "BENEFICIARIO";
export type SignatureOrder = "PARALLEL" | "SEQUENTIAL";

export type ContractTemplate = {
  key: string;
  title: string;
  descripcion: string;
  sectores: SectorId[] | "ALL";
  recomendado?: boolean;
};

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  { key: "OP_ESTANDAR", title: "Operación protegida estándar", descripcion: "Bienes, servicios y operaciones simples.", sectores: "ALL", recomendado: true },
  { key: "SERV_HITOS", title: "Prestación de servicios con hitos", descripcion: "Servicios profesionales y consultoría.", sectores: ["SERVICIOS"] },
  { key: "VEHICULO", title: "Compraventa de vehículo", descripcion: "Auto, camión, motocicleta, flotilla.", sectores: ["VEHICULOS"] },
  { key: "OBRA", title: "Cumplimiento de obra / construcción", descripcion: "Obra, remodelación, estimaciones.", sectores: ["CONSTRUCCION"] },
  { key: "LOGISTICA", title: "Operación logística", descripcion: "Autotransporte con Carta Porte.", sectores: ["AUTOTRANSPORTE"] },
  { key: "COMEX", title: "Operación de comercio exterior", descripcion: "Importación y exportación documentada.", sectores: ["COMERCIO_EXTERIOR"] },
  { key: "INMUEBLE", title: "Operación inmobiliaria", descripcion: "Compraventa o apartado condicionado de inmueble.", sectores: ["INMOBILIARIO"] },
];

export function templatesForSector(sector: SectorId): ContractTemplate[] {
  return CONTRACT_TEMPLATES.filter((t) => t.sectores === "ALL" || t.sectores.includes(sector));
}

export function recommendedTemplate(sector: SectorId): ContractTemplate {
  const specific = CONTRACT_TEMPLATES.find(
    (t) => Array.isArray(t.sectores) && t.sectores.includes(sector),
  );
  return specific ?? CONTRACT_TEMPLATES[0];
}

// Bloque legal obligatorio en todos los contratos generados.
export const YOKTO_LEGAL_BLOCK = `Las partes reconocen que YOKTO actúa únicamente como plataforma tecnológica y tercero neutral para estructurar, verificar y documentar condiciones de cumplimiento. YOKTO no custodia fondos, no capta recursos del público, no realiza intermediación financiera y no actúa como entidad financiera. Los recursos son procesados, retenidos, liberados o devueltos exclusivamente mediante la pasarela de pagos certificada correspondiente, conforme a sus propias reglas operativas y a las instrucciones derivadas del cumplimiento de la operación.`;

export type ContractState = {
  method: ContractMethod | null;
  templateKey: string | null;
  title: string;
  version: string;
  alreadySigned: boolean;
  requiresYoktoSignature: boolean;
  requiresBuyerSignature: boolean;
  requiresSellerSignature: boolean;
  buyerSignatureMethod: SignatureMethod | null;
  sellerSignatureMethod: SignatureMethod | null;
  signatureOrder: SignatureOrder;
  // Upload
  pdfName: string | null;
  pdfSize: number | null;
  pdfHash: string | null;
  // Generated
  editableSections: Record<string, string>;
  // Local signature state (mock hasta wiring a backend)
  buyerSigned: boolean;
  sellerSigned: boolean;
};

export const DEFAULT_CONTRACT_STATE: ContractState = {
  method: null,
  templateKey: null,
  title: "Contrato de operación protegida",
  version: "v1.0",
  alreadySigned: false,
  requiresYoktoSignature: true,
  requiresBuyerSignature: true,
  requiresSellerSignature: true,
  buyerSignatureMethod: null,
  sellerSignatureMethod: null,
  signatureOrder: "PARALLEL",
  pdfName: null,
  pdfSize: null,
  pdfHash: null,
  editableSections: {},
  buyerSigned: false,
  sellerSigned: false,
};

// Reglas de sugerencia de método de firma según monto / sector
export function suggestSignatureMethod(
  sector: SectorId,
  monto: number,
): SignatureMethod {
  if (monto >= 50000) return "EFIRMA_SAT";
  if (sector === "INMOBILIARIO" || sector === "CONSTRUCCION" || sector === "COMERCIO_EXTERIOR") {
    return "EFIRMA_SAT";
  }
  return "AUTOGRAFA_BIOMETRICA";
}

// SHA-256 hexadecimal usando WebCrypto (client-side).
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Cumplimiento fiscal (CFDI / REP) ─────────────────────────────────────
export type FiscalConfig = {
  requiereCfdiPpd: boolean;
  requiereRep: boolean;
  usoCfdiReceptor: string; // clave SAT (G03, G01, etc.)
  regimenFiscalReceptor: string;
  cpReceptor: string;
  conceptoSugerido: string;
  toleranciaMonto: 0 | 1 | 2;
  validacionSatRequerida: boolean;
  aceptacionCfdiPor: "COMPRADOR" | "BACKOFFICE" | "AMBOS";
};

export const DEFAULT_FISCAL_CONFIG: FiscalConfig = {
  requiereCfdiPpd: true,
  requiereRep: true,
  usoCfdiReceptor: "G03",
  regimenFiscalReceptor: "",
  cpReceptor: "",
  conceptoSugerido: "",
  toleranciaMonto: 2,
  validacionSatRequerida: true,
  aceptacionCfdiPor: "COMPRADOR",
};

export const USO_CFDI_OPTIONS: { key: string; label: string }[] = [
  { key: "G01", label: "G01 — Adquisición de mercancías" },
  { key: "G03", label: "G03 — Gastos en general" },
  { key: "I01", label: "I01 — Construcciones" },
  { key: "I04", label: "I04 — Equipo de cómputo y accesorios" },
  { key: "I08", label: "I08 — Otra maquinaria y equipo" },
  { key: "S01", label: "S01 — Sin efectos fiscales" },
  { key: "CP01", label: "CP01 — Pagos" },
];
