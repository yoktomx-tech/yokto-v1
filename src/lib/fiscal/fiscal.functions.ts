import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseCFDI, flattenFirstPago } from "./cfdi-parser";
import { checkCFDICoherence, checkREPCoherence, scoreChecks, type CheckResult, type TxContext } from "./coherence";
import { consultarEstadoSAT } from "./sat-lookup";
import { aiJsonCall } from "../ai-gateway.server";


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
      actor_id: userId,
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

async function loadTxContext(supabase: any, transaction_id: string): Promise<TxContext> {
  const { data: tx, error } = await supabase
    .from("transactions")
    .select("id, numero, buyer_id, seller_id, amount_cents, currency, created_at")
    .eq("id", transaction_id)
    .single();
  if (error || !tx) throw new Error("Transacción no encontrada");
  const [buyer, seller] = await Promise.all([
    supabase.from("profiles").select("rfc, first_name, last_name").eq("id", tx.buyer_id).maybeSingle(),
    tx.seller_id
      ? supabase.from("profiles").select("rfc, first_name, last_name").eq("id", tx.seller_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    numero: tx.numero ?? "",
    buyer_rfc: buyer.data?.rfc ?? null,
    seller_rfc: seller.data?.rfc ?? null,
    buyer_nombre: [buyer.data?.first_name, buyer.data?.last_name].filter(Boolean).join(" ") || null,
    seller_nombre: [seller.data?.first_name, seller.data?.last_name].filter(Boolean).join(" ") || null,
    monto_total: Number(tx.amount_cents ?? 0) / 100,
    moneda: tx.currency ?? "MXN",
    fecha_creacion: tx.created_at,
  };
}

/**
 * Corre coherencia + SAT + IA para un documento fiscal ya subido.
 */
export const validateFiscalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ fiscal_document_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: doc, error } = await supabase
      .from("fiscal_documents")
      .select("*")
      .eq("id", data.fiscal_document_id)
      .single();
    if (error || !doc) throw new Error("Documento fiscal no encontrado");

    // Verificar parte
    const { data: tx } = await supabase
      .from("transactions")
      .select("buyer_id, seller_id")
      .eq("id", doc.transaction_id)
      .single();
    if (!tx || (tx.buyer_id !== userId && tx.seller_id !== userId)) {
      throw new Error("No autorizado");
    }

    await supabase.from("fiscal_documents").update({ estado: "VALIDANDO" }).eq("id", doc.id);

    // Re-descargar el XML para re-parsear con estructura completa
    const { data: file, error: dlErr } = await supabase.storage
      .from("transaction-documents")
      .download(doc.xml_url);
    if (dlErr || !file) throw new Error("No se pudo leer el XML almacenado");
    const xml = await file.text();
    const parsed = parseCFDI(xml);

    const txCtx = await loadTxContext(supabase, doc.transaction_id);

    let checks: CheckResult[] = [];
    if (parsed.tipo === "REP") {
      const parentFlat = flattenFirstPago(parsed);
      let cfdiPadre = null as any;
      let totalPagadoPrevio = 0;
      if (parentFlat.parent_uuid) {
        const { data: p } = await supabase
          .from("fiscal_documents")
          .select("*")
          .eq("uuid_fiscal", parentFlat.parent_uuid)
          .maybeSingle();
        if (p) {
          cfdiPadre = { total: Number(p.total ?? 0), uuid_fiscal: p.uuid_fiscal, tipo: p.tipo } as any;
          const { data: prevReps } = await supabase
            .from("fiscal_documents")
            .select("imp_pagado, estado")
            .eq("parent_cfdi_id", p.id)
            .neq("id", doc.id);
          totalPagadoPrevio = (prevReps ?? [])
            .filter((r: any) => r.estado !== "RECHAZADO" && r.estado !== "CANCELADO_SAT")
            .reduce((acc: number, r: any) => acc + Number(r.imp_pagado ?? 0), 0);
        }
      }
      checks = checkREPCoherence(parsed, cfdiPadre, txCtx, totalPagadoPrevio);
    } else {
      checks = checkCFDICoherence(parsed, txCtx);
    }

    const score = scoreChecks(checks);
    const errors = checks.filter((c) => !c.ok && c.severity === "error");
    const warnings = checks.filter((c) => !c.ok && c.severity === "warning");

    // Consulta SAT
    const sat = await consultarEstadoSAT({
      uuid: parsed.uuid_fiscal ?? "",
      rfc_emisor: parsed.rfc_emisor ?? "",
      rfc_receptor: parsed.rfc_receptor ?? "",
      total: parsed.total ?? 0,
    });

    // Análisis IA (resumen ejecutivo)
    let ai_analysis: any = null;
    try {
      ai_analysis = await aiJsonCall<{
        resumen: string;
        semaforo: "verde" | "amarillo" | "rojo";
        recomendacion: "aceptar" | "revisar" | "rechazar";
        puntos_atencion: string[];
      }>({
        provider: "gemini",
        messages: [
          {
            role: "system",
            content:
              "Eres un contador fiscal mexicano experto en CFDI 4.0 y Complemento de Pago 2.0. Analiza el documento y responde SOLO JSON con { resumen, semaforo (verde|amarillo|rojo), recomendacion (aceptar|revisar|rechazar), puntos_atencion: string[] }.",
          },
          {
            role: "user",
            content: JSON.stringify({
              tipo: parsed.tipo,
              cfdi_summary: {
                uuid: parsed.uuid_fiscal,
                total: parsed.total,
                moneda: parsed.moneda,
                metodo_pago: parsed.metodo_pago,
                forma_pago: parsed.forma_pago,
                uso_cfdi: parsed.uso_cfdi,
                rfc_emisor: parsed.rfc_emisor,
                rfc_receptor: parsed.rfc_receptor,
                fecha_emision: parsed.fecha_emision,
              },
              transaccion: txCtx,
              checks: checks.map((c) => ({ code: c.code, ok: c.ok, severity: c.severity, message: c.message })),
              score,
              sat_estado: sat.estado,
            }),
          },
        ],
      });
    } catch (e: any) {
      ai_analysis = { error: e?.message ?? "IA no disponible" };
    }

    const nuevoEstado = errors.length > 0 ? "SUBIDO" : "VALIDADO";

    const { data: updated, error: updErr } = await supabase
      .from("fiscal_documents")
      .update({
        estado: nuevoEstado,
        coherence_checks: checks as any,
        coherence_score: score,
        validation_errors: errors as any,
        validation_warnings: warnings as any,
        ai_analysis: ai_analysis as any,
        estado_sat: sat.estado,
        fecha_consulta_sat: sat.consultado_at,
      })
      .eq("id", doc.id)
      .select("*")
      .single();
    if (updErr) throw updErr;

    await supabase.from("transaction_events").insert({
      transaction_id: doc.transaction_id,
      actor_id: userId,
      event_type: "fiscal_document_validated",
      metadata: { fiscal_document_id: doc.id, score, errores: errors.length, advertencias: warnings.length },
    });

    return updated;
  });

/**
 * Devuelve el estado de parcialidades para un CFDI PPD (y sus REP asociados).
 */
export const getEstadoParcialidades = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ cfdi_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cfdi, error } = await supabase
      .from("fiscal_documents")
      .select("id, uuid_fiscal, total, tipo, transaction_id")
      .eq("id", data.cfdi_id)
      .single();
    if (error || !cfdi) throw new Error("CFDI no encontrado");
    if (cfdi.tipo !== "CFDI_PPD") throw new Error("Solo CFDIs PPD tienen parcialidades");

    const { data: reps } = await supabase
      .from("fiscal_documents")
      .select("id, uuid_fiscal, parcialidad_numero, fecha_pago, imp_pagado, imp_saldo_ant, imp_saldo_insoluto, estado")
      .eq("parent_cfdi_id", cfdi.id)
      .order("parcialidad_numero", { ascending: true });

    const { buildEstadoParcialidades } = await import("./parcialidades");
    return buildEstadoParcialidades(
      { id: cfdi.id, uuid_fiscal: cfdi.uuid_fiscal, total: Number(cfdi.total ?? 0) },
      (reps ?? []) as any
    );
  });

/**
 * Devuelve instrucciones textuales para emitir el próximo REP contra un CFDI PPD.
 */
export const getInstruccionesREP = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ cfdi_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cfdi } = await supabase
      .from("fiscal_documents")
      .select("*")
      .eq("id", data.cfdi_id)
      .single();
    if (!cfdi) throw new Error("CFDI no encontrado");

    const { data: reps } = await supabase
      .from("fiscal_documents")
      .select("imp_pagado, parcialidad_numero, estado")
      .eq("parent_cfdi_id", cfdi.id);
    const activos = (reps ?? []).filter((r: any) => r.estado !== "RECHAZADO");
    const totalPagado = activos.reduce((a: number, r: any) => a + Number(r.imp_pagado ?? 0), 0);
    const totalCfdi = Number(cfdi.total ?? 0);
    const saldoAnt = Math.max(0, totalCfdi - totalPagado);
    const proxParcialidad = activos.length + 1;

    return {
      uuid_padre: cfdi.uuid_fiscal,
      serie_folio: [cfdi.serie, cfdi.folio].filter(Boolean).join("-"),
      rfc_emisor: cfdi.rfc_emisor,
      rfc_receptor: cfdi.rfc_receptor,
      moneda: cfdi.moneda ?? "MXN",
      parcialidad_numero: proxParcialidad,
      imp_saldo_ant: saldoAnt,
      imp_saldo_insoluto: 0,
      total_cfdi: totalCfdi,
      total_pagado: totalPagado,
      instrucciones: [
        "Emite un Complemento de Pago 2.0 (REP) en tu PAC/facturador.",
        `Referencia al CFDI padre UUID: ${cfdi.uuid_fiscal}`,
        `Número de parcialidad: ${proxParcialidad}`,
        `ImpSaldoAnt debe ser: ${saldoAnt.toFixed(2)} ${cfdi.moneda ?? "MXN"}`,
        "ImpPagado = monto realmente cobrado en esta parcialidad",
        "ImpSaldoInsoluto = ImpSaldoAnt - ImpPagado",
        "FechaPago = fecha real en que recibiste el pago",
      ],
    };
  });
