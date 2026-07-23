// Cálculo del depósito de seriedad para abrir una disputa.
// Regla Cumplex: 2% del monto en disputa, mínimo $500 MXN, máximo $50,000 MXN.
// El depósito se devuelve al activador si gana la disputa;
// se retiene por Cumplex si la disputa se resuelve en su contra.

export type DepositType = "minimo" | "porcentual" | "maximo";

export interface DepositoSeriedad {
  monto_cents: number;
  monto_mxn: number;
  porcentaje: number;
  base_calculo_cents: number;
  tipo: DepositType;
  descripcion: string;
  reembolsable_si_gana: boolean;
}

const PCT = 0.02; // 2%
const MIN_CENTS = 50_000; // $500 MXN
const MAX_CENTS = 5_000_000; // $50,000 MXN

export function calcularDepositoSeriedad(
  montoTransaccionCents: number,
  montoHitoCents?: number,
): DepositoSeriedad {
  const base = Math.max(montoHitoCents ?? montoTransaccionCents, 0);
  const raw = Math.round(base * PCT);
  const final = Math.min(Math.max(raw, MIN_CENTS), MAX_CENTS);
  const tipo: DepositType =
    raw < MIN_CENTS ? "minimo" : raw > MAX_CENTS ? "maximo" : "porcentual";
  const mxn = final / 100;
  const baseMxn = (base / 100).toLocaleString("es-MX", { maximumFractionDigits: 2 });
  return {
    monto_cents: final,
    monto_mxn: mxn,
    porcentaje: PCT * 100,
    base_calculo_cents: base,
    tipo,
    descripcion: `${(PCT * 100).toFixed(0)}% de $${baseMxn} MXN = $${mxn.toLocaleString("es-MX")} MXN`,
    reembolsable_si_gana: true,
  };
}

export const DEPOSIT_LIMITS = {
  MIN_CENTS,
  MAX_CENTS,
  PCT,
};
