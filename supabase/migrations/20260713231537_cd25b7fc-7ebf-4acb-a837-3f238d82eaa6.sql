
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.cleanup_abandoned_onboarding()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  deleted_count integer := 0;
  r record;
BEGIN
  FOR r IN
    SELECT u.id
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.created_at < now() - interval '3 days'
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
$$;

-- Reschedule idempotently
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'yokto-cleanup-abandoned-onboarding') THEN
    PERFORM cron.unschedule('yokto-cleanup-abandoned-onboarding');
  END IF;
  PERFORM cron.schedule(
    'yokto-cleanup-abandoned-onboarding',
    '0 4 * * *',
    $cron$ SELECT public.cleanup_abandoned_onboarding(); $cron$
  );
END $$;
