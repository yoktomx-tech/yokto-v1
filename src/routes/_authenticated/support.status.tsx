import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { listPlatformIncidents } from "@/lib/support.functions";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/support/status")({
  component: StatusPage,
});

const SERVICES = [
  { id: "api", name: "API" },
  { id: "app", name: "Panel web" },
  { id: "spei", name: "SPEI / Fondeo" },
  { id: "stripe", name: "Stripe Connect" },
  { id: "webhooks", name: "Webhooks" },
];

function StatusPage() {
  const fn = useServerFn(listPlatformIncidents);
  const { data } = useQuery({ queryKey: ["incidents"], queryFn: () => fn(), staleTime: 30_000 });
  const active = (data ?? []).filter((i: { status: string }) => i.status !== "resolved");

  return (
    <div className="space-y-6">
      <PageHeader icon={Activity} title="Estado de plataforma" subtitle="Servicios y incidentes recientes de YOKTO." />

      <div className="rounded-xl border border-yo-border bg-yo-surface divide-y divide-yo-border">
        {SERVICES.map((s) => {
          const inc = active.find((i: { service: string }) => i.service === s.id);
          const tone = !inc ? "emerald" : inc.severity === "critical" ? "red" : "amber";
          const cls = tone === "emerald" ? "bg-emerald-50 text-emerald-700"
            : tone === "red" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700";
          return (
            <div key={s.id} className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-medium text-yo-txt">{s.name}</p>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${cls}`}>
                ● {inc ? inc.status : "Operacional"}
              </span>
            </div>
          );
        })}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-yo-txt mb-3">Incidentes recientes</h2>
        <div className="space-y-2">
          {(data ?? []).map((i: { id: string; title: string; status: string; severity: string; started_at: string; body_md: string | null }) => (
            <div key={i.id} className="rounded-xl border border-yo-border bg-yo-surface p-4">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${i.severity === "critical" ? "bg-red-100 text-red-700" : i.severity === "major" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>{i.severity}</span>
                <p className="text-sm font-medium text-yo-txt">{i.title}</p>
                <span className="ml-auto text-[11px] text-yo-txt-3 font-mono">{new Date(i.started_at).toLocaleString("es-MX")}</span>
              </div>
              {i.body_md && <p className="mt-2 text-xs text-yo-txt-2 whitespace-pre-wrap">{i.body_md}</p>}
            </div>
          ))}
          {!data?.length && <p className="text-sm text-yo-txt-3">Sin incidentes registrados.</p>}
        </div>
      </div>
    </div>
  );
}
