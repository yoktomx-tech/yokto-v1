DROP POLICY IF EXISTS "dispute_evidence_update" ON storage.objects;
CREATE POLICY "dispute_evidence_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'dispute-evidence' AND (
    EXISTS (
      SELECT 1 FROM public.disputes d
      JOIN public.transactions t ON t.id = d.transaction_id
      WHERE d.id::text = split_part(objects.name, '/', 1)
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'mediator'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'dispute-evidence' AND (
    EXISTS (
      SELECT 1 FROM public.disputes d
      JOIN public.transactions t ON t.id = d.transaction_id
      WHERE d.id::text = split_part(objects.name, '/', 1)
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'mediator'::public.app_role)
  )
);