import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Copy, Key, Loader2, Trash2 } from "lucide-react";
import { listApiClients, createApiClient, revokeApiClient } from "@/lib/api-clients.functions";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/api-clients")({
  head: () => ({ meta: [{ title: "API — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: ApiClientsPage,
});

function ApiClientsPage() {
  const { user } = Route.useRouteContext();
  const listFn = useServerFn(listApiClients);
  const createFn = useServerFn(createApiClient);
  const revokeFn = useServerFn(revokeApiClient);
  const [items, setItems] = useState<Awaited<ReturnType<typeof listApiClients>>>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [freshSecret, setFreshSecret] = useState<{ keyId: string; secret: string } | null>(null);

  async function load() { setItems(await listFn()); }
  useEffect(() => { void load(); }, []);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const r = await createFn({ data: { name: name.trim(), scopes: ["read"] } });
      setFreshSecret({ keyId: r.key_id, secret: r.secret });
      setName("");
      await load();
    } finally { setBusy(false); }
  }

  async function revoke(id: string) {
    setBusy(true);
    try { await revokeFn({ data: { id } }); await load(); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 container-editorial py-8 max-w-4xl">
        <h1 className="text-2xl font-bold tracking-tight text-yo-txt">API pública</h1>
        <p className="text-sm text-yo-txt-3 mt-1">
          Genera credenciales para integrar YOKTO con tu ERP, marketplace o backend. Cada request debe firmarse con HMAC-SHA256.
        </p>

        <div className="rounded-lg border border-yo-border bg-yo-surface p-5 mt-6">
          <h2 className="font-semibold flex items-center gap-2"><Key className="size-4" /> Nueva credencial</h2>
          <div className="flex gap-2 mt-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (p.ej. ERP Producción)"
              className="flex-1 h-9 rounded-md border border-yo-border bg-background px-3 text-sm" />
            <button onClick={create} disabled={busy || !name.trim()}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-yo-ac text-white text-sm font-medium disabled:opacity-50">
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Crear"}
            </button>
          </div>
          {freshSecret && (
            <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-900">Guarda tu secreto ahora — no se volverá a mostrar.</p>
              <SecretRow label="Key ID" value={freshSecret.keyId} />
              <SecretRow label="Secret" value={freshSecret.secret} />
            </div>
          )}
        </div>

        <h3 className="mt-8 mb-2 text-sm font-semibold text-yo-txt-2 uppercase tracking-wider">Credenciales activas</h3>
        <div className="rounded-lg border border-yo-border bg-yo-surface">
          {items.length === 0 ? (
            <p className="p-4 text-sm text-yo-txt-3">Aún no has creado credenciales.</p>
          ) : (
            <ul className="divide-y divide-yo-border">
              {items.map((c) => (
                <li key={c.id} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{c.name} {!c.active && <span className="text-xs text-red-600">(revocada)</span>}</div>
                    <div className="text-xs text-yo-txt-3 font-mono">{c.key_id}</div>
                  </div>
                  {c.active && (
                    <button onClick={() => revoke(c.id)} disabled={busy}
                      className="inline-flex items-center gap-1 h-8 px-2 rounded-md border border-red-200 bg-red-50 text-red-700 text-xs">
                      <Trash2 className="size-3.5" /> Revocar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-8 rounded-lg border border-yo-border bg-yo-surface p-5">
          <h3 className="font-semibold">Firma de request (HMAC-SHA256)</h3>
          <p className="text-xs text-yo-txt-3 mt-1">
            Endpoint: <code className="bg-background px-1 rounded">GET /api/public/v1/transactions</code>
          </p>
          <pre className="mt-3 text-[11px] bg-background border border-yo-border rounded-md p-3 overflow-x-auto">
{`ts   = floor(Date.now()/1000)
body = ""   // string vacío en GET
sig  = HMAC_SHA256( sha256_hex(secret), \`\${ts}.GET./api/public/v1/transactions.\${sha256_hex(body)}\` )

Headers:
  x-yokto-key: <key_id>
  x-yokto-timestamp: <ts>
  x-yokto-signature: <sig hex>`}
          </pre>
        </div>
      </main>
    </div>
  );
}

function SecretRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-amber-900 w-14">{label}</span>
      <code className="flex-1 text-xs font-mono bg-white border border-amber-200 rounded px-2 py-1 truncate">{value}</code>
      <button onClick={() => navigator.clipboard.writeText(value)} className="inline-flex items-center gap-1 text-xs text-amber-900 hover:underline">
        <Copy className="size-3" /> Copiar
      </button>
    </div>
  );
}
