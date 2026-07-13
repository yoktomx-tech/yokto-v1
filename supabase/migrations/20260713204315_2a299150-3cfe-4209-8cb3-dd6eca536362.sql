
CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL UNIQUE REFERENCES public.transactions(id) ON DELETE CASCADE,
  opened_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_role text NOT NULL CHECK (opened_role IN ('buyer','seller')),
  reason_code text NOT NULL CHECK (reason_code IN ('not_delivered','not_as_described','quality','delay','fraud','other')),
  reason_description text NOT NULL,
  amount_disputed_cents bigint NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_mediation','resolved','closed','cancelled')),
  resolution text CHECK (resolution IN ('buyer_favor','seller_favor','split','no_resolution')),
  resolution_notes text,
  buyer_share_cents bigint,
  seller_share_cents bigint,
  loser_pays text CHECK (loser_pays IN ('buyer','seller','split','none')),
  mediator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX disputes_tx_idx ON public.disputes(transaction_id);
CREATE INDEX disputes_status_idx ON public.disputes(status);
GRANT SELECT, INSERT, UPDATE ON public.disputes TO authenticated;
GRANT ALL ON public.disputes TO service_role;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parties_or_staff_select" ON public.disputes FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid()))
  OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'mediator')
);
CREATE POLICY "party_insert" ON public.disputes FOR INSERT TO authenticated WITH CHECK (
  opened_by = auth.uid() AND
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid()))
);
CREATE POLICY "mediator_update" ON public.disputes FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'mediator')
);
CREATE TRIGGER disputes_updated BEFORE UPDATE ON public.disputes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.dispute_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  author_role text NOT NULL CHECK (author_role IN ('buyer','seller','mediator','admin','system')),
  body text NOT NULL,
  evidence_urls text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dispute_messages_dispute_idx ON public.dispute_messages(dispute_id);
GRANT SELECT, INSERT ON public.dispute_messages TO authenticated;
GRANT ALL ON public.dispute_messages TO service_role;
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parties_or_staff_select" ON public.dispute_messages FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.disputes d
    JOIN public.transactions t ON t.id = d.transaction_id
    WHERE d.id = dispute_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
  )
  OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'mediator')
);
CREATE POLICY "parties_or_staff_insert" ON public.dispute_messages FOR INSERT TO authenticated WITH CHECK (
  author_id = auth.uid() AND (
    EXISTS (
      SELECT 1 FROM public.disputes d
      JOIN public.transactions t ON t.id = d.transaction_id
      WHERE d.id = dispute_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
    OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'mediator')
  )
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, read_at, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_select" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own_update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
