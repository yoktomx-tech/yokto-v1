import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app-header";
import { formatMoney } from "@/lib/tx";
import { addDisputeMessage, resolveDispute } from "@/lib/disputes.functions";

type Dispute = {
  id: string;
  transaction_id: string;
  opened_by: string;
  opened_role: "buyer" | "seller";
  reason_code: string;
  reason_description: string;
  amount_disputed_cents: number;
  status: string;
  resolution: string | null;
  resolution_notes: string | null;
  buyer_share_cents: number | null;
  seller_share_cents: number | null;
  loser_pays: string | null;
  mediator_id: string | null;
  resolved_at: string | null;
  created_at: string;
  transactions: { title: string; currency: string; amount_cents: number; buyer_id: string; seller_id: string | null } | null;
};
type Msg = {
  id: string;
  author_id: string;
  author_role: string;
  body: string;
  evidence_urls: string[];
  created_at: string;
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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [canMediate, setCanMediate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addMsgFn = useServerFn(addDisputeMessage);
  const resolveFn = useServerFn(resolveDispute);

  async function load() {
    const [{ data: dd }, { data: mm }] = await Promise.all([
      supabase
        .from("disputes")
        .select("*, transactions:transaction_id(title, currency, amount_cents, buyer_id, seller_id)")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("dispute_messages").select("*").eq("dispute_id", id).order("created_at"),
    ]);
    setD(dd as unknown as Dispute);
    setMsgs((mm ?? []) as Msg[]);
    setLoading(false);
    // resolve signed URLs for evidence
    const paths = (mm ?? []).flatMap((m) => (m as Msg).evidence_urls);
    if (paths.length) {
      const { data: sig } = await supabase.storage.from("dispute-evidence").createSignedUrls(paths, 3600);
      const map: Record<string, string> = {};
      sig?.forEach((s) => { if (s.path && s.signedUrl) map[s.path] = s.signedUrl; });
      setSigned(map);
    }
    // role check
    const [{ data: isM }, { data: isA }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: user.id, _role: "mediator" }),
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
    ]);
    setCanMediate(Boolean(isM) || Boolean(isA));
  }
  useEffect(() => { load(); }, [id]);

  async function handleSend() {
    if (!body.trim() && files.length === 0) return;
    setBusy(true); setError(null);
    try {
      const paths: string[] = [];
      for (const f of files) {
        const path = `${user.id}/${id}/${Date.now()}_${f.name}`;
        const { error: upErr } = await supabase.storage.from("dispute-evidence").upload(path, f, { upsert: false });
        if (upErr) throw new Error(upErr.message);
        paths.push(path);
      }
      await addMsgFn({ data: { disputeId: id, body: body.trim() || "(evidencia adjunta)", evidenceUrls: paths } });
      setBody(""); setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  if (loading) return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader email={user.email} userId={user.id} section="Disputa" />
      <div className="container-editorial py-16 text-sm text-muted-foreground">Cargando…</div>
    </div>
  );
  if (!d) return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader email={user.email} userId={user.id} section="Disputa" />
      <div className="container-editorial py-16"><h1 className="font-display text-4xl">Disputa no encontrada</h1></div>
    </div>
  );

  const tx = d.transactions!;
  const canPost = d.status === "open" || d.status === "in_mediation";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader email={user.email} userId={user.id} section="Disputa" />
      <main className="flex-1">
        <div className="container-editorial py-10 max-w-4xl">
          <Link to="/disputes" className="text-[11px] uppercase tracking-[0.14em] font-semibold underline underline-offset-4">← Disputas</Link>
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">Transacción</p>
          <h1 className="mt-1 font-display text-4xl tracking-wide">{tx.title}</h1>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
            <Kv k="Estado" v={d.status} />
            <Kv k="Motivo" v={d.reason_code} />
            <Kv k="Abierta por" v={d.opened_role} />
            <Kv k="Monto disputado" v={formatMoney(d.amount_disputed_cents, tx.currency)} />
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

          {/* Thread */}
          <section className="mt-10">
            <h2 className="font-display text-3xl tracking-wide">Hilo</h2>
            <div className="mt-4 border border-yo-border bg-background divide-y divide-yokto-black/20">
              {msgs.length === 0 && <p className="p-4 text-sm text-muted-foreground">Sin mensajes todavía.</p>}
              {msgs.map((m) => (
                <div key={m.id} className="p-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-[11px] uppercase tracking-[0.14em] font-semibold">{m.author_role}</span>
                    <span className="text-[11px] text-muted-foreground">{new Date(m.created_at).toLocaleString("es-MX")}</span>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-line">{m.body}</p>
                  {m.evidence_urls?.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {m.evidence_urls.map((p) => (
                        <li key={p} className="text-xs">
                          <a href={signed[p] ?? "#"} target="_blank" rel="noreferrer" className="underline underline-offset-4 font-mono break-all">
                            {p.split("/").slice(-1)[0]}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
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
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <button disabled={busy} onClick={handleSend} className="px-5 py-2.5 bg-yokto-yellow text-yokto-black text-[12px] uppercase tracking-[0.14em] font-semibold border border-yo-border disabled:opacity-50">
                    {busy ? "Enviando…" : "Enviar mensaje"}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Mediation panel */}
          {canMediate && d.status !== "resolved" && d.status !== "closed" && (
            <ResolvePanel dispute={d} onResolved={load} resolveFn={resolveFn} />
          )}
        </div>
      </main>
    </div>
  );
}

function ResolvePanel({ dispute, onResolved, resolveFn }: {
  dispute: Dispute;
  onResolved: () => Promise<void>;
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
      await onResolved();
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  return (
    <section className="mt-10">
      <h2 className="font-display text-3xl tracking-wide">Panel de mediación</h2>
      <div className="mt-4 border border-yo-border bg-yo-bg/40 p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          {(["buyer_favor", "seller_favor", "split", "no_resolution"] as const).map((r) => (
            <button key={r} onClick={() => preset(r)} className={`px-3 py-2 text-[11px] uppercase tracking-[0.14em] border border-yo-border ${resolution === r ? "bg-yo-ac text-yokto-cream" : "bg-background"}`}>
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
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Comisión de disputa (loser pays)</span>
            <select value={loserPays} onChange={(e) => setLoserPays(e.target.value as never)} className="input-editorial w-full mt-1">
              <option value="buyer">Comprador</option>
              <option value="seller">Vendedor</option>
              <option value="split">Dividida</option>
              <option value="none">Sin cargo</option>
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Notas de resolución (públicas para las partes)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="input-editorial w-full mt-1" />
        </label>
        {err && <div role="alert" className="border border-[#FF3B3B] bg-[#FF3B3B]/10 text-[#FF3B3B] p-3 text-sm">{err}</div>}
        <button disabled={busy || notes.length < 10} onClick={submit} className="px-5 py-2.5 bg-yokto-yellow text-yokto-black text-[12px] uppercase tracking-[0.14em] font-semibold border border-yo-border disabled:opacity-50">
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
