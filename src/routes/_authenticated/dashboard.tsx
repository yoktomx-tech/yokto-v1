import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck, Wallet, UserCheck, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app-header";

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

const KYC_BADGE: Record<Profile["kyc_status"], { label: string; cls: string }> = {
  pending:   { label: "Pendiente",   cls: "bg-yokto-warning/12 text-yokto-warning border-yokto-warning/25" },
  in_review: { label: "En revisión", cls: "bg-yokto-accent/12  text-yokto-accent  border-yokto-accent/25" },
  approved:  { label: "Aprobado",    cls: "bg-yokto-success/12 text-yokto-success border-yokto-success/25" },
  rejected:  { label: "Rechazado",   cls: "bg-yokto-error/12   text-yokto-error   border-yokto-error/25" },
};

function Dashboard() {
  const { user } = Route.useRouteContext();
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

  const displayName = profile?.first_name || profile?.email?.split("@")[0] || "Operador";
  const approved = profile?.kyc_status === "approved";

  return (
    <div className="min-h-dvh flex flex-col bg-yokto-base">
      <AppHeader email={user.email} section="Panel" />

      <main className="flex-1">
        <div className="container-editorial py-10 lg:py-14">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest text-yokto-text-3 font-semibold">Bienvenido</p>
              <h1 className="mt-2 font-display text-4xl md:text-5xl text-yokto-text-1 tracking-tight">
                Hola, {displayName}.
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-yokto-text-2">
                Este es tu panel de operaciones YOKTO. Controla transacciones, verificaciones y liberaciones de fondos.
              </p>
            </div>
            {approved && (
              <Link
                to="/transactions/new"
                className="inline-flex items-center gap-2 rounded-md bg-yokto-accent hover:bg-yokto-accent-h text-white text-sm font-semibold px-4 py-2.5 shadow-sm hover:shadow-glow-accent transition"
              >
                Nueva transacción
                <ArrowRight className="size-4" />
              </Link>
            )}
          </div>

          {loading ? (
            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-32 rounded-xl bg-yokto-card border border-white/[0.06] animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                  label="Estado KYC"
                  value={profile ? KYC_BADGE[profile.kyc_status].label : "—"}
                  icon={ShieldCheck}
                  accent={profile ? KYC_BADGE[profile.kyc_status].cls : undefined}
                />
                <MetricCard
                  label="Roles asignados"
                  value={roles.length ? roles.join(", ") : "buyer"}
                  icon={UserCheck}
                />
                <MetricCard
                  label="Onboarding"
                  value={profile?.onboarding_completed ? "Completo" : "Incompleto"}
                  icon={Wallet}
                  accent={
                    profile?.onboarding_completed
                      ? "bg-yokto-success/12 text-yokto-success border-yokto-success/25"
                      : "bg-yokto-warning/12 text-yokto-warning border-yokto-warning/25"
                  }
                />
              </div>

              <div className="mt-6 relative overflow-hidden rounded-xl border border-white/[0.08] p-6 md:p-8 bg-gradient-to-br from-yokto-accent/[0.08] via-yokto-card to-yokto-card">
                <div
                  aria-hidden
                  className="absolute -top-24 -right-24 size-72 rounded-full bg-yokto-accent/20 blur-3xl pointer-events-none"
                />
                <div className="relative">
                  <p className="text-xs uppercase tracking-widest text-yokto-text-3 font-semibold">Próximo paso</p>
                  <h2 className="mt-2 text-2xl md:text-3xl font-bold text-yokto-text-1 tracking-tight">
                    {approved ? "Crea tu primera transacción" : "Completa tu verificación KYC"}
                  </h2>
                  <p className="mt-3 text-sm text-yokto-text-2 max-w-xl leading-relaxed">
                    {approved
                      ? "Ya puedes iniciar operaciones de pago contra cumplimiento con contrapartes verificadas."
                      : "Sube tus documentos fiscales y de identidad para habilitar operaciones."}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    {approved ? (
                      <Link
                        to="/transactions/new"
                        className="inline-flex items-center gap-2 rounded-md bg-yokto-accent hover:bg-yokto-accent-h text-white text-sm font-semibold px-5 py-2.5 shadow-sm hover:shadow-glow-accent transition"
                      >
                        Crear transacción
                        <ArrowRight className="size-4" />
                      </Link>
                    ) : (
                      <Link
                        to="/kyc"
                        className="inline-flex items-center gap-2 rounded-md bg-yokto-accent hover:bg-yokto-accent-h text-white text-sm font-semibold px-5 py-2.5 shadow-sm hover:shadow-glow-accent transition"
                      >
                        {profile?.kyc_status === "in_review" ? "Ver estado KYC" : "Iniciar KYC"}
                        <ArrowRight className="size-4" />
                      </Link>
                    )}
                    <Link
                      to="/como-funciona"
                      className="inline-flex items-center gap-2 rounded-md border border-white/[0.10] hover:border-white/[0.20] bg-yokto-card hover:bg-yokto-hover text-yokto-text-1 text-sm font-medium px-5 py-2.5 transition"
                    >
                      Cómo funciona
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function MetricCard({
  label, value, icon: Icon, accent,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl bg-yokto-card border border-white/[0.06] p-5 hover:border-yokto-accent/30 transition-all duration-200 hover:shadow-glow-accent">
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-yokto-accent/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
      />
      <div className="relative flex items-start justify-between">
        <p className="text-xs uppercase tracking-widest text-yokto-text-3 font-semibold">{label}</p>
        <div className="grid place-items-center size-8 rounded-md bg-yokto-hover">
          <Icon className="size-4 text-yokto-text-3 group-hover:text-yokto-accent transition-colors" />
        </div>
      </div>
      <div className="relative mt-3">
        {accent ? (
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-sm font-semibold ${accent}`}>
            {value}
          </span>
        ) : (
          <p className="text-2xl font-extrabold tracking-tight text-yokto-text-1 truncate">{value}</p>
        )}
      </div>
    </div>
  );
}
