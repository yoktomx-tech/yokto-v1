-- Permitir invitar al pagador (comprador) además del beneficiario
ALTER TABLE public.transactions
  ALTER COLUMN buyer_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS pagador_nombre text;

-- Al menos una de las partes debe existir como usuario
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_parties_at_least_one;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_parties_at_least_one
  CHECK (buyer_id IS NOT NULL OR seller_id IS NOT NULL);