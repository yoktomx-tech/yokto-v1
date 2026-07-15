
CREATE TABLE public.transaction_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('UPLOADED_PDF','GENERATED')),
  template_key TEXT,
  title TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'v1.0',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT','READY_TO_SIGN','WAITING_BUYER','WAITING_SELLER',
    'PARTIALLY_SIGNED','FULLY_SIGNED','REJECTED','EXPIRED','VOIDED'
  )),
  storage_path_original TEXT,
  storage_path_signed TEXT,
  hash_original_sha256 TEXT,
  hash_signed_sha256 TEXT,
  generated_payload JSONB,
  editable_sections JSONB,
  already_signed BOOLEAN NOT NULL DEFAULT FALSE,
  requires_yokto_signature BOOLEAN NOT NULL DEFAULT TRUE,
  requires_buyer_signature BOOLEAN NOT NULL DEFAULT TRUE,
  requires_seller_signature BOOLEAN NOT NULL DEFAULT TRUE,
  buyer_signature_method TEXT CHECK (buyer_signature_method IN ('AUTOGRAFA_BIOMETRICA','EFIRMA_SAT')),
  seller_signature_method TEXT CHECK (seller_signature_method IN ('AUTOGRAFA_BIOMETRICA','EFIRMA_SAT')),
  signature_order TEXT NOT NULL DEFAULT 'PARALLEL' CHECK (signature_order IN ('PARALLEL','SEQUENTIAL')),
  expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX transaction_contracts_tx_idx ON public.transaction_contracts(transaction_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_contracts TO authenticated;
GRANT ALL ON public.transaction_contracts TO service_role;

ALTER TABLE public.transaction_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contracts_via_transaction_select" ON public.transaction_contracts
  FOR SELECT TO authenticated USING (
    transaction_id IN (
      SELECT id FROM public.transactions
      WHERE buyer_id = auth.uid() OR seller_id = auth.uid() OR creado_por = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "contracts_via_transaction_write" ON public.transaction_contracts
  FOR ALL TO authenticated USING (
    transaction_id IN (
      SELECT id FROM public.transactions
      WHERE buyer_id = auth.uid() OR seller_id = auth.uid() OR creado_por = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  ) WITH CHECK (
    transaction_id IN (
      SELECT id FROM public.transactions
      WHERE buyer_id = auth.uid() OR seller_id = auth.uid() OR creado_por = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER transaction_contracts_set_updated_at
  BEFORE UPDATE ON public.transaction_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.contract_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.transaction_contracts(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  signer_user_id UUID NOT NULL REFERENCES auth.users(id),
  signer_role TEXT NOT NULL CHECK (signer_role IN (
    'PAGADOR','BENEFICIARIO','REPRESENTANTE_LEGAL','TESTIGO','ADMIN_YOKTO'
  )),
  signer_name TEXT NOT NULL,
  signer_rfc TEXT,
  method TEXT NOT NULL CHECK (method IN ('AUTOGRAFA_BIOMETRICA','EFIRMA_SAT')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING','SIGNED','FAILED','REJECTED','EXPIRED','MANUAL_REVIEW'
  )),
  signature_svg_path TEXT,
  signature_png_path TEXT,
  biometric_selfie_path TEXT,
  biometric_liveness_score NUMERIC(5,2),
  biometric_match_score NUMERIC(5,2),
  biometric_provider TEXT,
  efirma_certificate_serial TEXT,
  efirma_certificate_rfc TEXT,
  efirma_certificate_curp TEXT,
  efirma_certificate_valid_from DATE,
  efirma_certificate_valid_to DATE,
  efirma_signature_b64 TEXT,
  efirma_algorithm TEXT,
  document_hash_sha256 TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  geo_lat NUMERIC(10,7),
  geo_lng NUMERIC(10,7),
  signed_at TIMESTAMPTZ,
  evidence JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX contract_signatures_contract_idx ON public.contract_signatures(contract_id);
CREATE INDEX contract_signatures_tx_idx ON public.contract_signatures(transaction_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_signatures TO authenticated;
GRANT ALL ON public.contract_signatures TO service_role;

ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signatures_via_transaction_select" ON public.contract_signatures
  FOR SELECT TO authenticated USING (
    transaction_id IN (
      SELECT id FROM public.transactions
      WHERE buyer_id = auth.uid() OR seller_id = auth.uid() OR creado_por = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "signatures_via_transaction_insert" ON public.contract_signatures
  FOR INSERT TO authenticated WITH CHECK (
    signer_user_id = auth.uid()
    AND transaction_id IN (
      SELECT id FROM public.transactions
      WHERE buyer_id = auth.uid() OR seller_id = auth.uid() OR creado_por = auth.uid()
    )
  );

CREATE POLICY "signatures_admin_manage" ON public.contract_signatures
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
