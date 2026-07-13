
-- Storage policies: users manage files in their own folder (path prefix = user id)
CREATE POLICY "Users upload own kyc files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users view own kyc files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own kyc files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Verifiers view all kyc files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (public.has_role(auth.uid(), 'verifier') OR public.has_role(auth.uid(), 'admin'))
  );

-- Extend profiles with onboarding tracking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_step SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMPTZ;
