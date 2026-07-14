import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Parse a CFDI 4.0 XML string and extract the fiscal identifiers.
 * Uses regex extraction (no XML DOM in the Worker runtime).
 * Sets sat_status = "not_verified" until SAT lookup is wired.
 */
function parseCfdi(xml: string) {
  const get = (attr: string, scope = xml) => {
    const m = scope.match(new RegExp(`${attr}\\s*=\\s*"([^"]+)"`));
    return m?.[1] ?? null;
  };
  // <cfdi:Comprobante ... Total="..." Fecha="...">
  const compMatch = xml.match(/<cfdi:Comprobante\b[^>]*>/i);
  const comp = compMatch?.[0] ?? "";
  // <cfdi:Emisor Rfc="..." />
  const emisorMatch = xml.match(/<cfdi:Emisor\b[^>]*>/i);
  const emisor = emisorMatch?.[0] ?? "";
  // <cfdi:Receptor Rfc="..." />
  const receptorMatch = xml.match(/<cfdi:Receptor\b[^>]*>/i);
  const receptor = receptorMatch?.[0] ?? "";
  // <tfd:TimbreFiscalDigital ... UUID="..." />
  const tfdMatch = xml.match(/<tfd:TimbreFiscalDigital\b[^>]*>/i);
  const tfd = tfdMatch?.[0] ?? "";

  const total = get("Total", comp);
  const fecha = get("Fecha", comp);
  const rfcEm = get("Rfc", emisor);
  const rfcRe = get("Rfc", receptor);
  const uuid = get("UUID", tfd);

  const totalCents = total ? Math.round(Number(total) * 100) : null;

  return {
    uuid: uuid,
    rfc_emisor: rfcEm,
    rfc_receptor: rfcRe,
    total_cents: totalCents,
    fecha: fecha ? new Date(fecha).toISOString() : null,
    ok: Boolean(uuid && rfcEm && rfcRe && total),
  };
}

export const validateCfdiDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: doc, error } = await supabase
      .from("transaction_documents")
      .select("*")
      .eq("id", data.documentId)
      .maybeSingle();
    if (error || !doc) throw new Error("Documento no encontrado");
    if (doc.doc_type !== "CFDI") throw new Error("El documento no es un CFDI");

    // Fetch XML from storage
    const { data: file, error: dlErr } = await supabase
      .storage.from("transaction-documents")
      .download(doc.file_path);
    if (dlErr || !file) throw new Error("No se pudo descargar el archivo");
    const xml = await file.text();
    const parsed = parseCfdi(xml);

    const patch = {
      cfdi_uuid: parsed.uuid,
      cfdi_rfc_emisor: parsed.rfc_emisor,
      cfdi_rfc_receptor: parsed.rfc_receptor,
      cfdi_total_cents: parsed.total_cents,
      cfdi_fecha: parsed.fecha,
      sat_status: parsed.ok ? "not_verified" : "error",
      sat_message: parsed.ok
        ? "CFDI parseado correctamente. Verificación con SAT pendiente de integración."
        : "No se pudieron extraer los datos fiscales del XML.",
      validated_at: new Date().toISOString(),
    };
    const { error: upErr } = await supabase
      .from("transaction_documents").update(patch).eq("id", doc.id);
    if (upErr) throw upErr;
    return { ...parsed, ok: parsed.ok };
  });
