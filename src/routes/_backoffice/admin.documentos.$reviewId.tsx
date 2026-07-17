import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminCard, AdminPageHeader } from "@/components/admin/admin-shell";
import { adminDocGet, adminDocDecide } from "@/lib/admin/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_backoffice/admin/documentos/$reviewId")({
  component: AdminDocDetail,
});

type Decision = "VALIDADO" | "RECHAZADO" | "SOLICITAR_CORRECCION" | "ESCALAR_A_DISPUTA" | "ESCALAR_A_COMPLIANCE" | "INCONCLUSO";

function AdminDocDetail() {
  const { reviewId } = Route.useParams();
  const get = useServerFn(adminDocGet);
  const decide = useServerFn(adminDocDecide);
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-doc", reviewId], queryFn: () => get({ data: { reviewId } }) });
  const [reason, setReason] = useState("");
  const [notas, setNotas] = useState("");

  const m = useMutation({
    mutationFn: (decision: Decision) => decide({ data: { reviewId, decision, reason, notas } }),
    onSuccess: () => {
      toast.success("Decisión registrada");
      qc.invalidateQueries({ queryKey: ["admin-docs"] });
      nav({ to: "/admin/documentos" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data) return <p className="text-yo-txt-3 text-sm">Cargando...</p>;

  return (
    <>
      <AdminPageHeader title={`Revisión: ${data.tipo}`} description={data.motivo_revision} />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">
        <AdminCard>
          <h3 className="text-sm font-semibold text-yo-txt mb-3">Contexto</h3>
          <div className="space-y-3 text-xs">
            <div>
              <p className="text-yo-txt-3 uppercase">Operación</p>
              <p className="text-yo-txt font-mono">{data.transaction_id ?? "—"}</p>
            </div>
            <div>
              <p className="text-yo-txt-3 uppercase">Sector</p>
              <p className="text-yo-txt">{data.sector ?? "—"}</p>
            </div>
            <div>
              <p className="text-yo-txt-3 uppercase">Estado actual</p>
              <p className="text-yo-txt">{data.estado}</p>
            </div>
            {data.ia_summary && (
              <div>
                <p className="text-yo-txt-3 uppercase mb-1">Resumen IA</p>
                <p className="text-yo-txt-2 bg-yo-surface p-3 rounded border border-yo-border">{data.ia_summary}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-yo-txt-3 uppercase mb-1">Valores esperados</p>
                <pre className="text-[10px] text-yo-txt-3 bg-yo-surface p-2 rounded border border-yo-border overflow-auto">
                  {JSON.stringify(data.expected_values ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-yo-txt-3 uppercase mb-1">Valores extraídos</p>
                <pre className="text-[10px] text-yo-txt-3 bg-yo-surface p-2 rounded border border-yo-border overflow-auto">
                  {JSON.stringify(data.extracted_values ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </AdminCard>

        <AdminCard>
          <h3 className="text-sm font-semibold text-yo-txt mb-3">Decisión</h3>
          {typeof data.confianza_ia === "number" && (
            <div className="mb-3 p-3 bg-yo-surface rounded border border-yo-border">
              <p className="text-[10px] text-yo-txt-3 uppercase">Confianza IA</p>
              <p className="text-2xl font-semibold text-yo-txt">{data.confianza_ia}%</p>
            </div>
          )}
          <label className="block text-[11px] text-yo-txt-3 uppercase mb-1">Motivo (obligatorio)</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)}
            className="w-full bg-yo-surface border border-yo-border rounded p-2 text-sm text-yo-txt h-20 mb-3" />
          <label className="block text-[11px] text-yo-txt-3 uppercase mb-1">Notas internas</label>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)}
            className="w-full bg-yo-surface border border-yo-border rounded p-2 text-sm text-yo-txt h-16 mb-3" />

          <div className="grid grid-cols-2 gap-2">
            {(["VALIDADO", "RECHAZADO", "SOLICITAR_CORRECCION", "ESCALAR_A_DISPUTA", "ESCALAR_A_COMPLIANCE", "INCONCLUSO"] as Decision[]).map((d) => (
              <button key={d} disabled={reason.length < 3 || m.isPending}
                onClick={() => m.mutate(d)}
                className={
                  "px-2 py-1.5 text-[11px] rounded font-medium disabled:opacity-40 " +
                  (d === "VALIDADO" ? "bg-green-600 hover:bg-green-500 text-yo-txt" :
                   d === "RECHAZADO" ? "bg-red-600 hover:bg-red-500 text-yo-txt" :
                   "bg-yo-raised hover:bg-yo-raised text-yo-txt border border-yo-border")
                }>{d.replace(/_/g, " ")}</button>
            ))}
          </div>
        </AdminCard>
      </div>
    </>
  );
}
