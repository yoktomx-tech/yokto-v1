import { useState } from "react";

interface Props {
  transactionNumero: string;
  maxAmountCents: number;
  currency?: string;
  onConfirm: (reason: string, percentage: number) => Promise<void>;
  onClose: () => void;
}

function money(cents: number, cur = "MXN") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: cur }).format(cents / 100);
}

export function RefundDialog({ transactionNumero, maxAmountCents, currency = "MXN", onConfirm, onClose }: Props) {
  const [reason, setReason] = useState("");
  const [pct, setPct] = useState(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (reason.trim().length < 10) { setError("Motivo debe tener al menos 10 caracteres"); return; }
    setBusy(true); setError(null);
    try { await onConfirm(reason.trim(), pct); onClose(); }
    catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg border border-yo-border bg-background p-6">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Devolución</p>
        <h2 className="mt-1 font-display text-2xl">Devolver fondos — {transactionNumero}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Los fondos regresan al Customer Balance del pagador en Stripe. Los hitos ya liberados no se devuelven.
        </p>

        {error && <div role="alert" className="mt-4 border border-[#FF3B3B] bg-[#FF3B3B]/10 text-[#FF3B3B] p-3 text-sm">{error}</div>}

        <label className="mt-4 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Porcentaje a devolver</label>
        <div className="mt-2 flex items-center gap-3">
          <input type="range" min={10} max={100} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="flex-1" />
          <span className="font-mono w-16 text-right">{pct}%</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Devolverás <span className="font-mono">{money((maxAmountCents * pct) / 100, currency)}</span> de <span className="font-mono">{money(maxAmountCents, currency)}</span>.
        </p>

        <label className="mt-4 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Motivo</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="mt-2 w-full border border-yo-border bg-background p-3 text-sm"
          placeholder="Describe el motivo de la devolución"
        />

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-yo-border text-[12px] uppercase tracking-[0.14em]">Cancelar</button>
          <button disabled={busy} onClick={submit} className="px-4 py-2 bg-[#FF3B3B] text-white text-[12px] uppercase tracking-[0.14em] disabled:opacity-50">
            {busy ? "Procesando..." : "Confirmar devolución"}
          </button>
        </div>
      </div>
    </div>
  );
}
