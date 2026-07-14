// Validaciones de coherencia CFDI PPD vs Transacción YOKTO
// Cada check devuelve { code, severity, ok, message }

import type { ParsedCFDI } from "./cfdi-parser";

export type Severity = "error" | "warning" | "info";

export interface CheckResult {
  code: string;
  severity: Severity;
  ok: boolean;
  message: string;
  detail?: any;
}

export interface TxContext {
  numero: string;
  buyer_rfc?: string | null;
  seller_rfc?: string | null;
  buyer_nombre?: string | null;
  seller_nombre?: string | null;
  monto_total: number; // MXN
  moneda: string;
  fecha_creacion?: string | null;
}

function pass(code: string, message: string, severity: Severity = "info"): CheckResult {
  return { code, severity, ok: true, message };
}

function fail(code: string, message: string, severity: Severity = "error", detail?: any): CheckResult {
  return { code, severity, ok: false, message, detail };
}

function approxEqual(a: number, b: number, tol = 0.02): boolean {
  return Math.abs(a - b) <= tol;
}

/**
 * Ejecuta las 10 comprobaciones de coherencia para un CFDI PPD contra la transacción.
 */
export function checkCFDICoherence(cfdi: ParsedCFDI, tx: TxContext): CheckResult[] {
  const checks: CheckResult[] = [];

  // 1. Es CFDI PPD (Ingreso, MetodoPago=PPD)
  checks.push(
    cfdi.tipo === "CFDI_PPD"
      ? pass("PPD_TYPE", "El CFDI es de tipo Ingreso con MetodoPago=PPD")
      : fail("PPD_TYPE", `Se esperaba CFDI PPD, se recibió ${cfdi.tipo}`, "error")
  );

  // 2. RFC emisor coincide con vendedor
  if (tx.seller_rfc && cfdi.rfc_emisor) {
    checks.push(
      cfdi.rfc_emisor.toUpperCase() === tx.seller_rfc.toUpperCase()
        ? pass("RFC_EMISOR", "RFC del emisor coincide con el vendedor")
        : fail(
            "RFC_EMISOR",
            `RFC emisor ${cfdi.rfc_emisor} no coincide con vendedor ${tx.seller_rfc}`,
            "error"
          )
    );
  } else {
    checks.push(fail("RFC_EMISOR", "No se puede verificar RFC emisor", "warning"));
  }

  // 3. RFC receptor coincide con comprador
  if (tx.buyer_rfc && cfdi.rfc_receptor) {
    checks.push(
      cfdi.rfc_receptor.toUpperCase() === tx.buyer_rfc.toUpperCase()
        ? pass("RFC_RECEPTOR", "RFC del receptor coincide con el comprador")
        : fail(
            "RFC_RECEPTOR",
            `RFC receptor ${cfdi.rfc_receptor} no coincide con comprador ${tx.buyer_rfc}`,
            "error"
          )
    );
  } else {
    checks.push(fail("RFC_RECEPTOR", "No se puede verificar RFC receptor", "warning"));
  }

  // 4. Total del CFDI coincide con monto de la transacción
  if (cfdi.total !== undefined) {
    checks.push(
      approxEqual(cfdi.total, tx.monto_total, 1)
        ? pass("TOTAL_MATCH", `Total ${cfdi.total} coincide con la transacción`)
        : fail(
            "TOTAL_MATCH",
            `Total del CFDI (${cfdi.total}) no coincide con la transacción (${tx.monto_total})`,
            "error"
          )
    );
  }

  // 5. Moneda coincide
  const monedaCfdi = (cfdi.moneda ?? "MXN").toUpperCase();
  checks.push(
    monedaCfdi === tx.moneda.toUpperCase()
      ? pass("MONEDA", `Moneda ${monedaCfdi} coincide`)
      : fail("MONEDA", `Moneda ${monedaCfdi} ≠ ${tx.moneda}`, "warning")
  );

  // 6. TFD (UUID) presente
  checks.push(
    cfdi.uuid_fiscal
      ? pass("TFD_PRESENT", "Timbre Fiscal Digital presente")
      : fail("TFD_PRESENT", "Falta TimbreFiscalDigital", "error")
  );

  // 7. Sellos presentes
  checks.push(
    cfdi.sello_cfd && cfdi.sello_sat
      ? pass("SELLOS", "Sellos CFD y SAT presentes")
      : fail("SELLOS", "Faltan sellos digitales", "error")
  );

  // 8. Fecha de emisión no futura
  if (cfdi.fecha_emision) {
    const fe = new Date(cfdi.fecha_emision);
    checks.push(
      fe.getTime() <= Date.now() + 60_000
        ? pass("FECHA_EMISION", "Fecha de emisión válida")
        : fail("FECHA_EMISION", `Fecha de emisión futura: ${cfdi.fecha_emision}`, "error")
    );
  }

  // 9. UsoCFDI válido para B2B (G01, G03, I0x, S01)
  if (cfdi.uso_cfdi) {
    const validUsos = new Set(["G01", "G03", "I01", "I02", "I03", "I04", "I05", "I06", "I07", "I08", "S01"]);
    checks.push(
      validUsos.has(cfdi.uso_cfdi)
        ? pass("USO_CFDI", `Uso CFDI ${cfdi.uso_cfdi} válido`)
        : fail("USO_CFDI", `UsoCFDI ${cfdi.uso_cfdi} inusual para esta operación`, "warning")
    );
  }

  // 10. FormaPago debe ser 99 (Por definir) en un PPD
  if (cfdi.forma_pago) {
    checks.push(
      cfdi.forma_pago === "99"
        ? pass("FORMA_PAGO_PPD", "FormaPago=99 correcta para PPD")
        : fail("FORMA_PAGO_PPD", `PPD debería tener FormaPago=99, se recibió ${cfdi.forma_pago}`, "error")
    );
  }

  return checks;
}

/**
 * Ejecuta las 8 comprobaciones de coherencia para un REP (Complemento de Pago 2.0).
 */
export function checkREPCoherence(
  rep: ParsedCFDI,
  cfdiPadre: ParsedCFDI | null,
  tx: TxContext,
  totalPagadoPrevio: number
): CheckResult[] {
  const checks: CheckResult[] = [];

  // 1. Es tipo P
  checks.push(
    rep.tipo === "REP"
      ? pass("REP_TYPE", "Complemento de Pago 2.0 detectado")
      : fail("REP_TYPE", `Se esperaba REP (P), se recibió ${rep.tipo}`, "error")
  );

  // 2. Total=0 en el comprobante contenedor
  checks.push(
    (rep.total ?? 0) === 0
      ? pass("REP_TOTAL_CERO", "Total del contenedor = 0")
      : fail("REP_TOTAL_CERO", `El contenedor REP debe tener Total=0, se recibió ${rep.total}`, "error")
  );

  const pago = rep.pagos?.[0];
  const docRel = pago?.documentos?.[0];

  // 3. Existe al menos un pago con documento relacionado
  checks.push(
    docRel
      ? pass("REP_DOCTO", "DoctoRelacionado presente")
      : fail("REP_DOCTO", "Falta DoctoRelacionado en el REP", "error")
  );

  // 4. UUID del docto relacionado coincide con el CFDI padre
  if (docRel && cfdiPadre?.uuid_fiscal) {
    checks.push(
      docRel.id_documento?.toUpperCase() === cfdiPadre.uuid_fiscal.toUpperCase()
        ? pass("REP_UUID_PADRE", "El REP referencia al CFDI PPD correcto")
        : fail(
            "REP_UUID_PADRE",
            `IdDocumento ${docRel.id_documento} ≠ UUID del CFDI padre ${cfdiPadre.uuid_fiscal}`,
            "error"
          )
    );
  } else if (docRel) {
    checks.push(fail("REP_UUID_PADRE", "No hay CFDI PPD padre registrado para validar el UUID referenciado", "warning"));
  }

  // 5. ImpPagado > 0
  if (docRel) {
    checks.push(
      (docRel.imp_pagado ?? 0) > 0
        ? pass("REP_IMP_PAGADO", `ImpPagado = ${docRel.imp_pagado}`)
        : fail("REP_IMP_PAGADO", "ImpPagado debe ser mayor a 0", "error")
    );
  }

  // 6. Saldo insoluto = SaldoAnt - ImpPagado
  if (docRel?.imp_saldo_ant !== undefined && docRel.imp_pagado !== undefined && docRel.imp_saldo_insoluto !== undefined) {
    const esperado = docRel.imp_saldo_ant - docRel.imp_pagado;
    checks.push(
      approxEqual(esperado, docRel.imp_saldo_insoluto, 0.02)
        ? pass("REP_SALDO", "Cálculo de saldo insoluto correcto")
        : fail(
            "REP_SALDO",
            `Saldo insoluto ${docRel.imp_saldo_insoluto} ≠ ${docRel.imp_saldo_ant} - ${docRel.imp_pagado}`,
            "error"
          )
    );
  }

  // 7. SaldoAnt coincide con lo ya pagado
  if (docRel?.imp_saldo_ant !== undefined && cfdiPadre?.total !== undefined) {
    const esperadoSaldoAnt = cfdiPadre.total - totalPagadoPrevio;
    checks.push(
      approxEqual(esperadoSaldoAnt, docRel.imp_saldo_ant, 1)
        ? pass("REP_SALDO_ANT", "SaldoAnt coincide con historial de pagos")
        : fail(
            "REP_SALDO_ANT",
            `SaldoAnt esperado ${esperadoSaldoAnt.toFixed(2)}, recibido ${docRel.imp_saldo_ant}`,
            "warning",
            { totalPagadoPrevio, totalCFDI: cfdiPadre.total }
          )
    );
  }

  // 8. Suma pagada no excede total del CFDI padre
  if (docRel?.imp_pagado !== undefined && cfdiPadre?.total !== undefined) {
    const nuevoTotal = totalPagadoPrevio + docRel.imp_pagado;
    checks.push(
      nuevoTotal <= cfdiPadre.total + 0.02
        ? pass("REP_NO_EXCEDE", "Suma pagada no excede el total del CFDI")
        : fail(
            "REP_NO_EXCEDE",
            `Suma pagada (${nuevoTotal.toFixed(2)}) excede el total del CFDI (${cfdiPadre.total})`,
            "error"
          )
    );
  }

  return checks;
}

export function scoreChecks(checks: CheckResult[]): number {
  if (checks.length === 0) return 0;
  const weights = { error: 25, warning: 5, info: 0 } as const;
  const penalty = checks
    .filter((c) => !c.ok)
    .reduce((acc, c) => acc + weights[c.severity], 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}
