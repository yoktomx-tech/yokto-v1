// Motor de riesgo PLD/FT — determinista, sin dependencias externas.
// Devuelve score 0-100 (mayor = mayor riesgo) y factores individuales.

export type PldRiskLevel = "bajo" | "medio" | "alto" | "inaceptable";

export interface PldQuestionnaireInput {
  actividad_scian?: string | null;
  sector?: string | null;
  origen_recursos?: string | null;
  volumen_mensual_estimado?: number | null;
  operaciones_mensuales_estimadas?: number | null;
  paises_operacion?: string[] | null;
  usa_efectivo?: boolean;
  efectivo_mensual_estimado?: number | null;
  es_pep?: boolean;
  familiar_pep?: boolean;
  proposito_cuenta?: string | null;
}

export interface PldScreeningInput {
  status: "limpio" | "coincidencia_debil" | "coincidencia_fuerte" | "error";
  lista: string;
}

export interface PldRiskFactor {
  category: string;
  code: string;
  label: string;
  weight: number;
  value: number;
  contribution: number; // puntos añadidos al score (0-100)
  detail?: Record<string, unknown>;
}

export interface PldRiskResult {
  score: number;
  level: PldRiskLevel;
  factors: PldRiskFactor[];
  nextReviewMonths: number;
}

// Países de alto riesgo (FATF/GAFI listas grises/negras — muestra)
const HIGH_RISK_COUNTRIES = new Set([
  "AF","KP","IR","MM","SY","YE","VE","CU","NI","RU","BY",
  "PA","HT","JM","MZ","SN","UG","VU","TR","AE",
]);

// SCIAN de actividades sensibles (muestra)
const SENSITIVE_SCIAN = new Set([
  "5223", "5232", "7132", "8123", "5417", "9241",
]);

function levelFor(score: number): PldRiskLevel {
  if (score >= 85) return "inaceptable";
  if (score >= 60) return "alto";
  if (score >= 30) return "medio";
  return "bajo";
}

function reviewMonths(level: PldRiskLevel): number {
  switch (level) {
    case "inaceptable": return 1;
    case "alto": return 3;
    case "medio": return 6;
    default: return 12;
  }
}

export function evaluatePldRisk(
  q: PldQuestionnaireInput,
  screening: PldScreeningInput[] = [],
): PldRiskResult {
  const factors: PldRiskFactor[] = [];

  // 1) PEP
  if (q.es_pep) {
    factors.push({
      category: "PEP",
      code: "PEP_TITULAR",
      label: "Titular es Persona Políticamente Expuesta",
      weight: 30, value: 1, contribution: 30,
    });
  } else if (q.familiar_pep) {
    factors.push({
      category: "PEP",
      code: "PEP_FAMILIAR",
      label: "Familiar directo de PEP",
      weight: 15, value: 1, contribution: 15,
    });
  }

  // 2) Efectivo
  if (q.usa_efectivo) {
    const monto = q.efectivo_mensual_estimado ?? 0;
    let c = 5;
    if (monto >= 200000) c = 25;
    else if (monto >= 75000) c = 15;
    else if (monto >= 25000) c = 10;
    factors.push({
      category: "EFECTIVO",
      code: "USO_EFECTIVO",
      label: "Uso declarado de efectivo",
      weight: 25, value: monto, contribution: c,
    });
  }

  // 3) Geografía de riesgo
  const paises = (q.paises_operacion ?? []).map(p => p.toUpperCase());
  const riesgosos = paises.filter(p => HIGH_RISK_COUNTRIES.has(p));
  if (riesgosos.length > 0) {
    factors.push({
      category: "GEOGRAFIA",
      code: "PAIS_ALTO_RIESGO",
      label: `Opera con países de alto riesgo GAFI (${riesgosos.join(", ")})`,
      weight: 20, value: riesgosos.length, contribution: Math.min(20, 10 * riesgosos.length),
    });
  }

  // 4) Volumen
  const vol = q.volumen_mensual_estimado ?? 0;
  let volC = 0;
  if (vol >= 5_000_000) volC = 15;
  else if (vol >= 1_000_000) volC = 10;
  else if (vol >= 250_000) volC = 5;
  if (volC > 0) {
    factors.push({
      category: "VOLUMEN",
      code: "VOLUMEN_ALTO",
      label: "Volumen mensual esperado elevado",
      weight: 15, value: vol, contribution: volC,
    });
  }

  // 5) Actividad SCIAN sensible
  const scianPrefix = (q.actividad_scian ?? "").slice(0, 4);
  if (scianPrefix && SENSITIVE_SCIAN.has(scianPrefix)) {
    factors.push({
      category: "ACTIVIDAD",
      code: "SCIAN_SENSIBLE",
      label: "Actividad económica en sector vulnerable",
      weight: 15, value: 1, contribution: 12,
    });
  }

  // 6) Screening — listas negras
  const fuerte = screening.filter(s => s.status === "coincidencia_fuerte");
  const debil = screening.filter(s => s.status === "coincidencia_debil");
  if (fuerte.length > 0) {
    factors.push({
      category: "SCREENING",
      code: "MATCH_FUERTE",
      label: `Coincidencia fuerte en ${fuerte.map(f => f.lista).join(", ")}`,
      weight: 40, value: fuerte.length, contribution: 40,
    });
  } else if (debil.length > 0) {
    factors.push({
      category: "SCREENING",
      code: "MATCH_DEBIL",
      label: `Coincidencia débil en ${debil.map(f => f.lista).join(", ")}`,
      weight: 15, value: debil.length, contribution: 10,
    });
  }

  // 7) Origen de recursos vago o no declarado
  const orig = (q.origen_recursos ?? "").trim();
  if (!orig || orig.length < 20) {
    factors.push({
      category: "TRANSPARENCIA",
      code: "ORIGEN_VAGO",
      label: "Origen de recursos no declarado o insuficiente",
      weight: 10, value: orig.length, contribution: 8,
    });
  }

  const raw = factors.reduce((s, f) => s + f.contribution, 0);
  const score = Math.min(100, Math.max(0, raw));
  const level = levelFor(score);

  return { score, level, factors, nextReviewMonths: reviewMonths(level) };
}

// Stub determinista de screening (sin proveedor externo aún)
export function stubScreening(subjectName: string, curp?: string | null): PldScreeningInput[] {
  const seed = (curp ?? subjectName ?? "").toUpperCase();
  const hash = Array.from(seed).reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
  const bucket = Math.abs(hash) % 100;
  const lists: Array<PldScreeningInput["lista"]> = [
    "pep_nacional", "pep_internacional", "ofac", "onu", "adverse_media", "sat_69b",
  ];
  // 90% limpio, 8% débil, 2% fuerte — determinista por semilla
  const status: PldScreeningInput["status"] =
    bucket < 90 ? "limpio" : bucket < 98 ? "coincidencia_debil" : "coincidencia_fuerte";
  return lists.map(l => ({ lista: l, status }));
}
