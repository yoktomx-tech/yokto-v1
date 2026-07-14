
CREATE TABLE public.biometric_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','id_captured','id_verified','face_verified','address_verified','completed','failed','expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  id_type TEXT CHECK (id_type IN ('ine','passport')),
  id_front_path TEXT,
  id_back_path TEXT,
  ocr_data JSONB,
  ocr_curp TEXT,
  curp_match BOOLEAN,
  curp_renapo_data JSONB,
  selfie_path TEXT,
  video_path TEXT,
  face_score NUMERIC(6,3),
  face_match_ok BOOLEAN,
  address_doc_type TEXT,
  address_doc_path TEXT,
  address_doc_data JSONB,
  address_doc_ok BOOLEAN,
  address_doc_issued_at DATE,
  lista_nominal_ok BOOLEAN,
  lista_nominal_data JSONB,
  last_error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_biometric_enrollments_user ON public.biometric_enrollments(user_id, created_at DESC);
CREATE INDEX ix_biometric_enrollments_token ON public.biometric_enrollments(token);

GRANT SELECT, INSERT, UPDATE ON public.biometric_enrollments TO authenticated;
GRANT ALL ON public.biometric_enrollments TO service_role;

ALTER TABLE public.biometric_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_enrollments_read" ON public.biometric_enrollments
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own_enrollments_write" ON public.biometric_enrollments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_enrollments_update" ON public.biometric_enrollments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_biometric_enrollments_updated
BEFORE UPDATE ON public.biometric_enrollments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.biometric_api_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID REFERENCES public.biometric_enrollments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'nubarium',
  endpoint TEXT NOT NULL,
  http_status INTEGER,
  ok BOOLEAN NOT NULL DEFAULT false,
  request_summary JSONB,
  response_summary JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_biometric_api_logs_enrollment ON public.biometric_api_logs(enrollment_id, created_at DESC);

GRANT SELECT ON public.biometric_api_logs TO authenticated;
GRANT ALL ON public.biometric_api_logs TO service_role;

ALTER TABLE public.biometric_api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_biometric_logs" ON public.biometric_api_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
