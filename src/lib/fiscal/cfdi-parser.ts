// Parser de CFDI 4.0 y Complemento de Pago 2.0 (REP)
// Usa fast-xml-parser en modo tolerante (namespaces cfdi:, tfd:, pago20:)

import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  parseAttributeValue: false, // mantenemos strings para no perder ceros
  trimValues: true,
  allowBooleanAttributes: true,
});

export type CFDIType = "CFDI_PPD" | "CFDI_PUE" | "REP";

export interface ParsedCFDI {
  tipo: CFDIType;
  version: string;
  serie?: string;
  folio?: string;
  fecha_emision?: string;
  fecha_timbrado?: string;
  uuid_fiscal?: string;
  no_certificado_sat?: string;
  no_certificado_emisor?: string;
  sello_cfd?: string;
  sello_sat?: string;

  tipo_comprobante?: string; // I, E, P, N, T
  metodo_pago?: string; // PUE / PPD
  forma_pago?: string;
  uso_cfdi?: string;
  moneda?: string;
  tipo_cambio?: number;
  subtotal?: number;
  descuento?: number;
  total?: number;
  total_impuestos_trasladados?: number;
  total_impuestos_retenidos?: number;

  rfc_emisor?: string;
  nombre_emisor?: string;
  regimen_fiscal_emisor?: string;

  rfc_receptor?: string;
  nombre_receptor?: string;
  regimen_fiscal_receptor?: string;
  domicilio_fiscal_receptor?: string;

  // REP: puede tener varios pagos y cada pago varios documentos relacionados
  pagos?: RepPago[];
  raw: any;
}

export interface RepPago {
  fecha_pago?: string;
  forma_pago?: string;
  moneda?: string;
  tipo_cambio?: number;
  monto?: number;
  num_operacion?: string;
  documentos: RepDocRelacionado[];
}

export interface RepDocRelacionado {
  id_documento: string; // UUID del CFDI PPD
  serie?: string;
  folio?: string;
  moneda?: string;
  num_parcialidad?: number;
  imp_saldo_ant?: number;
  imp_pagado?: number;
  imp_saldo_insoluto?: number;
  objeto_imp?: string;
}

function num(v: any): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

export function parseCFDI(xml: string): ParsedCFDI {
  const doc = parser.parse(xml);
  const comp = doc.Comprobante;
  if (!comp) {
    throw new Error("XML inválido: no se encontró nodo Comprobante");
  }

  const emisor = comp.Emisor ?? {};
  const receptor = comp.Receptor ?? {};
  const complemento = comp.Complemento ?? {};
  const tfd = complemento.TimbreFiscalDigital ?? {};
  const impuestos = comp.Impuestos ?? {};

  // Detectar REP vs CFDI
  const tipoComp = String(comp.TipoDeComprobante ?? "").toUpperCase();
  const pagosNode = complemento.Pagos ?? complemento.pagos;
  let tipo: CFDIType;
  if (tipoComp === "P" || pagosNode) tipo = "REP";
  else if (String(comp.MetodoPago ?? "").toUpperCase() === "PPD") tipo = "CFDI_PPD";
  else tipo = "CFDI_PUE";

  const parsed: ParsedCFDI = {
    tipo,
    version: String(comp.Version ?? comp.version ?? ""),
    serie: comp.Serie,
    folio: comp.Folio,
    fecha_emision: comp.Fecha,
    fecha_timbrado: tfd.FechaTimbrado,
    uuid_fiscal: tfd.UUID,
    no_certificado_sat: tfd.NoCertificadoSAT,
    no_certificado_emisor: comp.NoCertificado,
    sello_cfd: tfd.SelloCFD ?? comp.Sello,
    sello_sat: tfd.SelloSAT,

    tipo_comprobante: tipoComp,
    metodo_pago: comp.MetodoPago,
    forma_pago: comp.FormaPago,
    uso_cfdi: receptor.UsoCFDI,
    moneda: comp.Moneda,
    tipo_cambio: num(comp.TipoCambio),
    subtotal: num(comp.SubTotal),
    descuento: num(comp.Descuento) ?? 0,
    total: num(comp.Total),
    total_impuestos_trasladados: num(impuestos.TotalImpuestosTrasladados) ?? 0,
    total_impuestos_retenidos: num(impuestos.TotalImpuestosRetenidos) ?? 0,

    rfc_emisor: emisor.Rfc,
    nombre_emisor: emisor.Nombre,
    regimen_fiscal_emisor: emisor.RegimenFiscal,

    rfc_receptor: receptor.Rfc,
    nombre_receptor: receptor.Nombre,
    regimen_fiscal_receptor: receptor.RegimenFiscalReceptor,
    domicilio_fiscal_receptor: receptor.DomicilioFiscalReceptor,

    raw: doc,
  };

  if (tipo === "REP" && pagosNode) {
    const pagos = asArray<any>(pagosNode.Pago);
    parsed.pagos = pagos.map((p) => ({
      fecha_pago: p.FechaPago,
      forma_pago: p.FormaDePagoP,
      moneda: p.MonedaP,
      tipo_cambio: num(p.TipoCambioP),
      monto: num(p.Monto),
      num_operacion: p.NumOperacion,
      documentos: asArray<any>(p.DoctoRelacionado).map((d) => ({
        id_documento: d.IdDocumento,
        serie: d.Serie,
        folio: d.Folio,
        moneda: d.MonedaDR,
        num_parcialidad: num(d.NumParcialidad),
        imp_saldo_ant: num(d.ImpSaldoAnt),
        imp_pagado: num(d.ImpPagado),
        imp_saldo_insoluto: num(d.ImpSaldoInsoluto),
        objeto_imp: d.ObjetoImpDR,
      })),
    }));
  }

  return parsed;
}

/**
 * Devuelve una representación aplanada del primer pago/docto — útil para
 * poblar columnas de conveniencia en fiscal_documents cuando es REP.
 */
export function flattenFirstPago(parsed: ParsedCFDI) {
  const pago = parsed.pagos?.[0];
  const doc = pago?.documentos?.[0];
  return {
    fecha_pago: pago?.fecha_pago,
    forma_pago: pago?.forma_pago,
    monto: pago?.monto,
    parcialidad_numero: doc?.num_parcialidad,
    imp_saldo_ant: doc?.imp_saldo_ant,
    imp_pagado: doc?.imp_pagado,
    imp_saldo_insoluto: doc?.imp_saldo_insoluto,
    parent_uuid: doc?.id_documento,
  };
}
