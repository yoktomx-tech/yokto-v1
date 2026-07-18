import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send } from "lucide-react";
import { getTicket, addTicketMessage } from "@/lib/support.functions";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useCurrentOrg } from "@/hooks/use-current-org";

export const Route = createFileRoute("/_authenticated/support/tickets/$id")({
  component: TicketDetail,
});

function TicketDetail() {
  const { id } = Route.useParams();
  const { userId } = useAuthUser();
  const { currentOrg } = useCurrentOrg();
  const isAuditor = currentOrg?.org_role === "auditor";
  const getFn = useServerFn(getTicket);
  const addFn = useServerFn(addTicketMessage);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["ticket", id], queryFn: () => getFn({ data: { id } }) });
  const [msg, setMsg] = useState("");
  const m = useMutation({
    mutationFn: (body: string) => addFn({ data: { ticketId: id, body } }),
    onSuccess: () => { setMsg(""); qc.invalidateQueries({ queryKey: ["ticket", id] }); },
  });

  if (isLoading) return <p className="text-sm text-yo-txt-3">Cargando…</p>;
  if (!data) return <p className="text-sm text-yo-txt-3">Ticket no encontrado.</p>;
  const { ticket, messages } = data;

  return (
    <div className="max-w-4xl space-y-6">
      <Link to="/support/tickets" className="inline-flex items-center gap-1.5 text-xs text-yo-txt-3 hover:text-yo-txt">
        <ArrowLeft className="size-3.5" /> Mis tickets
      </Link>

      <div className="rounded-xl border border-yo-border bg-yo-surface p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-mono">{ticket.numero}</p>
            <h1 className="text-xl font-semibold text-yo-txt mt-1">{ticket.subject}</h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[11px] font-semibold uppercase px-2 py-1 rounded bg-[#F5F3FF] text-[#7C3AED]">{ticket.status}</span>
            <span className="text-[10px] uppercase text-yo-txt-3">Prioridad {ticket.priority}</span>
          </div>
        </div>
        <p className="mt-4 text-sm text-yo-txt-2 whitespace-pre-wrap">{ticket.description}</p>
        {ticket.sla_first_response_at && (
          <p className="mt-3 text-[11px] text-yo-txt-3">
            SLA de primera respuesta: <span className="font-mono">{new Date(ticket.sla_first_response_at).toLocaleString("es-MX")}</span>
          </p>
        )}
      </div>

      <div className="rounded-xl border border-yo-border bg-yo-surface">
        <div className="p-4 border-b border-yo-border">
          <h2 className="text-sm font-semibold text-yo-txt">Conversación</h2>
        </div>
        <div className="p-4 space-y-3 max-h-[50vh] overflow-y-auto">
          {messages.map((m) => {
            const mine = m.author_id === userId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-lg p-3 text-sm ${mine ? "bg-[#18181B] text-white" : "bg-yo-bg text-yo-txt border border-yo-border"}`}>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className={`mt-1 text-[10px] ${mine ? "text-white/60" : "text-yo-txt-3"}`}>
                    {m.author_kind === "internal" ? "Equipo YOKTO" : "Tú"} · {new Date(m.created_at).toLocaleString("es-MX")}
                  </p>
                </div>
              </div>
            );
          })}
          {!messages.length && <p className="text-sm text-yo-txt-3 text-center py-6">Aún no hay mensajes.</p>}
        </div>
        {!isAuditor && ticket.status !== "closed" && (
          <div className="p-3 border-t border-yo-border flex gap-2">
            <input value={msg} onChange={(e) => setMsg(e.target.value)}
              placeholder="Escribe una respuesta…"
              className="flex-1 h-10 px-3 rounded-lg border border-yo-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30" />
            <button onClick={() => msg.trim() && m.mutate(msg.trim())} disabled={!msg.trim() || m.isPending}
              className="h-10 px-4 rounded-lg bg-[#18181B] text-white text-sm font-semibold hover:bg-black disabled:opacity-40 inline-flex items-center gap-1.5">
              <Send className="size-4" /> Enviar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
