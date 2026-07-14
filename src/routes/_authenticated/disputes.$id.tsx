import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/tx";
import {
  addDisputeMessage,
  confirmDisputeDeposit,
  resolveDispute,
  withdrawDispute,
} from "@/lib/disputes.functions";

type Dispute = {
  id: string;
  numero: string | null;
  transaction_id: string;
  opened_by: string;
  opened_role: "buyer" | "seller";
  reason_code: string;
  reason_description: string;
  amount_disputed_cents: number;
  status: string;
  hito_id: string | null;
  deposit_cents: number | null;
  deposit_paid: boolean | null;
  deposit_provider_ref: string | null;
  activated_at: string | null;
  counterparty_response_due_at: string | null;
  evidence_due_at: string | null;
  resolution_due_at: string | null;
  resolution: string | null;
  resolution_notes: string | null;
  buyer_share_cents: number | null;
  seller_share_cents: number | null;
  loser_pays: string | null;
  mediator_id: string | null;
  resolved_at: string | null;
  created_at: string;
  transactions: {
    title: string;
    numero: string | null;
    currency: string;
    amount_cents: number;
    buyer_id: string;
    seller_id: string | null;
  } | null;
};

type Msg = {
  id: string;
  author_id: string;
  author_role: string;
  message_type: string | null;
  body: string;
  evidence_urls: string[] | null;
  attachments: unknown;
  visible_to: string | null;
  created_at: string;
};

type Ev = {
  id: string;
  event_type: string;
  metadata: unknown;
  created_at: string;
};

const STATUS_LABEL: Record<string, { label: string; tone: "warn" | "info" | "ok" | "danger" | "neutral" }> = {
  pending_deposit: { label: "Pendiente de depósito", tone: "warn" },
  open: { label: "Abierta", tone: "info" },
  awaiting_response: { label: "Esperando respuesta", tone: "info" },
  in_review: { label: "En revisión", tone: "info" },
  in_mediation: { label: "En mediación", tone: "info" },
  resolved: { label: "Resuelta", tone: "ok" },
  closed: { label: "Cerrada", tone: "neutral" },
  withdrawn: { label: "Retirada", tone: "neutral" },
  cancelled: { label: "Cancelada", tone: "neutral" },
  escalated: { label: "Escalada", tone: "danger" },
};

const REASON_LABEL: Record<string, string> = {
  incumplimiento_hito: "Incumplimiento de hito",
  documentos_invalidos: "Documentos inválidos",
  mercancia_incompleta: "Mercancía incompleta",
  calidad_insuficiente: "Calidad insuficiente",
  plazo_vencido: "Plazo vencido",
  fraude_sospechado: "Fraude sospechado",
  condiciones_no_acordadas: "Condiciones no acordadas",
  otro: "Otro",
};

export const Route = createFileRoute("/_authenticated/disputes/$id")({
  head: () => ({ meta: [{ title: "Disputa — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: DisputeDetail,
});

function DisputeDetail() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const [d, setD] = useState<Dispute | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [canMediate, setCanMediate] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const addMsgFn = useServerFn(addDisputeMessage);
  const resolveFn = useServerFn(resolveDispute);
  const confirmDepositFn = useServerFn(confirmDisputeDeposit);
  const withdrawFn = useServerFn(withdrawDispute);

  const resolveSigned = useCallback(async (mm: Msg[]) => {
    const paths = mm.flatMap((m) => m.evidence_urls ?? []);
    if (!paths.length) { setSigned({}); return; }
    const { data: sig } = await supabase.storage.from("dispute-evidence").createSignedUrls(paths, 3600);
    const map: Record<string, string> = {};
    sig?.forEach((s) => { if (s.path && s.signedUrl) map[s.path] = s.signedUrl; });
    setSigned(map);
  }, []);

  const load = useCallback(async () => {
    const [{ data: dd }, { data: mm }] = await Promise.all([
      supabase
        .from("disputes")
        .select("*, transactions:transaction_id(title, numero, currency, amount_cents, buyer_id, seller_id)")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("dispute_messages").select("*").eq("dispute_id", id).order("created_at"),
    ]);
    const dispute = dd as unknown as Dispute | null;
    setD(dispute);
    const messages = (mm ?? []) as Msg[];
    setMsgs(messages);
    setLoading(false);
    void resolveSigned(messages);

    if (dispute) {
      const { data: ev } = await supabase
        .from("transaction_events")
        .select("id, event_type, metadata, created_at")
        .eq("transaction_id", dispute.transaction_id)
        .like("event_type", "dispute.%")
        .order("created_at");
      setEvents((ev ?? []) as Ev[]);
    }

    const [{ data: isM }, { data: isA }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: user.id, _role: "mediator" }),
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
    ]);
    setCanMediate(Boolean(isM) || Boolean(isA));
  }, [id, user.id, resolveSigned]);

  useEffect(() => { void load(); }, [load]);

  // Realtime — mensajes y disputa
  useEffect(() => {
    const ch = supabase
      .channel(`dispute:${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dispute_messages", filter: `dispute_id=eq.${id}` },
        (payload) => {
          const m = payload.new as Msg;
          setMsgs((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
          if (m.evidence_urls?.length) void resolveSigned([m]);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "disputes", filter: `id=eq.${id}` },
        (payload) => {
          setD((prev) => (prev ? ({ ...prev, ...(payload.new as Partial<Dispute>) } as Dispute) : prev));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, resolveSigned]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);

  async function handleSend() {
    if (!body.trim() && files.length === 0) return;
    setBusy(true); setError(null);
    try {
      const paths: string[] = [];
      for (const f of files) {
        if (f.size > 20 * 1024 * 1024) throw new Error(`Archivo demasiado grande: ${f.name}`);
        const safe = f.name.replace(/[^\w.\-]+/g, "_");
        const path = `${user.id}/${id}/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage.from("dispute-evidence").upload(path, f, { upsert: false });
        if (upErr) throw new Error(upErr.message);
        paths.push(path);
      }
      await addMsgFn({ data: { disputeId: id, body: body.trim() || "(evidencia adjunta)", evidenceUrls: paths } });
      setBody(""); setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  async function payDeposit() {
    setBusy(true); setError(null);
    try {
      const res = await confirmDepositFn({ data: { disputeId: id } });
      if (!res.ok) setError(`El pago no se completó (estado: ${res.status}).`);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  async function submitWithdraw() {
    if (withdrawReason.trim().length < 10) return;
    setBusy(true); setError(null);
    try {
      await withdrawFn({ data: { disputeId: id, reason: withdrawReason.trim() } });
      setWithdrawOpen(false);
      setWithdrawReason("");
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  if (loading) return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="container-editorial py-16 text-sm text-muted-foreground">Cargando…</div>
    </div>
  );
  if (!d) return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="container-editorial py-16"><h1 className="font-display text-4xl">Disputa no encontrada</h1></div>
    </div>
  );

  const tx = d.transactions!;
  const isActivator = d.opened_by === user.id;
  const isParty = tx.buyer_id === user.id || tx.seller_id === user.id;
  const canPost =
    (isParty || canMediate) && ["open", "awaiting_response", "in_review", "in_mediation"].includes(d.status);
  const canWithdraw =
    isActivator && ["pending_deposit", "open", "awaiting_response", "in_review", "in_mediation"].includes(d.status);
  const statusMeta = STATUS_LABEL[d.status] ?? { label: d.status, tone: "neutral" as const };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1">
        <div className="container-editorial py-10 max-w-5xl">
          <Link to="/disputes" className="text-[11px] uppercase tracking-[0.14em] font-semibold underline underline-offset-4">← Disputas</Link>
          <div className="mt-4 flex items-baseline justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {d.numero ?? "Disputa"} · Transacción {tx.numero ?? ""}
              </p>
              <h1 className="mt-1 font-display text-4xl tracking-wide">{tx.title}</h1>
            </div>
            <StatusPill tone={statusMeta.tone}>{statusMeta.label}</StatusPill>
          </div>

          {/* Countdown banners */}
          {d.status !== "resolved" && d.status !== "closed" && d.status !== "withdrawn" && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
              <Countdown label="Respuesta contraparte" due={d.counterparty_response_due_at} />
              <Countdown label="Cierre de evidencia" due={d.evidence_due_at} />
              <Countdown label="Resolución final" due={d.resolution_due_at} />
            </div>
          )}

          {/* Pending deposit banner */}
          {d.status === "pending_deposit" && isActivator && (
            <div className="mt-6 border-2 border-yokto-yellow bg-yokto-yellow/20 p-5">
              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold">Depósito pendiente</p>
              <p className="mt-2 text-sm">
                Para activar esta disputa debes cubrir el depósito de seriedad de{" "}
                <strong>{formatMoney(d.deposit_cents ?? 0, tx.currency)}</strong>. Se devuelve si ganas la disputa; se retiene si la resolución te resulta desfavorable.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button disabled={busy} onClick={payDeposit} className="px-5 py-2.5 bg-yokto-black text-white text-[12px] uppercase tracking-[0.14em] font-semibold border border-yo-border disabled:opacity-50">
                  {busy ? "Procesando…" : "Simular pago del depósito"}
                </button>
                <button disabled={busy} onClick={() => setWithdrawOpen(true)} className="px-5 py-2.5 bg-background text-[12px] uppercase tracking-[0.14em] font-semibold border border-yo-border">
                  Cancelar disputa
                </button>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Modo desarrollo: el pago se simula. En producción abrirá la pasarela real.
              </p>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
            <Kv k="Motivo" v={REASON_LABEL[d.reason_code] ?? d.reason_code} />
            <Kv k="Abierta por" v={d.opened_role === "buyer" ? "Comprador" : "Vendedor"} />
            <Kv k="Monto disputado" v={formatMoney(d.amount_disputed_cents, tx.currency)} />
            <Kv k="Depósito" v={formatMoney(d.deposit_cents ?? 0, tx.currency)} />
          </div>
          <div className="mt-4 border border-yo-border p-4 bg-yo-bg/40">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Descripción</p>
            <p className="mt-1 text-sm whitespace-pre-line">{d.reason_description}</p>
          </div>

          {d.status === "resolved" && (
            <div className="mt-6 border border-yo-border bg-yokto-yellow/40 p-5">
              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold">Resolución · {d.resolution}</p>
              <p className="mt-2 text-sm whitespace-pre-line">{d.resolution_notes}</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Comprador: </span>{formatMoney(d.buyer_share_cents ?? 0, tx.currency)}</div>
                <div><span className="text-muted-foreground">Vendedor: </span>{formatMoney(d.seller_share_cents ?? 0, tx.currency)}</div>
              </div>
            </div>
          )}

          {error && <div role="alert" className="mt-6 border border-[#FF3B3B] bg-[#FF3B3B]/10 text-[#FF3B3B] p-3 text-sm">{error}</div>}

          {/* Two-column: chat + timeline */}
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chat */}
            <section className="lg:col-span-2">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-3xl tracking-wide">Hilo</h2>
                {canWithdraw && (
                  <button onClick={() => setWithdrawOpen(true)} className="text-[11px] uppercase tracking-[0.14em] font-semibold underline underline-offset-4 text-muted-foreground hover:text-foreground">
                    Retirar disputa
                  </button>
                )}
              </div>

              <div ref={scrollRef} className="mt-4 border border-yo-border bg-background max-h-[520px] overflow-y-auto">
                {msgs.length === 0 && (
                  <p className="p-6 text-sm text-muted-foreground text-center">
                    Sin mensajes todavía. Envía la primera actualización o evidencia.
                  </p>
                )}
                <div className="divide-y divide-yo-border/40">
                  {msgs.map((m) => (
                    <MessageRow key={m.id} m={m} me={user.id} signed={signed} tx={tx} />
                  ))}
                </div>
              </div>

              {canPost && (
                <div className="mt-4 border border-yo-border bg-background p-4 space-y-3">
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={3}
                    placeholder="Escribe tu mensaje…"
                    className="input-editorial w-full"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                      className="text-xs"
                    />
                    {files.length > 0 && (
                      <span className="text-[11px] text-muted-foreground">{files.length} archivo(s) por adjuntar</span>
                    )}
                    <div className="ml-auto">
                      <button disabled={busy || (!body.trim() && files.length === 0)} onClick={handleSend} className="px-5 py-2.5 bg-yo-ac text-white text-[12px] uppercase tracking-[0.14em] font-semibold border border-yo-border disabled:opacity-50">
                        {busy ? "Enviando…" : "Enviar"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Timeline */}
            <aside>
              <h2 className="font-display text-3xl tracking-wide">Línea de tiempo</h2>
              <ol className="mt-4 border border-yo-border bg-background divide-y divide-yo-border/40">
                <TimelineRow when={d.created_at} title="Disputa creada" />
                {d.deposit_paid && (
                  <TimelineRow when={d.activated_at ?? d.created_at} title="Depósito confirmado" />
                )}
                {events.map((e) => (
                  <TimelineRow key={e.id} when={e.created_at} title={eventLabel(e.event_type)} />
                ))}
                {d.resolved_at && <TimelineRow when={d.resolved_at} title="Disputa resuelta" />}
              </ol>
            </aside>
          </div>

          {/* Mediation panel */}
          {canMediate && d.status !== "resolved" && d.status !== "closed" && d.status !== "withdrawn" && d.status !== "pending_deposit" && (
            <ResolvePanel dispute={d} resolveFn={resolveFn} />
          )}
        </div>
      </main>

      {/* Withdraw modal */}
      {withdrawOpen && (
        <div className="fixed inset-0 z-50 bg-yokto-black/50 flex items-center justify-center p-4" onClick={() => setWithdrawOpen(false)}>
          <div className="w-full max-w-lg border border-yo-border bg-background p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-3xl tracking-wide">Retirar disputa</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              La transacción volverá a su estado anterior. Si ya pagaste depósito, aplican las reglas de reembolso.
            </p>
            <label className="mt-4 block text-sm">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Motivo (mín. 10 caracteres)</span>
              <textarea rows={4} value={withdrawReason} onChange={(e) => setWithdrawReason(e.target.value)} className="input-editorial w-full mt-1" />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setWithdrawOpen(false)} className="px-4 py-2 border border-yo-border text-[12px] uppercase tracking-[0.14em] font-semibold">Cancelar</button>
              <button disabled={busy || withdrawReason.trim().length < 10} onClick={submitWithdraw} className="px-4 py-2 bg-[#FF3B3B] text-white text-[12px] uppercase tracking-[0.14em] font-semibold disabled:opacity-50">
                Confirmar retiro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function eventLabel(t: string): string {
  switch (t) {
    case "dispute.draft": return "Borrador creado";
    case "dispute.opened": return "Disputa activada";
    case "dispute.withdrawn": return "Disputa retirada";
    case "dispute.resolved": return "Disputa resuelta";
    case "dispute.message": return "Nuevo mensaje";
    default: return t;
  }
}

function MessageRow({ m, me, signed, tx }: {
  m: Msg;
  me: string;
  signed: Record<string, string>;
  tx: { buyer_id: string; seller_id: string | null };
}) {
  const isSystem = m.author_role === "system" || m.message_type === "system";
  if (isSystem) {
    return (
      <div className="px-4 py-3 bg-yo-bg/40">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Sistema · {new Date(m.created_at).toLocaleString("es-MX")}</p>
        <p className="mt-1 text-sm">{m.body}</p>
      </div>
    );
  }
  const mine = m.author_id === me;
  const roleLabel =
    m.author_role === "buyer" ? (tx.buyer_id === m.author_id ? "Comprador" : "Comprador")
    : m.author_role === "seller" ? "Vendedor"
    : m.author_role === "mediator" ? "Mediador YOKTO"
    : m.author_role === "admin" ? "Administrador"
    : m.author_role;
  return (
    <div className={`px-4 py-3 flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] ${mine ? "bg-yokto-black text-white" : "bg-yo-bg"} border border-yo-border p-3`}>
        <div className="flex items-baseline justify-between gap-3">
          <span className={`text-[10px] uppercase tracking-[0.14em] font-semibold ${mine ? "text-white/70" : "text-muted-foreground"}`}>
            {roleLabel}{mine ? " · tú" : ""}
          </span>
          <span className={`text-[10px] ${mine ? "text-white/60" : "text-muted-foreground"}`}>
            {new Date(m.created_at).toLocaleString("es-MX")}
          </span>
        </div>
        <p className="mt-2 text-sm whitespace-pre-line">{m.body}</p>
        {m.evidence_urls && m.evidence_urls.length > 0 && (
          <ul className={`mt-3 space-y-1 border-t ${mine ? "border-white/20" : "border-yo-border"} pt-2`}>
            {m.evidence_urls.map((p) => (
              <li key={p} className="text-xs">
                📎{" "}
                <a href={signed[p] ?? "#"} target="_blank" rel="noreferrer" className={`underline underline-offset-4 font-mono break-all ${mine ? "text-white" : ""}`}>
                  {p.split("/").slice(-1)[0]}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Countdown({ label, due }: { label: string; due: string | null }) {
  const remaining = useMemo(() => {
    if (!due) return null;
    const ms = new Date(due).getTime() - Date.now();
    if (ms <= 0) return { text: "Vencido", tone: "danger" as const };
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    const tone = days < 1 ? ("danger" as const) : days < 2 ? ("warn" as const) : ("info" as const);
    return { text: `${days}d ${hours}h`, tone };
  }, [due]);
  if (!due) return (
    <div className="border border-dashed border-yo-border p-3 bg-background">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">—</p>
    </div>
  );
  const cls =
    remaining?.tone === "danger" ? "border-[#FF3B3B] bg-[#FF3B3B]/10"
    : remaining?.tone === "warn" ? "border-yokto-yellow bg-yokto-yellow/20"
    : "border-yo-border bg-background";
  return (
    <div className={`border p-3 ${cls}`}>
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-sm">{remaining?.text}</p>
      <p className="text-[11px] text-muted-foreground">{new Date(due).toLocaleString("es-MX")}</p>
    </div>
  );
}

function TimelineRow({ when, title }: { when: string; title: string }) {
  return (
    <li className="p-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{new Date(when).toLocaleString("es-MX")}</p>
      <p className="mt-1 text-sm">{title}</p>
    </li>
  );
}

function StatusPill({ tone, children }: { tone: "warn" | "info" | "ok" | "danger" | "neutral"; children: React.ReactNode }) {
  const cls =
    tone === "ok" ? "bg-[#0aa15a] text-white"
    : tone === "danger" ? "bg-[#FF3B3B] text-white"
    : tone === "warn" ? "bg-yokto-yellow text-yokto-black"
    : tone === "info" ? "bg-yokto-black text-white"
    : "bg-yo-bg text-foreground";
  return <span className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] font-semibold border border-yo-border ${cls}`}>{children}</span>;
}

function ResolvePanel({ dispute, resolveFn }: {
  dispute: Dispute;
  resolveFn: (a: { data: Parameters<typeof resolveDispute>[0]["data"] }) => Promise<unknown>;
}) {
  const tx = dispute.transactions!;
  const [resolution, setResolution] = useState<"buyer_favor" | "seller_favor" | "split" | "no_resolution">("buyer_favor");
  const [buyerShare, setBuyerShare] = useState(tx.amount_cents / 100);
  const [sellerShare, setSellerShare] = useState(0);
  const [loserPays, setLoserPays] = useState<"buyer" | "seller" | "split" | "none">("seller");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function preset(r: typeof resolution) {
    setResolution(r);
    if (r === "buyer_favor") { setBuyerShare(tx.amount_cents / 100); setSellerShare(0); setLoserPays("seller"); }
    if (r === "seller_favor") { setBuyerShare(0); setSellerShare(tx.amount_cents / 100); setLoserPays("buyer"); }
    if (r === "split") { setBuyerShare(tx.amount_cents / 200); setSellerShare(tx.amount_cents / 200); setLoserPays("split"); }
    if (r === "no_resolution") { setBuyerShare(0); setSellerShare(0); setLoserPays("none"); }
  }

  async function submit() {
    setBusy(true); setErr(null);
    try {
      await resolveFn({ data: {
        disputeId: dispute.id, resolution,
        buyerShareCents: Math.round(buyerShare * 100),
        sellerShareCents: Math.round(sellerShare * 100),
        loserPays, notes,
      }});
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  return (
    <section className="mt-10">
      <h2 className="font-display text-3xl tracking-wide">Panel de mediación</h2>
      <div className="mt-4 border border-yo-border bg-yo-bg/40 p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          {(["buyer_favor", "seller_favor", "split", "no_resolution"] as const).map((r) => (
            <button key={r} onClick={() => preset(r)} className={`px-3 py-2 text-[11px] uppercase tracking-[0.14em] border border-yo-border ${resolution === r ? "bg-yo-ac text-white" : "bg-background"}`}>
              {r}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Reembolso comprador ({tx.currency})</span>
            <input type="number" min={0} step="0.01" value={buyerShare} onChange={(e) => setBuyerShare(Number(e.target.value))} className="input-editorial w-full mt-1" />
          </label>
          <label className="text-sm">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Liberación vendedor ({tx.currency})</span>
            <input type="number" min={0} step="0.01" value={sellerShare} onChange={(e) => setSellerShare(Number(e.target.value))} className="input-editorial w-full mt-1" />
          </label>
          <label className="text-sm">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Depósito de seriedad (loser pays)</span>
            <select value={loserPays} onChange={(e) => setLoserPays(e.target.value as never)} className="input-editorial w-full mt-1">
              <option value="buyer">Comprador</option>
              <option value="seller">Vendedor</option>
              <option value="split">Dividido</option>
              <option value="none">Sin cargo</option>
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Notas de resolución (visibles para las partes)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="input-editorial w-full mt-1" />
        </label>
        {err && <div role="alert" className="border border-[#FF3B3B] bg-[#FF3B3B]/10 text-[#FF3B3B] p-3 text-sm">{err}</div>}
        <button disabled={busy || notes.length < 10} onClick={submit} className="px-5 py-2.5 bg-yo-ac text-white text-[12px] uppercase tracking-[0.14em] font-semibold border border-yo-border disabled:opacity-50">
          {busy ? "Resolviendo…" : "Resolver disputa"}
        </button>
      </div>
    </section>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="border border-yo-border p-3 bg-background">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{k}</p>
      <p className="mt-1 font-mono text-sm">{v}</p>
    </div>
  );
}
