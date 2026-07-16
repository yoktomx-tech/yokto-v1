DROP POLICY IF EXISTS party_insert ON public.disputes;
CREATE POLICY party_insert ON public.disputes
FOR INSERT TO authenticated
WITH CHECK (
  opened_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = disputes.transaction_id
      AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
  )
  AND status = 'open'
  AND resolution IS NULL
  AND COALESCE(deposit_paid, false) = false
);