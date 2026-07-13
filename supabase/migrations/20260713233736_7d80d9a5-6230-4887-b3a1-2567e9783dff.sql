CREATE TABLE public.postal_code_lookups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  cp text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  success boolean NOT NULL DEFAULT false,
  colonias jsonb,
  municipio text,
  estado text,
  ciudad text,
  pais text,
  error text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.postal_code_lookups TO authenticated;
GRANT ALL ON public.postal_code_lookups TO service_role;

ALTER TABLE public.postal_code_lookups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own postal code lookups"
  ON public.postal_code_lookups FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own postal code lookups"
  ON public.postal_code_lookups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_postal_code_lookups_user_id ON public.postal_code_lookups(user_id);
CREATE INDEX idx_postal_code_lookups_cp ON public.postal_code_lookups(cp);