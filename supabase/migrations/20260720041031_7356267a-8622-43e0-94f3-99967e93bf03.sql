
CREATE OR REPLACE FUNCTION public.support_tickets_owner_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean := false;
BEGIN
  -- Allow when there is no auth context (service role / triggers / cron)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Staff bypass: any active internal role can modify staff-only fields
  SELECT EXISTS (
    SELECT 1 FROM public.internal_role_assignments
    WHERE user_id = auth.uid()
      AND activo = true
      AND (expira_at IS NULL OR expira_at > now())
  ) INTO is_staff;

  IF is_staff THEN
    RETURN NEW;
  END IF;

  -- Non-staff owners: pin staff-only columns to their prior values
  NEW.status                 := OLD.status;
  NEW.priority               := OLD.priority;
  NEW.escalation             := OLD.escalation;
  NEW.escalated_at           := OLD.escalated_at;
  NEW.escalated_by           := OLD.escalated_by;
  NEW.escalation_reason      := OLD.escalation_reason;
  NEW.assigned_to            := OLD.assigned_to;
  NEW.plan                   := OLD.plan;
  NEW.contexto_rol_congelado := OLD.contexto_rol_congelado;
  NEW.sla_first_response_at  := OLD.sla_first_response_at;
  NEW.sla_resolution_at      := OLD.sla_resolution_at;
  NEW.first_response_at      := OLD.first_response_at;
  NEW.resolved_at            := OLD.resolved_at;
  NEW.closed_at              := OLD.closed_at;
  NEW.sla_warn_notified_at   := OLD.sla_warn_notified_at;
  NEW.sla_breach_notified_at := OLD.sla_breach_notified_at;
  NEW.escalation_notified_at := OLD.escalation_notified_at;
  NEW.is_live_chat           := OLD.is_live_chat;
  NEW.numero                 := OLD.numero;
  NEW.user_id                := OLD.user_id;
  NEW.org_id                 := OLD.org_id;
  NEW.created_at             := OLD.created_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_tickets_owner_guard ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_owner_guard
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.support_tickets_owner_update_guard();
