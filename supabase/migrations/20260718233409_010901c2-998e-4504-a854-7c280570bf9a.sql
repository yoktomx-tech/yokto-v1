DROP POLICY IF EXISTS dispute_evidence_update ON storage.objects;
CREATE POLICY dispute_evidence_update ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'dispute-evidence' AND (
    EXISTS (
      SELECT 1 FROM disputes d
      JOIN transactions t ON t.id = d.transaction_id
      WHERE d.id::text = split_part(objects.name, '/', 1)
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'mediator'::app_role)
  )
)
WITH CHECK (
  bucket_id = 'dispute-evidence' AND (
    EXISTS (
      SELECT 1 FROM disputes d
      JOIN transactions t ON t.id = d.transaction_id
      WHERE d.id::text = split_part(objects.name, '/', 1)
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'mediator'::app_role)
  )
);