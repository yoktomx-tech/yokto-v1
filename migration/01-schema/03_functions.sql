CREATE OR REPLACE FUNCTION public.assign_dispute_numero()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero := 'DIS-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                  LPAD(nextval('public.dispute_numero_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.assign_support_numero()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero := 'SUP-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('public.support_ticket_numero_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END; $function$
;
CREATE OR REPLACE FUNCTION public.assign_transaction_numero()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero := 'YOKTO-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                  LPAD(nextval('public.transaction_numero_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$function$
;
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
$function$
;
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
$function$
;
CREATE OR REPLACE FUNCTION public.get_active_internal_role(_user_id uuid)
 RETURNS internal_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT rol FROM public.internal_role_assignments
  WHERE user_id = _user_id AND activo = true
    AND (expira_at IS NULL OR expira_at > now())
  LIMIT 1;
$function$
;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_org_id UUID;
  display_name TEXT;
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, avatar_url)
  VALUES (
    NEW.id, NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'buyer')
  ON CONFLICT (user_id, role) DO NOTHING;

  display_name := COALESCE(
    NULLIF(TRIM(CONCAT_WS(' ', NEW.raw_user_meta_data ->> 'first_name', NEW.raw_user_meta_data ->> 'last_name')), ''),
    split_part(NEW.email, '@', 1),
    'Mi organización'
  );

  INSERT INTO public.organizations (name, type, owner_user_id)
  VALUES (display_name, 'individual', NEW.id)
  RETURNING id INTO new_org_id;

  INSERT INTO public.memberships (org_id, user_id, org_role, status)
  VALUES (new_org_id, NEW.id, 'owner', 'active');

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.has_org_role(_org_id uuid, _user_id uuid, _role org_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE org_id = _org_id AND user_id = _user_id AND status = 'active' AND org_role = _role
  );
$function$
;
CREATE OR REPLACE FUNCTION public.has_platform_role(_user_id uuid, _role platform_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_roles WHERE user_id = _user_id AND role = _role
  );
$function$
;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$
;
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE org_id = _org_id AND user_id = _user_id AND status = 'active'
  );
$function$
;
CREATE OR REPLACE FUNCTION public.is_org_owner(_org_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_org_role(_org_id, _user_id, 'owner');
$function$
;
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$
;
