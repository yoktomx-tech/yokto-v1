
-- ============ ENUM roles internos ============
DO $$ BEGIN
  CREATE TYPE public.internal_role AS ENUM (
    'YOKTO_SUPER_ADMIN',
    'ANALISTA_KYC',
    'ANALISTA_DOCUMENTAL',
    'OFICIAL_CUMPLIMIENTO',
    'AGENTE_ESCROW',
    'AGENTE_SOPORTE',
    'ANALISTA_FINANCIERO'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ internal_role_assignments ============
CREATE TABLE IF NOT EXISTS public.internal_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol public.internal_role NOT NULL,
  asignado_por UUID NOT NULL REFERENCES auth.users(id),
  motivo TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  expira_at TIMESTAMPTZ,
  revocado_at TIMESTAMPTZ,
  revocado_por UUID REFERENCES auth.users(id),
  motivo_revocacion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_internal_role_user_active
  ON public.internal_role_assignments(user_id) WHERE activo = true;

GRANT SELECT ON public.internal_role_assignments TO authenticated;
GRANT ALL ON public.internal_role_assignments TO service_role;
ALTER TABLE public.internal_role_assignments ENABLE ROW LEVEL SECURITY;

-- Staff puede ver su propia asignación
CREATE POLICY "Staff sees own assignment"
  ON public.internal_role_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============ document_review_queue ============
CREATE TABLE IF NOT EXISTS public.document_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  hito_id UUID,
  document_id UUID,
  evidence_id UUID,
  tipo TEXT NOT NULL,
  sector TEXT,
  motivo_revision TEXT NOT NULL,
  confianza_ia INTEGER CHECK (confianza_ia BETWEEN 0 AND 100),
  ia_summary TEXT,
  expected_values JSONB,
  extracted_values JSONB,
  estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (
    estado IN ('PENDIENTE','EN_REVISION','VALIDADO','RECHAZADO','CORRECCION_SOLICITADA','ESCALADO','INCONCLUSO')
  ),
  prioridad TEXT NOT NULL DEFAULT 'NORMAL' CHECK (prioridad IN ('BAJA','NORMAL','ALTA','CRITICA')),
  asignado_a UUID REFERENCES auth.users(id),
  revisado_por UUID REFERENCES auth.users(id),
  revisado_at TIMESTAMPTZ,
  decision TEXT,
  notas_revision TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_docrev_pending
  ON public.document_review_queue(estado, prioridad, created_at)
  WHERE estado IN ('PENDIENTE','EN_REVISION');
CREATE INDEX IF NOT EXISTS idx_docrev_tx ON public.document_review_queue(transaction_id);

GRANT SELECT ON public.document_review_queue TO authenticated;
GRANT ALL ON public.document_review_queue TO service_role;
ALTER TABLE public.document_review_queue ENABLE ROW LEVEL SECURITY;
-- No policies: solo service_role vía server functions con requirePermission.

-- ============ internal_action_log ============
CREATE TABLE IF NOT EXISTS public.internal_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  rol_usado public.internal_role NOT NULL,
  recurso TEXT NOT NULL,
  accion TEXT NOT NULL,
  entidad_tipo TEXT,
  entidad_id UUID,
  motivo TEXT,
  ip INET,
  user_agent TEXT,
  snapshot_antes JSONB,
  snapshot_despues JSONB,
  detalle_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iact_user ON public.internal_action_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_iact_entity ON public.internal_action_log(entidad_tipo, entidad_id);

GRANT ALL ON public.internal_action_log TO service_role;
ALTER TABLE public.internal_action_log ENABLE ROW LEVEL SECURITY;
-- Inmutable: sin policies para authenticated.

-- ============ internal_access_log ============
CREATE TABLE IF NOT EXISTS public.internal_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  rol_usado public.internal_role,
  ruta TEXT NOT NULL,
  metodo TEXT,
  ip INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.internal_access_log TO service_role;
ALTER TABLE public.internal_access_log ENABLE ROW LEVEL SECURITY;

-- ============ Helpers ============
CREATE OR REPLACE FUNCTION public.get_active_internal_role(_user_id UUID)
RETURNS public.internal_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT rol FROM public.internal_role_assignments
  WHERE user_id = _user_id AND activo = true
    AND (expira_at IS NULL OR expira_at > now())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_active_internal_role(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_internal_role(UUID) TO authenticated, service_role;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_ira_touch ON public.internal_role_assignments;
CREATE TRIGGER trg_ira_touch BEFORE UPDATE ON public.internal_role_assignments
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

DROP TRIGGER IF EXISTS trg_drq_touch ON public.document_review_queue;
CREATE TRIGGER trg_drq_touch BEFORE UPDATE ON public.document_review_queue
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
