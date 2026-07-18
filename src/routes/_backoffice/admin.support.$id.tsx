import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, AlertTriangle, XCircle, Paperclip, Download, ShieldCheck } from "lucide-react";
import { AdminCard, AdminPageHeader } from "@/components/admin/admin-shell";
import {
  adminGetTicket, adminReplyTicket, adminEscalateTicket, adminCloseTicket,
  adminGetAttachmentDownloadUrl,
} from "@/lib/admin/support.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_backoffice/admin/support/$id")({
  component: AdminTicket,
});

function AdminTicket() {
  const { id } = Route.useParams();
  const getFn = useServerFn(adminGetTicket);
  const replyFn = useServerFn(adminReplyTicket);
  const escFn = useServerFn(adminEscalateTicket);
  const closeFn = useServerFn(adminCloseTicket);
  const dlFn = useServerFn(adminGetAttachmentDownloadUrl);
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-ticket", id], queryFn: () => getFn({ data: { id } }) });

  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [escOpen, setEscOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [escType, setEscType] = useState<"conflict"|"pld_ft"|"financial"|"technical">("conflict");
  const [reason, setReason] = useState("");
  const [resolution, setResolution] = useState("resolved");
  const [mfa, setMfa] = useState("");
  const [mfaErr, setMfaErr] = useState<string | null>(null);
  const [elevating, setElevating] = useState(false);

  const reply = useMutation({
    mutationFn: () => replyFn({ data: { id, body: body.trim(), internal } }),
    onSuccess: () => { setBody(""); setInternal(false); qc.invalidateQueries({ queryKey: ["admin-ticket", id] }); },
  });
  const escalate = useMutation({
    mutationFn: () => escFn({ data: { id, type: escType, reason: reason.trim() } }),
    onSuccess: () => { setEscOpen(false); setReason(""); qc.invalidateQueries({ queryKey: ["admin-ticket", id] }); },
  });
  const close = useMutation({
    mutationFn: () => closeFn({ data: { id, reason: reason.trim(), resolution } }),
    onSuccess: () => { setCloseOpen(false); setReason(""); setMfa(""); qc.invalidateQueries({ queryKey: ["admin-ticket", id] }); },
  });

  async function elevateWithMfa() {
    setMfaErr(null); setElevating(true);
    try {
      const { data: factors, error: fErr } = await supabase.auth.mfa.listFactors();
      if (fErr) throw fErr;
      const totp = factors?.totp?.find((f) => f.status === "verified");
      if (!totp) throw new Error("No tienes un factor TOTP verificado. Configura MFA en tu perfil primero.");
      const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({ factorId: totp.id, code: mfa });
      if (vErr) throw vErr;
      await refetch(); // recarga aal
    } catch (e) {
      setMfaErr((e as Error).message);
    } finally {
      setElevating(false);
    }
  }

  async function downloadAttachment(attachmentId: string) {
    const { url } = await dlFn({ data: { attachmentId } });
    window.open(url, "_blank", "noopener");
  }

  if (isLoading) return <p className="text-sm text-yo-txt-3">Cargando…</p>;
  if (!data) return <p className="text-sm text-yo-txt-3">Ticket no encontrado.</p>;
  const { ticket, messages, attachments, aal } = data;
  const sensitive = Boolean(
    (ticket.escalation && ticket.escalation !== "none") ||
    ticket.module === "payments" || ticket.module === "disputes" ||
    ticket.related_dispute_id || ticket.is_live_chat
  );
  const isAal2 = aal === "aal2";

  return (
    <>
      <Link to="/admin/support" className="inline-flex items-center gap-1.5 text-xs text-yo-txt-3 hover:text-yo-txt mb-3">
        <ArrowLeft className="size-3.5" /> Cola de soporte
      </Link>
      <AdminPageHeader title={ticket.subject} description={`Ticket ${ticket.numero} · estado ${ticket.status} · prioridad ${ticket.priority} · plan ${ticket.plan ?? "free"}`} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <AdminCard>
            <p className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-2">Descripción original</p>
            <p className="text-sm text-yo-txt-2 whitespace-pre-wrap">{ticket.description}</p>
            {ticket.contexto_rol_congelado && (
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-yo-txt-3">Ver contexto congelado (rol/plan/organización)</summary>
                <pre className="mt-2 p-2 rounded bg-yo-bg text-[11px] overflow-auto">{JSON.stringify(ticket.contexto_rol_congelado, null, 2)}</pre>
              </details>
            )}
          </AdminCard>

          <AdminCard>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold">Conversación</p>
              {ticket.is_live_chat && <span className="text-[10px] font-semibold uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Chat en vivo</span>}
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {messages.map((m) => (
                <div key={m.id} className={`rounded-lg p-3 text-sm ${m.author_kind === "internal" ? "bg-yo-ac-bg" : "bg-yo-bg border border-yo-border"}`}>
                  {m.is_internal_note && (
                    <span className="inline-block text-[10px] font-semibold uppercase text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded mb-1">Nota interna</span>
                  )}
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className="mt-1 text-[10px] text-yo-txt-3">
                    {m.author_kind === "internal" ? "Equipo YOKTO" : "Usuario"} · {new Date(m.created_at).toLocaleString("es-MX")}
                  </p>
                </div>
              ))}
              {!messages.length && <p className="text-sm text-yo-txt-3">Sin mensajes.</p>}
            </div>

            {attachments.length > 0 && (
              <div className="mt-3 border-t border-yo-border pt-3">
                <p className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-2">Adjuntos ({attachments.length})</p>
                <ul className="space-y-1.5">
                  {attachments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between text-xs bg-yo-bg rounded p-2 border border-yo-border">
                      <span className="inline-flex items-center gap-2 truncate">
                        <Paperclip className="size-3.5 text-yo-txt-3" />
                        <span className="truncate">{a.file_name}</span>
                        <span className="text-yo-txt-3">· {(((a.size_bytes ?? 0)/1024)).toFixed(0)} KB</span>
                      </span>
                      <button onClick={() => downloadAttachment(a.id)}
                        className="inline-flex items-center gap-1 h-7 px-2 rounded border border-yo-border hover:bg-white">
                        <Download className="size-3.5" /> Descargar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {ticket.status !== "closed" && (
              <div className="mt-3 space-y-2">
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3}
                  placeholder="Escribe una respuesta o nota interna…"
                  className="w-full px-3 py-2 rounded-lg border border-yo-border bg-white text-sm" />
                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-xs text-yo-txt-2">
                    <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                    Nota interna (no visible al usuario)
                  </label>
                  <button onClick={() => body.trim() && reply.mutate()} disabled={!body.trim() || reply.isPending}
                    className="h-9 px-3 rounded-lg bg-[#18181B] text-white text-sm font-semibold hover:bg-black disabled:opacity-40 inline-flex items-center gap-1.5">
                    <Send className="size-4" /> Enviar
                  </button>
                </div>
              </div>
            )}
          </AdminCard>
        </div>

        <div className="space-y-3">
          <AdminCard>
            <p className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-2">Acciones</p>
            <div className="space-y-2">
              <button onClick={() => setEscOpen((o) => !o)}
                className="w-full h-9 px-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm font-medium hover:bg-amber-100 inline-flex items-center gap-2">
                <AlertTriangle className="size-4" /> Escalar ticket
              </button>
              {escOpen && (
                <div className="rounded-lg border border-yo-border p-3 space-y-2">
                  <select value={escType} onChange={(e) => setEscType(e.target.value as typeof escType)}
                    className="w-full h-9 px-2 rounded border border-yo-border bg-white text-sm">
                    <option value="conflict">Conflicto (Escrow)</option>
                    <option value="pld_ft">PLD/FT (Cumplimiento)</option>
                    <option value="financial">Financiero</option>
                    <option value="technical">Técnico</option>
                  </select>
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                    placeholder="Motivo del escalamiento (obligatorio, se registra en auditoría)…"
                    className="w-full px-2 py-1.5 rounded border border-yo-border bg-white text-sm" />
                  <button onClick={() => reason.trim().length >= 6 && escalate.mutate()} disabled={reason.trim().length < 6 || escalate.isPending}
                    className="w-full h-8 rounded bg-amber-600 text-white text-xs font-semibold disabled:opacity-40">
                    Confirmar escalamiento
                  </button>
                </div>
              )}

              <button onClick={() => { setCloseOpen((o) => !o); setReason(""); }}
                className="w-full h-9 px-3 rounded-lg border border-yo-border text-yo-txt text-sm font-medium hover:bg-yo-raised inline-flex items-center gap-2">
                <XCircle className="size-4" /> Cerrar ticket
              </button>
              {closeOpen && (
                <div className="rounded-lg border border-yo-border p-3 space-y-2">
                  {sensitive && (
                    <div className={`rounded p-2 text-[11px] ${isAal2 ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
                      <div className="inline-flex items-center gap-1.5 font-semibold">
                        <ShieldCheck className="size-3.5" />
                        {isAal2 ? "Sesión elevada con MFA (aal2)" : "Ticket sensible: requiere elevación MFA para cerrar."}
                      </div>
                    </div>
                  )}
                  <select value={resolution} onChange={(e) => setResolution(e.target.value)}
                    className="w-full h-9 px-2 rounded border border-yo-border bg-white text-sm">
                    <option value="resolved">Resuelto</option>
                    <option value="duplicate">Duplicado</option>
                    <option value="wont_fix">No procede</option>
                    <option value="user_error">Error de usuario</option>
                    <option value="other">Otro</option>
                  </select>
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                    placeholder="Motivo del cierre (mín. 6 caracteres, se guarda en auditoría con snapshot antes/después)…"
                    className="w-full px-2 py-1.5 rounded border border-yo-border bg-white text-sm" />
                  {sensitive && !isAal2 && (
                    <div className="space-y-1.5">
                      <input value={mfa} onChange={(e) => setMfa(e.target.value.replace(/\D/g,"").slice(0,6))}
                        placeholder="Código TOTP (6 dígitos)"
                        className="w-full h-9 px-2 rounded border border-yo-border bg-white text-sm font-mono tracking-widest" />
                      <button onClick={elevateWithMfa} disabled={mfa.length < 6 || elevating}
                        className="w-full h-8 rounded bg-[#18181B] text-white text-xs font-semibold disabled:opacity-40">
                        {elevating ? "Verificando…" : "Elevar sesión (MFA)"}
                      </button>
                      {mfaErr && <p className="text-[11px] text-yo-err">{mfaErr}</p>}
                    </div>
                  )}
                  <button onClick={() => close.mutate()}
                    disabled={reason.trim().length < 6 || close.isPending || (sensitive && !isAal2)}
                    className="w-full h-8 rounded bg-[#18181B] text-white text-xs font-semibold disabled:opacity-40">
                    Confirmar cierre
                  </button>
                </div>
              )}
              {(escalate.error || close.error || reply.error) && (
                <p className="text-[11px] text-yo-err">
                  {(escalate.error ?? close.error ?? reply.error)?.message}
                </p>
              )}
            </div>
          </AdminCard>

          <AdminCard>
            <p className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-2">Metadatos</p>
            <dl className="text-xs space-y-1">
              <div className="flex justify-between"><dt className="text-yo-txt-3">Módulo</dt><dd>{ticket.module ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-yo-txt-3">Escalamiento</dt><dd>{ticket.escalation}</dd></div>
              <div className="flex justify-between"><dt className="text-yo-txt-3">Plan</dt><dd className="uppercase">{ticket.plan ?? "free"}</dd></div>
              <div className="flex justify-between"><dt className="text-yo-txt-3">Sesión</dt><dd className="font-mono">{aal}</dd></div>
              <div className="flex justify-between"><dt className="text-yo-txt-3">Creado</dt><dd className="font-mono">{new Date(ticket.created_at).toLocaleString("es-MX")}</dd></div>
              {ticket.sla_first_response_at && (
                <div className="flex justify-between"><dt className="text-yo-txt-3">SLA respuesta</dt><dd className="font-mono">{new Date(ticket.sla_first_response_at).toLocaleString("es-MX")}</dd></div>
              )}
              {ticket.sla_resolution_at && (
                <div className="flex justify-between"><dt className="text-yo-txt-3">SLA resolución</dt><dd className="font-mono">{new Date(ticket.sla_resolution_at).toLocaleString("es-MX")}</dd></div>
              )}
            </dl>
          </AdminCard>
        </div>
      </div>
    </>
  );
}
