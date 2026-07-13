
CREATE TABLE public.curp_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  curp TEXT NOT NULL,
  nombre TEXT,
  apellido_paterno TEXT,
  apellido_materno TEXT,
  sexo TEXT,
  fecha_nacimiento DATE,
  pais_nacimiento TEXT,
  estado_nacimiento TEXT,
  doc_probatorio INTEGER,
  datos_doc_probatorio JSONB,
  estatus_curp TEXT,
  codigo_validacion TEXT,
  codigo_mensaje TEXT,
  estatus TEXT,
  raw_response JSONB,
  provider TEXT NOT NULL DEFAULT 'nubarium',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_curp_verifications_user ON public.curp_verifications(user_id);
CREATE INDEX idx_curp_verifications_curp ON public.curp_verifications(curp);

GRANT SELECT ON public.curp_verifications TO authenticated;
GRANT ALL ON public.curp_verifications TO service_role;

ALTER TABLE public.curp_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own CURP verifications"
  ON public.curp_verifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE TRIGGER set_curp_verifications_updated_at
  BEFORE UPDATE ON public.curp_verifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
