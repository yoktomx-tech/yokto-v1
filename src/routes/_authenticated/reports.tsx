import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { exportTransactionsCsv, listRecentReports, generateCfdiStub } from "@/lib/reports.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reportes — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { user } = Route.useRouteContext();
  const exportFn = useServerFn(exportTransactionsCsv);
  const cfdiFn = useServerFn(generateCfdiStub);
  const listFn = useServerFn(listRecentReports);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [txs, setTxs] = useState<{ id: string; title: string; released_at: string | null }[]>([]);
  const [reports, setReports] = useState<Awaited<ReturnType<typeof listRecentReports>>>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<string>("");

  async function refresh() {
    const { data } = await supabase.from("transactions")
      .select("id, title, released_at")
      .not("released_at", "is", null)
      .order("released_at", { ascending: false })
      .limit(50);
    setTxs((data ?? []) as { id: string; title: string; released_at: string | null }[]);
    setReports(await listFn());
  }
  useEffect(() => { void refresh(); }, []);

  async function downloadCsv() {
    setBusy(true); setMsg(null);
    try {
      const res = await exportFn({ data: { from: from || undefined, to: to || undefined } });
      const blob = new Blob([Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0))], { type: res.mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = res.filename; a.click();
      URL.revokeObjectURL(url);
      setMsg(`CSV generado con ${res.rows} filas.`);
      await refresh();
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  }

  async function downloadCfdi() {
    if (!selectedTx) return;
    setBusy(true); setMsg(null);
    try {
      const stub = await cfdiFn({ data: { transactionId: selectedTx } });
      const blob = new Blob([JSON.stringify(stub, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${stub.folio}.json`; a.click();
      URL.revokeObjectURL(url);
      setMsg(`CFDI stub generado (${stub.folio}). Integra un PAC para timbrado real.`);
      await refresh();
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader email={user.email} userId={user.id} section="Reportes" />
      <main className="flex-1 container-editorial py-8 max-w-4xl">
        <h1 className="text-2xl font-bold tracking-tight text-yo-txt">Reportes y CFDI</h1>
        <p className="text-sm text-yo-txt-3 mt-1">Exporta tu operación en CSV y genera CFDI stub para pruebas de integración.</p>

        {msg && <div className="mt-4 rounded-md border border-yo-border bg-yo-surface px-3 py-2 text-sm">{msg}</div>}

        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <div className="rounded-lg border border-yo-border bg-yo-surface p-5">
            <h2 className="font-semibold flex items-center gap-2"><Download className="size-4" /> Exportar transacciones (CSV)</h2>
            <p className="text-xs text-yo-txt-3 mt-1">Todas tus operaciones como comprador o vendedor.</p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <label className="text-xs">Desde<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full h-9 rounded-md border border-yo-border bg-background px-2 text-sm" /></label>
              <label className="text-xs">Hasta<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full h-9 rounded-md border border-yo-border bg-background px-2 text-sm" /></label>
            </div>
            <button onClick={downloadCsv} disabled={busy}
              className="mt-3 inline-flex items-center gap-2 h-9 px-4 rounded-md bg-yo-ac text-white text-sm font-medium disabled:opacity-50">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Descargar CSV
            </button>
          </div>

          <div className="rounded-lg border border-yo-border bg-yo-surface p-5">
            <h2 className="font-semibold flex items-center gap-2"><FileText className="size-4" /> CFDI 4.0 (stub)</h2>
            <p className="text-xs text-yo-txt-3 mt-1">Estructura JSON compatible con PACs. No sustituye timbrado fiscal real.</p>
            <select value={selectedTx} onChange={(e) => setSelectedTx(e.target.value)}
              className="mt-3 w-full h-9 rounded-md border border-yo-border bg-background px-2 text-sm">
              <option value="">Selecciona transacción liberada…</option>
              {txs.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <button onClick={downloadCfdi} disabled={busy || !selectedTx}
              className="mt-3 inline-flex items-center gap-2 h-9 px-4 rounded-md bg-yo-ac text-white text-sm font-medium disabled:opacity-50">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />} Generar CFDI stub
            </button>
          </div>
        </div>

        <h3 className="mt-8 mb-2 text-sm font-semibold text-yo-txt-2 uppercase tracking-wider">Historial</h3>
        <div className="rounded-lg border border-yo-border bg-yo-surface">
          {reports.length === 0 ? (
            <p className="p-4 text-sm text-yo-txt-3">Sin reportes generados.</p>
          ) : (
            <ul className="divide-y divide-yo-border">
              {reports.map((r) => (
                <li key={r.id} className="p-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{r.kind === "tx_csv" ? "Export CSV" : r.kind === "cfdi_stub" ? "CFDI stub" : "PDF"}</span>
                    {r.row_count != null && <span className="text-xs text-yo-txt-3 ml-2">{r.row_count} filas</span>}
                  </div>
                  <span className="text-xs text-yo-txt-3">{new Date(r.created_at).toLocaleString("es-MX")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
