import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  getDisputeAdminView,
  assignMediator,
  setDisputeStatus,
  generateDisputeAiSummary,
  isCurrentUserMediator,
} from "@/lib/mediation.functions";
import { resolveDispute, addDisputeMessage } from "@/lib/disputes.functions";
import { formatMoney } from "@/lib/tx";
import { Sparkles, Scale, ShieldAlert, UserCheck, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/disputes/$id")({
  head: () => ({ meta: [{ title: "Resolución de disputa — YOKTO" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async () => {
    try {
      const r = await isCurrentUserMediator();
      if (!r.allowed) throw redirect({ to: "/dashboard" });
    } catch {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminDisputeDetail,
});

type View = Awaited<ReturnType<typeof getDisputeAdminView>>;

const REASON_ES: Record<string, string> = {
  incumplimiento_hito: "Incumplimiento de hito",
  documentos_invalidos: "Documentos inválidos",
  mercancia_incompleta: "Mercancía incompleta",
  calidad_insuficiente: "Calidad insuficiente",
  plazo_vencido: "Plazo vencido",
  fraude_sospechado: "Fraude sospechado",
  condiciones_no_acordadas: "Condiciones no acordadas",
  otro: "Otro",
};

function AdminDisputeDetail() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const viewFn = useServerFn(getDisputeAdminView);
  const assignFn = useServerFn(assignMediator);
  const statusFn = useServerFn(setDisputeStatus);
  const aiFn = useServerFn(generateDisputeAiSummary);
  const resolveFn = useServerFn(resolveDispute);
  const msgFn = useServerFn(addDisputeMessage);

  const [view, setView] = useState<View | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [aiRunning, setAiRunning] = useState(false);
  const [tab, setTab] = useState<"resumen" | "mensajes" | "evidencias" | "linea" | "resolucion">("resumen");
  const [privateNote, setPrivateNote] = useState("");
  const [escEntity, setEscEntity] = useState("");
  const [escCase, setEscCase] = useState("");

  // Resolution form
  const [buyerPct, setBuyerPct] = useState(0);
  const [sellerPct, setSellerPct] = useState(100);
  const [loserPays, setLoserPays] = useState<"buyer" | "seller" | "split" | "none">("none");
  const [notes, setNotes] = useState("");

  async function load() {
    setLoading(true);
    try {
      setView(await viewFn({ data: { disputeId: id } }));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [id]);

  const dispute = view?.dispute as unknown as
    | (Record<string, unknown> & {
        transactions: { id: string; numero: string; title: string; amount_cents: number; currency: string; buyer_id: string; seller_id: string | null; status: string; sector: string | null };
      })
    | undefined;
  const tx = dispute?.transactions;
  const profileMap = useMemo(() => {
    const m = new Map<string, { first_name: string | null; last_name: string | null; email: string | null }>();
    (view?.profiles ?? []).forEach((p) => m.set(p.id, p));
    return m;
  }, [view]);
  const buyer = tx?.buyer_id ? profileMap.get(tx.buyer_id) : undefined;
  const seller = tx?.seller_id ? profileMap.get(tx.seller_id) : undefined;
  const opener = dispute?.opened_by ? profileMap.get(dispute.opened_by as string) : undefined;
  const mediatorProfile = dispute?.mediator_id ? profileMap.get(dispute.mediator_id as string) : undefined;

  async function doAssign() {
    setBusy("assign");
    try { await assignFn({ data: { disputeId: id } }); await load(); } finally { setBusy(null); }
  }
  async function doStatus(s: "in_review" | "in_mediation" | "escalated") {
    setBusy(s);
    try {
      await statusFn({
        data: {
          disputeId: id,
          status: s,
          note: privateNote || undefined,
          arbitrationEntity: s === "escalated" ? escEntity || undefined : undefined,
          arbitrationCaseNumber: s === "escalated" ? escCase || undefined : undefined,
        },
      });
      setPrivateNote("");
      await load();
    } finally { setBusy(null); }
  }
  async function doAI() {
    setAiRunning(true);
    try { await aiFn({ data: { disputeId: id } }); await load(); }
    catch (e) { alert((e as Error).message); }
    finally { setAiRunning(false); }
  }
  async function doResolve() {
    if (!tx) return;
    const total = tx.amount_cents;
    const buyerShare = Math.round((total * buyerPct) / 100);
    const sellerShare = total - buyerShare;
    let resolution: "buyer_favor" | "seller_favor" | "split" | "no_resolution" = "split";
    if (buyerPct === 100) resolution = "buyer_favor";
    else if (buyerPct === 0) resolution = "seller_favor";
    if (notes.trim().length < 10) { alert("Agrega notas de resolución (mín. 10 caracteres)."); return; }
    if (!confirm(`Aplicar resolución "${resolution}" — Comprador ${buyerPct}% · Vendedor ${100 - buyerPct}%?`)) return;
    setBusy("resolve");
    try {
      await resolveFn({
        data: {
          disputeId: id,
          resolution,
          buyerShareCents: buyerShare,
          sellerShareCents: sellerShare,
          loserPays,
          notes,
        },
      });
      alert("Disputa resuelta.");
      navigate({ to: "/admin/disputes" });
    } catch (e) { alert((e as Error).message); }
    finally { setBusy(null); }
  }
  async function sendMediatorMessage(visibleTo: "all" | "buyer_and_mediator" | "seller_and_mediator") {
    if (!privateNote.trim()) return;
    setBusy("msg");
    try {
      await msgFn({ data: { disputeId: id, body: privateNote.trim(), visibleTo } });
      setPrivateNote("");
      await load();
    } finally { setBusy(null); }
  }

  if (loading || !view || !dispute || !tx) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <main className="flex-1 container-editorial py-8 max-w-6xl">
          <p className="text-sm text-yo-txt-3">Cargando…</p>
        </main>
      </div>
    );
  }

  const dueResp = dispute.counterparty_response_due_at as string | null;
  const dueEv = dispute.evidence_due_at as string | null;
  const dueRes = dispute.resolution_due_at as string | null;
  const status = dispute.status as string;
  const summary = dispute.summary_ai as string | null;
  const summaryAt = dispute.summary_ai_generated_at as string | null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 container-editorial py-8 max-w-6xl">
        {/* Sticky header */}
        <div className="sticky top-16 z-20 -mx-4 md:mx-0 mb-4 rounded-lg border border-yo-border bg-yo-surface/90 backdrop-blur px-4 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Link to="/admin/disputes" className="text-xs text-yo-txt-3 hover:text-yo-txt">← Panel</Link>
                <span className="text-xs text-yo-txt-3">/</span>
                <span className="font-mono text-xs text-yo-txt">{dispute.numero as string}</span>
                <span className="inline-flex items-center h-6 px-2 rounded-full text-[11px] font-medium border bg-background text-yo-txt border-yo-border">
                  {status.replace(/_/g, " ")}
                </span>
              </div>
              <div className="mt-1 text-sm font-semibold text-yo-txt truncate max-w-[560px]">{tx.title}</div>
              <div className="text-[11px] text-yo-txt-3 font-mono">Tx {tx.numero} · {formatMoney(tx.amount_cents, tx.currency)} · Sector {tx.sector ?? "—"}</div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {!dispute.mediator_id && (
                <button onClick={doAssign} disabled={busy === "assign"} className="h-8 px-3 rounded-md bg-yo-txt text-yo-surface text-xs font-medium hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-1">
                  <UserCheck className="h-3.5 w-3.5" /> Asignarme
                </button>
              )}
              <button onClick={doAI} disabled={aiRunning} className="h-8 px-3 rounded-md border border-yo-ac/60 bg-yo-ac-bg text-yo-txt text-xs font-medium hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> {aiRunning ? "Analizando…" : summary ? "Regenerar IA" : "Análisis IA"}
              </button>
            </div>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Monto en disputa" value={formatMoney((dispute.amount_disputed_cents as number) ?? 0, tx.currency)} />
          <Kpi label="Depósito seriedad" value={formatMoney((dispute.deposit_cents as number) ?? 0, tx.currency)} accent={!(dispute.deposit_paid as boolean)} />
          <Kpi label="Mediador" value={mediatorProfile ? `${mediatorProfile.first_name ?? ""} ${mediatorProfile.last_name ?? ""}`.trim() || (mediatorProfile.email ?? "—") : "Sin asignar"} />
          <Kpi label="Vence resolución" value={dueRes ? new Date(dueRes).toLocaleDateString("es-MX") : "—"} />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-6 border-b border-yo-border overflow-x-auto">
          {(["resumen", "mensajes", "evidencias", "linea", "resolucion"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 h-9 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${tab === t ? "border-yo-ac text-yo-txt" : "border-transparent text-yo-txt-3 hover:text-yo-txt"}`}>
              {t === "resumen" ? "Resumen" : t === "mensajes" ? `Mensajes (${view.messages.length})` : t === "evidencias" ? `Evidencias (${view.evidence.length})` : t === "linea" ? "Línea de tiempo" : "Resolución"}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "resumen" && (
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                <Card title="Descripción de la contraparte">
                  <div className="text-xs text-yo-txt-3 mb-2">
                    Abierta por <strong>{dispute.opened_role as string}</strong>
                    {opener && <> · {opener.first_name} {opener.last_name} · {opener.email}</>}
                  </div>
                  <p className="text-sm text-yo-txt whitespace-pre-wrap">{dispute.reason_description as string}</p>
                  <div className="mt-3 text-xs text-yo-txt-3">
                    Motivo: <span className="font-medium text-yo-txt">{REASON_ES[dispute.reason_code as string] ?? dispute.reason_code}</span>
                  </div>
                </Card>
                <Card title={<span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-yo-ac-dk" /> Análisis IA (Gemini)</span>}>
                  {summary ? (
                    <>
                      <pre className="text-xs text-yo-txt whitespace-pre-wrap font-sans leading-relaxed">{summary}</pre>
                      <div className="mt-2 text-[11px] text-yo-txt-3">Generado {summaryAt ? new Date(summaryAt).toLocaleString("es-MX") : ""}</div>
                    </>
                  ) : (
                    <p className="text-sm text-yo-txt-3">Aún no se ha generado análisis. Presiona <em>Análisis IA</em> arriba.</p>
                  )}
                </Card>
              </div>
              <div className="space-y-4">
                <Card title="Partes">
                  <Party label="Comprador" p={buyer} />
                  <div className="h-px bg-yo-border my-3" />
                  <Party label="Vendedor" p={seller} />
                </Card>
                <Card title={<span className="inline-flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Acciones rápidas</span>}>
                  <div className="space-y-2">
                    <button onClick={() => doStatus("in_review")} disabled={busy === "in_review" || status === "in_review"} className="w-full h-9 rounded-md border border-yo-border bg-background text-xs font-medium hover:bg-yo-surface disabled:opacity-40">
                      Marcar en revisión
                    </button>
                    <button onClick={() => doStatus("in_mediation")} disabled={busy === "in_mediation" || status === "in_mediation"} className="w-full h-9 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-800 text-xs font-medium hover:bg-indigo-100 disabled:opacity-40">
                      Iniciar mediación activa
                    </button>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {tab === "mensajes" && (
            <div className="space-y-3">
              {view.messages.length === 0 && <p className="text-sm text-yo-txt-3">Sin mensajes.</p>}
              {view.messages.map((m) => {
                const author = m.author_id ? profileMap.get(m.author_id) : undefined;
                const isSystem = m.message_type === "system" || m.author_role === "system";
                return (
                  <div key={m.id} className={`rounded-lg border p-3 ${isSystem ? "border-slate-200 bg-slate-50" : m.visible_to !== "all" ? "border-amber-200 bg-amber-50" : "border-yo-border bg-yo-surface"}`}>
                    <div className="flex items-center justify-between text-[11px] text-yo-txt-3">
                      <span>
                        <strong className="text-yo-txt">{m.author_role}</strong>
                        {author && <> · {author.first_name ?? ""} {author.last_name ?? ""}</>}
                        {m.visible_to !== "all" && <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">privado: {m.visible_to}</span>}
                      </span>
                      <span>{new Date(m.created_at).toLocaleString("es-MX")}</span>
                    </div>
                    <p className="mt-1 text-sm text-yo-txt whitespace-pre-wrap">{m.body}</p>
                  </div>
                );
              })}
              <Card title="Enviar mensaje como mediador">
                <textarea value={privateNote} onChange={(e) => setPrivateNote(e.target.value)}
                  className="w-full min-h-[80px] rounded-md border border-yo-border bg-background p-2 text-sm" placeholder="Escribe una nota o pregunta a las partes…" />
                <div className="mt-2 flex flex-wrap gap-2 justify-end">
                  <button onClick={() => sendMediatorMessage("buyer_and_mediator")} disabled={busy === "msg" || !privateNote.trim()} className="h-8 px-3 rounded-md border border-yo-border bg-background text-xs font-medium disabled:opacity-40">Solo comprador</button>
                  <button onClick={() => sendMediatorMessage("seller_and_mediator")} disabled={busy === "msg" || !privateNote.trim()} className="h-8 px-3 rounded-md border border-yo-border bg-background text-xs font-medium disabled:opacity-40">Solo vendedor</button>
                  <button onClick={() => sendMediatorMessage("all")} disabled={busy === "msg" || !privateNote.trim()} className="h-8 px-3 rounded-md bg-yo-txt text-yo-surface text-xs font-medium disabled:opacity-40 inline-flex items-center gap-1">
                    <Send className="h-3.5 w-3.5" /> Enviar a todos
                  </button>
                </div>
              </Card>
            </div>
          )}

          {tab === "evidencias" && (
            <div className="grid md:grid-cols-2 gap-3">
              {view.evidence.length === 0 && <p className="text-sm text-yo-txt-3">Sin evidencias.</p>}
              {view.evidence.map((e) => (
                <div key={e.id} className="rounded-lg border border-yo-border bg-yo-surface p-3">
                  <div className="flex items-center justify-between text-[11px] text-yo-txt-3">
                    <span><strong className="text-yo-txt">{e.uploader_role}</strong> · {e.kind}</span>
                    <span>{new Date(e.created_at).toLocaleString("es-MX")}</span>
                  </div>
                  <p className="mt-1 text-sm text-yo-txt">{e.description}</p>
                  <div className="mt-2 text-[11px] font-mono text-yo-txt-3 truncate">{e.storage_path}</div>
                </div>
              ))}
            </div>
          )}

          {tab === "linea" && (
            <div className="space-y-2">
              {view.events.length === 0 && <p className="text-sm text-yo-txt-3">Sin eventos.</p>}
              {view.events.map((ev) => (
                <div key={ev.id} className="flex items-start gap-3 border-l-2 border-yo-border pl-3 py-1">
                  <div className="text-[11px] text-yo-txt-3 w-32 font-mono">{new Date(ev.created_at).toLocaleString("es-MX")}</div>
                  <div className="flex-1 text-sm">
                    <div className="font-medium text-yo-txt">{ev.event_type}</div>
                    {ev.metadata && Object.keys(ev.metadata as object).length > 0 && (
                      <pre className="text-[11px] text-yo-txt-3 whitespace-pre-wrap">{JSON.stringify(ev.metadata, null, 2)}</pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "resolucion" && (
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-4">
                <Card title={<span className="inline-flex items-center gap-2"><Scale className="h-4 w-4" /> Repartir monto retenido</span>}>
                  <div className="text-xs text-yo-txt-3 mb-3">Total retenido: <strong className="text-yo-txt">{formatMoney(tx.amount_cents, tx.currency)}</strong></div>
                  <input type="range" min={0} max={100} value={buyerPct}
                    onChange={(e) => { const v = Number(e.target.value); setBuyerPct(v); setSellerPct(100 - v); }}
                    className="w-full accent-yo-ac" />
                  <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md border border-yo-border bg-background p-3">
                      <div className="text-[11px] uppercase text-yo-txt-3">Comprador · {buyerPct}%</div>
                      <div className="text-lg font-bold text-yo-txt">{formatMoney(Math.round((tx.amount_cents * buyerPct) / 100), tx.currency)}</div>
                    </div>
                    <div className="rounded-md border border-yo-border bg-background p-3">
                      <div className="text-[11px] uppercase text-yo-txt-3">Vendedor · {sellerPct}%</div>
                      <div className="text-lg font-bold text-yo-txt">{formatMoney(tx.amount_cents - Math.round((tx.amount_cents * buyerPct) / 100), tx.currency)}</div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="text-xs text-yo-txt-3">¿Quién asume el costo del proceso? (loser pays)</label>
                    <select value={loserPays} onChange={(e) => setLoserPays(e.target.value as typeof loserPays)}
                      className="mt-1 w-full h-9 rounded-md border border-yo-border bg-background px-2 text-sm">
                      <option value="none">Ninguno (YOKTO asume)</option>
                      <option value="buyer">Comprador</option>
                      <option value="seller">Vendedor</option>
                      <option value="split">Dividido 50/50</option>
                    </select>
                  </div>
                  <div className="mt-4">
                    <label className="text-xs text-yo-txt-3">Notas de resolución (mín. 10 caracteres)</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                      className="mt-1 w-full min-h-[100px] rounded-md border border-yo-border bg-background p-2 text-sm"
                      placeholder="Explica la decisión, evidencias determinantes y base para el reparto…" />
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button onClick={doResolve} disabled={busy === "resolve" || status === "resolved"} className="h-10 px-5 rounded-md bg-yo-txt text-yo-surface font-medium hover:opacity-90 disabled:opacity-40">
                      {busy === "resolve" ? "Aplicando…" : "Aplicar resolución"}
                    </button>
                  </div>
                </Card>
              </div>
              <div className="space-y-4">
                <Card title="Escalar a arbitraje externo">
                  <input value={escEntity} onChange={(e) => setEscEntity(e.target.value)} placeholder="Entidad (p.ej. PROFECO)" className="w-full h-9 rounded-md border border-yo-border bg-background px-2 text-sm" />
                  <input value={escCase} onChange={(e) => setEscCase(e.target.value)} placeholder="No. de caso" className="w-full h-9 rounded-md border border-yo-border bg-background px-2 text-sm mt-2" />
                  <textarea value={privateNote} onChange={(e) => setPrivateNote(e.target.value)} placeholder="Nota interna (opcional)"
                    className="w-full min-h-[60px] rounded-md border border-yo-border bg-background p-2 text-sm mt-2" />
                  <button onClick={() => doStatus("escalated")} disabled={busy === "escalated"}
                    className="w-full h-9 mt-2 rounded-md border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800 text-xs font-medium hover:bg-fuchsia-100 disabled:opacity-40">
                    Marcar como escalada
                  </button>
                </Card>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Card({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-yo-border bg-yo-surface p-4">
      <h3 className="text-sm font-semibold text-yo-txt mb-3">{title}</h3>
      {children}
    </section>
  );
}
function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${accent ? "border-yo-ac/40 bg-yo-ac-bg" : "border-yo-border bg-yo-surface"}`}>
      <div className="text-[11px] uppercase tracking-wider text-yo-txt-3">{label}</div>
      <div className="mt-1 text-sm font-semibold text-yo-txt truncate">{value}</div>
    </div>
  );
}
function Party({ label, p }: { label: string; p?: { first_name: string | null; last_name: string | null; email: string | null } }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-yo-txt-3">{label}</div>
      <div className="text-sm text-yo-txt">{p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—" : "—"}</div>
      <div className="text-[11px] text-yo-txt-3">{p?.email ?? ""}</div>
    </div>
  );
}
