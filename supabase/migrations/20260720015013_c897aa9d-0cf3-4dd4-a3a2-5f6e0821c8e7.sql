-- Support attachments DELETE: require ticket ownership/org membership
DROP POLICY IF EXISTS "Support attachments — owner delete own" ON storage.objects;
CREATE POLICY "Support attachments — owner delete own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND owner = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id::text = (storage.foldername(objects.name))[1]
      AND (t.user_id = auth.uid() OR public.is_org_member(t.org_id, auth.uid()))
  )
);

-- Transaction documents UPDATE/DELETE: require current party membership
DROP POLICY IF EXISTS tx_docs_storage_update ON storage.objects;
CREATE POLICY tx_docs_storage_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'transaction-documents'
  AND owner = auth.uid()
  AND (storage.foldername(name))[1] IN (
    SELECT t.id::text FROM public.transactions t
    WHERE t.buyer_id = auth.uid() OR t.seller_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'transaction-documents'
  AND owner = auth.uid()
  AND (storage.foldername(name))[1] IN (
    SELECT t.id::text FROM public.transactions t
    WHERE t.buyer_id = auth.uid() OR t.seller_id = auth.uid()
  )
);

DROP POLICY IF EXISTS tx_docs_storage_delete ON storage.objects;
CREATE POLICY tx_docs_storage_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'transaction-documents'
  AND owner = auth.uid()
  AND (storage.foldername(name))[1] IN (
    SELECT t.id::text FROM public.transactions t
    WHERE t.buyer_id = auth.uid() OR t.seller_id = auth.uid()
  )
);

-- Verification evidence UPDATE/DELETE: require current transaction party membership
DROP POLICY IF EXISTS party_update_verif_files ON storage.objects;
CREATE POLICY party_update_verif_files
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'verification-evidence'
  AND owner = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id::text = split_part(objects.name, '/', 1)
      AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'verification-evidence'
  AND owner = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id::text = split_part(objects.name, '/', 1)
      AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
  )
);

DROP POLICY IF EXISTS owner_delete_verif_files ON storage.objects;
CREATE POLICY owner_delete_verif_files
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'verification-evidence'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      owner = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.transactions t
        WHERE t.id::text = split_part(objects.name, '/', 1)
          AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
      )
    )
  )
);