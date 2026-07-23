import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, Plus, RotateCw, XCircle, Eye, Copy, X, CheckCircle2, Lock } from "lucide-react";
import {
  MOCK_API_KEYS, TEAM, planAllows, AVAILABLE_PERMISSIONS, WEBHOOK_EVENTS, formatDateTime,
  type ApiKey,
} from "@/lib/teams-mock";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/teams/api-keys")({
  component: ApiKeysPage,
});

function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>(MOCK_API_KEYS);
  const [createOpen, setCreateOpen] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);

  const gated = !planAllows(TEAM.plan, "apiKeys");

  if (gated) {
    return (
      <div className="rounded-lg bg-yo-surface border border-yo-border p-10 text-center shadow-sm">
        <div className="mx-auto size-12 rounded-xl bg-yo-ac-bg grid place-items-center mb-4">
          <Lock className="size-6 text-yo-ac" />
        </div>
        <h3 className="text-[16px] font-semibold text-yo-txt">API Keys disponibles en Enterprise</h3>
        <p className="mt-1 text-[13px] text-yo-txt-2 max-w-md mx-auto">
          Actualiza tu plan para conectar CUMPLEX con tu ERP, TMS o sistema interno mediante API REST y webhooks.
        </p>
        <button className="mt-4 h-9 px-4 text-[13px] font-semibold rounded-md bg-yo-ac text-white hover:bg-yo-ac-h">
          Actualizar a Enterprise
        </button>
      </div>
    );
  }

  const create = (payload: Omit<ApiKey, "id" | "prefix" | "requests" | "ultimo_uso" | "activa">) => {
    const raw = "yk_" + (payload.environment === "sandbox" ? "test_" : "live_") + Math.random().toString(36).slice(2, 34);
    const prefix = raw.slice(0, 12);
    const key: ApiKey = { ...payload, id: "ak" + Date.now(), prefix, requests: 0, ultimo_uso: "", activa: true };
    setKeys(prev => [key, ...prev]);
    setCreateOpen(false);
    setRevealed(raw);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-yo-txt">API Keys</h2>
          <p className="text-[12.5px] text-yo-txt-3">Conecta CUMPLEX con tu ERP, CRM, TMS o sistema interno.</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-1.5 h-9 px-3 text-[13px] font-medium rounded-md bg-yo-ac text-white hover:bg-yo-ac-h">
          <Plus className="size-3.5" /> Crear API Key
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {keys.map(k => (
          <article key={k.id} className="relative rounded-lg bg-yo-surface border border-yo-border p-4 shadow-sm">
            <div className={cn("absolute top-0 inset-x-0 h-0.5", k.activa ? "bg-yo-ac" : "bg-yo-border-s")} />
            <header className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <KeyRound className="size-4 text-yo-ac" />
                  <h3 className="text-[14px] font-semibold text-yo-txt">{k.nombre}</h3>
                </div>
                <div className="mt-1 font-mono text-[12px] text-yo-txt-2">{k.prefix}…</div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider",
                  k.environment === "production" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                )}>{k.environment}</span>
                <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider",
                  k.activa ? "bg-yo-ac-bg text-yo-ac-txt" : "bg-yo-raised text-yo-txt-3"
                )}>{k.activa ? "Activa" : "Revocada"}</span>
              </div>
            </header>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] mb-3">
              <div>
                <dt className="text-yo-txt-3 text-[10.5px] uppercase tracking-wider font-semibold">Permisos</dt>
                <dd className="text-yo-txt-2 mt-0.5">{k.permisos.length} scopes</dd>
              </div>
              <div>
                <dt className="text-yo-txt-3 text-[10.5px] uppercase tracking-wider font-semibold">IP allowlist</dt>
                <dd className="text-yo-txt-2 mt-0.5 font-mono">{k.ip_whitelist.length ? k.ip_whitelist.join(", ") : "Cualquiera"}</dd>
              </div>
              <div>
                <dt className="text-yo-txt-3 text-[10.5px] uppercase tracking-wider font-semibold">Requests</dt>
                <dd className="font-mono tabular-nums text-yo-txt mt-0.5">{k.requests.toLocaleString("es-MX")}</dd>
              </div>
              <div>
                <dt className="text-yo-txt-3 text-[10.5px] uppercase tracking-wider font-semibold">Último uso</dt>
                <dd className="text-yo-txt-2 mt-0.5">{k.ultimo_uso ? formatDateTime(k.ultimo_uso) : "Nunca"}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-1 mb-3">
              {k.permisos.slice(0, 4).map(p => (
                <span key={p} className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-yo-raised text-yo-txt-2">{p}</span>
              ))}
              {k.permisos.length > 4 && <span className="text-[10.5px] text-yo-txt-3">+{k.permisos.length - 4}</span>}
            </div>
            <footer className="flex gap-2">
              <button onClick={() => toast.info("Logs (mock)")} className="h-8 px-2.5 text-[12px] rounded-md border border-yo-border hover:bg-yo-raised inline-flex items-center gap-1">
                <Eye className="size-3.5" /> Logs
              </button>
              <button onClick={() => { toast.success("Nueva key generada"); setRevealed("yk_live_" + Math.random().toString(36).slice(2, 34)); }}
                className="h-8 px-2.5 text-[12px] rounded-md border border-yo-border hover:bg-yo-raised inline-flex items-center gap-1">
                <RotateCw className="size-3.5" /> Rotar
              </button>
              <button
                onClick={() => setKeys(prev => prev.map(x => x.id === k.id ? { ...x, activa: false } : x))}
                className="h-8 px-2.5 text-[12px] rounded-md border border-red-200 text-red-600 hover:bg-red-50 inline-flex items-center gap-1">
                <XCircle className="size-3.5" /> Revocar
              </button>
            </footer>
          </article>
        ))}
      </div>

      <p className="text-[11px] text-yo-txt-3">
        Las API Keys permiten integrar sistemas externos. Trátalas como credenciales sensibles.
      </p>

      {createOpen && <CreateApiKeyModal onClose={() => setCreateOpen(false)} onCreate={create} />}
      {revealed && <RevealModal apiKey={revealed} onClose={() => setRevealed(null)} />}
    </div>
  );
}

function CreateApiKeyModal({ onClose, onCreate }: { onClose: () => void; onCreate: (p: Omit<ApiKey, "id" | "prefix" | "requests" | "ultimo_uso" | "activa">) => void }) {
  const [nombre, setNombre] = useState("");
  const [env, setEnv] = useState<"sandbox" | "production">("production");
  const [permisos, setPermisos] = useState<string[]>(["transactions:read"]);
  const [ips, setIps] = useState("");
  const [whUrl, setWhUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);

  const submit = () => {
    if (!nombre) { toast.error("Nombre requerido"); return; }
    onCreate({
      nombre,
      environment: env,
      permisos,
      ip_whitelist: ips.split(",").map(s => s.trim()).filter(Boolean),
      webhook_url: whUrl || undefined,
      webhook_events: events.length ? events : undefined,
      expira: null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg bg-yo-surface border border-yo-border shadow-lg max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="px-5 py-3.5 border-b border-yo-border flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-yo-txt">Crear API Key</h3>
          <button onClick={onClose} className="size-7 grid place-items-center rounded-md hover:bg-yo-raised"><X className="size-4" /></button>
        </header>
        <div className="p-5 space-y-4 overflow-y-auto">
          <F label="Nombre">
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Integración SAP"
              className="w-full h-9 px-3 text-[13px] rounded-md border border-yo-border focus:border-yo-ac focus:outline-none" />
          </F>
          <F label="Ambiente">
            <div className="flex gap-2">
              {(["production", "sandbox"] as const).map(e => (
                <button key={e} type="button" onClick={() => setEnv(e)}
                  className={cn("flex-1 h-9 text-[12.5px] font-medium rounded-md border",
                    env === e ? "border-yo-ac bg-yo-ac-bg text-yo-ac-txt" : "border-yo-border hover:bg-yo-raised")}>
                  {e === "production" ? "Producción" : "Sandbox"}
                </button>
              ))}
            </div>
          </F>
          <F label="Permisos">
            <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-2 border border-yo-border rounded-md">
              {AVAILABLE_PERMISSIONS.map(p => {
                const on = permisos.includes(p);
                return (
                  <label key={p} className="flex items-center gap-1.5 text-[11.5px] cursor-pointer">
                    <input type="checkbox" checked={on}
                      onChange={() => setPermisos(prev => on ? prev.filter(x => x !== p) : [...prev, p])} />
                    <span className="font-mono text-yo-txt-2">{p}</span>
                  </label>
                );
              })}
            </div>
          </F>
          <F label="IP whitelist (opcional, separadas por coma)">
            <input value={ips} onChange={e => setIps(e.target.value)} placeholder="201.120.10.4, 187.144.90.2"
              className="w-full h-9 px-3 text-[13px] font-mono rounded-md border border-yo-border focus:border-yo-ac focus:outline-none" />
          </F>
          <F label="Webhook URL (opcional)">
            <input value={whUrl} onChange={e => setWhUrl(e.target.value)} placeholder="https://erp.tuempresa.com/hooks/yokto"
              className="w-full h-9 px-3 text-[13px] font-mono rounded-md border border-yo-border focus:border-yo-ac focus:outline-none" />
          </F>
          {whUrl && (
            <F label="Eventos a notificar">
              <div className="flex flex-wrap gap-1.5">
                {WEBHOOK_EVENTS.map(ev => {
                  const on = events.includes(ev);
                  return (
                    <button key={ev} type="button"
                      onClick={() => setEvents(prev => on ? prev.filter(x => x !== ev) : [...prev, ev])}
                      className={cn("px-2 py-1 rounded-full text-[10.5px] font-mono border",
                        on ? "bg-yo-ac-bg border-yo-ac text-yo-ac-txt" : "bg-yo-surface border-yo-border text-yo-txt-2 hover:bg-yo-raised")}>
                      {ev}
                    </button>
                  );
                })}
              </div>
            </F>
          )}
        </div>
        <footer className="px-5 py-3 border-t border-yo-border flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-3 text-[13px] rounded-md border border-yo-border hover:bg-yo-raised">Cancelar</button>
          <button onClick={submit} className="h-9 px-4 text-[13px] font-semibold rounded-md bg-yo-ac text-white hover:bg-yo-ac-h">Generar API Key</button>
        </footer>
      </div>
    </div>
  );
}

function RevealModal({ apiKey, onClose }: { apiKey: string; onClose: () => void }) {
  const copy = () => { navigator.clipboard.writeText(apiKey); toast.success("Copiada al portapapeles"); };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4">
      <div className="w-full max-w-md rounded-lg bg-yo-surface border border-yo-border shadow-lg">
        <div className="p-5 text-center">
          <div className="mx-auto size-12 rounded-xl bg-emerald-50 grid place-items-center mb-3">
            <CheckCircle2 className="size-6 text-emerald-600" />
          </div>
          <h3 className="text-[15px] font-semibold text-yo-txt">Guarda esta API Key ahora</h3>
          <p className="text-[12.5px] text-yo-txt-2 mt-1">Por seguridad, no volverá a mostrarse.</p>
          <div className="mt-4 p-3 rounded-md bg-yo-raised border border-yo-border font-mono text-[12px] text-yo-txt break-all">
            {apiKey}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={copy} className="flex-1 h-9 text-[13px] font-medium rounded-md border border-yo-border hover:bg-yo-raised inline-flex items-center justify-center gap-1.5">
              <Copy className="size-3.5" /> Copiar
            </button>
            <button onClick={onClose} className="flex-1 h-9 text-[13px] font-semibold rounded-md bg-yo-ac text-white hover:bg-yo-ac-h">Entendido</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-1">{label}</span>
      {children}
    </label>
  );
}
