
-- 1. Evidence: add GPS
ALTER TABLE public.verification_evidence
  ADD COLUMN IF NOT EXISTS latitude numeric(9,6),
  ADD COLUMN IF NOT EXISTS longitude numeric(9,6),
  ADD COLUMN IF NOT EXISTS captured_at timestamptz;

-- 2. Documents table
CREATE TABLE IF NOT EXISTS public.transaction_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('CONTRATO','CFDI','COMPROBANTE_PAGO','GARANTIA','ACTA_ENTREGA','OTRO')),
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  note text,
  -- CFDI validation
  cfdi_uuid text,
  cfdi_rfc_emisor text,
  cfdi_rfc_receptor text,
  cfdi_total_cents bigint,
  cfdi_fecha timestamptz,
  sat_status text CHECK (sat_status IN ('valid','invalid','cancelled','not_verified','error')),
  sat_message text,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tx_documents_tx ON public.transaction_documents(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tx_documents_type ON public.transaction_documents(doc_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_documents TO authenticated;
GRANT ALL ON public.transaction_documents TO service_role;

ALTER TABLE public.transaction_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tx_docs_select_parties" ON public.transaction_documents FOR SELECT TO authenticated
  USING (transaction_id IN (SELECT id FROM public.transactions WHERE buyer_id = auth.uid() OR seller_id = auth.uid()));

CREATE POLICY "tx_docs_insert_parties" ON public.transaction_documents FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND transaction_id IN (SELECT id FROM public.transactions WHERE buyer_id = auth.uid() OR seller_id = auth.uid())
  );

CREATE POLICY "tx_docs_update_uploader" ON public.transaction_documents FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "tx_docs_delete_uploader" ON public.transaction_documents FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_tx_documents_updated_at
  BEFORE UPDATE ON public.transaction_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Storage RLS for transaction-documents bucket
CREATE POLICY "tx_docs_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'transaction-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.transactions WHERE buyer_id = auth.uid() OR seller_id = auth.uid()
    )
  );

CREATE POLICY "tx_docs_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'transaction-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.transactions WHERE buyer_id = auth.uid() OR seller_id = auth.uid()
    )
  );

CREATE POLICY "tx_docs_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'transaction-documents'
    AND owner = auth.uid()
  );
