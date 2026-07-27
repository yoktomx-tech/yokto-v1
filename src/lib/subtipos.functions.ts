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
