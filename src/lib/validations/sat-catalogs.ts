// Catálogos SAT — subconjunto suficiente para onboarding.

export const REGIMEN_FISICA: Array<{ code: string; label: string }> = [
  { code: "605", label: "605 · Sueldos y salarios e ingresos asimilados" },
  { code: "606", label: "606 · Arrendamiento" },
  { code: "608", label: "608 · Demás ingresos" },
  { code: "612", label: "612 · Actividades empresariales y profesionales" },
  { code: "621", label: "621 · Incorporación fiscal" },
  { code: "625", label: "625 · Plataformas tecnológicas" },
  { code: "626", label: "626 · RESICO — Régimen simplificado de confianza" },
];

export const REGIMEN_MORAL: Array<{ code: string; label: string }> = [
  { code: "601", label: "601 · General de Ley Personas Morales" },
  { code: "603", label: "603 · Personas Morales con fines no lucrativos" },
  { code: "620", label: "620 · Sociedades cooperativas de producción" },
  { code: "622", label: "622 · Actividades agrícolas, ganaderas, silvícolas y pesqueras" },
  { code: "623", label: "623 · Opcional para grupos de sociedades" },
  { code: "624", label: "624 · Coordinados" },
  { code: "628", label: "628 · Hidrocarburos" },
  { code: "630", label: "630 · Enajenación de acciones en bolsa de valores" },
];

export const USO_CFDI: Array<{ code: string; label: string }> = [
  { code: "G01", label: "G01 · Adquisición de mercancías" },
  { code: "G02", label: "G02 · Devoluciones, descuentos o bonificaciones" },
  { code: "G03", label: "G03 · Gastos en general" },
  { code: "I01", label: "I01 · Construcciones" },
  { code: "I04", label: "I04 · Equipo de cómputo y accesorios" },
  { code: "I08", label: "I08 · Otra maquinaria y equipo" },
  { code: "P01", label: "P01 · Por definir" },
  { code: "S01", label: "S01 · Sin efectos fiscales" },
  { code: "CP01", label: "CP01 · Pagos" },
];

export const ESTADOS_MX: string[] = [
  "Aguascalientes","Baja California","Baja California Sur","Campeche","Chiapas",
  "Chihuahua","Ciudad de México","Coahuila","Colima","Durango","Estado de México",
  "Guanajuato","Guerrero","Hidalgo","Jalisco","Michoacán","Morelos","Nayarit",
  "Nuevo León","Oaxaca","Puebla","Querétaro","Quintana Roo","San Luis Potosí",
  "Sinaloa","Sonora","Tabasco","Tamaulipas","Tlaxcala","Veracruz","Yucatán","Zacatecas",
];
