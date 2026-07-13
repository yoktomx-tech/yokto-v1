
CREATE POLICY "dispute_evidence_read" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'dispute-evidence' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'mediator')
    OR EXISTS (
      SELECT 1 FROM public.disputes d
      JOIN public.transactions t ON t.id = d.transaction_id
      WHERE d.id::text = (storage.foldername(name))[2]
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  )
);
CREATE POLICY "dispute_evidence_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'dispute-evidence' AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "dispute_evidence_update" ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'dispute-evidence' AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "dispute_evidence_delete" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'dispute-evidence' AND (storage.foldername(name))[1] = auth.uid()::text
);
