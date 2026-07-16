import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Webhook, Plus, Copy, Play, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { SettingsCard } from "@/components/settings/settings-shell";

export const Route = createFileRoute("/_authenticated/settings/webhooks")({
  component: WebhooksPage,
});

const EVENTS = [
  "transaction.created", "transaction.funded", "transaction.released",
  "dispute.opened", "dispute.resolved", "payout.paid", "kyc.updated",
];

type Hook = {
  id: string; url: string; events: string[]; secret: string; active: boolean;
  deliveries: { ts: string; event: string; status: number }[];
};

const urlSchema = z.string().url("URL inválida").startsWith("https://", "Debe ser HTTPS");

function randHex(n: number) {
  let s = ""; for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

function WebhooksPage() {
  const [hooks, setHooks] = useState<Hook[]>([{
    id: "wh_1", url: "https://api.miempresa.com/yokto/hook",
    events: ["transaction.released", "dispute.opened"],
    secret: `whsec_${randHex(40)}`, active: true,
    deliveries: [
      { ts: "2026-07-16 10:12", event: "transaction.released", status: 200 },
      { ts: "2026-07-15 18:44", event: "dispute.opened", status: 200 },
      { ts: "2026-07-15 09:20", event: "transaction.released", status: 500 },
    ],
  }]);
  const [url, setUrl] = useState("");
  const [selEvents, setSelEvents] = useState<string[]>(["transaction.released"]);

  function create() {
    const parsed = urlSchema.safeParse(url);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (selEvents.length === 0) { toast.error("Selecciona al menos un evento"); return; }
    setHooks((h) => [{
      id: `wh_${Date.now()}`, url, events: selEvents, secret: `whsec_${randHex(40)}`,
      active: true, deliveries: [],
    }, ...h]);
    setUrl(""); setSelEvents(["transaction.released"]);
    toast.success("Webhook creado. Guarda el secret ahora — no volverá a mostrarse.");
  }

  function del(id: string) {
    setHooks((h) => h.filter((x) => x.id !== id));
    toast.success("Webhook eliminado");
  }

  function test(id: string) {
    setHooks((h) => h.map((x) => x.id === id ? {
      ...x, deliveries: [{ ts: new Date().toISOString().slice(0, 16).replace("T", " "), event: "ping", status: 200 }, ...x.deliveries].slice(0, 20),
    } : x));
    toast.success("Ping enviado con firma HMAC-SHA256");
  }

  function rotate(id: string) {
    setHooks((h) => h.map((x) => x.id === id ? { ...x, secret: `whsec_${randHex(40)}` } : x));
    toast.success("Secret rotado");
  }

  return (
    <div className="space-y-4">
      <SettingsCard icon={Plus} title="Nuevo webhook" description="Endpoints HTTPS firmados con HMAC-SHA256 en cabecera x-yokto-signature.">
        <div className="space-y-3">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.miempresa.com/yokto/hook"
            className="w-full h-10 rounded-md border border-yo-border bg-background px-3 text-sm" />
          <div>
            <div className="text-[11px] uppercase tracking-wider text-yo-txt-3 mb-1.5">Eventos</div>
            <div className="flex flex-wrap gap-1.5">
              {EVENTS.map((ev) => {
                const on = selEvents.includes(ev);
                return (
                  <button key={ev} onClick={() => setSelEvents((s) => on ? s.filter((x) => x !== ev) : [...s, ev])}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-mono border ${on ? "bg-yo-ac text-white border-yo-ac" : "bg-yo-surface border-yo-border text-yo-txt-2"}`}>
                    {ev}
                  </button>
                );
              })}
            </div>
          </div>
          <button onClick={create} className="h-9 px-4 rounded-md bg-yo-ac text-white text-sm font-medium">Crear webhook</button>
        </div>
      </SettingsCard>

      {hooks.map((h) => (
        <SettingsCard key={h.id} icon={Webhook} title={h.url} description={`${h.events.length} eventos · ${h.deliveries.length} entregas recientes`}>
          <div className="space-y-3">
            <div className="rounded-md border border-yo-border bg-yo-raised/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10.5px] uppercase text-yo-txt-3">Signing secret</div>
                  <code className="text-[12px] font-mono truncate block">{h.secret}</code>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => { navigator.clipboard.writeText(h.secret); toast.success("Copiado"); }}
                    className="h-8 px-2 rounded-md border border-yo-border text-xs inline-flex items-center gap-1"><Copy className="size-3" /> Copiar</button>
                  <button onClick={() => rotate(h.id)}
                    className="h-8 px-2 rounded-md border border-yo-border text-xs inline-flex items-center gap-1"><RefreshCw className="size-3" /> Rotar</button>
                </div>
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wider text-yo-txt-3 mb-1.5">Historial de entregas</div>
              <div className="rounded-md border border-yo-border overflow-hidden">
                {h.deliveries.length === 0 ? (
                  <p className="p-3 text-[12px] text-yo-txt-3">Sin entregas todavía.</p>
                ) : (
                  <ul className="divide-y divide-yo-border">
                    {h.deliveries.map((d, i) => (
                      <li key={i} className="flex items-center justify-between px-3 py-2 text-[12px]">
                        <span className="font-mono text-yo-txt-3">{d.ts}</span>
                        <span className="font-mono">{d.event}</span>
                        <span className={`font-mono ${d.status < 300 ? "text-emerald-700" : "text-red-700"}`}>{d.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => test(h.id)} className="h-8 px-3 rounded-md border border-yo-border text-xs inline-flex items-center gap-1.5">
                <Play className="size-3" /> Probar
              </button>
              <button onClick={() => del(h.id)} className="h-8 px-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-xs inline-flex items-center gap-1.5">
                <Trash2 className="size-3" /> Eliminar
              </button>
            </div>
          </div>
        </SettingsCard>
      ))}
    </div>
  );
}
