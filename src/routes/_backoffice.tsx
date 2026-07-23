import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { getMyInternalRole } from "@/lib/admin/admin.functions";
import { EmailVerificationGate } from "@/components/email-verification-gate";

export const Route = createFileRoute("/_backoffice")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    return { user: data.user };
  },
  component: BackofficeGate,
});

function BackofficeGate() {
  const fn = useServerFn(getMyInternalRole);
  const { data, isLoading, error } = useQuery({
    queryKey: ["internal-role"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#101014] flex items-center justify-center text-gray-400">
        Validando acceso al backoffice...
      </div>
    );
  }
  if (error || !data?.role) {
    return (
      <div className="min-h-screen bg-[#101014] flex items-center justify-center text-center">
        <div className="max-w-md p-8 bg-[#18181B] border border-white/10 rounded-xl">
          <h1 className="text-lg font-semibold text-white mb-2">Acceso restringido</h1>
          <p className="text-sm text-gray-400 mb-4">
            No tienes rol interno CUMPLEX activo. Solicita asignación a un Super Administrador.
          </p>
          <a href="/dashboard" className="text-sm text-[#A78BFA] hover:underline">← Volver a la app</a>
        </div>
      </div>
    );
  }

  return (
    <EmailVerificationGate>
      <AdminShell role={data.role}>
        <Outlet />
      </AdminShell>
    </EmailVerificationGate>
  );
}
