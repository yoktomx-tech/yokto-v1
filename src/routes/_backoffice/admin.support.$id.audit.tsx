import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, FileText, Filter, RefreshCw } from "lucide-react";
import { AdminCard, AdminPageHeader } from "@/components/admin/admin-shell";
import { adminGetTicketAudit, type TicketAuditRow } from "@/lib/admin/audit.functions";
import { INTERNAL_ROLE_LABEL, type InternalRole } from "@/lib/admin/permissions";

export const Route = createFileRoute("/_backoffice/admin/support/$id/audit")({
  component: TicketAudit,
});

const ACTION_OPTIONS = [
  "support.reply", "support.escalate", "support.close",
  "support.attachment.upload", "support.attachment.download",
  "support.assign", "support.reopen",
];

function TicketAudit() {
  const { id } = Route.useParams();
  const fn = useServerFn(adminGetTicketAudit);

  const [kinds, setKinds] = useState<Array<"action" | "download">>(["action", "download"]);
  const [actions, setActions] = useState<string[]>([]);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [search, setSearch] = useState("");

  const params = useMemo(() => ({
    id,
    kinds: kinds.length ? kinds : undefined,
    actions: actions.length ? actions : undefined,
    from: from ? new Date(from).toISOString() : null,
    to: to ? new Date(to).toISOString() : null,
    search: search.trim() || null,
  }), [id, kinds, actions, from, to, search]);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-ticket-audit", params],
    queryFn: () => fn({ data: params }),
  });

  function toggleKind(k: "action" | "download") {
    setKinds((prev) => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);
  }
  function toggleAction(a: string) {
    setActions((prev) => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  }

  async function exportPdf() {
    if (!data) return;
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
    const now = new Date();
    doc.setFontSize(14);
    doc.text("Auditoría de ticket de soporte", 40, 40);
    doc.setFontSize(10);
    doc.setTextColor(90);
    const t = data.ticket;
    if (t) {
      doc.text(`Ticket: ${t.numero ?? t.id.slice(0,8)} · ${t.subject}`, 40, 58);
      doc.text(`Estado: ${t.status} · Prioridad: ${t.priority} · Escalamiento: ${t.escalation} · Plan: ${(t.plan ?? "free").toUpperCase()}`, 40, 72);
    }
    doc.text(`Generado: ${now.toLocaleString("es-MX")} · ${data.rows.length} eventos`, 40, 86);

    const body = data.rows.map((r) => rowToPdfCells(r));
    autoTable(doc, {
      startY: 100,
      head: [["Fecha", "Tipo", "Actor", "Rol", "Acción / Recurso", "Detalle", "IP"]],
      body,
      styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
      headStyles: { fillColor: [24, 24, 27], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 90 }, 1: { cellWidth: 55 }, 2: { cellWidth: 120 },
        3: { cellWidth: 90 }, 4: { cellWidth: 150 }, 5: { cellWidth: 200 }, 6: { cellWidth: 80 },
      },
      didDrawPage: (dat) => {
        doc.setFontSize(8); doc.setTextColor(120);
        doc.text(`CUMPLEX · Confidencial · pág ${dat.pageNumber}`, 40, doc.internal.pageSize.getHeight() - 20);
      },
    });
    doc.save(`auditoria-${t?.numero ?? id.slice(0,8)}.pdf`);
  }

  return (
    <>
      <Link to="/admin/support/$id" params={{ id }} className="inline-flex items-center gap-1.5 text-xs text-yo-txt-3 hover:text-yo-txt mb-3">
        <ArrowLeft className="size-3.5" /> Volver al ticket
      </Link>
      <AdminPageHeader
        title="Auditoría del ticket"
        description="Acciones internas y descargas de adjuntos registradas para este ticket."
      />

      <AdminCard>
        <div className="flex items-center gap-2 mb-3">
          <Filter className="size-4 text-yo-ac" />
          <p className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold">Filtros</p>
          <button onClick={() => refetch()} disabled={isFetching}
            className="ml-auto inline-flex items-center gap-1.5 h-8 px-2 text-xs rounded border border-yo-border hover:bg-yo-raised">
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} /> Recargar
          </button>
          <button onClick={exportPdf} disabled={!data?.rows.length}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded bg-[#18181B] text-white disabled:opacity-40">
            <Download className="size-3.5" /> Exportar PDF
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="text-[10px] uppercase text-yo-txt-3 font-semibold">Tipo</label>
            <div className="mt-1 flex gap-1.5">
              {(["action","download"] as const).map(k => (
                <button key={k} onClick={() => toggleKind(k)}
                  className={`h-7 px-2 rounded border text-[11px] ${kinds.includes(k) ? "bg-yo-ac text-white border-yo-ac" : "bg-white border-yo-border text-yo-txt-2"}`}>
                  {k === "action" ? "Acciones" : "Descargas"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase text-yo-txt-3 font-semibold">Desde</label>
            <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full h-8 px-2 rounded border border-yo-border bg-white text-[11px]" />
          </div>
          <div>
            <label className="text-[10px] uppercase text-yo-txt-3 font-semibold">Hasta</label>
            <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full h-8 px-2 rounded border border-yo-border bg-white text-[11px]" />
          </div>
          <div>
            <label className="text-[10px] uppercase text-yo-txt-3 font-semibold">Búsqueda libre</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="motivo, IP, archivo…"
              className="mt-1 w-full h-8 px-2 rounded border border-yo-border bg-white text-[11px]" />
          </div>
        </div>

        <div className="mt-3">
          <label className="text-[10px] uppercase text-yo-txt-3 font-semibold">Acciones específicas</label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {ACTION_OPTIONS.map(a => (
              <button key={a} onClick={() => toggleAction(a)}
                className={`h-6 px-2 rounded-full border text-[10.5px] font-mono ${actions.includes(a) ? "bg-yo-ac text-white border-yo-ac" : "bg-white border-yo-border text-yo-txt-3"}`}>
                {a}
              </button>
            ))}
            {actions.length > 0 && (
              <button onClick={() => setActions([])} className="h-6 px-2 rounded-full border border-yo-border text-[10.5px] text-yo-txt-3">
                Limpiar
              </button>
            )}
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        {isLoading ? (
          <p className="text-sm text-yo-txt-3 py-6 text-center">Cargando auditoría…</p>
        ) : !data?.rows.length ? (
          <div className="py-8 text-center">
            <FileText className="size-8 mx-auto text-yo-txt-3 mb-2" />
            <p className="text-sm text-yo-txt-3">Sin eventos para los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] text-yo-txt-3 uppercase">
                <tr className="text-left border-b border-yo-border">
                  <th className="py-2">Fecha</th>
                  <th>Tipo</th>
                  <th>Actor</th>
                  <th>Rol</th>
                  <th>Acción</th>
                  <th>Detalle</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <AuditRow key={r.kind + ":" + r.id} r={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </>
  );
}

function AuditRow({ r }: { r: TicketAuditRow }) {
  const [open, setOpen] = useState(false);
  const isAction = r.kind === "action";
  return (
    <>
      <tr className="border-b border-yo-border hover:bg-yo-raised/40">
        <td className="py-1.5 pr-2 text-yo-txt-3 font-mono whitespace-nowrap">
          {new Date(r.created_at).toLocaleString("es-MX")}
        </td>
        <td className="pr-2">
          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${isAction ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-700"}`}>
            {isAction ? "Acción" : "Descarga"}
          </span>
        </td>
        <td className="pr-2 text-yo-txt-2 truncate max-w-[180px]">{r.actor_email ?? r.user_id?.slice(0, 8) ?? "—"}</td>
        <td className="pr-2 text-yo-ac font-mono text-[10.5px]">
          {isAction
            ? (r.rol_usado ? INTERNAL_ROLE_LABEL[r.rol_usado as InternalRole] ?? r.rol_usado : "—")
            : (r.internal_role ? INTERNAL_ROLE_LABEL[r.internal_role as InternalRole] ?? r.internal_role : (r.user_kind ?? "—"))}
        </td>
        <td className="pr-2 font-mono text-yo-txt">{isAction ? (r.accion ?? "—") : "support.attachment.download"}</td>
        <td className="pr-2 text-yo-txt-2 max-w-[280px] truncate">
          {isAction ? (r.motivo ?? "—") : (r.file_name ?? r.attachment_id.slice(0, 8))}
        </td>
        <td className="pr-2 font-mono text-yo-txt-3">{r.ip ?? "—"}</td>
      </tr>
      {isAction && (r.snapshot_antes || r.snapshot_despues || r.detalle_json) && (
        <tr>
          <td colSpan={7} className="pb-2">
            <button onClick={() => setOpen(o => !o)} className="text-[10.5px] text-yo-txt-3 hover:text-yo-txt underline">
              {open ? "Ocultar" : "Ver"} snapshot / detalle
            </button>
            {open && (
              <div className="mt-1 grid grid-cols-1 md:grid-cols-3 gap-2 text-[10.5px]">
                <SnapshotBox title="Antes" value={r.snapshot_antes} />
                <SnapshotBox title="Después" value={r.snapshot_despues} />
                <SnapshotBox title="Detalle" value={r.detalle_json} />
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function SnapshotBox({ title, value }: { title: string; value: unknown }) {
  if (!value) return <div className="rounded border border-yo-border p-2 bg-yo-bg text-yo-txt-3">{title}: —</div>;
  return (
    <div className="rounded border border-yo-border p-2 bg-yo-bg">
      <p className="font-semibold text-yo-txt-3 mb-1">{title}</p>
      <pre className="whitespace-pre-wrap break-all">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

function rowToPdfCells(r: TicketAuditRow): string[] {
  const fecha = new Date(r.created_at).toLocaleString("es-MX");
  if (r.kind === "action") {
    const detalle = [
      r.motivo ? `Motivo: ${r.motivo}` : null,
      r.snapshot_antes ? `Antes: ${trunc(JSON.stringify(r.snapshot_antes))}` : null,
      r.snapshot_despues ? `Después: ${trunc(JSON.stringify(r.snapshot_despues))}` : null,
    ].filter(Boolean).join("\n") || "—";
    return [fecha, "Acción", r.actor_email ?? r.user_id?.slice(0, 8) ?? "—",
      r.rol_usado ? INTERNAL_ROLE_LABEL[r.rol_usado as InternalRole] ?? r.rol_usado : "—",
      r.accion ?? "—", detalle, r.ip ?? "—"];
  }
  return [fecha, "Descarga", r.actor_email ?? r.user_id?.slice(0, 8) ?? "—",
    r.internal_role ? INTERNAL_ROLE_LABEL[r.internal_role as InternalRole] ?? r.internal_role : (r.user_kind ?? "—"),
    "support.attachment.download", r.file_name ?? r.attachment_id, r.ip ?? "—"];
}

function trunc(s: string, n = 240) { return s.length > n ? s.slice(0, n) + "…" : s; }
