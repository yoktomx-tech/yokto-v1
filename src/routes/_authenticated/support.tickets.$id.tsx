import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, Download, Paperclip, MessageCircle } from "lucide-react";
import { getTicket, addTicketMessage, getAttachmentDownloadUrl } from "@/lib/support.functions";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { supabase } from "@/integrations/supabase/client";
import { AttachmentPicker, type PendingAttachment } from "@/components/support/attachment-picker";

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
  const dlFn = useServerFn(getAttachmentDownloadUrl);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["ticket", id], queryFn: () => getFn({ data: { id } }) });
  const [msg, setMsg] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);

  const m = useMutation({
    mutationFn: () => addFn({ data: { ticketId: id, body: msg.trim(), attachmentIds: pending.map((p) => p.id) } }),
    onSuccess: () => { setMsg(""); setPending([]); qc.invalidateQueries({ queryKey: ["ticket", id] }); },
  });

  // Realtime — para chat en vivo (y también útil en tickets normales)
  useEffect(() => {
    const ch = supabase.channel(`ticket-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["ticket", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  async function download(attachmentId: string) {
    const { url } = await dlFn({ data: { attachmentId } });
    window.open(url, "_blank", "noopener");
  }

  if (isLoading) return <p className="text-sm text-yo-txt-3">Cargando…</p>;
  if (!data) return <p className="text-sm text-yo-txt-3">Ticket no encontrado.</p>;
  const { ticket, messages, attachments } = data;
  const attByMsg = new Map<string, typeof attachments>();
  const orphanAtt: typeof attachments = [];
  attachments.forEach((a) => {
    if (a.message_id) {
      const arr = attByMsg.get(a.message_id) ?? [];
      arr.push(a); attByMsg.set(a.message_id, arr);
    } else {
      orphanAtt.push(a);
    }
  });

  return (
    <div className="max-w-4xl space-y-6">
      <Link to="/support/tickets" className="inline-flex items-center gap-1.5 text-xs text-yo-txt-3 hover:text-yo-txt">
        <ArrowLeft className="size-3.5" /> Mis tickets
      </Link>

      <div className="rounded-xl border border-yo-border bg-yo-surface p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-mono">{ticket.numero}</p>
            <h1 className="text-xl font-semibold text-yo-txt mt-1 inline-flex items-center gap-2">
              {ticket.subject}
              {ticket.is_live_chat && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                  <MessageCircle className="size-3" /> Chat en vivo
                </span>
              )}
            </h1>
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
        <div className="p-4 space-y-3 max-h-[55vh] overflow-y-auto">
          {messages.map((m) => {
            const mine = m.author_id === userId;
            const atts = attByMsg.get(m.id) ?? [];
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-lg p-3 text-sm ${mine ? "bg-[#18181B] text-white" : "bg-yo-bg text-yo-txt border border-yo-border"}`}>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  {atts.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {atts.map((a) => (
                        <li key={a.id}>
                          <button onClick={() => download(a.id)}
                            className={`inline-flex items-center gap-1.5 text-[11px] underline ${mine ? "text-white/90" : "text-[#7C3AED]"}`}>
                            <Paperclip className="size-3" /> {a.file_name} · {(((a.size_bytes ?? 0)/1024)).toFixed(0)} KB
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className={`mt-1 text-[10px] ${mine ? "text-white/60" : "text-yo-txt-3"}`}>
                    {m.author_kind === "internal" ? "Equipo Cumplex" : "Tú"} · {new Date(m.created_at).toLocaleString("es-MX")}
                  </p>
                </div>
              </div>
            );
          })}
          {!messages.length && <p className="text-sm text-yo-txt-3 text-center py-6">Aún no hay mensajes.</p>}

          {orphanAtt.length > 0 && (
            <div className="mt-4 border-t border-yo-border pt-3">
              <p className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-2">Adjuntos del ticket</p>
              <ul className="space-y-1">
                {orphanAtt.map((a) => (
                  <li key={a.id}>
                    <button onClick={() => download(a.id)}
                      className="inline-flex items-center gap-1.5 text-xs text-[#7C3AED] hover:underline">
                      <Download className="size-3.5" /> {a.file_name} · {(((a.size_bytes ?? 0)/1024)).toFixed(0)} KB
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {!isAuditor && ticket.status !== "closed" && (
          <div className="p-3 border-t border-yo-border space-y-2">
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={2}
              placeholder="Escribe una respuesta…"
              className="w-full px-3 py-2 rounded-lg border border-yo-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30" />
            <AttachmentPicker ticketId={id} value={pending} onChange={setPending} />
            <div className="flex justify-end">
              <button onClick={() => (msg.trim() || pending.length) && m.mutate()} disabled={(!msg.trim() && !pending.length) || m.isPending}
                className="h-10 px-4 rounded-lg bg-[#18181B] text-white text-sm font-semibold hover:bg-black disabled:opacity-40 inline-flex items-center gap-1.5">
                <Send className="size-4" /> Enviar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
