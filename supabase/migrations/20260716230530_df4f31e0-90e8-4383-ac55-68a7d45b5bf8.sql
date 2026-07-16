
-- 1) Revoke anon EXECUTE on cancel_my_onboarding (SECURITY DEFINER)
REVOKE EXECUTE ON FUNCTION public.cancel_my_onboarding() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_onboarding() TO authenticated;

-- 2) Explicit RESTRICTIVE policy on disputes: only admin/mediator may UPDATE
DROP POLICY IF EXISTS disputes_restrict_party_update ON public.disputes;
CREATE POLICY disputes_restrict_party_update
  ON public.disputes
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'mediator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'mediator'));

-- Also restrict DELETE to admin/mediator explicitly
DROP POLICY IF EXISTS disputes_restrict_party_delete ON public.disputes;
CREATE POLICY disputes_restrict_party_delete
  ON public.disputes
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'mediator'));

-- 3) Allow owners to UPDATE their own storage objects (fixes fail-closed observation)
DROP POLICY IF EXISTS tx_docs_storage_update ON storage.objects;
CREATE POLICY tx_docs_storage_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'transaction-documents' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'transaction-documents' AND owner = auth.uid());

DROP POLICY IF EXISTS party_update_verif_files ON storage.objects;
CREATE POLICY party_update_verif_files
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'verification-evidence' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'verification-evidence' AND owner = auth.uid());
