// Lógica pura para decidir si la cuenta bancaria pertenece al titular.
// No importa `supabase` ni env — se puede probar sin backend.

export type BankMatch = "EXACT" | "PARTIAL" | "NO_MATCH" | "MISSING";
export type BankDecision = "APPROVED" | "MANUAL_REVIEW" | "REJECTED";

export interface BankMatchResult {
  decision: BankDecision;
  name_similarity: number;
  rfc_curp_match: BankMatch;
  reasons: string[];
}

export function normalizeName(value: string): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(S\.?A\.? DE C\.?V\.?|S DE RL DE CV|S\.? DE R\.?L\.? DE C\.?V\.?|SAPI DE CV|SC|SRL)\b/gi, "")
    .replace(/[^A-Z0-9 ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

// Similaridad Jaro-Winkler simplificada + Levenshtein fallback.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

export function stringSimilarity(a: string, b: string): number {
  const A = normalizeName(a);
  const B = normalizeName(b);
  if (!A && !B) return 1;
  if (!A || !B) return 0;
  // Bag-of-tokens Jaccard + Levenshtein promedio, robusto a orden y typos.
  const setA = new Set(A.split(" ").filter(Boolean));
  const setB = new Set(B.split(" ").filter(Boolean));
  const inter = [...setA].filter((t) => setB.has(t)).length;
  const jaccard = inter / new Set([...setA, ...setB]).size;
  const lev = 1 - levenshtein(A, B) / Math.max(A.length, B.length);
  return Math.max(0, Math.min(1, jaccard * 0.5 + lev * 0.5));
}

export function decideBankAccountOwnership(params: {
  expectedName: string;
  expectedRfc?: string | null;
  expectedCurp?: string | null;
  receivedName?: string | null;
  receivedRfcCurp?: string | null;
}): BankMatchResult {
  const nameSimilarity = stringSimilarity(params.expectedName ?? "", params.receivedName ?? "");
  const expectedIds = [params.expectedRfc, params.expectedCurp]
    .filter((v): v is string => Boolean(v))
    .map((v) => v.toUpperCase());
  const receivedId = (params.receivedRfcCurp ?? "").toUpperCase();

  let rfcCurpMatch: BankMatch = "MISSING";
  if (receivedId) {
    rfcCurpMatch = expectedIds.includes(receivedId)
      ? "EXACT"
      : expectedIds.some((id) => id.slice(0, 10) === receivedId.slice(0, 10))
        ? "PARTIAL"
        : "NO_MATCH";
  }

  if (rfcCurpMatch === "EXACT" && nameSimilarity >= 0.85)
    return { decision: "APPROVED", name_similarity: nameSimilarity, rfc_curp_match: rfcCurpMatch, reasons: ["RFC/CURP coincide y el nombre tiene alta similitud"] };
  if (rfcCurpMatch === "EXACT" && nameSimilarity >= 0.65)
    return { decision: "MANUAL_REVIEW", name_similarity: nameSimilarity, rfc_curp_match: rfcCurpMatch, reasons: ["RFC/CURP coincide, pero el nombre requiere revisión manual"] };
  if (rfcCurpMatch === "MISSING" && nameSimilarity >= 0.9)
    return { decision: "MANUAL_REVIEW", name_similarity: nameSimilarity, rfc_curp_match: rfcCurpMatch, reasons: ["El nombre coincide, pero Verificamex no devolvió RFC/CURP"] };
  if (rfcCurpMatch === "PARTIAL" && nameSimilarity >= 0.75)
    return { decision: "MANUAL_REVIEW", name_similarity: nameSimilarity, rfc_curp_match: rfcCurpMatch, reasons: ["Coincidencia parcial de RFC/CURP"] };

  return { decision: "REJECTED", name_similarity: nameSimilarity, rfc_curp_match: rfcCurpMatch, reasons: ["Los datos bancarios no coinciden con el Perfil de Cumplimiento"] };
}

export function maskCLABE(clabe: string): string {
  const c = clabe.replace(/\s+/g, "");
  if (c.length !== 18) return c;
  return `${c.slice(0, 3)} ••• ••• ••• ••• ${c.slice(-4)}`;
}

export function maskCard(card: string): string {
  const c = card.replace(/\s+/g, "");
  if (c.length < 8) return c;
  return `${c.slice(0, 6)}${"•".repeat(Math.max(0, c.length - 10))}${c.slice(-4)}`;
}

export const STATUS_UI: Record<string, { label: string; bg: string; text: string }> = {
  DRAFT:            { label: "Sin validar",     bg: "bg-[#F4F4F7]", text: "text-[#52525B]" },
  LOCAL_VALIDATED:  { label: "Lista para validar", bg: "bg-[#F4F4F7]", text: "text-[#52525B]" },
  PENNY_CREATED:    { label: "Enviada",         bg: "bg-[#F0F9FF]", text: "text-[#0284C7]" },
  WAITING_RESULT:   { label: "En proceso",      bg: "bg-[#F0F9FF]", text: "text-[#0284C7]" },
  APPROVED:         { label: "Validada",        bg: "bg-[#ECFDF5]", text: "text-[#059669]" },
  MANUAL_REVIEW:    { label: "Revisión manual", bg: "bg-[#FFFBEB]", text: "text-[#D97706]" },
  REJECTED:         { label: "No validada",     bg: "bg-[#FEF2F2]", text: "text-[#DC2626]" },
  ERROR:            { label: "Error",           bg: "bg-[#FEF2F2]", text: "text-[#DC2626]" },
  EXPIRED:          { label: "Expirada",        bg: "bg-[#F4F4F7]", text: "text-[#52525B]" },
};

export function mapProviderStatus(providerStatus: string | null | undefined):
  "WAITING_RESULT" | "ERROR" | "PENNY_CREATED" {
  const s = (providerStatus ?? "").toUpperCase();
  if (s === "SPEI_WAITING") return "WAITING_RESULT";
  if (s === "ERROR" || s === "UNKNOWN") return "ERROR";
  return "PENNY_CREATED";
}
