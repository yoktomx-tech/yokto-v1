
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS sla_warn_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_breach_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalation_notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_support_tickets_sla_warn
  ON public.support_tickets (sla_first_response_at)
  WHERE first_response_at IS NULL AND sla_warn_notified_at IS NULL AND status NOT IN ('closed');
CREATE INDEX IF NOT EXISTS idx_support_tickets_esc_notify
  ON public.support_tickets (escalated_at)
  WHERE escalation_notified_at IS NULL AND escalation <> 'none';
