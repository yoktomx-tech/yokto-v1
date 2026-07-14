// SAT lookup stub — la consulta real usa el WS de SAT (SOAP) que no está
// disponible en el runtime Worker sin un cliente SOAP dedicado. Aquí
// dejamos un stub que marca "pendiente_verificacion" para que el resto
// de la validación siga funcionando.

export type EstadoSAT = "vigente" | "cancelado" | "no_encontrado" | "pendiente_verificacion" | "error";

export interface ConsultaSATResult {
  estado: EstadoSAT;
  consultado_at: string;
  detalle?: string;
}

/**
 * TODO: integrar https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc
 * (SOAP) mediante un cliente HTTP + XML manual o proveedor tercero (Facturama, SW Sapien, etc.).
 * Por ahora retornamos "pendiente_verificacion".
 */
export async function consultarEstadoSAT(_params: {
  uuid: string;
  rfc_emisor: string;
  rfc_receptor: string;
  total: number;
}): Promise<ConsultaSATResult> {
  return {
    estado: "pendiente_verificacion",
    consultado_at: new Date().toISOString(),
    detalle: "Integración SAT SOAP pendiente. Se validó estructura, sellos y coherencia.",
  };
}
