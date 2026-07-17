import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck, AlertTriangle, ClipboardList, Bell, CheckCircle2, Info, ArrowRight, RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { getPldOverview } from "@/lib/pld.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pld/")({
  head: () => ({
    meta: [
      { title: "PLD/FT — YOKTO" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PldIndex,
});

const LEVEL_STYLE: Record<string, { badge: string; ring: string; label: string }> = {
  bajo:         { badge: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", ring: "text-emerald-500", label: "Bajo" },
  medio:        { badge: "bg-amber-500/15 text-amber-500 border-amber-500/30",       ring: "text-amber-500",   label: "Medio" },
  alto:         { badge: "bg-orange-500/15 text-orange-500 border-orange-500/30",    ring: "text-orange-500",  label: "Alto" },
  inaceptable:  { badge: "bg-red-500/15 text-red-500 border-red-500/30",             ring: "text-red-500",     label: "Inaceptable" },
};

function PldIndex() {
  const { currentOrg } = useCurrentOrg();
  const fn = useServerFn(getPldOverview);
  const navigate = useNavigate();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["pld-overview", currentOrg?.id],
    queryFn: () => fn({ data: { org_id: currentOrg!.id } }),
    enabled: !!currentOrg?.id,
  });

  const profile = data?.profile ?? null;
  const questionnaire = data?.questionnaire ?? null;
  const alerts = data?.alerts ?? [];
  const factors = data?.factors ?? [];
  const openAlerts = useMemo(() => alerts.filter(a => a.status === "abierta" || a.status === "en_revision"), [alerts]);

  const level = (profile?.level ?? "medio") as string;
  const style = LEVEL_STYLE[level] ?? LEVEL_STYLE.medio;
  const score = profile?.score ?? 0;

  if (!currentOrg) {
    return (
      <div className="p-6">
        <PageHeader icon={ShieldCheck} title="PLD/FT" subtitle="Prevención de Lavado de Dinero y Financiamiento al Terrorismo" />
        <div className="mt-6 rounded-lg border border-yo-border bg-yo-surface p-8 text-center text-yo-txt-2">
          Selecciona una organización para ver su perfil PLD/FT.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="PLD/FT"
        subtitle="Perfil de riesgo, screening y alertas"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 rounded-lg border border-yo-border bg-yo-surface px-3 py-2 text-sm text-yo-txt-2 hover:text-yo-txt"
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              Actualizar
            </button>
            <button
              onClick={() => navigate({ to: "/pld/cuestionario" })}
              className="inline-flex items-center gap-2 rounded-lg bg-yo-accent px-3 py-2 text-sm font-medium text-yo-bg hover:opacity-90"
            >
              <ClipboardList className="h-4 w-4" />
              {questionnaire ? "Actualizar cuestionario" : "Completar cuestionario"}
            </button>
          </div>
        }
      />

      {/* Perfil de riesgo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 rounded-lg border border-yo-border bg-yo-surface p-6">
          <div className="text-[11px] uppercase tracking-wider text-yo-txt-2 font-semibold">Nivel de riesgo</div>
          <div className={cn("mt-3 text-5xl font-bold tabular-nums", style.ring)}>{score}</div>
          <div className="mt-1 text-sm text-yo-txt-2">de 100 (mayor = mayor riesgo)</div>
          <div className={cn("mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium", style.badge)}>
            <ShieldCheck className="h-3.5 w-3.5" />
            {style.label}
          </div>
          {profile?.next_review_at && (
            <div className="mt-4 text-xs text-yo-txt-2">
              Próxima revisión: {new Date(profile.next_review_at).toLocaleDateString("es-MX")}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 rounded-lg border border-yo-border bg-yo-surface p-6">
          <div className="text-[11px] uppercase tracking-wider text-yo-txt-2 font-semibold mb-3">Estado</div>
          {isLoading ? (
            <div className="text-yo-txt-2 text-sm">Cargando…</div>
          ) : !questionnaire ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm text-yo-txt-2">
                <Info className="h-4 w-4 mt-0.5 text-yo-accent shrink-0" />
                Aún no has completado el cuestionario PLD/FT. Es requisito para activar la organización en operaciones de riesgo medio o superior.
              </div>
              <Link to="/pld/cuestionario"
                className="inline-flex items-center gap-2 rounded-lg bg-yo-accent px-3 py-2 text-sm font-medium text-yo-bg hover:opacity-90">
                Iniciar cuestionario <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Stat label="Estado" value={profile?.status ?? "vigente"} />
              <Stat label="Actividad" value={questionnaire.actividad_economica ?? "—"} />
              <Stat label="Volumen mensual" value={
                questionnaire.volumen_mensual_estimado != null
                  ? `$${Number(questionnaire.volumen_mensual_estimado).toLocaleString("es-MX")}`
                  : "—"
              } />
              <Stat label="PEP" value={questionnaire.es_pep ? "Sí" : questionnaire.familiar_pep ? "Familiar PEP" : "No"} />
              <Stat label="Uso de efectivo" value={questionnaire.usa_efectivo ? "Sí" : "No"} />
              <Stat label="Última evaluación" value={
                profile?.last_evaluated_at ? new Date(profile.last_evaluated_at).toLocaleString("es-MX") : "—"
              } />
            </div>
          )}
        </div>
      </div>

      {/* Alertas abiertas */}
      <div className="rounded-lg border border-yo-border bg-yo-surface">
        <div className="flex items-center justify-between p-4 border-b border-yo-border">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-yo-txt-2" />
            <h3 className="text-sm font-semibold text-yo-txt">Alertas abiertas</h3>
            <span className="text-xs text-yo-txt-2">({openAlerts.length})</span>
          </div>
        </div>
        {openAlerts.length === 0 ? (
          <div className="p-6 text-center text-sm text-yo-txt-2 flex flex-col items-center gap-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            No hay alertas abiertas.
          </div>
        ) : (
          <ul className="divide-y divide-yo-border">
            {openAlerts.map(a => (
              <li key={a.id} className="p-4 flex items-start gap-3">
                <AlertTriangle className={cn(
                  "h-5 w-5 mt-0.5 shrink-0",
                  a.severity === "critica" ? "text-red-500" :
                  a.severity === "alta" ? "text-orange-500" :
                  a.severity === "media" ? "text-amber-500" : "text-yo-txt-2",
                )} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-yo-txt">{a.title}</div>
                  {a.description && <div className="text-xs text-yo-txt-2 mt-1">{a.description}</div>}
                  <div className="text-[11px] text-yo-txt-2 mt-1">
                    {new Date(a.detected_at).toLocaleString("es-MX")}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Factores */}
      <div className="rounded-lg border border-yo-border bg-yo-surface">
        <div className="flex items-center gap-2 p-4 border-b border-yo-border">
          <ShieldCheck className="h-4 w-4 text-yo-txt-2" />
          <h3 className="text-sm font-semibold text-yo-txt">Factores del puntaje</h3>
          <span className="text-xs text-yo-txt-2">({factors.length})</span>
        </div>
        {factors.length === 0 ? (
          <div className="p-6 text-center text-sm text-yo-txt-2">
            Sin factores registrados. Completa el cuestionario para calcular el perfil.
          </div>
        ) : (
          <ul className="divide-y divide-yo-border">
            {factors.map(f => (
              <li key={f.id} className="p-4 grid grid-cols-12 gap-4 items-center">
                <div className="col-span-2 text-[11px] uppercase tracking-wider text-yo-txt-2">{f.category}</div>
                <div className="col-span-7 text-sm text-yo-txt">{f.label}</div>
                <div className="col-span-3 text-right">
                  <span className="inline-flex items-center gap-1 rounded-full border border-yo-border px-2 py-0.5 text-xs tabular-nums text-yo-txt">
                    +{f.contribution} pts
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-yo-txt-2">{label}</div>
      <div className="mt-0.5 text-sm text-yo-txt">{value}</div>
    </div>
  );
}
