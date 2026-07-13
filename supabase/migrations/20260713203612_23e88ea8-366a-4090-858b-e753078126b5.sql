
CREATE TABLE public.connected_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  provider text NOT NULL DEFAULT 'mock',
  provider_account_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','onboarding','verified','restricted','disabled')),
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.connected_accounts TO authenticated;
GRANT ALL ON public.connected_accounts TO service_role;
ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_or_admin_select" ON public.connected_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'verifier'));
CREATE POLICY "own_insert" ON public.connected_accounts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_update" ON public.connected_accounts FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER connected_accounts_updated BEFORE UPDATE ON public.connected_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mock',
  provider_ref text,
  method text NOT NULL CHECK (method IN ('spei','card')),
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'MXN',
  clabe text,
  reference_code text,
  status text NOT NULL DEFAULT 'requires_payment' CHECK (status IN ('requires_payment','processing','succeeded','failed','cancelled','expired')),
  expires_at timestamptz,
  paid_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_intents_tx_idx ON public.payment_intents(transaction_id);
GRANT SELECT, INSERT, UPDATE ON public.payment_intents TO authenticated;
GRANT ALL ON public.payment_intents TO service_role;
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties_select" ON public.payment_intents FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid()))
  OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'mediator')
);
CREATE POLICY "buyer_insert" ON public.payment_intents FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.buyer_id = auth.uid())
);
CREATE POLICY "buyer_update" ON public.payment_intents FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.buyer_id = auth.uid())
);
CREATE TRIGGER payment_intents_updated BEFORE UPDATE ON public.payment_intents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'mock',
  provider_ref text,
  gross_cents bigint NOT NULL,
  commission_cents bigint NOT NULL DEFAULT 0,
  net_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'MXN',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed','reversed')),
  paid_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payouts_tx_idx ON public.payouts(transaction_id);
GRANT SELECT, INSERT, UPDATE ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties_select" ON public.payouts FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid()))
  OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'mediator')
);
CREATE TRIGGER payouts_updated BEFORE UPDATE ON public.payouts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
