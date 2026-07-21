
CREATE OR REPLACE FUNCTION public.assign_transaction_numero()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
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
