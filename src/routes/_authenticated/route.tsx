import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OrgProvider } from "@/hooks/use-current-org";
import { ViewRoleProvider } from "@/hooks/use-view-role";
import { AuthUserProvider } from "@/hooks/use-auth-user";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const [name, setName] = useState<string | undefined>(undefined);

  useEffect(() => {
    supabase.from("profiles").select("first_name,email").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        setName(data?.first_name ?? data?.email?.split("@")[0] ?? "Usuario");
      });
  }, [user.id]);

  return (
    <AuthUserProvider value={{ userId: user.id, email: user.email ?? null, displayName: name }}>
      <OrgProvider>
        <ViewRoleProvider>
          <Outlet />
        </ViewRoleProvider>
      </OrgProvider>
    </AuthUserProvider>
  );
}
