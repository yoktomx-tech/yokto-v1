
-- SECTORS
CREATE TABLE public.sectores_operacion (
  id SERIAL PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  duracion_tipica TEXT,
  monto_tipico TEXT,
  componentes_especiales TEXT,
  validaciones_adicionales TEXT,
  solo_spei BOOLEAN DEFAULT FALSE,
  repse_requerido BOOLEAN DEFAULT FALSE,
  inspeccion_fisica BOOLEAN DEFAULT FALSE,
  checklist_pts TEXT,
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sectores_operacion TO authenticated;
GRANT ALL ON public.sectores_operacion TO service_role;
ALTER TABLE public.sectores_operacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sectores_read_auth" ON public.sectores_operacion FOR SELECT TO authenticated USING (true);

-- SUBTIPOS
CREATE TABLE public.subtipos_operacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id INTEGER NOT NULL REFERENCES public.sectores_operacion(id),
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  duracion_sugerida_dias INTEGER,
  is_default BOOLEAN NOT NULL DEFAULT TRUE,
  is_editable BOOLEAN NOT NULL DEFAULT FALSE,
  parent_subtipo_id UUID REFERENCES public.subtipos_operacion(id) ON DELETE SET NULL,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sector_id, codigo, org_id)
);
CREATE INDEX idx_subtipos_sector ON public.subtipos_operacion(sector_id);
CREATE INDEX idx_subtipos_org ON public.subtipos_operacion(org_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subtipos_operacion TO authenticated;
GRANT ALL ON public.subtipos_operacion TO service_role;
ALTER TABLE public.subtipos_operacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subtipos_read_defaults_or_own_org" ON public.subtipos_operacion FOR SELECT TO authenticated
  USING (is_default = TRUE OR (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid())));
CREATE POLICY "subtipos_write_own_org_admin" ON public.subtipos_operacion FOR INSERT TO authenticated
  WITH CHECK (is_default = FALSE AND org_id IS NOT NULL AND public.is_org_owner(org_id, auth.uid()));
CREATE POLICY "subtipos_update_own_org_admin" ON public.subtipos_operacion FOR UPDATE TO authenticated
  USING (is_default = FALSE AND org_id IS NOT NULL AND public.is_org_owner(org_id, auth.uid()))
  WITH CHECK (is_default = FALSE);
CREATE POLICY "subtipos_delete_own_org_admin" ON public.subtipos_operacion FOR DELETE TO authenticated
  USING (is_default = FALSE AND org_id IS NOT NULL AND public.is_org_owner(org_id, auth.uid()));
CREATE TRIGGER trg_subtipos_updated BEFORE UPDATE ON public.subtipos_operacion FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- DOCUMENT FILE PROFILES
CREATE TABLE public.document_file_profiles (
  file_profile_code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  descripcion TEXT,
  allowed_extensions TEXT[] NOT NULL,
  allowed_mime_types TEXT[] NOT NULL,
  min_files INTEGER NOT NULL DEFAULT 1,
  max_files INTEGER NOT NULL DEFAULT 1,
  max_file_size_mb INTEGER NOT NULL DEFAULT 25,
  required_extensions_any TEXT[] DEFAULT '{}',
  recommended_extensions TEXT[] DEFAULT '{}',
  requires_ocr BOOLEAN NOT NULL DEFAULT FALSE,
  requires_xml_parse BOOLEAN NOT NULL DEFAULT FALSE,
  requires_sat_validation BOOLEAN NOT NULL DEFAULT FALSE,
  requires_image_analysis BOOLEAN NOT NULL DEFAULT FALSE,
  requires_gps_metadata BOOLEAN NOT NULL DEFAULT FALSE,
  requires_signature_validation BOOLEAN NOT NULL DEFAULT FALSE,
  requires_hash BOOLEAN NOT NULL DEFAULT TRUE,
  requires_virus_scan BOOLEAN NOT NULL DEFAULT TRUE,
  capture_mode TEXT NOT NULL DEFAULT 'UPLOAD',
  validation_engine TEXT NOT NULL DEFAULT 'MANUAL',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT ON public.document_file_profiles TO authenticated;
GRANT ALL ON public.document_file_profiles TO service_role;
ALTER TABLE public.document_file_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "file_profiles_read_auth" ON public.document_file_profiles FOR SELECT TO authenticated USING (true);

-- DOCUMENTOS CATALOGO
CREATE TABLE public.documentos_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_codigo TEXT UNIQUE NOT NULL,
  nombre_referencia TEXT NOT NULL,
  descripcion TEXT,
  es_propuesto BOOLEAN NOT NULL DEFAULT FALSE,
  file_profile_code TEXT REFERENCES public.document_file_profiles(file_profile_code),
  allowed_extensions_override TEXT[],
  allowed_mime_types_override TEXT[],
  max_file_size_mb_override INTEGER,
  min_files_override INTEGER,
  max_files_override INTEGER,
  validation_engine_override TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.documentos_catalogo TO authenticated;
GRANT ALL ON public.documentos_catalogo TO service_role;
ALTER TABLE public.documentos_catalogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs_catalogo_read_auth" ON public.documentos_catalogo FOR SELECT TO authenticated USING (true);

-- HITO TEMPLATES
CREATE TABLE public.hito_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subtipo_id UUID NOT NULL REFERENCES public.subtipos_operacion(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  dia_inicio_est INTEGER,
  duracion_max_dias INTEGER,
  pct_monto TEXT,
  responsable TEXT,
  revisor_yokto TEXT,
  modulo_dispositivo TEXT,
  alerta_dias INTEGER,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subtipo_id, numero)
);
CREATE INDEX idx_hito_tpl_subtipo ON public.hito_templates(subtipo_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hito_templates TO authenticated;
GRANT ALL ON public.hito_templates TO service_role;
ALTER TABLE public.hito_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hito_tpl_read_via_subtipo" ON public.hito_templates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.subtipos_operacion s WHERE s.id = subtipo_id
    AND (s.is_default = TRUE OR public.is_org_member(s.org_id, auth.uid()))));
CREATE POLICY "hito_tpl_write_via_subtipo" ON public.hito_templates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.subtipos_operacion s WHERE s.id = subtipo_id
    AND s.is_default = FALSE AND public.is_org_owner(s.org_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.subtipos_operacion s WHERE s.id = subtipo_id
    AND s.is_default = FALSE AND public.is_org_owner(s.org_id, auth.uid())));

-- HITO TEMPLATE DOCUMENTOS
CREATE TABLE public.hito_template_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hito_template_id UUID NOT NULL REFERENCES public.hito_templates(id) ON DELETE CASCADE,
  documento_codigo TEXT NOT NULL REFERENCES public.documentos_catalogo(documento_codigo),
  categoria TEXT NOT NULL DEFAULT 'OBLIGATORIO',
  detalle_especifico TEXT,
  nombre_referencia TEXT,
  descripcion_catalogo TEXT,
  es_propuesto BOOLEAN DEFAULT FALSE,
  file_profile_code_override TEXT REFERENCES public.document_file_profiles(file_profile_code),
  allowed_extensions_override TEXT[],
  allowed_mime_types_override TEXT[],
  min_files INTEGER,
  max_files INTEGER,
  max_file_size_mb INTEGER,
  requires_geotag BOOLEAN DEFAULT FALSE,
  requires_timestamp BOOLEAN DEFAULT TRUE,
  requires_signature BOOLEAN DEFAULT FALSE,
  requires_sat_validation BOOLEAN DEFAULT FALSE,
  validation_engine_override TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_htd_hito ON public.hito_template_documentos(hito_template_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hito_template_documentos TO authenticated;
GRANT ALL ON public.hito_template_documentos TO service_role;
ALTER TABLE public.hito_template_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "htd_read_via_hito" ON public.hito_template_documentos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hito_templates h JOIN public.subtipos_operacion s ON s.id = h.subtipo_id
    WHERE h.id = hito_template_id AND (s.is_default = TRUE OR public.is_org_member(s.org_id, auth.uid()))));
CREATE POLICY "htd_write_via_hito" ON public.hito_template_documentos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hito_templates h JOIN public.subtipos_operacion s ON s.id = h.subtipo_id
    WHERE h.id = hito_template_id AND s.is_default = FALSE AND public.is_org_owner(s.org_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hito_templates h JOIN public.subtipos_operacion s ON s.id = h.subtipo_id
    WHERE h.id = hito_template_id AND s.is_default = FALSE AND public.is_org_owner(s.org_id, auth.uid())));

-- HITO TEMPLATE CONDICIONES
CREATE TABLE public.hito_template_condiciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hito_template_id UUID NOT NULL REFERENCES public.hito_templates(id) ON DELETE CASCADE,
  orden INTEGER NOT NULL DEFAULT 1,
  condicion_texto TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_htc_hito ON public.hito_template_condiciones(hito_template_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hito_template_condiciones TO authenticated;
GRANT ALL ON public.hito_template_condiciones TO service_role;
ALTER TABLE public.hito_template_condiciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "htc_read_via_hito" ON public.hito_template_condiciones FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hito_templates h JOIN public.subtipos_operacion s ON s.id = h.subtipo_id
    WHERE h.id = hito_template_id AND (s.is_default = TRUE OR public.is_org_member(s.org_id, auth.uid()))));
CREATE POLICY "htc_write_via_hito" ON public.hito_template_condiciones FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hito_templates h JOIN public.subtipos_operacion s ON s.id = h.subtipo_id
    WHERE h.id = hito_template_id AND s.is_default = FALSE AND public.is_org_owner(s.org_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hito_templates h JOIN public.subtipos_operacion s ON s.id = h.subtipo_id
    WHERE h.id = hito_template_id AND s.is_default = FALSE AND public.is_org_owner(s.org_id, auth.uid())));

-- SNAPSHOT: TRANSACTION MILESTONE DOCUMENT REQUIREMENTS
CREATE TABLE public.transaction_milestone_document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  hito_id UUID NOT NULL REFERENCES public.transaction_hitos(id) ON DELETE CASCADE,
  documento_codigo TEXT NOT NULL,
  nombre_referencia TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'OBLIGATORIO',
  detalle_especifico TEXT,
  allowed_extensions TEXT[] NOT NULL,
  allowed_mime_types TEXT[] NOT NULL,
  min_files INTEGER NOT NULL DEFAULT 1,
  max_files INTEGER NOT NULL DEFAULT 1,
  max_file_size_mb INTEGER NOT NULL DEFAULT 25,
  requires_ocr BOOLEAN NOT NULL DEFAULT FALSE,
  requires_xml_parse BOOLEAN NOT NULL DEFAULT FALSE,
  requires_sat_validation BOOLEAN NOT NULL DEFAULT FALSE,
  requires_image_analysis BOOLEAN NOT NULL DEFAULT FALSE,
  requires_gps_metadata BOOLEAN NOT NULL DEFAULT FALSE,
  requires_signature_validation BOOLEAN NOT NULL DEFAULT FALSE,
  requires_hash BOOLEAN NOT NULL DEFAULT TRUE,
  requires_virus_scan BOOLEAN NOT NULL DEFAULT TRUE,
  capture_mode TEXT NOT NULL DEFAULT 'UPLOAD',
  validation_engine TEXT NOT NULL DEFAULT 'MANUAL',
  template_document_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tmdr_tx ON public.transaction_milestone_document_requirements(transaction_id);
CREATE INDEX idx_tmdr_hito ON public.transaction_milestone_document_requirements(hito_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_milestone_document_requirements TO authenticated;
GRANT ALL ON public.transaction_milestone_document_requirements TO service_role;
ALTER TABLE public.transaction_milestone_document_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tmdr_read_via_tx" ON public.transaction_milestone_document_requirements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_id
      AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid() OR t.creado_por = auth.uid())));

-- DOCUMENT VALIDATION LOGS
CREATE TABLE public.document_validation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  hito_id UUID REFERENCES public.transaction_hitos(id) ON DELETE CASCADE,
  requirement_id UUID REFERENCES public.transaction_milestone_document_requirements(id) ON DELETE SET NULL,
  file_name TEXT,
  file_size BIGINT,
  mime_type TEXT,
  extension TEXT,
  sha256 TEXT,
  validation_engine TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  result_payload JSONB,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dvl_tx ON public.document_validation_logs(transaction_id);
GRANT SELECT, INSERT ON public.document_validation_logs TO authenticated;
GRANT ALL ON public.document_validation_logs TO service_role;
ALTER TABLE public.document_validation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dvl_read_via_tx" ON public.document_validation_logs FOR SELECT TO authenticated
  USING (transaction_id IS NULL OR EXISTS (SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_id
      AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid() OR t.creado_por = auth.uid())));
CREATE POLICY "dvl_insert_auth" ON public.document_validation_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
