CREATE TABLE public.stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.stripe_webhook_events TO service_role;

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only" ON public.stripe_webhook_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_stripe_webhook_events_event_id ON public.stripe_webhook_events(event_id);
CREATE INDEX idx_stripe_webhook_events_processed ON public.stripe_webhook_events(processed) WHERE processed = false;