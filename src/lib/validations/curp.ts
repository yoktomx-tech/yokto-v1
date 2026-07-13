// CURP — validador de estructura (18 chars).
const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;

export interface CurpCheck { valid: boolean; error?: string }

export function normalizeCurp(v: string): string {
  return v.replace(/\s+/g, "").toUpperCase();
}

export function validateCurp(input: string): CurpCheck {
  const curp = normalizeCurp(input);
  if (!curp) return { valid: false, error: "CURP requerido" };
  if (curp.length !== 18) return { valid: false, error: "La CURP debe tener 18 caracteres" };
  if (!CURP_REGEX.test(curp)) return { valid: false, error: "Formato de CURP inválido" };
  return { valid: true };
}
