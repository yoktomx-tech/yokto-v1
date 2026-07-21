
DROP POLICY IF EXISTS "buyer creates transactions" ON public.transactions;
DROP POLICY IF EXISTS "buyer updates draft" ON public.transactions;
DROP POLICY IF EXISTS "buyer deletes draft" ON public.transactions;

CREATE POLICY "party creates transactions"
ON public.transactions FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = creado_por
  AND (
    auth.uid() = buyer_id
    OR auth.uid() = seller_id
  )
  AND (buyer_id IS NOT NULL OR seller_id IS NOT NULL)
);

CREATE POLICY "party updates draft"
ON public.transactions FOR UPDATE TO authenticated
USING (
  (
    (auth.uid() = buyer_id OR auth.uid() = seller_id OR auth.uid() = creado_por)
    AND status = 'draft'::transaction_status
  )
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  (
    (auth.uid() = buyer_id OR auth.uid() = seller_id OR auth.uid() = creado_por)
    AND status = 'draft'::transaction_status
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "party deletes draft"
ON public.transactions FOR DELETE TO authenticated
USING (
  (
    (auth.uid() = buyer_id OR auth.uid() = seller_id OR auth.uid() = creado_por)
    AND status = 'draft'::transaction_status
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);
