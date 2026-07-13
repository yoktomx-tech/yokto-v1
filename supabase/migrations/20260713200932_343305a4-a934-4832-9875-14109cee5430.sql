
-- ENUMS
CREATE TYPE public.transaction_status AS ENUM (
  'draft','awaiting_funding','funded','in_progress','conditions_met','released','disputed','cancelled','refunded'
);
CREATE TYPE public.payment_method AS ENUM ('spei','card');
CREATE TYPE public.commission_payer AS ENUM ('buyer','seller','split');
CREATE TYPE public.condition_status AS ENUM ('pending','met','rejected');

-- TRANSACTIONS
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  seller_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  counterparty_email TEXT,
  title TEXT NOT NULL,
  description TEXT,
  sector TEXT,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'MXN',
  payment_method public.payment_method NOT NULL DEFAULT 'spei',
  commission_bps INTEGER NOT NULL DEFAULT 250 CHECK (commission_bps >= 0 AND commission_bps <= 10000),
  commission_payer public.commission_payer NOT NULL DEFAULT 'split',
  status public.transaction_status NOT NULL DEFAULT 'draft',
  funding_deadline TIMESTAMPTZ,
  delivery_deadline TIMESTAMPTZ,
  funded_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (seller_id IS NOT NULL OR counterparty_email IS NOT NULL)
);
CREATE INDEX idx_tx_buyer ON public.transactions(buyer_id);
CREATE INDEX idx_tx_seller ON public.transactions(seller_id);
CREATE INDEX idx_tx_status ON public.transactions(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parties view own transactions" ON public.transactions FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'mediator'));
CREATE POLICY "buyer creates transactions" ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "buyer updates draft" ON public.transactions FOR UPDATE TO authenticated
  USING ((auth.uid() = buyer_id AND status = 'draft') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK ((auth.uid() = buyer_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "buyer deletes draft" ON public.transactions FOR DELETE TO authenticated
  USING ((auth.uid() = buyer_id AND status = 'draft') OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_tx_updated_at BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CONDITIONS
CREATE TABLE public.transaction_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  status public.condition_status NOT NULL DEFAULT 'pending',
  evidence_url TEXT,
  met_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cond_tx ON public.transaction_conditions(transaction_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_conditions TO authenticated;
GRANT ALL ON public.transaction_conditions TO service_role;
ALTER TABLE public.transaction_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parties view conditions" ON public.transaction_conditions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id
    AND (auth.uid() = t.buyer_id OR auth.uid() = t.seller_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'mediator'))));
CREATE POLICY "buyer manages draft conditions" ON public.transaction_conditions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id
    AND ((auth.uid() = t.buyer_id AND t.status = 'draft') OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id
    AND ((auth.uid() = t.buyer_id AND t.status = 'draft') OR public.has_role(auth.uid(),'admin'))));

CREATE TRIGGER trg_cond_updated_at BEFORE UPDATE ON public.transaction_conditions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- EVENTS
CREATE TABLE public.transaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_evt_tx ON public.transaction_events(transaction_id);

GRANT SELECT, INSERT ON public.transaction_events TO authenticated;
GRANT ALL ON public.transaction_events TO service_role;
ALTER TABLE public.transaction_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parties view events" ON public.transaction_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id
    AND (auth.uid() = t.buyer_id OR auth.uid() = t.seller_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'mediator'))));
CREATE POLICY "parties insert events" ON public.transaction_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = actor_id AND EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id
    AND (auth.uid() = t.buyer_id OR auth.uid() = t.seller_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'mediator'))));
