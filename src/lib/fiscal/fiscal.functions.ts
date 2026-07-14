import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseCFDI, flattenFirstPago } from "./cfdi-parser";

const UploadInput = z.object({
  transaction_id: z.string().uuid(),
  hito_id: z.string().uuid().optional().nullable(),
  file_name: z.string().min(1),
  xml_base64: z.string().min(20),
});

async function sha256Hex(input: string) {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Sube un XML (CFDI PPD / PUE / REP), lo parsea y crea un registro
 * en fiscal_documents con estado SUBIDO. Las validaciones de coherencia
 * y SAT se disparan en fase 2.
 */
export const uploadFiscalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => UploadInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verificar que el usuario es parte de la transacción
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("id, buyer_id, seller_id, numero")
      .eq("id", data.transaction_id)
      .maybeSingle();
    if (txErr) throw txErr;
    if (!tx) throw new Error("Transacción no encontrada");
    if (tx.buyer_id !== userId && tx.seller_id !== userId) {
      throw new Error("No autorizado sobre esta transacción");
    }

    // Decode + parse
    const xml = atob(data.xml_base64);
    let parsed;
    try {
      parsed = parseCFDI(xml);
    } catch (e: any) {
      throw new Error(`XML inválido: ${e?.message ?? "no se pudo parsear"}`);
    }

    if (!parsed.uuid_fiscal) {
      throw new Error("El XML no contiene TimbreFiscalDigital (UUID)");
    }

    // Duplicado?
    const { data: dup } = await supabase
      .from("fiscal_documents")
      .select("id")
      .eq("uuid_fiscal", parsed.uuid_fiscal)
      .maybeSingle();
    if (dup) throw new Error("Este CFDI ya fue registrado previamente");

    const xml_hash = await sha256Hex(xml);

    // Subir XML a storage
    const path = `fiscal/${data.transaction_id}/${parsed.uuid_fiscal}.xml`;
    const bytes = Uint8Array.from(xml, (c) => c.charCodeAt(0));
    const { error: upErr } = await supabase.storage
      .from("transaction-documents")
      .upload(path, bytes, {
        contentType: "application/xml",
        upsert: true,
      });
    if (upErr) throw upErr;

    // Datos REP aplanados
    const rep = parsed.tipo === "REP" ? flattenFirstPago(parsed) : null;

    // Buscar CFDI padre si es REP
    let parent_cfdi_id: string | null = null;
    if (rep?.parent_uuid) {
      const { data: parent } = await supabase
        .from("fiscal_documents")
        .select("id")
        .eq("uuid_fiscal", rep.parent_uuid)
        .maybeSingle();
      parent_cfdi_id = parent?.id ?? null;
    }

    const insertRow = {
      transaction_id: data.transaction_id,
      hito_id: data.hito_id ?? null,
      parent_cfdi_id,
      tipo: parsed.tipo,
      metodo_pago: parsed.metodo_pago ?? null,
      forma_pago: parsed.forma_pago ?? rep?.forma_pago ?? null,
      uso_cfdi: parsed.uso_cfdi ?? null,
      uuid_fiscal: parsed.uuid_fiscal,
      serie: parsed.serie ?? null,
      folio: parsed.folio ?? null,
      fecha_emision: parsed.fecha_emision ?? null,
      fecha_timbrado: parsed.fecha_timbrado ?? null,
      no_certificado_sat: parsed.no_certificado_sat ?? null,
      no_certificado_emisor: parsed.no_certificado_emisor ?? null,
      sello_cfd: parsed.sello_cfd ?? null,
      sello_sat: parsed.sello_sat ?? null,
      rfc_emisor: parsed.rfc_emisor ?? null,
      nombre_emisor: parsed.nombre_emisor ?? null,
      regimen_fiscal_emisor: parsed.regimen_fiscal_emisor ?? null,
      rfc_receptor: parsed.rfc_receptor ?? null,
      nombre_receptor: parsed.nombre_receptor ?? null,
      regimen_fiscal_receptor: parsed.regimen_fiscal_receptor ?? null,
      domicilio_fiscal_receptor: parsed.domicilio_fiscal_receptor ?? null,
      subtotal: parsed.subtotal ?? null,
      descuento: parsed.descuento ?? 0,
      total: parsed.total ?? rep?.imp_pagado ?? null,
      moneda: parsed.moneda ?? "MXN",
      tipo_cambio: parsed.tipo_cambio ?? null,
      total_impuestos_trasladados: parsed.total_impuestos_trasladados ?? 0,
      total_impuestos_retenidos: parsed.total_impuestos_retenidos ?? 0,
      rep_data: parsed.tipo === "REP" ? (JSON.parse(JSON.stringify({ pagos: parsed.pagos ?? [] })) as any) : null,
      parcialidad_numero: rep?.parcialidad_numero ?? null,
      imp_saldo_ant: rep?.imp_saldo_ant ?? null,
      imp_pagado: rep?.imp_pagado ?? null,
      imp_saldo_insoluto: rep?.imp_saldo_insoluto ?? null,
      fecha_pago: rep?.fecha_pago ?? null,
      xml_url: path,
      xml_hash,
      estado: "SUBIDO",
      estado_sat: "pendiente_verificacion",
      uploaded_by: userId,
    };

    const { data: inserted, error: insErr } = await supabase
      .from("fiscal_documents")
      .insert(insertRow)
      .select("id, tipo, uuid_fiscal, estado")
      .single();
    if (insErr) throw insErr;

    // Evento en la transacción
    await supabase.from("transaction_events").insert({
      transaction_id: data.transaction_id,
      user_id: userId,
      event_type: "fiscal_document_uploaded",
      metadata: {
        fiscal_document_id: inserted.id,
        tipo: parsed.tipo,
        uuid: parsed.uuid_fiscal,
        file_name: data.file_name,
      },
    });

    return inserted;
  });

/**
 * Lista los documentos fiscales de una transacción.
 */
export const listFiscalDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ transaction_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: docs, error } = await supabase
      .from("fiscal_documents")
      .select("*")
      .eq("transaction_id", data.transaction_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return docs ?? [];
  });
