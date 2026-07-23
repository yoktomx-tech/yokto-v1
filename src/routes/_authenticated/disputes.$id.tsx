import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft, Download, Plus, X, Info, LockKeyhole, FileCheck, MessageSquare,
  Clock, CheckCircle2, AlertTriangle, Paperclip, Send, Shield,
} from "lucide-react";
import {
  MOCK_DISPUTES, STATUS_CFG, PRIORITY_CFG, SECTOR_CFG, REASON_LABEL,
  slaLabel, isResolved, canAcceptResolution, canAddEvidence, canRespond,
  type Dispute, type DisputeStatus, type SectorId, type DisputeEvidence,
} from "@/lib/disputes-mock";
import { useViewRole } from "@/hooks/use-view-role";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/disputes/$id")({
  head: () => ({ meta: [{ title: "Disputa — Cumplex" }, { name: "robots", content: "noindex" }] }),
  loader: ({ params }) => {
    const d = MOCK_DISPUTES.find((x) => x.id === params.id);
    if (!d) throw notFound();
    return { dispute: d };
  },
  errorComponent: ({ reset }) => (
    <div className="p-8">
      <p className="text-sm text-[#DC2626]">No fue posible cargar la disputa.</p>
      <button onClick={reset} className="mt-2 text-xs text-[#4F46E5] hover:underline">Reintentar</button>
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8">
      <p className="text-sm text-[#52525B]">Disputa no encontrada.</p>
      <Link to="/disputes" className="mt-2 inline-block text-xs text-[#4F46E5] hover:underline">← Volver al listado</Link>
    </div>
  ),
  component: DisputeDetail,
});

const money = (c: number, cur = "MXN") =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(c / 100);

type ModalKind = null | "evidence" | "respond" | "propose" | "accept" | "review" | "request_evidence";

function DisputeDetail() {
  const data = Route.useLoaderData() as { dispute: Dispute };
  const d = data.dispute;
  const { role } = useViewRole();
  const actor = role as "buyer" | "seller";
  const isBuyer = actor === "buyer";
  const counter = isBuyer ? d.seller_name : d.buyer_name;
  const sla = slaLabel(d.sla_due_at);
  const [modal, setModal] = useState<ModalKind>(null);
  const [message, setMessage] = useState("");

  const [evTab, setEvTab] = useState<"ALL" | "BUYER" | "SELLER" | "VERIFIER" | "DOC" | "PHOTO" | "GPS">("ALL");
  const evidence = d.evidence.filter((e) => {
    if (evTab === "ALL") return true;
    if (evTab === "BUYER") return e.uploaded_by_role === "buyer";
    if (evTab === "SELLER") return e.uploaded_by_role === "seller";
    if (evTab === "VERIFIER") return e.uploaded_by_role === "internal";
    if (evTab === "DOC") return e.kind === "DOCUMENT";
    if (evTab === "PHOTO") return e.kind === "PHOTO" || e.kind === "VIDEO";
    if (evTab === "GPS") return e.kind === "GPS" || e.kind === "CHECKLIST";
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F8F8FB]">
      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">
        {/* Breadcrumb + header */}
        <Link to="/disputes" className="inline-flex items-center gap-1 text-xs text-[#52525B] hover:text-[#18181B]">
          <ArrowLeft className="h-3 w-3" /> Volver a disputas
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-medium text-[#18181B]">{d.code}</span>
              <StatusBadge s={d.status} />
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: PRIORITY_CFG[d.priority].bg, color: PRIORITY_CFG[d.priority].txt }}>
                Prioridad {PRIORITY_CFG[d.priority].label.toLowerCase()}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-[#18181B]">Disputa {STATUS_CFG[d.status].label.toLowerCase()}</h1>
            <p className="mt-1 text-sm text-[#52525B]">
              Operación <span className="font-mono">{d.transaction_folio}</span> · <SectorPill s={d.sector} /> · {money(d.held_amount_cents, d.currency)} retenidos
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/transactions/$id" params={{ id: d.transaction_id }} className="inline-flex items-center gap-2 rounded-[8px] border border-[#EBEBF0] bg-white px-3 py-2 text-sm text-[#52525B] hover:bg-[#F4F4F7]">
              Ver operación
            </Link>
            <button className="inline-flex items-center gap-2 rounded-[8px] border border-[#EBEBF0] bg-white px-3 py-2 text-sm text-[#52525B] hover:bg-[#F4F4F7]">
              <Download className="h-4 w-4" /> Exportar expediente
            </button>
            {canAddEvidence(actor, d) && (
              <button onClick={() => setModal("evidence")} className="inline-flex items-center gap-2 rounded-[8px] bg-[#4F46E5] px-3 py-2 text-sm font-medium text-white hover:bg-[#4338CA]">
                <Plus className="h-4 w-4" /> Agregar evidencia
              </button>
            )}
          </div>
        </div>

        {/* Neutrality */}
        <div className="mt-4 flex items-start gap-2 rounded-[12px] border border-[#EBEBF0] bg-[#F0F9FF] px-4 py-3 text-xs text-[#0284C7]">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>La plataforma actúa como tercero neutral. La resolución se basará en las condiciones pactadas, evidencia presentada, documentos verificados y trazabilidad de la operación.</p>
        </div>

        {/* 70/30 layout */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Main */}
          <div className="space-y-4">
            {/* Summary */}
            <Card title="Resumen ejecutivo">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <KV k="Motivo" v={REASON_LABEL[d.reason]} />
                <KV k="Solicitante" v={d.opened_by_role === "buyer" ? "Comprador" : "Vendedor"} />
                <KV k="Contraparte" v={counter} />
                <KV k="Fecha apertura" v={new Date(d.created_at).toLocaleDateString("es-MX")} />
                <KV k="Monto afectado" v={money(d.affected_amount_cents, d.currency)} mono />
                <KV k="Fondos retenidos" v={money(d.held_amount_cents, d.currency)} mono />
                <KV k="Monto total" v={money(d.total_amount_cents, d.currency)} mono />
                <KV k="SLA" v={sla.text} />
              </div>
              <p className="mt-3 rounded-[8px] bg-[#F4F4F7] p-3 text-xs text-[#52525B]">{d.description}</p>
            </Card>

            {/* Operation link */}
            <Card title="Operación vinculada">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[#18181B]">{d.transaction_title}</p>
                  <p className="mt-0.5 text-xs text-[#52525B]"><span className="font-mono">{d.transaction_folio}</span> · <SectorPill s={d.sector} /></p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                    <MiniKV k="Comprador" v={d.buyer_name} />
                    <MiniKV k="Vendedor" v={d.seller_name} />
                    <MiniKV k="Total" v={money(d.total_amount_cents, d.currency)} mono />
                    <MiniKV k="Retenido" v={money(d.held_amount_cents, d.currency)} mono />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Link to="/transactions/$id" params={{ id: d.transaction_id }} className="rounded-[8px] border border-[#EBEBF0] bg-white px-3 py-1.5 text-xs text-[#52525B] hover:bg-[#F4F4F7]">Ver operación</Link>
                  <Link to="/payments" className="rounded-[8px] border border-[#EBEBF0] bg-white px-3 py-1.5 text-xs text-[#52525B] hover:bg-[#F4F4F7]">Ver pagos</Link>
                </div>
              </div>
            </Card>

            {/* Milestones */}
            <Card title="Hitos relacionados">
              <div className="overflow-hidden rounded-[8px] border border-[#EBEBF0]">
                <table className="w-full text-sm">
                  <thead className="bg-[#F4F4F7] text-[11px] uppercase tracking-wide text-[#71717A]">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Hito</th>
                      <th className="px-3 py-2 text-left font-medium">Estado</th>
                      <th className="px-3 py-2 text-left font-medium">Evidencia</th>
                      <th className="px-3 py-2 text-right font-medium">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.milestones.map((m) => (
                      <tr key={m.id} className="border-t border-[#EBEBF0]">
                        <td className="px-3 py-2 text-[#18181B]">{m.label}</td>
                        <td className="px-3 py-2 text-xs text-[#52525B]">{m.status.replaceAll("_", " ").toLowerCase()}</td>
                        <td className="px-3 py-2 text-xs">
                          <span className={cn("rounded-full px-1.5 py-0.5", m.evidence_state === "COMPLETA" ? "bg-[#ECFDF5] text-[#059669]" : "bg-[#FFFBEB] text-[#B45309]")}>{m.evidence_state.toLowerCase()}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-sm text-[#18181B]">{money(m.affected_amount_cents, d.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Evidence */}
            <Card
              title="Evidencia presentada"
              action={canAddEvidence(actor, d) && (
                <button onClick={() => setModal("evidence")} className="text-xs font-medium text-[#4F46E5] hover:underline">+ Agregar</button>
              )}
            >
              <div className="mb-3 flex flex-wrap gap-1 rounded-[8px] border border-[#EBEBF0] bg-[#F4F4F7] p-1">
                {([
                  ["ALL", "Todas"], ["BUYER", "Comprador"], ["SELLER", "Vendedor"],
                  ["VERIFIER", "Verificador"], ["DOC", "Documentos"], ["PHOTO", "Fotos/Video"], ["GPS", "GPS/Checklist"],
                ] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setEvTab(k)} className={cn("rounded-[6px] px-2 py-1 text-[11px] font-medium", evTab === k ? "bg-white text-[#3730A3] shadow-sm" : "text-[#52525B]")}>{l}</button>
                ))}
              </div>
              {evidence.length === 0 ? (
                <EmptyBlock icon={FileCheck} title="Aún no se ha agregado evidencia" body="Agrega documentos, fotos, checklist o comentarios que ayuden a acreditar tu posición." />
              ) : (
                <ul className="space-y-2">
                  {evidence.map((e) => <EvidenceRow key={e.id} e={e} />)}
                </ul>
              )}
            </Card>

            {/* Messages */}
            <Card title="Mensajes auditados">
              {d.messages.length === 0 ? (
                <EmptyBlock icon={MessageSquare} title="No hay comentarios en esta disputa" body="Los mensajes y solicitudes quedarán registrados en el expediente auditado." />
              ) : (
                <ul className="space-y-3">
                  {d.messages.map((m) => (
                    <li key={m.id} className="rounded-[10px] border border-[#EBEBF0] p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium",
                            m.sender_role === "buyer" && "bg-[#EEF2FF] text-[#3730A3]",
                            m.sender_role === "seller" && "bg-[#FFF7ED] text-[#9A3412]",
                            m.sender_role === "internal" && "bg-[#F0F9FF] text-[#075985]")}>
                            {m.sender_name}
                          </span>
                          {m.visibility === "internal" && (
                            <span className="rounded-full bg-[#F4F4F7] px-1.5 py-0.5 text-[10px] text-[#71717A]"><Shield className="mr-0.5 inline h-2.5 w-2.5" />Interna</span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#A1A1AA]">{new Date(m.created_at).toLocaleString("es-MX")}</span>
                      </div>
                      <p className="mt-2 text-sm text-[#18181B]">{m.body}</p>
                    </li>
                  ))}
                </ul>
              )}

              {!isResolved(d.status) && d.status !== "CANCELLED" && (
                <div className="mt-3 rounded-[10px] border border-[#EBEBF0] bg-[#F4F4F7] p-3">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    placeholder="Describe la aclaración o evidencia que deseas agregar a la disputa..."
                    className="w-full resize-none rounded-[8px] border border-[#EBEBF0] bg-white px-3 py-2 text-sm text-[#18181B] placeholder:text-[#A1A1AA] focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/15"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <button className="inline-flex items-center gap-1 text-xs text-[#52525B] hover:text-[#18181B]">
                      <Paperclip className="h-3 w-3" /> Adjuntar
                    </button>
                    <button disabled={!message.trim()} className="inline-flex items-center gap-1 rounded-[8px] bg-[#4F46E5] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#4338CA] disabled:opacity-50">
                      <Send className="h-3 w-3" /> Enviar
                    </button>
                  </div>
                </div>
              )}
            </Card>

            {/* Resolution */}
            {d.resolution && (
              <Card title="Resolución">
                <div className="rounded-[10px] border border-[#EBEBF0] bg-[#F0F9FF] p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#0284C7]" />
                    <span className="text-sm font-medium text-[#075985]">
                      {d.resolution.resolution_type === "RELEASE" && "Resolución favorable a liberación"}
                      {d.resolution.resolution_type === "REFUND" && "Resolución favorable a devolución"}
                      {d.resolution.resolution_type === "PARTIAL" && "Resolución parcial"}
                      {d.resolution.resolution_type === "CORRECTION" && "Corrección requerida"}
                      {d.resolution.resolution_type === "AGREEMENT" && "Cierre por acuerdo"}
                      {d.resolution.resolution_type === "IMPROCEDENT" && "Improcedente"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <MiniKV k="Monto liberar" v={money(d.resolution.amount_release_cents, d.currency)} mono />
                    <MiniKV k="Monto devolver" v={money(d.resolution.amount_refund_cents, d.currency)} mono />
                    <MiniKV k="Emitida por" v={d.resolution.proposed_by} />
                    <MiniKV k="Estado ejecución" v={d.resolution.execution_status.toLowerCase()} />
                  </div>
                  <p className="mt-3 text-xs text-[#52525B]">{d.resolution.rationale}</p>

                  {canAcceptResolution(actor, d) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => setModal("accept")} className="rounded-[8px] bg-[#059669] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#047857]">Aceptar resolución</button>
                      <button onClick={() => setModal("review")} className="rounded-[8px] border border-[#EBEBF0] bg-white px-3 py-1.5 text-xs font-medium text-[#52525B] hover:bg-[#F4F4F7]">Solicitar revisión</button>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar 30% */}
          <div className="space-y-4">
            {/* State panel */}
            <Card title="Panel de estado">
              <div className="space-y-2 text-xs">
                <SideRow k="Estado" v={<StatusBadge s={d.status} />} />
                <SideRow k="Prioridad" v={<span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: PRIORITY_CFG[d.priority].bg, color: PRIORITY_CFG[d.priority].txt }}>{PRIORITY_CFG[d.priority].label}</span>} />
                <SideRow k="SLA" v={<span className={cn("font-medium", sla.tone === "err" && "text-[#DC2626]", sla.tone === "warn" && "text-[#D97706]", sla.tone === "ok" && "text-[#059669]")}>{sla.text}</span>} />
                <SideRow k="Debe actuar" v={d.status === "AWAITING_RESPONSE" ? (d.against_role === "seller" ? "Vendedor" : "Comprador") : "Mediación"} />
                <SideRow k="Monto afectado" v={<span className="font-mono font-semibold text-[#18181B]">{money(d.affected_amount_cents, d.currency)}</span>} />
              </div>

              <div className="mt-4 space-y-2">
                {canRespond(actor, d) && <ActionBtn primary onClick={() => setModal("respond")}>Responder disputa</ActionBtn>}
                {canAddEvidence(actor, d) && <ActionBtn onClick={() => setModal("evidence")}>Agregar evidencia</ActionBtn>}
                {canAcceptResolution(actor, d) && <ActionBtn primary onClick={() => setModal("accept")}>Aceptar resolución</ActionBtn>}
              </div>
            </Card>

            {/* Payment impact */}
            <Card title="Impacto en pagos">
              <div className="space-y-2 text-xs">
                <SideRow k="Total operación" v={<span className="font-mono">{money(d.total_amount_cents, d.currency)}</span>} />
                <SideRow k="Retenido" v={<span className="font-mono">{money(d.held_amount_cents, d.currency)}</span>} />
                <SideRow k="Afectado" v={<span className="font-mono">{money(d.affected_amount_cents, d.currency)}</span>} />
                <SideRow k="Liberación" v={<span className="text-[#B45309]">Pausada</span>} />
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-[8px] bg-[#FFFBEB] p-3 text-[11px] text-[#B45309]">
                <LockKeyhole className="mt-0.5 h-3 w-3 shrink-0" />
                <p>Mientras la disputa esté activa, la liberación del hito afectado queda pausada hasta resolución o acuerdo.</p>
              </div>
            </Card>

            {/* Compliance link */}
            <div className="rounded-[12px] border border-[#EBEBF0] bg-[#EEF2FF] p-3 text-[11px] text-[#3730A3]">
              <Info className="mr-1 inline h-3 w-3" />
              Esta disputa puede impactar el Perfil de Cumplimiento de las partes según su resultado, evidencia y tiempos de respuesta.
            </div>

            {/* Timeline */}
            <Card title="Timeline auditado">
              <ol className="space-y-3">
                {d.timeline.map((e, i) => (
                  <li key={i} className="relative pl-5">
                    <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-[#4F46E5]" />
                    {i < d.timeline.length - 1 && <span className="absolute left-[3px] top-3 h-full w-px bg-[#EBEBF0]" />}
                    <p className="text-[11px] text-[#A1A1AA]">{new Date(e.at).toLocaleString("es-MX")}</p>
                    <p className="mt-0.5 text-xs text-[#18181B]"><span className="font-medium">{e.actor}</span> — {e.action}</p>
                    {e.hash && <p className="mt-0.5 font-mono text-[10px] text-[#A1A1AA]">Hash {e.hash}</p>}
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === "evidence" && <SimpleModal title="Agregar evidencia" onClose={() => setModal(null)} primary="Subir evidencia">
        <p className="text-xs text-[#52525B]">Sube documentos, fotos, video, GPS o checklist relacionados al hito.</p>
        <div className="mt-3 rounded-[10px] border-2 border-dashed border-[#EBEBF0] bg-[#F4F4F7] px-4 py-6 text-center text-xs text-[#71717A]">Arrastra archivos o haz clic para seleccionar</div>
        <label className="mt-3 block text-xs">
          <span className="mb-1 block text-[#52525B]">Comentarios</span>
          <textarea rows={3} className={ipt} placeholder="Contexto para el verificador..." />
        </label>
      </SimpleModal>}

      {modal === "respond" && <SimpleModal title="Responder disputa" onClose={() => setModal(null)} primary="Enviar respuesta">
        <label className="block text-xs">
          <span className="mb-1 block text-[#52525B]">Respuesta</span>
          <textarea rows={4} className={ipt} placeholder="Describe tu posición con evidencia verificable..." />
        </label>
      </SimpleModal>}

      {modal === "accept" && <SimpleModal title="Aceptar resolución" onClose={() => setModal(null)} primary="Aceptar resolución" primaryTone="ok">
        <p className="text-xs text-[#52525B]">Se ejecutarán las instrucciones de liberación o devolución acordadas.</p>
        <label className="mt-3 flex items-start gap-2 rounded-[8px] bg-[#F4F4F7] p-3 text-xs text-[#52525B]">
          <input type="checkbox" className="mt-0.5" />
          Acepto la resolución propuesta y entiendo que la orden se ejecutará en la pasarela correspondiente.
        </label>
      </SimpleModal>}

      {modal === "review" && <SimpleModal title="Solicitar revisión" onClose={() => setModal(null)} primary="Solicitar revisión">
        <label className="block text-xs">
          <span className="mb-1 block text-[#52525B]">Fundamento (obligatorio)</span>
          <textarea rows={4} className={ipt} placeholder="Explica por qué solicitas una revisión de la resolución..." />
        </label>
      </SimpleModal>}
    </div>
  );
}

// ---------- Helpers ----------
function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-[12px] border border-[#EBEBF0] bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/.04)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wide text-[#71717A]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="rounded-[8px] bg-[#F4F4F7] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-[#A1A1AA]">{k}</p>
      <p className={cn("mt-0.5 text-sm text-[#18181B]", mono && "font-mono font-semibold")}>{v}</p>
    </div>
  );
}
function MiniKV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-[#A1A1AA]">{k}</p>
      <p className={cn("mt-0.5 text-[#18181B]", mono && "font-mono font-semibold")}>{v}</p>
    </div>
  );
}
function SideRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-[#EBEBF0] pb-2 last:border-0 last:pb-0">
      <span className="text-[#71717A]">{k}</span>
      <span className="text-right text-[#18181B]">{v}</span>
    </div>
  );
}
function StatusBadge({ s }: { s: DisputeStatus }) {
  const c = STATUS_CFG[s];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: c.bg, color: c.txt }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
      {c.label}
    </span>
  );
}
function SectorPill({ s }: { s: SectorId }) {
  const c = SECTOR_CFG[s];
  return <span className="inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[11px]" style={{ background: c.bg, color: c.txt }}>{c.emoji} {c.label}</span>;
}
function EmptyBlock({ icon: Icon, title, body }: { icon: typeof FileCheck; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[8px] bg-[#F4F4F7] px-4 py-8 text-center">
      <Icon className="h-5 w-5 text-[#A1A1AA]" />
      <p className="mt-2 text-sm font-medium text-[#18181B]">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-[#52525B]">{body}</p>
    </div>
  );
}
function EvidenceRow({ e }: { e: DisputeEvidence }) {
  const v = e.validation;
  return (
    <li className="flex items-center justify-between gap-3 rounded-[8px] border border-[#EBEBF0] p-3 hover:bg-[#F4F4F7]">
      <div className="min-w-0">
        <p className="truncate text-sm text-[#18181B]">{e.title}</p>
        <p className="mt-0.5 text-[10px] text-[#A1A1AA]">
          {e.uploaded_by_name} · {new Date(e.uploaded_at).toLocaleDateString("es-MX")}
          {e.milestone_label && <> · {e.milestone_label}</>}
          {" · "}<span className="font-mono">{e.hash}</span>
        </p>
        {e.comments && <p className="mt-1 text-[11px] text-[#B45309]">{e.comments}</p>}
      </div>
      <div className="flex items-center gap-2">
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium",
          v === "VALIDATED" && "bg-[#ECFDF5] text-[#059669]",
          v === "PENDING" && "bg-[#FFFBEB] text-[#B45309]",
          v === "REJECTED" && "bg-[#FEF2F2] text-[#B91C1C]")}>
          {v === "VALIDATED" ? "Validada" : v === "PENDING" ? "Pendiente" : "Rechazada"}
        </span>
        <button className="rounded-[6px] border border-[#EBEBF0] bg-white px-2 py-1 text-[11px] text-[#52525B] hover:bg-white"><Download className="h-3 w-3" /></button>
      </div>
    </li>
  );
}
function ActionBtn({ children, primary, onClick }: { children: React.ReactNode; primary?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={cn(
      "block w-full rounded-[8px] px-3 py-2 text-xs font-medium",
      primary ? "bg-[#4F46E5] text-white hover:bg-[#4338CA]" : "border border-[#EBEBF0] bg-white text-[#52525B] hover:bg-[#F4F4F7]"
    )}>{children}</button>
  );
}

const ipt = "w-full rounded-[8px] border border-[#EBEBF0] bg-white px-3 py-2 text-sm text-[#18181B] placeholder:text-[#A1A1AA] focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/15";
function SimpleModal({ title, children, onClose, primary, primaryTone = "accent" }: { title: string; children: React.ReactNode; onClose: () => void; primary: string; primaryTone?: "accent" | "ok" | "err" }) {
  const tone = primaryTone === "ok" ? "bg-[#059669] hover:bg-[#047857]" : primaryTone === "err" ? "bg-[#DC2626] hover:bg-[#B91C1C]" : "bg-[#4F46E5] hover:bg-[#4338CA]";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-[12px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#EBEBF0] px-5 py-4">
          <h3 className="text-base font-semibold text-[#18181B]">{title}</h3>
          <button onClick={onClose} className="rounded-[6px] p-1 hover:bg-[#F4F4F7]"><X className="h-4 w-4 text-[#52525B]" /></button>
        </div>
        <div className="p-5">
          <div className="mb-3 flex items-start gap-2 rounded-[8px] bg-[#F0F9FF] px-3 py-2 text-[11px] text-[#075985]">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            <p>Toda acción queda registrada en el expediente auditado.</p>
          </div>
          {children}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#EBEBF0] bg-[#F4F4F7] px-5 py-3">
          <button onClick={onClose} className="rounded-[8px] px-3 py-2 text-sm text-[#52525B] hover:text-[#18181B]">Cancelar</button>
          <button onClick={onClose} className={cn("rounded-[8px] px-4 py-2 text-sm font-medium text-white", tone)}>{primary}</button>
        </div>
      </div>
    </div>
  );
}
