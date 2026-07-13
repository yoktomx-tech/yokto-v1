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
  pending:   { label: "Pendiente",   cls: "bg-yo-warn-bg text-yo-warn" },
  in_review: { label: "En revisión", cls: "bg-yo-ac-bg   text-yo-ac-txt" },
  approved:  { label: "Aprobado",    cls: "bg-yo-ok-bg   text-yo-ok" },
  rejected:  { label: "Rechazado",   cls: "bg-yo-err-bg  text-yo-err" },
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
    <div className="min-h-dvh flex flex-col bg-yo-bg">
      <AppHeader email={user.email} userId={user.id} section="Panel" />

      <main className="flex-1">
        <div className="container-editorial py-8 lg:py-12">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.14em] text-yo-txt-3 font-semibold">Bienvenido</p>
              <h1 className="mt-2 text-3xl md:text-4xl font-bold text-yo-txt tracking-tight">
                Hola, {displayName}.
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-yo-txt-2">
                Este es tu panel de operaciones YOKTO. Controla transacciones, verificaciones y liberaciones de fondos.
              </p>
            </div>
            {approved && (
              <Link
                to="/transactions/new"
                className="inline-flex items-center gap-2 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold px-4 py-2.5 shadow-sm transition"
              >
                Nueva transacción
                <ArrowRight className="size-4" />
              </Link>
            )}
          </div>

          {loading ? (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-32 rounded-[10px] bg-yo-surface border border-yo-border animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                  label="Estado KYC"
                  value={profile ? KYC_BADGE[profile.kyc_status].label : "—"}
                  icon={ShieldCheck}
                  accent={profile ? KYC_BADGE[profile.kyc_status].cls : undefined}
                  accentLine={profile?.kyc_status === "approved" ? "bg-yo-ok" : profile?.kyc_status === "rejected" ? "bg-yo-err" : "bg-yo-ac"}
                />
                <MetricCard
                  label="Roles asignados"
                  value={roles.length ? roles.join(", ") : "buyer"}
                  icon={UserCheck}
                  accentLine="bg-yo-ac"
                />
                <MetricCard
                  label="Onboarding"
                  value={profile?.onboarding_completed ? "Completo" : "Incompleto"}
                  icon={Wallet}
                  accent={
                    profile?.onboarding_completed
                      ? "bg-yo-ok-bg text-yo-ok"
                      : "bg-yo-warn-bg text-yo-warn"
                  }
                  accentLine={profile?.onboarding_completed ? "bg-yo-ok" : "bg-yo-warn"}
                />
              </div>

              <div className="mt-6 relative overflow-hidden rounded-xl border border-yo-border bg-yo-surface p-6 md:p-8 shadow-sm">
                <div aria-hidden className="absolute top-0 inset-x-0 h-[2px] bg-yo-ac" />
                <div className="relative">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-yo-txt-3 font-semibold">Próximo paso</p>
                  <h2 className="mt-2 text-2xl md:text-3xl font-bold text-yo-txt tracking-tight">
                    {approved ? "Crea tu primera transacción" : "Completa tu verificación KYC"}
                  </h2>
                  <p className="mt-3 text-sm text-yo-txt-2 max-w-xl leading-relaxed">
                    {approved
                      ? "Ya puedes iniciar operaciones de pago contra cumplimiento con contrapartes verificadas."
                      : "Sube tus documentos fiscales y de identidad para habilitar operaciones."}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    {approved ? (
                      <Link
                        to="/transactions/new"
                        className="inline-flex items-center gap-2 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition"
                      >
                        Crear transacción
                        <ArrowRight className="size-4" />
                      </Link>
                    ) : (
                      <Link
                        to="/kyc"
                        className="inline-flex items-center gap-2 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition"
                      >
                        {profile?.kyc_status === "in_review" ? "Ver estado KYC" : "Iniciar KYC"}
                        <ArrowRight className="size-4" />
                      </Link>
                    )}
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
  label, value, icon: Icon, accent, accentLine = "bg-yo-ac",
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
  accentLine?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[10px] bg-yo-surface border border-yo-border p-4 hover:shadow transition-shadow">
      <div aria-hidden className={`absolute top-0 inset-x-0 h-[2px] ${accentLine}`} />
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-yo-txt-3">{label}</p>
        <div className="grid place-items-center size-7 rounded-md bg-yo-ac-bg">
          <Icon className="size-3.5 text-yo-ac" />
        </div>
      </div>
      <div className="mt-3">
        {accent ? (
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-semibold ${accent}`}>
            {value}
          </span>
        ) : (
          <p className="text-2xl font-bold tracking-tight text-yo-txt truncate">{value}</p>
        )}
      </div>
    </div>
  );
}
