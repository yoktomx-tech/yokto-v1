// CLABE (18 dígitos) — dígito verificador + catálogo de bancos.

export const BANCO_CODES: Record<string, string> = {
  "002":"BBVA Bancomer","006":"Bancomext","009":"Banobras","012":"BBVA Bancomer",
  "014":"Santander","021":"HSBC","030":"Bajío","032":"IXE","036":"Inbursa",
  "037":"Multiva","042":"Mifel","044":"Scotiabank","058":"Banregio","059":"Invex",
  "060":"Bansi","062":"Afirme","072":"Banorte","102":"ABN AMRO","103":"American Express",
  "106":"BAMSA","108":"Bank of Tokyo","110":"JP Morgan","112":"Bansí","113":"Ve por Más",
  "116":"ING","124":"Deutsche","126":"Credit Suisse","127":"Azteca","128":"Autofin",
  "129":"Barclays","130":"Compartamos","132":"Multiva CB","133":"Actinver","134":"Walmart",
  "135":"Nafin","136":"Interbanco","137":"HDI Seguros","138":"ASP Integra","139":"Ixe Automotriz",
  "140":"Consubanco","141":"Volkswagen","143":"CIBanco","145":"BBase","147":"Bankaool",
  "148":"PagaTodo","149":"Inmobiliario Mexicano","155":"ICBC","156":"Sabadell","166":"BaBien",
  "168":"Hipotecaria Federal","600":"Monex CB","601":"GBM","602":"Masari","605":"Valué",
  "606":"Fondivisa","607":"Base","608":"Fincomún","610":"Bursametrik","617":"Chadw",
  "618":"Única","619":"Mapfre","620":"Profuturo","621":"CB JP Morgan","622":"Oactín",
  "623":"Hahnbank","626":"CB Deutsche","627":"Zurichvi","628":"Sustemex","629":"Evercore",
  "630":"CB Actinver","631":"Interacciones","632":"Akala","633":"CB JP Morgan","634":"Finpatria",
  "637":"Order","638":"Akala","640":"CB JP Morgan","642":"OBMX","646":"STP",
  "648":"Evercore","649":"Inmobiliario MX","651":"Segmenta","652":"Asea","653":"Kuspit",
  "655":"Sofiexpress","656":"Unagra","659":"ASP Integra OPC","670":"Libertad","674":"AXA",
  "677":"Caja Pop Mexicana","679":"FND","684":"Transfer","685":"Fondo FIRA","686":"Invercap",
  "689":"Farch","699":"Fondeadora","706":"Arcus","710":"Telecomm","722":"Mercado Pago",
  "723":"Cuenca","728":"Spin by OXXO","730":"Nvio","732":"Caja Pop","733":"Caja Telefonistas",
  "734":"Transfero","735":"Cuenca","736":"HDI Fondos","737":"Transfer","738":"Nvio",
  "742":"Accendino","743":"Del Ejército","745":"Bimbo","746":"STP","748":"Bienestar",
  "749":"Inmobiliario","760":"Caja Pop","761":"Fincomún","899":"Chivo","901":"CoDi Valida","902":"Tran",
};

const PESOS = [3,7,1,3,7,1,3,7,1,3,7,1,3,7,1,3,7];

export function normalizeClabe(v: string): string {
  return v.replace(/\s+/g, "");
}

export interface ClabeCheck {
  valid: boolean;
  banco?: string;
  bancoCode?: string;
  error?: string;
}

export function validateClabe(input: string): ClabeCheck {
  const clabe = normalizeClabe(input);
  if (!clabe) return { valid: false, error: "CLABE requerida" };
  if (!/^\d{18}$/.test(clabe)) return { valid: false, error: "La CLABE debe tener 18 dígitos" };

  let suma = 0;
  for (let i = 0; i < 17; i++) suma += parseInt(clabe[i], 10) * PESOS[i];
  const dv = (10 - (suma % 10)) % 10;
  if (dv !== parseInt(clabe[17], 10)) {
    return { valid: false, error: "Dígito verificador inválido (CLABE incorrecta)" };
  }
  const bancoCode = clabe.substring(0, 3);
  const banco = BANCO_CODES[bancoCode] ?? "Banco no reconocido";
  return { valid: true, banco, bancoCode };
}

export function getBanco(clabe: string): string | null {
  const c = normalizeClabe(clabe);
  if (c.length < 3) return null;
  return BANCO_CODES[c.substring(0, 3)] ?? null;
}
