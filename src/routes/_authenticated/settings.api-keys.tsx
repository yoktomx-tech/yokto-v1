import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Copy, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listApiClients, createApiClient, revokeApiClient } from "@/lib/api-clients.functions";
import { SettingsCard } from "@/components/settings/settings-shell";

export const Route = createFileRoute("/_authenticated/settings/api-keys")({
  component: ApiKeysPage,
});

function ApiKeysPage() {
  const listFn = useServerFn(listApiClients);
  const createFn = useServerFn(createApiClient);
  const revokeFn = useServerFn(revokeApiClient);
  const [items, setItems] = useState<Awaited<ReturnType<typeof listApiClients>>>([]);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<("read" | "write")[]>(["read"]);
  const [ipWhitelist, setIpWhitelist] = useState("");
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<{ keyId: string; secret: string } | null>(null);

  async function load() { setItems(await listFn()); }
  useEffect(() => { void load(); }, []);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const r = await createFn({ data: { name: name.trim(), scopes } });
      setFresh({ keyId: r.key_id, secret: r.secret });
      setName(""); setIpWhitelist("");
      await load();
    } finally { setBusy(false); }
  }

  async function revoke(id: string) {
    setBusy(true);
    try { await revokeFn({ data: { id } }); await load(); toast.success("API key revocada"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <SettingsCard icon={KeyRound} title="Nueva API key" description="Las credenciales se muestran una sola vez. Sólo guardamos su hash SHA-256.">
        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (p.ej. ERP Producción)"
            className="w-full h-10 rounded-md border border-yo-border bg-background px-3 text-sm" />

          <div>
            <div className="text-[11px] uppercase tracking-wider text-yo-txt-3 mb-1.5">Scopes</div>
            <div className="flex gap-2">
              {(["read", "write"] as const).map((s) => {
                const on = scopes.includes(s);
                return (
                  <button key={s} onClick={() => setScopes((cur) => on ? cur.filter((x) => x !== s) : [...cur, s])}
                    className={`px-3 py-1 rounded-full text-[12px] font-mono border ${on ? "bg-yo-ac text-white border-yo-ac" : "bg-yo-surface border-yo-border text-yo-txt-2"}`}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wider text-yo-txt-3 mb-1.5">IP whitelist (opcional)</div>
            <input value={ipWhitelist} onChange={(e) => setIpWhitelist(e.target.value)} placeholder="200.10.1.0/24, 189.20.30.40"
              className="w-full h-10 rounded-md border border-yo-border bg-background px-3 text-sm font-mono" />
          </div>

          <button onClick={create} disabled={busy || !name.trim()}
            className="h-9 px-4 rounded-md bg-yo-ac text-white text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2">
            {busy && <Loader2 className="size-4 animate-spin" />} Crear API key
          </button>

          {fresh && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
              <p className="text-[12px] font-semibold text-amber-900">Guarda tu secret ahora — no se volverá a mostrar.</p>
              <SecretRow label="Key ID" value={fresh.keyId} />
              <SecretRow label="Secret" value={fresh.secret} />
            </div>
          )}
        </div>
      </SettingsCard>

      <SettingsCard icon={KeyRound} title="API keys activas">
        {items.length === 0 ? (
          <p className="text-[13px] text-yo-txt-3">No tienes credenciales.</p>
        ) : (
          <ul className="divide-y divide-yo-border">
            {items.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium">
                    {c.name} {!c.active && <span className="text-xs text-red-600 ml-1">(revocada)</span>}
                  </div>
                  <div className="text-[11.5px] text-yo-txt-3 font-mono">{c.key_id}</div>
                  <div className="text-[11px] text-yo-txt-3 mt-0.5">
                    scopes: {(c.scopes ?? []).join(", ") || "read"} · último uso: {c.last_used_at ? new Date(c.last_used_at).toLocaleString() : "nunca"}
                  </div>
                </div>
                {c.active && (
                  <button onClick={() => revoke(c.id)} disabled={busy}
                    className="h-8 px-2 rounded-md border border-red-200 bg-red-50 text-red-700 text-xs inline-flex items-center gap-1">
                    <Trash2 className="size-3" /> Revocar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>
    </div>
  );
}

function SecretRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-amber-900 w-14">{label}</span>
      <code className="flex-1 text-xs font-mono bg-white border border-amber-200 rounded px-2 py-1 truncate">{value}</code>
      <button onClick={() => { navigator.clipboard.writeText(value); toast.success("Copiado"); }}
        className="inline-flex items-center gap-1 text-xs text-amber-900 hover:underline">
        <Copy className="size-3" /> Copiar
      </button>
    </div>
  );
}
