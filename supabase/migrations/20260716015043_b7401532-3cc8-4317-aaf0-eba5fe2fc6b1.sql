
CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL CHECK (account_type IN ('CLABE','DEBIT_CARD')),
  query_hash TEXT NOT NULL,
  query_last4 TEXT NOT NULL,
  query_masked TEXT NOT NULL,
  bank_institution_clave TEXT,
  bank_name TEXT,
  holder_expected_name TEXT NOT NULL,
  holder_expected_rfc TEXT,
  holder_expected_curp TEXT,
  verification_status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (verification_status IN
    ('DRAFT','LOCAL_VALIDATED','PENNY_CREATED','WAITING_RESULT','APPROVED','MANUAL_REVIEW','REJECTED','ERROR','EXPIRED')),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  can_receive_payouts BOOLEAN NOT NULL DEFAULT FALSE,
  can_receive_refunds BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (owner_user_id IS NOT NULL OR owner_org_id IS NOT NULL)
);

CREATE INDEX idx_bank_accounts_user ON public.bank_accounts(owner_user_id);
CREATE INDEX idx_bank_accounts_org ON public.bank_accounts(owner_org_id);
CREATE INDEX idx_bank_accounts_status ON public.bank_accounts(verification_status);
CREATE UNIQUE INDEX idx_bank_accounts_unique_hash_user ON public.bank_accounts(owner_user_id, query_hash)
  WHERE owner_user_id IS NOT NULL AND archived_at IS NULL;
CREATE UNIQUE INDEX idx_bank_accounts_unique_hash_org ON public.bank_accounts(owner_org_id, query_hash)
  WHERE owner_org_id IS NOT NULL AND archived_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_accounts_select_owner" ON public.bank_accounts
  FOR SELECT TO authenticated USING (
    owner_user_id = auth.uid()
    OR (owner_org_id IS NOT NULL AND public.is_org_member(owner_org_id, auth.uid()))
  );

CREATE POLICY "bank_accounts_insert_owner" ON public.bank_accounts
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid() AND (
      (owner_user_id = auth.uid() AND owner_org_id IS NULL)
      OR (owner_org_id IS NOT NULL AND (
        public.has_org_role(owner_org_id, auth.uid(), 'owner')
        OR public.has_org_role(owner_org_id, auth.uid(), 'buyer_admin')
        OR public.has_org_role(owner_org_id, auth.uid(), 'seller_admin')
      ))
    )
  );

CREATE POLICY "bank_accounts_update_owner" ON public.bank_accounts
  FOR UPDATE TO authenticated USING (
    (owner_user_id = auth.uid())
    OR (owner_org_id IS NOT NULL AND (
      public.has_org_role(owner_org_id, auth.uid(), 'owner')
      OR public.has_org_role(owner_org_id, auth.uid(), 'buyer_admin')
      OR public.has_org_role(owner_org_id, auth.uid(), 'seller_admin')
    ))
  );

CREATE TRIGGER trg_bank_accounts_updated
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE public.bank_account_penny_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  provider TEXT NOT NULL DEFAULT 'VERIFICAMEX',
  provider_uuid TEXT UNIQUE NOT NULL,
  provider_status TEXT,
  type TEXT NOT NULL CHECK (type IN ('CLABE','DEBIT_CARD')),
  query_masked TEXT NOT NULL,
  name_receiver TEXT,
  rfc_curp_receiver TEXT,
  status TEXT NOT NULL DEFAULT 'WAITING_RESULT' CHECK (status IN
    ('PENNY_CREATED','WAITING_RESULT','APPROVED','MANUAL_REVIEW','REJECTED','ERROR','EXPIRED')),
  name_similarity NUMERIC(5,4),
  rfc_curp_match TEXT CHECK (rfc_curp_match IN ('EXACT','PARTIAL','NO_MATCH','MISSING')),
  decision_reasons TEXT[],
  raw_response JSONB,
  webhook_events JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX idx_penny_tests_bank_account ON public.bank_account_penny_tests(bank_account_id);
CREATE INDEX idx_penny_tests_status ON public.bank_account_penny_tests(status);

GRANT SELECT ON public.bank_account_penny_tests TO authenticated;
GRANT ALL ON public.bank_account_penny_tests TO service_role;
ALTER TABLE public.bank_account_penny_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "penny_tests_select_owner" ON public.bank_account_penny_tests
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR bank_account_id IN (
      SELECT id FROM public.bank_accounts WHERE
        owner_user_id = auth.uid()
        OR (owner_org_id IS NOT NULL AND public.is_org_member(owner_org_id, auth.uid()))
    )
  );

CREATE TRIGGER trg_penny_tests_updated
  BEFORE UPDATE ON public.bank_account_penny_tests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
