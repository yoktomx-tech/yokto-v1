import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  resolveFileRule,
  type CatalogoDoc,
  type FileProfile,
  type HitoDocRequirement,
  type ResolvedFileRule,
} from "./document-file-rules";

/** Lista sectores activos. */
export const listSectores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sectores_operacion")
      .select("id, codigo, nombre, duracion_tipica, monto_tipico, solo_spei, repse_requerido, inspeccion_fisica, notas")
      .eq("activo", true)
      .order("id");
    if (error) throw error;
    return data ?? [];
  });

/** Lista subtipos disponibles (defaults + de la organización actual, si aplica). */
export const listSubtiposBySector = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        sectorId: z.number().int(),
        orgId: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("subtipos_operacion")
      .select(
        "id, sector_id, codigo, nombre, duracion_sugerida_dias, is_default, is_editable, parent_subtipo_id, org_id",
      )
      .eq("sector_id", data.sectorId)
      .eq("activo", true)
      .order("codigo");
    if (error) throw error;
    return (rows ?? []).filter(
      (r) => r.is_default || (data.orgId && r.org_id === data.orgId),
    );
  });

/** Devuelve los hitos (con documentos y condiciones + reglas resueltas) de un subtipo. */
export const getSubtipoBlueprint = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ subtipoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [{ data: subtipo, error: eSub }, { data: hitos, error: eH }, { data: profiles, error: eP }] =
      await Promise.all([
        supabase
          .from("subtipos_operacion")
          .select("*")
          .eq("id", data.subtipoId)
          .maybeSingle(),
        supabase
          .from("hito_templates")
          .select("*")
          .eq("subtipo_id", data.subtipoId)
          .order("numero"),
        supabase.from("document_file_profiles").select("*"),
      ]);
    if (eSub) throw eSub;
    if (!subtipo) throw new Error("Subtipo no encontrado");
    if (eH) throw eH;
    if (eP) throw eP;

    const profilesMap: Record<string, FileProfile> = {};
    for (const p of profiles ?? []) profilesMap[p.file_profile_code] = p as FileProfile;

    const hitoIds = (hitos ?? []).map((h) => h.id);
    let docs: any[] = [];
    let conds: any[] = [];
    let catalogo: CatalogoDoc[] = [];

    if (hitoIds.length > 0) {
      const [{ data: dRes, error: eD }, { data: cRes, error: eC }] = await Promise.all([
        supabase.from("hito_template_documentos").select("*").in("hito_template_id", hitoIds),
        supabase.from("hito_template_condiciones").select("*").in("hito_template_id", hitoIds).order("orden"),
      ]);
      if (eD) throw eD;
      if (eC) throw eC;
      docs = dRes ?? [];
      conds = cRes ?? [];
      const codes = Array.from(new Set(docs.map((d: any) => d.documento_codigo)));
      if (codes.length > 0) {
        const { data: cat, error: eCat } = await supabase
          .from("documentos_catalogo")
          .select("*")
          .in("documento_codigo", codes);
        if (eCat) throw eCat;
        catalogo = (cat ?? []) as CatalogoDoc[];
      }
    }

    const catMap: Record<string, CatalogoDoc> = {};
    for (const c of catalogo) catMap[c.documento_codigo] = c;

    const hitosOut = (hitos ?? []).map((h: any) => {
      const hDocs = docs.filter((d) => d.hito_template_id === h.id);
      const hConds = conds.filter((c) => c.hito_template_id === h.id);
      const resolved: ResolvedFileRule[] = hDocs
        .map((d) => {
          const cat = catMap[d.documento_codigo];
          if (!cat) return null;
          try {
            return resolveFileRule(d as HitoDocRequirement, cat, profilesMap);
          } catch {
            return null;
          }
        })
        .filter(Boolean) as ResolvedFileRule[];
      return { ...h, documentos: resolved, condiciones: hConds };
    });

    return { subtipo, hitos: hitosOut };
  });

/** Mapeo de SectorId del frontend al `codigo` en la tabla `sectores_operacion`. */
export const SECTOR_CODE_MAP: Record<string, string> = {
  AUTOTRANSPORTE: "AUTOTRANSPORTE",
  CONSTRUCCION: "CONSTRUCCION",
  VEHICULOS: "VEHICULOS",
  SERVICIOS: "SERVICIOS",
  INMOBILIARIO: "INMOBILIARIO",
  COMERCIO_GENERAL: "COMERCIO_GENERAL",
};

/**
 * Toma un subtipo y una transacción existente y "congela" los requisitos
 * documentales por hito en `transaction_milestone_document_requirements`.
 * Empareja hitos por posición (orden ↔ numero).
 */
export const snapshotRequirementsForTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      transaction_id: z.string().uuid(),
      subtipo_id: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Ownership guard
    const { data: tx, error: eTx } = await supabase
      .from("transactions")
      .select("id, creado_por")
      .eq("id", data.transaction_id)
      .maybeSingle();
    if (eTx) throw new Error(eTx.message);
    if (!tx || tx.creado_por !== userId) throw new Error("Operación no encontrada");

    // Blueprint + hitos reales
    const [{ data: templates, error: eT }, { data: txHitos, error: eH }, { data: profiles, error: eP }] =
      await Promise.all([
        supabase
          .from("hito_templates")
          .select("id, numero")
          .eq("subtipo_id", data.subtipo_id)
          .order("numero"),
        supabase
          .from("transaction_hitos")
          .select("id, orden")
          .eq("transaction_id", data.transaction_id)
          .order("orden"),
        supabase.from("document_file_profiles").select("*"),
      ]);
    if (eT) throw new Error(eT.message);
    if (eH) throw new Error(eH.message);
    if (eP) throw new Error(eP.message);
    if (!templates?.length || !txHitos?.length) {
      return { inserted: 0, skipped: "no_hitos" as const };
    }

    const profilesMap: Record<string, FileProfile> = {};
    for (const p of profiles ?? []) profilesMap[p.file_profile_code] = p as FileProfile;

    const templateIds = templates.map((t) => t.id);
    const [{ data: docReqs, error: eD }] = await Promise.all([
      supabase.from("hito_template_documentos").select("*").in("hito_template_id", templateIds),
    ]);
    if (eD) throw new Error(eD.message);

    const codes = Array.from(new Set((docReqs ?? []).map((d: any) => d.documento_codigo)));
    let catalogo: CatalogoDoc[] = [];
    if (codes.length) {
      const { data: cat, error: eCat } = await supabase
        .from("documentos_catalogo")
        .select("*")
        .in("documento_codigo", codes);
      if (eCat) throw new Error(eCat.message);
      catalogo = (cat ?? []) as CatalogoDoc[];
    }
    const catMap: Record<string, CatalogoDoc> = {};
    for (const c of catalogo) catMap[c.documento_codigo] = c;

    // Reemplazar snapshot previo
    await supabase
      .from("transaction_milestone_document_requirements")
      .delete()
      .eq("transaction_id", data.transaction_id);

    const rows: any[] = [];
    const n = Math.min(templates.length, txHitos.length);
    for (let i = 0; i < n; i++) {
      const template = templates[i];
      const hito = txHitos[i];
      const templateDocs = (docReqs ?? []).filter((d: any) => d.hito_template_id === template.id);
      for (const d of templateDocs) {
        const cat = catMap[d.documento_codigo];
        if (!cat) continue;
        let rule: ResolvedFileRule;
        try {
          rule = resolveFileRule(d as HitoDocRequirement, cat, profilesMap);
        } catch { continue; }
        rows.push({
          transaction_id: data.transaction_id,
          hito_id: hito.id,
          template_document_id: d.id,
          documento_codigo: rule.documento_codigo,
          nombre_referencia: rule.nombre_referencia,
          categoria: rule.categoria,
          detalle_especifico: rule.detalle_especifico,
          allowed_extensions: rule.allowed_extensions,
          allowed_mime_types: rule.allowed_mime_types,
          min_files: rule.min_files,
          max_files: rule.max_files,
          max_file_size_mb: rule.max_file_size_mb,
          requires_ocr: rule.requires_ocr,
          requires_xml_parse: rule.requires_xml_parse,
          requires_sat_validation: rule.requires_sat_validation,
          requires_image_analysis: rule.requires_image_analysis,
          requires_gps_metadata: rule.requires_gps_metadata,
          requires_signature_validation: rule.requires_signature_validation,
          requires_hash: rule.requires_hash,
          requires_virus_scan: rule.requires_virus_scan,
          capture_mode: rule.capture_mode,
          validation_engine: rule.validation_engine,
        });
      }
    }

    if (rows.length) {
      const { error: eIns } = await supabase
        .from("transaction_milestone_document_requirements")
        .insert(rows);
      if (eIns) throw new Error(eIns.message);
    }
    return { inserted: rows.length };
  });
