
CREATE OR REPLACE FUNCTION public.cleanup_abandoned_onboarding()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  deleted_count integer := 0;
  r record;
BEGIN
  FOR r IN
    SELECT u.id
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.created_at < now() - interval '24 hours'
      AND (
        p.id IS NULL
        OR (COALESCE(p.onboarding_completed, false) = false
            AND COALESCE(p.onboarding_step, 1) < 3
            AND COALESCE(p.kyc_status, 'not_started') NOT IN ('in_review','approved'))
      )
  LOOP
    DELETE FROM auth.users WHERE id = r.id;
    deleted_count := deleted_count + 1;
  END LOOP;
  RETURN deleted_count;
END;
$function$;

-- Función para que el propio usuario cancele y borre su onboarding en curso
CREATE OR REPLACE FUNCTION public.cancel_my_onboarding()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  uid uuid := auth.uid();
  is_completed boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT COALESCE(onboarding_completed, false) INTO is_completed
  FROM public.profiles WHERE id = uid;

  IF is_completed THEN
    RAISE EXCEPTION 'onboarding already completed; cannot cancel';
  END IF;

  DELETE FROM auth.users WHERE id = uid;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.cancel_my_onboarding() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_my_onboarding() TO authenticated;
