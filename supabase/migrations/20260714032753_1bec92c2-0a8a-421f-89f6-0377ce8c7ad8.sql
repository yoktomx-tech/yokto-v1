
CREATE SEQUENCE IF NOT EXISTS public.dispute_numero_seq START 1;

ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS numero TEXT,
  ADD COLUMN IF NOT EXISTS hito_id UUID REFERENCES public.transaction_hitos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deposit_cents BIGINT,
  ADD COLUMN IF NOT EXISTS deposit_provider_ref TEXT,
  ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deposit_returned_to TEXT,
  ADD COLUMN IF NOT EXISTS deposit_distribution JSONB,
  ADD COLUMN IF NOT EXISTS summary_ai TEXT,
  ADD COLUMN IF NOT EXISTS summary_ai_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS counterparty_response_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS evidence_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arbitration_entity TEXT,
  ADD COLUMN IF NOT EXISTS arbitration_case_number TEXT,
  ADD COLUMN IF NOT EXISTS percent_release_seller NUMERIC(5,2);

CREATE UNIQUE INDEX IF NOT EXISTS disputes_numero_key ON public.disputes(numero) WHERE numero IS NOT NULL;

ALTER TABLE public.disputes DROP CONSTRAINT IF EXISTS disputes_deposit_returned_to_check;
ALTER TABLE public.disputes
  ADD CONSTRAINT disputes_deposit_returned_to_check
  CHECK (deposit_returned_to IS NULL OR deposit_returned_to IN ('buyer','seller','split','yokto'));

ALTER TABLE public.disputes DROP CONSTRAINT IF EXISTS disputes_percent_release_seller_check;
ALTER TABLE public.disputes
  ADD CONSTRAINT disputes_percent_release_seller_check
  CHECK (percent_release_seller IS NULL OR (percent_release_seller BETWEEN 0 AND 100));

ALTER TABLE public.disputes DROP CONSTRAINT IF EXISTS disputes_status_check;
ALTER TABLE public.disputes
  ADD CONSTRAINT disputes_status_check
  CHECK (status IN ('pending_deposit','open','awaiting_response','in_review','in_mediation','resolved','escalated','withdrawn','closed','cancelled'));

CREATE OR REPLACE FUNCTION public.assign_dispute_numero()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero := 'DIS-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                  LPAD(nextval('public.dispute_numero_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS disputes_set_numero ON public.disputes;
CREATE TRIGGER disputes_set_numero
  BEFORE INSERT ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.assign_dispute_numero();

ALTER TABLE public.dispute_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS visible_to TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS read_by_buyer BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS read_by_seller BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS read_by_mediator BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.dispute_messages DROP CONSTRAINT IF EXISTS dispute_messages_message_type_check;
ALTER TABLE public.dispute_messages
  ADD CONSTRAINT dispute_messages_message_type_check
  CHECK (message_type IN ('text','system','resolution','mediation'));

ALTER TABLE public.dispute_messages DROP CONSTRAINT IF EXISTS dispute_messages_visible_to_check;
ALTER TABLE public.dispute_messages
  ADD CONSTRAINT dispute_messages_visible_to_check
  CHECK (visible_to IN ('all','mediator_only','buyer_and_mediator','seller_and_mediator'));

CREATE TABLE IF NOT EXISTS public.dispute_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  uploader_role TEXT NOT NULL CHECK (uploader_role IN ('buyer','seller','mediator','admin')),
  kind TEXT NOT NULL CHECK (kind IN ('photo','video','document','screenshot','other')),
  description TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dispute_evidence_dispute_idx ON public.dispute_evidence(dispute_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispute_evidence TO authenticated;
GRANT ALL ON public.dispute_evidence TO service_role;

ALTER TABLE public.dispute_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parties_or_staff_select_evidence" ON public.dispute_evidence;
CREATE POLICY "parties_or_staff_select_evidence" ON public.dispute_evidence
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.disputes d
      JOIN public.transactions t ON t.id = d.transaction_id
      WHERE d.id = dispute_evidence.dispute_id
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'mediator')
  );

DROP POLICY IF EXISTS "parties_or_staff_insert_evidence" ON public.dispute_evidence;
CREATE POLICY "parties_or_staff_insert_evidence" ON public.dispute_evidence
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.disputes d
        JOIN public.transactions t ON t.id = d.transaction_id
        WHERE d.id = dispute_evidence.dispute_id
          AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
      )
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'mediator')
    )
  );

DROP POLICY IF EXISTS "uploader_or_staff_delete_evidence" ON public.dispute_evidence;
CREATE POLICY "uploader_or_staff_delete_evidence" ON public.dispute_evidence
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'mediator')
  );

DROP POLICY IF EXISTS "dispute_evidence_read" ON storage.objects;
CREATE POLICY "dispute_evidence_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'dispute-evidence'
    AND (
      EXISTS (
        SELECT 1 FROM public.disputes d
        JOIN public.transactions t ON t.id = d.transaction_id
        WHERE d.id::text = split_part(storage.objects.name, '/', 1)
          AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
      )
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'mediator')
    )
  );

DROP POLICY IF EXISTS "dispute_evidence_write" ON storage.objects;
CREATE POLICY "dispute_evidence_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dispute-evidence'
    AND (
      EXISTS (
        SELECT 1 FROM public.disputes d
        JOIN public.transactions t ON t.id = d.transaction_id
        WHERE d.id::text = split_part(storage.objects.name, '/', 1)
          AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
      )
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'mediator')
    )
  );

DROP POLICY IF EXISTS "dispute_evidence_delete" ON storage.objects;
CREATE POLICY "dispute_evidence_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'dispute-evidence'
    AND (
      owner = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'mediator')
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dispute_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dispute_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'disputes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.disputes;
  END IF;
END $$;
