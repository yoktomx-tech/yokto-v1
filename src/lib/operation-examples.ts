// Ejemplos precargados para el wizard "Crear operación protegida".
// Estos ejemplos coinciden con las operaciones mostradas en /cumplimiento
// (ver src/lib/cumplimiento-mock.ts) para mantener coherencia entre módulos.

import type { SectorId, HitoDraft } from "./sectors";

export type OperationExample = {
  id: string;
  label: string;
  emoji: string;
  sector: SectorId;
  subtipo: string;
  descripcion: string;
  diasDuracion: number; // desde hoy hasta fecha_fin
  rol: "PAGADOR" | "BENEFICIARIO";
  contraparte: {
    email: string;
    nombre: string;
    rfc: string;
  };
  monto: number;
  metodoPago: "SPEI" | "TARJETA" | "OXXO";
  comisionPagadaPor: "COMPRADOR" | "VENDEDOR";
  hitos: Array<Omit<HitoDraft, "orden" | "fecha_limite"> & { diasDesdeInicio: number }>;
};

export const OPERATION_EXAMPLES: OperationExample[] = [
  {
    id: "EJ-CONSTRUCCION",
    label: "Suministro de materiales etapa 2",
    emoji: "🏗️",
    sector: "CONSTRUCCION",
    subtipo: "Obra civil",
    descripcion:
      "Suministro e instalación de materiales para etapa 2 de obra civil en Torre Norte. Incluye anticipo documental, entrega parcial verificada en sitio y evidencia final con acuse del comprador.",
    diasDuracion: 45,
    rol: "BENEFICIARIO",
    contraparte: {
      email: "compras@constructoranorte.mx",
      nombre: "Constructora Norte S.A. de C.V.",
      rfc: "CNO120315AB4",
    },
    monto: 420000,
    metodoPago: "SPEI",
    comisionPagadaPor: "COMPRADOR",
    hitos: [
      {
        titulo: "Anticipo documental",
        descripcion: "Contrato firmado y CFDI de anticipo timbrado.",
        monto_porcentaje: 24,
        diasDesdeInicio: 5,
        tipo_verificacion: "DOCUMENTAL",
        documentos_requeridos: ["Contrato firmado", "CFDI anticipo", "Orden de compra"],
        evidencia_requerida: [],
        responsable: "BENEFICIARIO",
        auto_release: false,
      },
      {
        titulo: "Entrega parcial de obra",
        descripcion: "Evidencia fotográfica, checklist firmado y CFDI relacionado.",
        monto_porcentaje: 44,
        diasDesdeInicio: 25,
        tipo_verificacion: "EVIDENCIA_FISICA",
        documentos_requeridos: ["CFDI entrega parcial", "Checklist entrega"],
        evidencia_requerida: ["Fotos avance zona A", "Video recorrido zona B", "GPS de sitio"],
        responsable: "BENEFICIARIO",
        auto_release: false,
      },
      {
        titulo: "Evidencia final y acuse",
        descripcion: "Cierre de obra con acuse firmado del comprador.",
        monto_porcentaje: 32,
        diasDesdeInicio: 45,
        tipo_verificacion: "DOCUMENTAL",
        documentos_requeridos: ["Acuse de recepción", "CFDI de cierre", "Reporte técnico"],
        evidencia_requerida: ["Fotografías finales"],
        responsable: "PAGADOR",
        auto_release: false,
      },
    ],
  },
  {
    id: "EJ-SERVICIOS-INDUSTRIALES",
    label: "Servicio de mantenimiento planta 3",
    emoji: "🔧",
    sector: "SERVICIOS",
    subtipo: "Servicios industriales",
    descripcion:
      "Servicio integral de mantenimiento preventivo en planta 3, incluye levantamiento en sitio, ejecución de mantenimiento por sesión y entrega final con CFDI.",
    diasDuracion: 40,
    rol: "BENEFICIARIO",
    contraparte: {
      email: "operaciones@industriasdelbajio.mx",
      nombre: "Industrias del Bajío S.A.",
      rfc: "IBA150210XY9",
    },
    monto: 240000,
    metodoPago: "SPEI",
    comisionPagadaPor: "COMPRADOR",
    hitos: [
      {
        titulo: "Levantamiento en sitio",
        descripcion: "Reporte técnico con fotografías y checklist.",
        monto_porcentaje: 25,
        diasDesdeInicio: 7,
        tipo_verificacion: "CHECKLIST",
        documentos_requeridos: ["Reporte técnico", "Checklist firmado"],
        evidencia_requerida: ["Fotos planta 3"],
        responsable: "BENEFICIARIO",
        auto_release: false,
      },
      {
        titulo: "Ejecución de mantenimiento",
        descripcion: "Bitácora diaria y evidencia fotográfica por sesión.",
        monto_porcentaje: 50,
        diasDesdeInicio: 25,
        tipo_verificacion: "EVIDENCIA_FISICA",
        documentos_requeridos: ["Bitácora diaria", "Reporte de horas", "CFDI parcial"],
        evidencia_requerida: ["Evidencia fotográfica", "Checklist SST"],
        responsable: "BENEFICIARIO",
        auto_release: false,
      },
      {
        titulo: "Entrega final y CFDI",
        descripcion: "Acta de cierre firmada y CFDI final timbrado.",
        monto_porcentaje: 25,
        diasDesdeInicio: 40,
        tipo_verificacion: "DOCUMENTAL",
        documentos_requeridos: ["Acta de cierre", "CFDI final"],
        evidencia_requerida: [],
        responsable: "PAGADOR",
        auto_release: false,
      },
    ],
  },
  {
    id: "EJ-CONSULTORIA",
    label: "Consultoría estratégica Q3",
    emoji: "💼",
    sector: "SERVICIOS",
    subtipo: "Consultoría",
    descripcion:
      "Consultoría estratégica trimestral con entrega final consistente en reporte ejecutivo en PDF y presentación al comité directivo.",
    diasDuracion: 30,
    rol: "BENEFICIARIO",
    contraparte: {
      email: "direccion@grupopalmera.mx",
      nombre: "Grupo Palmera S.A. de C.V.",
      rfc: "GPA180524KL2",
    },
    monto: 180000,
    metodoPago: "SPEI",
    comisionPagadaPor: "VENDEDOR",
    hitos: [
      {
        titulo: "Entrega final del reporte",
        descripcion: "PDF final y presentación ejecutiva.",
        monto_porcentaje: 100,
        diasDesdeInicio: 30,
        tipo_verificacion: "DOCUMENTAL",
        documentos_requeridos: ["Reporte final", "CFDI final"],
        evidencia_requerida: [],
        responsable: "PAGADOR",
        auto_release: true,
      },
    ],
  },
  {
    id: "EJ-AUTOTRANSPORTE",
    label: "Flete CDMX–Monterrey 5 ton",
    emoji: "🚛",
    sector: "AUTOTRANSPORTE",
    subtipo: "Flete terrestre",
    descripcion:
      "Flete terrestre CDMX–Monterrey, 5 toneladas de mercancía electrónica con monitoreo GPS y acuse firmado en destino.",
    diasDuracion: 7,
    rol: "PAGADOR",
    contraparte: {
      email: "trafico@transporteslogimx.mx",
      nombre: "Transportes LogiMX S.A. de C.V.",
      rfc: "TLM210318QR5",
    },
    monto: 75000,
    metodoPago: "SPEI",
    comisionPagadaPor: "COMPRADOR",
    hitos: [
      {
        titulo: "Carga y salida de origen",
        descripcion: "Confirmación de recolección y salida del punto de origen.",
        monto_porcentaje: 30,
        diasDesdeInicio: 1,
        tipo_verificacion: "EVIDENCIA_FISICA",
        documentos_requeridos: ["Carta porte", "Foto de carga"],
        evidencia_requerida: ["Foto unidad cargada"],
        responsable: "BENEFICIARIO",
        auto_release: false,
      },
      {
        titulo: "Tránsito y monitoreo GPS",
        descripcion: "Ruta cumplida sin desviaciones mayores.",
        monto_porcentaje: 20,
        diasDesdeInicio: 3,
        tipo_verificacion: "GPS",
        documentos_requeridos: [],
        evidencia_requerida: ["Track GPS"],
        responsable: "BENEFICIARIO",
        auto_release: true,
      },
      {
        titulo: "Entrega en destino",
        descripcion: "Descarga y acuse de recibo firmado.",
        monto_porcentaje: 50,
        diasDesdeInicio: 7,
        tipo_verificacion: "DOCUMENTAL",
        documentos_requeridos: ["Remisión firmada", "Fotos de entrega"],
        evidencia_requerida: ["Firma destinatario"],
        responsable: "PAGADOR",
        auto_release: false,
      },
    ],
  },
  {
    id: "EJ-INMOBILIARIO",
    label: "Compraventa casa Del Valle",
    emoji: "🏠",
    sector: "INMOBILIARIO",
    subtipo: "Compraventa residencial",
    descripcion:
      "Compraventa de casa habitación en Col. Del Valle, CDMX. Incluye promesa, due diligence con avalúo y firma de escrituras ante notario.",
    diasDuracion: 90,
    rol: "PAGADOR",
    contraparte: {
      email: "ventas@inmobiliariacentral.mx",
      nombre: "Inmobiliaria Central S.A. de C.V.",
      rfc: "ICE110708HG7",
    },
    monto: 4800000,
    metodoPago: "SPEI",
    comisionPagadaPor: "COMPRADOR",
    hitos: [
      {
        titulo: "Firma de contrato de promesa",
        descripcion: "Contrato de promesa firmado por ambas partes.",
        monto_porcentaje: 10,
        diasDesdeInicio: 5,
        tipo_verificacion: "DOCUMENTAL",
        documentos_requeridos: ["Contrato promesa"],
        evidencia_requerida: [],
        responsable: "PAGADOR",
        auto_release: false,
      },
      {
        titulo: "Due diligence y avalúo",
        descripcion: "Avalúo bancario y certificado de libertad de gravámenes.",
        monto_porcentaje: 20,
        diasDesdeInicio: 30,
        tipo_verificacion: "DOCUMENTAL",
        documentos_requeridos: ["Avalúo", "Cert. libertad gravámenes"],
        evidencia_requerida: [],
        responsable: "PAGADOR",
        auto_release: false,
      },
      {
        titulo: "Firma de escrituras",
        descripcion: "Firma de escritura pública ante notario y entrega de llaves.",
        monto_porcentaje: 70,
        diasDesdeInicio: 90,
        tipo_verificacion: "DOCUMENTAL",
        documentos_requeridos: ["Escritura pública", "Boleta predial", "Constancia notarial"],
        evidencia_requerida: [],
        responsable: "PAGADOR",
        auto_release: false,
      },
    ],
  },
  {
    id: "EJ-VEHICULOS",
    label: "Venta Honda CR-V 2022",
    emoji: "🚗",
    sector: "VEHICULOS",
    subtipo: "Auto seminuevo",
    descripcion:
      "Venta de Honda CR-V 2022, color gris, 45,000 km. Incluye inspección física, verificación REPUVE y endoso de factura.",
    diasDuracion: 10,
    rol: "PAGADOR",
    contraparte: {
      email: "particular@autospremium.mx",
      nombre: "Autos Premium Seminuevos S.A.",
      rfc: "APS190612MN3",
    },
    monto: 385000,
    metodoPago: "SPEI",
    comisionPagadaPor: "COMPRADOR",
    hitos: [
      {
        titulo: "Inspección física y prueba",
        descripcion: "Checklist de inspección firmado y fotografías del vehículo.",
        monto_porcentaje: 20,
        diasDesdeInicio: 2,
        tipo_verificacion: "CHECKLIST",
        documentos_requeridos: ["Checklist inspección"],
        evidencia_requerida: ["Fotos vehículo"],
        responsable: "PAGADOR",
        auto_release: false,
      },
      {
        titulo: "Documentos y verificación de origen",
        descripcion: "Factura original, tarjeta de circulación y REPUVE.",
        monto_porcentaje: 30,
        diasDesdeInicio: 5,
        tipo_verificacion: "DOCUMENTAL",
        documentos_requeridos: ["Factura original", "Tarjeta circulación", "REPUVE"],
        evidencia_requerida: [],
        responsable: "PAGADOR",
        auto_release: false,
      },
      {
        titulo: "Endoso y entrega",
        descripcion: "Factura endosada y contrato de compraventa firmado.",
        monto_porcentaje: 50,
        diasDesdeInicio: 10,
        tipo_verificacion: "DOCUMENTAL",
        documentos_requeridos: ["Factura endosada", "Contrato compraventa"],
        evidencia_requerida: [],
        responsable: "PAGADOR",
        auto_release: false,
      },
    ],
  },
];

export function findExample(id: string): OperationExample | undefined {
  return OPERATION_EXAMPLES.find((e) => e.id === id);
}

// ─── Demo TxRows para /transactions ───────────────────────────────────────
// Genera filas de demostración a partir de los ejemplos por sector, con
// estados variados para que el listado, métricas y tabs se vean pobladas.

type DemoTxRow = {
  id: string;
  numero: string;
  title: string;
  sector: string;
  buyer_id: string;
  seller_id: string | null;
  counterparty_email: string | null;
  beneficiario_nombre: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  delivery_deadline: string | null;
  funding_deadline: string | null;
  milestones_total: number;
  milestones_done: number;
  held_cents: number;
  releasable_cents: number;
  next_action: { label: string; tone: "warn" | "info" | "err" | "ok" } | null;
  __demo: true;
};

// Estado + progreso asignado por ejemplo (para variedad visual)
const DEMO_STATE: Record<string, { status: string; done: number }> = {
  "EJ-CONSTRUCCION":            { status: "in_progress",       done: 1 },
  "EJ-SERVICIOS-INDUSTRIALES":  { status: "en_verificacion",   done: 1 },
  "EJ-CONSULTORIA":             { status: "released",          done: 1 },
  "EJ-AUTOTRANSPORTE":          { status: "funded",            done: 0 },
  "EJ-INMOBILIARIO":            { status: "awaiting_funding",  done: 0 },
  "EJ-VEHICULOS":               { status: "draft",             done: 0 },
};

const HELD_STATES = new Set(["funded", "in_progress", "en_verificacion", "partial_release", "disputed"]);
const RELEASABLE_STATES = new Set(["conditions_met", "partial_release"]);

function nextActionDemo(status: string, isBuyer: boolean): DemoTxRow["next_action"] {
  if (isBuyer) {
    if (status === "awaiting_funding") return { label: "Fondear ahora", tone: "warn" };
    if (status === "conditions_met") return { label: "Liberar pago", tone: "info" };
    if (status === "disputed") return { label: "Responder disputa", tone: "err" };
    return null;
  }
  if (status === "pending_signature") return { label: "Aceptar invitación", tone: "info" };
  if (status === "funded" || status === "in_progress") return { label: "Subir evidencia", tone: "warn" };
  if (status === "en_verificacion") return { label: "En revisión", tone: "info" };
  if (status === "disputed") return { label: "Responder disputa", tone: "err" };
  return null;
}

export function buildDemoTxRows(userId: string): DemoTxRow[] {
  const now = Date.now();
  return OPERATION_EXAMPLES.map((ex, idx) => {
    const state = DEMO_STATE[ex.id] ?? { status: "in_progress", done: 0 };
    const amount_cents = Math.round(ex.monto * 100);
    const isBuyer = ex.rol === "PAGADOR";
    const buyer_id = isBuyer ? userId : `demo-buyer-${idx}`;
    const seller_id = isBuyer ? `demo-seller-${idx}` : userId;
    const created = new Date(now - (idx + 1) * 86_400_000 * 3);
    const delivery = new Date(created.getTime() + ex.diasDuracion * 86_400_000);
    const held = HELD_STATES.has(state.status) ? amount_cents : 0;
    const releasable = RELEASABLE_STATES.has(state.status) ? amount_cents : 0;
    return {
      id: `demo-${ex.id}`,
      numero: `Cumplex-DEMO-${String(idx + 1).padStart(3, "0")}`,
      title: ex.label,
      sector: ex.sector,
      buyer_id,
      seller_id,
      counterparty_email: ex.contraparte.email,
      beneficiario_nombre: ex.contraparte.nombre,
      amount_cents,
      currency: "MXN",
      status: state.status,
      created_at: created.toISOString(),
      delivery_deadline: delivery.toISOString(),
      funding_deadline: state.status === "awaiting_funding" ? delivery.toISOString() : null,
      milestones_total: ex.hitos.length,
      milestones_done: state.done,
      held_cents: held,
      releasable_cents: releasable,
      next_action: nextActionDemo(state.status, isBuyer),
      __demo: true,
    };
  });
}

