import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteFooter } from "@/components/site-footer";

type Profile = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  kyc_status: "pending" | "in_review" | "approved" | "rejected";
  onboarding_completed: boolean;
  account_type: string | null;
};

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Panel — YOKTO" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("first_name,last_name,email,kyc_status,onboarding_completed,account_type").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      setProfile((p.data as Profile) ?? null);
      setRoles((r.data ?? []).map((x: { role: string }) => x.role));
      setLoading(false);
    })();
  }, [user.id]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const displayName = profile?.first_name || profile?.email?.split("@")[0] || "Operador";
  const kycLabel: Record<Profile["kyc_status"], string> = {
    pending: "Pendiente",
    in_review: "En revisión",
    approved: "Aprobado",
    rejected: "Rechazado",
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-yokto-black bg-background">
        <div className="container-editorial flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid place-items-center size-7 bg-yokto-black text-yokto-cream font-display text-lg leading-none">Y</span>
            <span className="font-display text-2xl tracking-wide text-foreground">YOKTO</span>
            <span className="ml-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground border-l border-yokto-black/30 pl-3">Panel</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {user.email}
            </span>
            <button
              onClick={signOut}
              className="text-[12px] uppercase tracking-[0.14em] font-semibold border border-yokto-black px-3 py-2 hover:bg-yokto-black hover:text-yokto-cream"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container-editorial py-10">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Bienvenido</p>
          <h1 className="mt-2 font-display text-5xl md:text-6xl tracking-wide text-foreground">
            Hola, {displayName}.
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Este es tu panel de operaciones YOKTO. Aquí controlarás transacciones, verificaciones y liberaciones de fondos.
          </p>

          {loading ? (
            <div className="mt-10 text-sm text-muted-foreground">Cargando datos…</div>
          ) : (
            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card label="Estado KYC" value={profile ? kycLabel[profile.kyc_status] : "—"} accent={profile?.kyc_status === "approved"} />
              <Card label="Roles asignados" value={roles.length ? roles.join(", ") : "buyer"} />
              <Card
                label="Onboarding"
                value={profile?.onboarding_completed ? "Completo" : "Incompleto"}
                accent={profile?.onboarding_completed ?? false}
              />

              <div className="md:col-span-3 border border-yokto-black p-6 bg-yokto-cream/40">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Próximo paso</p>
                <h2 className="mt-2 font-display text-3xl text-foreground">
                  {profile?.kyc_status === "approved"
                    ? "Crea tu primera transacción"
                    : "Completa tu verificación KYC"}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground max-w-xl">
                  {profile?.kyc_status === "approved"
                    ? "Ya puedes iniciar operaciones de pago contra cumplimiento con contrapartes verificadas."
                    : "Sube tus documentos fiscales y de identidad para habilitar operaciones. Este módulo estará disponible en el próximo sprint."}
                </p>
                <div className="mt-5 flex gap-3">
                  {profile?.kyc_status === "approved" ? (
                    <Link
                      to="/transactions/new"
                      className="inline-flex items-center px-5 py-2.5 bg-yokto-yellow text-yokto-black text-[12px] uppercase tracking-[0.14em] font-semibold border border-yokto-black hover:bg-yokto-black hover:text-yokto-yellow"
                    >
                      Crear transacción
                    </Link>
                  ) : (
                    <Link
                      to="/kyc"
                      className="inline-flex items-center px-5 py-2.5 bg-yokto-yellow text-yokto-black text-[12px] uppercase tracking-[0.14em] font-semibold border border-yokto-black hover:bg-yokto-black hover:text-yokto-yellow"
                    >
                      {profile?.kyc_status === "in_review" ? "Ver estado KYC" : "Iniciar KYC"}
                    </Link>
                  )}
                  <Link
                    to="/como-funciona"
                    className="inline-flex items-center px-5 py-2.5 border border-yokto-black text-[12px] uppercase tracking-[0.14em] font-semibold hover:bg-yokto-black hover:text-yokto-cream"
                  >
                    Cómo funciona
                  </Link>
                </div>

              </div>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Card({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`border border-yokto-black p-5 ${accent ? "bg-yokto-yellow" : "bg-background"}`}>
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl tracking-wide text-foreground">{value}</p>
    </div>
  );
}
