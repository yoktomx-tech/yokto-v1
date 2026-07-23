import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listFiscalDocsForUser } from "@/lib/ledger.functions";
import { PageHeader } from "@/components/page-header";
import { FileText, ArrowLeft, CheckCircle2, AlertCircle, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/payments/fiscal")({
  head: () => ({ meta: [{ title: "Documentos fiscales — CUMPLEX" }, { name: "robots", content: "noindex" }] }),
  component: FiscalPage,
});

const ESTADO_TONE: Record<string, { label: string; tone: string; icon: any }> = {
  aceptado: { label: "Aceptado", tone: "text-yo-ok bg-yo-ok/10", icon: CheckCircle2 },
  rechazado:{ label: "Rechazado", tone: "text-yo-err bg-yo-err/10", icon: AlertCircle },
  pendiente:{ label: "Pendiente", tone: "text-yo-warn bg-yo-warn/10", icon: Clock },
  en_revision:{ label: "En revisión", tone: "text-yo-info bg-yo-info/10", icon: Clock },
};

function FiscalPage() {
  const navigate = useNavigate();
  const fn = useServerFn(listFiscalDocsForUser);
  const { data: docs = [], isLoading } = useQuery({ queryKey: ["fiscal-docs"], queryFn: () => fn() });
  const [tipo, setTipo] = useState<string>("ALL");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return docs.filter((d) => {
      if (tipo !== "ALL" && d.tipo !== tipo) return false;
      if (query) {
        const hay = [d.uuidFiscal, d.folio, d.serie, d.rfcEmisor, d.rfcReceptor, d.txNumero, d.txTitle]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [docs, tipo, q]);

  const stats = useMemo(() => ({
    total: docs.length,
    aceptados: docs.filter((d) => d.estado === "aceptado").length,
    pendientes: docs.filter((d) => d.estado === "pendiente" || d.estado === "en_revision").length,
    rechazados: docs.filter((d) => d.estado === "rechazado").length,
  }), [docs]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title="Documentos fiscales"
        subtitle="CFDIs PPD y REPs asociados a tus transacciones. Validación SAT y coherencia con cada operación."
        actions={
          <Link
            to="/payments"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-yo-card border border-yo-border text-yo-t1 text-sm font-medium rounded-md hover:bg-yo-hover"
          >
            <ArrowLeft className="size-4" /> Centro de Pagos
          </Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-yo-border bg-yo-card p-4">
          <p className="text-xs text-yo-t2">Total</p>
          <p className="mt-1 text-2xl font-semibold text-yo-t1">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-yo-border bg-yo-card p-4">
          <p className="text-xs text-yo-t2">Aceptados</p>
          <p className="mt-1 text-2xl font-semibold text-yo-ok">{stats.aceptados}</p>
        </div>
        <div className="rounded-xl border border-yo-border bg-yo-card p-4">
          <p className="text-xs text-yo-t2">Pendientes</p>
          <p className="mt-1 text-2xl font-semibold text-yo-warn">{stats.pendientes}</p>
        </div>
        <div className="rounded-xl border border-yo-border bg-yo-card p-4">
          <p className="text-xs text-yo-t2">Rechazados</p>
          <p className="mt-1 text-2xl font-semibold text-yo-err">{stats.rechazados}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar UUID, folio, RFC o transacción…"
          className="flex-1 min-w-[240px] px-3 py-2 bg-yo-card border border-yo-border rounded-md text-sm text-yo-t1"
        />
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="px-3 py-2 bg-yo-card border border-yo-border rounded-md text-sm text-yo-t1"
        >
          <option value="ALL">Todos los tipos</option>
          <option value="PPD">CFDI PPD</option>
          <option value="PUE">CFDI PUE</option>
          <option value="REP">Complemento de Pago (REP)</option>
        </select>
      </div>

      <div className="rounded-xl border border-yo-border bg-yo-card overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-yo-t2">Cargando documentos…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-yo-t2">
            Sin documentos fiscales aún. Los CFDIs y REPs se validarán aquí conforme se timbren.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-yo-hover text-yo-t2">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Tipo</th>
                <th className="text-left px-3 py-2 font-medium">Serie/Folio</th>
                <th className="text-left px-3 py-2 font-medium">UUID</th>
                <th className="text-left px-3 py-2 font-medium">Emisor → Receptor</th>
                <th className="text-left px-3 py-2 font-medium">Transacción</th>
                <th className="text-right px-3 py-2 font-medium">Total</th>
                <th className="text-left px-3 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yo-border">
              {filtered.map((d) => {
                const estadoInfo = ESTADO_TONE[d.estado ?? ""] ?? { label: d.estado ?? "—", tone: "text-yo-t2 bg-yo-hover", icon: Clock };
                const Icon = estadoInfo.icon;
                return (
                  <tr
                    key={d.id}
                    className="hover:bg-yo-hover cursor-pointer"
                    onClick={() => navigate({ to: "/transactions/$id", params: { id: d.txId } })}
                  >
                    <td className="px-3 py-2">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-yo-ac/10 text-yo-ac">
                        {d.tipo ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-yo-t1">
                      {d.serie ?? ""} {d.folio ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-yo-t2 truncate max-w-[180px]">
                      {d.uuidFiscal ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-yo-t1">
                      <div className="truncate max-w-[200px]">{d.rfcEmisor ?? "—"}</div>
                      <div className="text-yo-t2">→ {d.rfcReceptor ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-yo-t1">{d.txNumero ?? "—"}</div>
                      <div className="text-xs text-yo-t2 truncate max-w-[180px]">{d.txTitle ?? ""}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-yo-t1">
                      {d.total !== null ? `${d.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })} ${d.moneda ?? "MXN"}` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${estadoInfo.tone}`}>
                        <Icon className="size-3" /> {estadoInfo.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
