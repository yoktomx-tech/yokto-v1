
CREATE TYPE public.pld_risk_level AS ENUM ('bajo', 'medio', 'alto', 'inaceptable');
CREATE TYPE public.pld_profile_status AS ENUM ('borrador', 'vigente', 'en_revision', 'vencido', 'bloqueado');
CREATE TYPE public.pld_screening_status AS ENUM ('limpio', 'coincidencia_debil', 'coincidencia_fuerte', 'error');
CREATE TYPE public.pld_screening_list AS ENUM ('pep_nacional','pep_internacional','ofac','onu','ue','adverse_media','interpol','sat_69b');
CREATE TYPE public.pld_alert_severity AS ENUM ('info', 'baja', 'media', 'alta', 'critica');
CREATE TYPE public.pld_alert_status AS ENUM ('abierta', 'en_revision', 'resuelta', 'descartada', 'escalada');

CREATE TABLE public.pld_questionnaires (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actividad_economica TEXT,
  actividad_scian TEXT,
  sector TEXT,
  origen_recursos TEXT,
  destino_recursos TEXT,
  volumen_mensual_estimado NUMERIC(14,2),
  operaciones_mensuales_estimadas INTEGER,
  ticket_promedio_estimado NUMERIC(14,2),
  paises_operacion TEXT[] DEFAULT ARRAY['MX']::TEXT[],
  estados_operacion TEXT[],
  usa_efectivo BOOLEAN NOT NULL DEFAULT FALSE,
  efectivo_mensual_estimado NUMERIC(14,2),
  es_pep BOOLEAN NOT NULL DEFAULT FALSE,
  pep_detalle JSONB,
  familiar_pep BOOLEAN NOT NULL DEFAULT FALSE,
  proposito_cuenta TEXT,
  beneficiario_final JSONB,
  completado BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1,
  respuestas_raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, version)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pld_questionnaires TO authenticated;
GRANT ALL ON public.pld_questionnaires TO service_role;
ALTER TABLE public.pld_questionnaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros ven cuestionario de su org"
  ON public.pld_questionnaires FOR SELECT TO authenticated
  USING (public.is_org_member(org_id, auth.uid()));

CREATE POLICY "Owners y auditor crean cuestionario"
  ON public.pld_questionnaires FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (public.is_org_owner(org_id, auth.uid()) OR public.has_org_role(org_id, auth.uid(), 'auditor'))
  );

CREATE POLICY "Owners y auditor actualizan cuestionario"
  ON public.pld_questionnaires FOR UPDATE TO authenticated
  USING (public.is_org_owner(org_id, auth.uid()) OR public.has_org_role(org_id, auth.uid(), 'auditor'))
  WITH CHECK (public.is_org_owner(org_id, auth.uid()) OR public.has_org_role(org_id, auth.uid(), 'auditor'));

CREATE INDEX pld_questionnaires_org_idx ON public.pld_questionnaires(org_id);

CREATE TABLE public.pld_screening_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('titular','representante','beneficiario_final','contraparte','empresa')),
  subject_name TEXT NOT NULL,
  subject_curp TEXT,
  subject_rfc TEXT,
  lista public.pld_screening_list NOT NULL,
  status public.pld_screening_status NOT NULL,
  match_score NUMERIC(5,2),
  provider TEXT NOT NULL DEFAULT 'internal_stub',
  raw_response JSONB,
  evidence_hash TEXT,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pld_screening_results TO authenticated;
GRANT ALL ON public.pld_screening_results TO service_role;
ALTER TABLE public.pld_screening_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros ven screening de su org"
  ON public.pld_screening_results FOR SELECT TO authenticated
  USING (public.is_org_member(org_id, auth.uid()));

CREATE POLICY "Deny user writes on screening"
  ON public.pld_screening_results AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE INDEX pld_screening_org_idx ON public.pld_screening_results(org_id, evaluated_at DESC);

CREATE TABLE public.pld_risk_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  level public.pld_risk_level NOT NULL DEFAULT 'medio',
  status public.pld_profile_status NOT NULL DEFAULT 'borrador',
  last_evaluated_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  evaluated_by UUID REFERENCES auth.users(id),
  factors_summary JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id)
);

GRANT SELECT ON public.pld_risk_profiles TO authenticated;
GRANT ALL ON public.pld_risk_profiles TO service_role;
ALTER TABLE public.pld_risk_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros ven perfil PLD de su org"
  ON public.pld_risk_profiles FOR SELECT TO authenticated
  USING (public.is_org_member(org_id, auth.uid()));

CREATE POLICY "Deny user writes on risk profile"
  ON public.pld_risk_profiles AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE TABLE public.pld_risk_factors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.pld_risk_profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  weight INTEGER NOT NULL,
  value NUMERIC(6,2),
  contribution INTEGER NOT NULL,
  detail JSONB,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pld_risk_factors TO authenticated;
GRANT ALL ON public.pld_risk_factors TO service_role;
ALTER TABLE public.pld_risk_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros ven factores PLD de su org"
  ON public.pld_risk_factors FOR SELECT TO authenticated
  USING (public.is_org_member(org_id, auth.uid()));

CREATE POLICY "Deny user writes on risk factors"
  ON public.pld_risk_factors AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE INDEX pld_risk_factors_org_idx ON public.pld_risk_factors(org_id, evaluated_at DESC);

CREATE TABLE public.pld_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity public.pld_alert_severity NOT NULL DEFAULT 'media',
  status public.pld_alert_status NOT NULL DEFAULT 'abierta',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pld_alerts TO authenticated;
GRANT ALL ON public.pld_alerts TO service_role;
ALTER TABLE public.pld_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros ven alertas PLD de su org"
  ON public.pld_alerts FOR SELECT TO authenticated
  USING (public.is_org_member(org_id, auth.uid()));

CREATE POLICY "Deny user writes on alerts"
  ON public.pld_alerts AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

CREATE INDEX pld_alerts_org_idx ON public.pld_alerts(org_id, detected_at DESC);
CREATE INDEX pld_alerts_status_idx ON public.pld_alerts(status) WHERE status IN ('abierta','en_revision','escalada');

CREATE TRIGGER trg_pld_questionnaires_updated
  BEFORE UPDATE ON public.pld_questionnaires
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_pld_risk_profiles_updated
  BEFORE UPDATE ON public.pld_risk_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_pld_alerts_updated
  BEFORE UPDATE ON public.pld_alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
