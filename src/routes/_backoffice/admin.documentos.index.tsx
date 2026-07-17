import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AdminCard, AdminPageHeader } from "@/components/admin/admin-shell";
import { adminDocQueue } from "@/lib/admin/admin.functions";

export const Route = createFileRoute("/_backoffice/admin/documentos/")({
  component: AdminDocs,
});

const TIPOS = ["", "CFDI", "REP", "CARTA_PORTE", "BILL_OF_LADING", "AIR_WAYBILL", "PEDIMENTO", "CONTRATO", "EVIDENCIA_HITO", "CHECKLIST_SECTORIAL"];
const ESTADOS = ["", "PENDIENTE", "EN_REVISION", "VALIDADO", "RECHAZADO", "CORRECCION_SOLICITADA", "ESCALADO"];

function AdminDocs() {
  const list = useServerFn(adminDocQueue);
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState("");
  const { data } = useQuery({
    queryKey: ["admin-docs", tipo, estado],
    queryFn: () => list({ data: { tipo: tipo || undefined, estado: estado || undefined } }),
  });

  return (
    <>
      <AdminPageHeader title="Revisión documental" description="Cola del Analista Documental" />
      <AdminCard className="mb-4">
        <div className="flex gap-3 items-center flex-wrap">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}
            className="bg-[#0A0A0B] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white">
            {TIPOS.map((t) => <option key={t} value={t}>{t || "Todos los tipos"}</option>)}
          </select>
          <select value={estado} onChange={(e) => setEstado(e.target.value)}
            className="bg-[#0A0A0B] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white">
            {ESTADOS.map((s) => <option key={s} value={s}>{s || "Todos los estados"}</option>)}
          </select>
        </div>
      </AdminCard>

      <AdminCard>
        {(data ?? []).length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Sin elementos en la cola.</p>
        ) : (
          <div className="space-y-2">
            {(data ?? []).map((d) => (
              <Link key={d.id} to="/admin/documentos/$reviewId" params={{ reviewId: d.id }}
                className="block p-3 rounded-lg border border-white/5 hover:border-white/20 hover:bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[#A78BFA] bg-[#7C3AED]/15 px-2 py-0.5 rounded">{d.tipo}</span>
                      <span className={
                        "text-[10px] uppercase font-semibold px-2 py-0.5 rounded " +
                        (d.prioridad === "CRITICA" ? "bg-red-950 text-red-400" :
                         d.prioridad === "ALTA" ? "bg-orange-950 text-orange-400" :
                         "bg-white/5 text-gray-400")
                      }>{d.prioridad}</span>
                      {d.sector && <span className="text-[10px] text-gray-500">{d.sector}</span>}
                    </div>
                    <p className="text-sm text-gray-200 mt-1">{d.motivo_revision}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">Estado: {d.estado}</p>
                  </div>
                  {typeof d.confianza_ia === "number" && (
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 uppercase">Confianza IA</p>
                      <p className={
                        "text-lg font-semibold " +
                        (d.confianza_ia >= 80 ? "text-green-400" :
                         d.confianza_ia >= 60 ? "text-yellow-400" :
                         d.confianza_ia >= 30 ? "text-orange-400" : "text-red-400")
                      }>{d.confianza_ia}%</p>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </AdminCard>
    </>
  );
}
