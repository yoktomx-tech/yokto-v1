import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listLedgerEntries, type LedgerEntry } from "@/lib/ledger.functions";
import { PageHeader } from "@/components/page-header";
import { NoCustodyBanner } from "@/components/payments/ui/no-custody-banner";
import { BookOpen, Download, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/payments/ledger")({
  head: () => ({ meta: [{ title: "Ledger contable — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: LedgerPage,
});

const KIND_LABEL: Record<string, { label: string; tone: string }> = {
  FONDEO:         { label: "Fondeo",           tone: "text-yo-info bg-yo-info/10" },
  LIBERACION:     { label: "Liberación",       tone: "text-yo-ok bg-yo-ok/10" },
  COMISION_YOKTO: { label: "Comisión YOKTO",   tone: "text-yo-ac bg-yo-ac/10" },
  REEMBOLSO:      { label: "Reembolso",        tone: "text-yo-warn bg-yo-warn/10" },
};

function money(cents: number, currency = "MXN") {
  return `${(cents / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })} ${currency}`;
}

function exportLedgerCsv(entries: LedgerEntry[]) {
  const headers = ["fecha","tipo","transaccion","titulo","contraparte","pasarela","referencia","debito","credito","moneda"];
  const lines = [headers.join(",")];
  for (const e of entries) {
    const row = [
      e.date, KIND_LABEL[e.kind]?.label ?? e.kind, e.txNumero ?? e.txId,
      e.txTitle ?? "", e.counterparty ?? "", e.provider ?? "", e.reference ?? "",
      (e.debitCents/100).toFixed(2), (e.creditCents/100).toFixed(2), e.currency,
    ].map((v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    });
    lines.push(row.join(","));
  }
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "yokto-ledger.csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function LedgerPage() {
  const navigate = useNavigate();
  const fn = useServerFn(listLedgerEntries);
  const { data: entries = [], isLoading } = useQuery({ queryKey: ["ledger"], queryFn: () => fn() });
  const [kind, setKind] = useState<string>("ALL");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (kind !== "ALL" && e.kind !== kind) return false;
      if (query) {
        const hay = [e.txNumero, e.txTitle, e.counterparty, e.reference].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [entries, kind, q]);

  const totals = useMemo(() => {
    let deb = 0, cre = 0;
    for (const e of filtered) { deb += e.debitCents; cre += e.creditCents; }
    return { deb, cre, saldo: deb - cre };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BookOpen}
        title="Ledger contable"
        subtitle="Asientos derivados de los movimientos procesados por la pasarela. YOKTO no custodia fondos."
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/payments"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-yo-card border border-yo-border text-yo-t1 text-sm font-medium rounded-md hover:bg-yo-hover"
            >
              <ArrowLeft className="size-4" /> Centro de Pagos
            </Link>
            <button
              onClick={() => exportLedgerCsv(filtered)}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-yo-ac text-white text-sm font-medium rounded-md hover:bg-yo-ac-h disabled:opacity-50"
            >
              <Download className="size-4" /> Exportar CSV
            </button>
          </div>
        }
      />

      <NoCustodyBanner />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-yo-border bg-yo-card p-4">
          <p className="text-xs text-yo-t2">Débitos (fondeos)</p>
          <p className="mt-1 font-mono text-xl text-yo-t1">{money(totals.deb)}</p>
        </div>
        <div className="rounded-xl border border-yo-border bg-yo-card p-4">
          <p className="text-xs text-yo-t2">Créditos (salidas)</p>
          <p className="mt-1 font-mono text-xl text-yo-t1">{money(totals.cre)}</p>
        </div>
        <div className="rounded-xl border border-yo-border bg-yo-card p-4">
          <p className="text-xs text-yo-t2">Retención neta en pasarela</p>
          <p className={`mt-1 font-mono text-xl ${totals.saldo >= 0 ? "text-yo-ok" : "text-yo-err"}`}>
            {money(totals.saldo)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar transacción, contraparte o referencia…"
          className="flex-1 min-w-[240px] px-3 py-2 bg-yo-card border border-yo-border rounded-md text-sm text-yo-t1"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="px-3 py-2 bg-yo-card border border-yo-border rounded-md text-sm text-yo-t1"
        >
          <option value="ALL">Todos los tipos</option>
          <option value="FONDEO">Fondeos</option>
          <option value="LIBERACION">Liberaciones</option>
          <option value="COMISION_YOKTO">Comisiones YOKTO</option>
          <option value="REEMBOLSO">Reembolsos</option>
        </select>
      </div>

      <div className="rounded-xl border border-yo-border bg-yo-card overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-yo-t2">Cargando ledger…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-yo-t2">Sin movimientos.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-yo-hover text-yo-t2">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Fecha</th>
                <th className="text-left px-3 py-2 font-medium">Tipo</th>
                <th className="text-left px-3 py-2 font-medium">Transacción</th>
                <th className="text-left px-3 py-2 font-medium">Contraparte</th>
                <th className="text-left px-3 py-2 font-medium">Referencia</th>
                <th className="text-right px-3 py-2 font-medium">Débito</th>
                <th className="text-right px-3 py-2 font-medium">Crédito</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yo-border">
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  className="hover:bg-yo-hover cursor-pointer"
                  onClick={() => navigate({ to: "/transactions/$id", params: { id: e.txId } })}
                >
                  <td className="px-3 py-2 text-yo-t2 whitespace-nowrap">
                    {new Date(e.date).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${KIND_LABEL[e.kind]?.tone ?? ""}`}>
                      {KIND_LABEL[e.kind]?.label ?? e.kind}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-yo-t1">{e.txNumero ?? "—"}</div>
                    <div className="text-xs text-yo-t2 truncate max-w-[200px]">{e.txTitle ?? ""}</div>
                  </td>
                  <td className="px-3 py-2 text-yo-t1 truncate max-w-[180px]">{e.counterparty ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs text-yo-t2">{e.reference ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono text-yo-info">
                    {e.debitCents > 0 ? money(e.debitCents, e.currency) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-yo-ok">
                    {e.creditCents > 0 ? money(e.creditCents, e.currency) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
