/**
 * Reglas resueltas de archivo para un documento de un hito.
 * Cascada de precedencia (mayor gana):
 *   1) Override en hito_template_documentos (Requisito específico)
 *   2) Override en documentos_catalogo (Catálogo)
 *   3) document_file_profiles (Perfil base)
 */
export type FileProfile = {
  file_profile_code: string;
  label: string;
  allowed_extensions: string[];
  allowed_mime_types: string[];
  min_files: number;
  max_files: number;
  max_file_size_mb: number;
  requires_ocr: boolean;
  requires_xml_parse: boolean;
  requires_sat_validation: boolean;
  requires_image_analysis: boolean;
  requires_gps_metadata: boolean;
  requires_signature_validation: boolean;
  requires_hash: boolean;
  requires_virus_scan: boolean;
  capture_mode: string;
  validation_engine: string;
};

export type CatalogoDoc = {
  documento_codigo: string;
  nombre_referencia: string;
  descripcion: string | null;
  es_propuesto: boolean;
  file_profile_code: string | null;
  allowed_extensions_override: string[] | null;
  allowed_mime_types_override: string[] | null;
  max_file_size_mb_override: number | null;
  min_files_override: number | null;
  max_files_override: number | null;
  validation_engine_override: string | null;
};

export type HitoDocRequirement = {
  documento_codigo: string;
  categoria: "OBLIGATORIO" | "OPCIONAL" | "CONDICIONAL" | string;
  detalle_especifico: string | null;
  file_profile_code_override: string | null;
  allowed_extensions_override: string[] | null;
  allowed_mime_types_override: string[] | null;
  min_files: number | null;
  max_files: number | null;
  max_file_size_mb: number | null;
  requires_geotag: boolean | null;
  requires_timestamp: boolean | null;
  requires_signature: boolean | null;
  requires_sat_validation: boolean | null;
  validation_engine_override: string | null;
};

export type ResolvedFileRule = {
  documento_codigo: string;
  nombre_referencia: string;
  categoria: string;
  detalle_especifico: string | null;
  allowed_extensions: string[];
  allowed_mime_types: string[];
  min_files: number;
  max_files: number;
  max_file_size_mb: number;
  requires_ocr: boolean;
  requires_xml_parse: boolean;
  requires_sat_validation: boolean;
  requires_image_analysis: boolean;
  requires_gps_metadata: boolean;
  requires_signature_validation: boolean;
  requires_hash: boolean;
  requires_virus_scan: boolean;
  capture_mode: string;
  validation_engine: string;
};

const uniqLower = (arr: (string | null | undefined)[]) =>
  Array.from(new Set(arr.filter(Boolean).map((s) => (s as string).toLowerCase())));

export function resolveFileRule(
  req: HitoDocRequirement,
  cat: CatalogoDoc,
  profiles: Record<string, FileProfile>,
): ResolvedFileRule {
  const profileCode = req.file_profile_code_override ?? cat.file_profile_code ?? "GENERIC_DOCUMENT";
  const profile = profiles[profileCode];
  if (!profile) {
    throw new Error(`Perfil de archivo no encontrado: ${profileCode}`);
  }

  const allowed_extensions = uniqLower(
    req.allowed_extensions_override ??
      cat.allowed_extensions_override ??
      profile.allowed_extensions,
  );
  const allowed_mime_types = uniqLower(
    req.allowed_mime_types_override ??
      cat.allowed_mime_types_override ??
      profile.allowed_mime_types,
  );

  return {
    documento_codigo: cat.documento_codigo,
    nombre_referencia: cat.nombre_referencia,
    categoria: req.categoria ?? "OBLIGATORIO",
    detalle_especifico: req.detalle_especifico,
    allowed_extensions,
    allowed_mime_types,
    min_files: req.min_files ?? cat.min_files_override ?? profile.min_files,
    max_files: req.max_files ?? cat.max_files_override ?? profile.max_files,
    max_file_size_mb:
      req.max_file_size_mb ?? cat.max_file_size_mb_override ?? profile.max_file_size_mb,
    requires_ocr: profile.requires_ocr,
    requires_xml_parse: profile.requires_xml_parse,
    requires_sat_validation:
      (req.requires_sat_validation ?? false) || profile.requires_sat_validation,
    requires_image_analysis: profile.requires_image_analysis,
    requires_gps_metadata: (req.requires_geotag ?? false) || profile.requires_gps_metadata,
    requires_signature_validation:
      (req.requires_signature ?? false) || profile.requires_signature_validation,
    requires_hash: profile.requires_hash,
    requires_virus_scan: profile.requires_virus_scan,
    capture_mode: profile.capture_mode,
    validation_engine:
      req.validation_engine_override ??
      cat.validation_engine_override ??
      profile.validation_engine,
  };
}

export function validateUpload(
  file: { name: string; size: number; type: string },
  rule: ResolvedFileRule,
): { ok: true } | { ok: false; error: string } {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!rule.allowed_extensions.includes(ext)) {
    return {
      ok: false,
      error: `Extensión no permitida ".${ext}". Permitidas: ${rule.allowed_extensions.join(", ")}`,
    };
  }
  const mime = (file.type || "").toLowerCase();
  if (mime && !rule.allowed_mime_types.includes(mime)) {
    return {
      ok: false,
      error: `Tipo MIME no permitido "${mime}". Permitidos: ${rule.allowed_mime_types.join(", ")}`,
    };
  }
  const maxBytes = rule.max_file_size_mb * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      ok: false,
      error: `El archivo excede ${rule.max_file_size_mb} MB.`,
    };
  }
  return { ok: true };
}
