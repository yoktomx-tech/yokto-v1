
CREATE TABLE public.onboarding_api_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  account_type TEXT,
  step TEXT,
  status TEXT NOT NULL CHECK (status IN ('success','failed','incomplete')),
  http_status INT,
  duration_ms INT,
  request_summary JSONB,
  response_summary JSONB,
  error_message TEXT,
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX idx_onboarding_api_logs_user ON public.onboarding_api_logs(user_id, created_at DESC);
CREATE INDEX idx_onboarding_api_logs_status ON public.onboarding_api_logs(status, created_at DESC);
CREATE INDEX idx_onboarding_api_logs_provider ON public.onboarding_api_logs(provider, endpoint);

GRANT SELECT ON public.onboarding_api_logs TO authenticated;
GRANT ALL ON public.onboarding_api_logs TO service_role;

ALTER TABLE public.onboarding_api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own onboarding logs"
  ON public.onboarding_api_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Internal staff can view all onboarding logs"
  ON public.onboarding_api_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.internal_role_assignments ira
      WHERE ira.user_id = auth.uid()
        AND ira.activo = true
        AND (ira.expira_at IS NULL OR ira.expira_at > now())
    )
  );
