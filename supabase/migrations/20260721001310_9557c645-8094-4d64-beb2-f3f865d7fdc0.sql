
CREATE TABLE IF NOT EXISTS public.transaction_daily_counter (
  op_date date PRIMARY KEY,
  last_seq integer NOT NULL DEFAULT 0
);

GRANT SELECT ON public.transaction_daily_counter TO authenticated;
GRANT ALL ON public.transaction_daily_counter TO service_role;

ALTER TABLE public.transaction_daily_counter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no direct access" ON public.transaction_daily_counter
  FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.assign_transaction_numero()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  d date := (COALESCE(NEW.created_at, now()) AT TIME ZONE 'America/Mexico_City')::date;
  next_seq integer;
BEGIN
  IF NEW.numero IS NULL THEN
    INSERT INTO public.transaction_daily_counter AS c (op_date, last_seq)
    VALUES (d, 1)
    ON CONFLICT (op_date) DO UPDATE SET last_seq = c.last_seq + 1
    RETURNING last_seq INTO next_seq;

    NEW.numero := 'OP' || TO_CHAR(d, 'YYMMDD') || LPAD(next_seq::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;
