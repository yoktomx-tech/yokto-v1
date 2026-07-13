
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
EXCEPTION WHEN others THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.verification_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INT,
  note TEXT,
  ai_provider TEXT,
  ai_model TEXT,
  ai_verdict TEXT CHECK (ai_verdict IN ('approve','review','reject')),
  ai_score INT,
  ai_summary TEXT,
  ai_raw JSONB,
  analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_evidence TO authenticated;
GRANT ALL ON public.verification_evidence TO service_role;
ALTER TABLE public.verification_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "party_or_admin_read_evidence" ON public.verification_evidence
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid()))
);
CREATE POLICY "party_insert_evidence" ON public.verification_evidence
FOR INSERT TO authenticated WITH CHECK (
  uploaded_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
  )
);
CREATE POLICY "admin_update_evidence" ON public.verification_evidence
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "party_or_admin_delete_evidence" ON public.verification_evidence
FOR DELETE TO authenticated USING (
  uploaded_by = auth.uid() OR public.has_role(auth.uid(),'admin')
);

CREATE TABLE IF NOT EXISTS public.api_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_id TEXT NOT NULL UNIQUE,
  secret_hash TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read']::TEXT[],
  active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_clients TO authenticated;
GRANT ALL ON public.api_clients TO service_role;
ALTER TABLE public.api_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_or_admin_read_clients" ON public.api_clients
FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "owner_insert_clients" ON public.api_clients
FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner_or_admin_update_clients" ON public.api_clients
FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "owner_or_admin_delete_clients" ON public.api_clients
FOR DELETE TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.reports_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('tx_csv','tx_pdf','cfdi_stub')),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  period_from DATE,
  period_to DATE,
  row_count INT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports_ledger TO authenticated;
GRANT ALL ON public.reports_ledger TO service_role;
ALTER TABLE public.reports_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_or_admin_read_reports" ON public.reports_ledger
FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "owner_insert_reports" ON public.reports_ledger
FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE POLICY "party_read_verif_files" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'verification-evidence' AND (
    public.has_role(auth.uid(),'admin') OR
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id::text = split_part(name,'/',1)
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  )
);
CREATE POLICY "party_upload_verif_files" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'verification-evidence' AND EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id::text = split_part(name,'/',1)
      AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
  )
);
CREATE POLICY "owner_delete_verif_files" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'verification-evidence' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin'))
);
