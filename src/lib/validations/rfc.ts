// RFC (SAT México) — validador de estructura + palabras inconvenientes.
// No hace llamada a API SAT (queda como TODO cuando haya proveedor).

const RFC_PF = /^([A-ZÑ&]{4})(\d{2})(0[1-9]|1[012])(0[1-9]|[12]\d|3[01])([A-Z\d]{3})$/;
const RFC_PM = /^([A-ZÑ&]{3})(\d{2})(0[1-9]|1[012])(0[1-9]|[12]\d|3[01])([A-Z\d]{3})$/;

const PALABRAS_INCONVENIENTES = new Set([
  "BACA","BAKA","BUEI","BUEY","CACA","CACO","CAGA","CAGO","CAKA","CAKO",
  "COGE","COGI","COJA","COJE","COJI","COJO","COLA","CULO","FALO","FETO",
  "GETA","GUEI","GUEY","JETA","JOTO","KACA","KACO","KAGA","KAGO","KAKA",
  "KAKO","KOGE","KOGI","KOJA","KOJE","KOJI","KOJO","KOLA","KULO","LELO",
  "LOCA","LOCO","LOKA","LOKO","MAME","MAMO","MEAR","MEAS","MEON","MIAR",
  "MION","MOCO","MOKO","MULA","MULO","NACA","NACO","PEDA","PEDO","PENE",
  "PIPI","PITO","POPO","PUTA","PUTO","QULO","RATA","ROBA","ROBE","ROBO",
  "RUIN","SENO","TETA","VACA","VAGA","VAGO","VAKA","VUEI","VUEY","WUEI","WUEY",
]);

export type RfcTipo = "PF" | "PM";
export interface RfcCheck {
  valid: boolean;
  tipo: RfcTipo | null;
  error?: string;
}

export function normalizeRfc(v: string): string {
  return v.replace(/\s+/g, "").toUpperCase();
}

export function validateRfc(input: string, expected?: RfcTipo): RfcCheck {
  const rfc = normalizeRfc(input);
  if (!rfc) return { valid: false, tipo: null, error: "RFC requerido" };

  let tipo: RfcTipo | null = null;
  if (RFC_PF.test(rfc)) tipo = "PF";
  else if (RFC_PM.test(rfc)) tipo = "PM";

  if (!tipo) {
    if (rfc.length === 13) return { valid: false, tipo: "PF", error: "Formato de RFC persona física inválido" };
    if (rfc.length === 12) return { valid: false, tipo: "PM", error: "Formato de RFC persona moral inválido" };
    return { valid: false, tipo: null, error: "El RFC debe tener 12 (PM) o 13 (PF) caracteres" };
  }

  const prefix = tipo === "PF" ? rfc.substring(0, 4) : rfc.substring(0, 3);
  if (tipo === "PF" && PALABRAS_INCONVENIENTES.has(prefix)) {
    return { valid: false, tipo, error: "RFC inicia con palabra inconveniente (SAT)" };
  }

  if (expected && tipo !== expected) {
    return { valid: false, tipo, error: `Se esperaba RFC de ${expected === "PF" ? "persona física" : "persona moral"}` };
  }

  return { valid: true, tipo };
}
