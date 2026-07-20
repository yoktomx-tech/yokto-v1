-- 1. Cerrar exposición pública de invitations. El flujo de invitado ya usa
-- una server function con service role, así que anon no necesita SELECT.
DROP POLICY IF EXISTS "public can read invitation by token" ON public.invitations;
REVOKE SELECT ON public.invitations FROM anon;

-- 2. Restringir platform_incidents a usuarios autenticados (no exponer a anon).
DROP POLICY IF EXISTS "incidents public read" ON public.platform_incidents;
CREATE POLICY "authenticated can read incidents"
  ON public.platform_incidents
  FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.platform_incidents FROM anon;

-- 3. Función de trigger no debe ser invocable como RPC por nadie.
REVOKE EXECUTE ON FUNCTION public.support_tickets_owner_update_guard() FROM PUBLIC, anon, authenticated;