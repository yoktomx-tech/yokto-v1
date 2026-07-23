import { useState } from "react";

interface Props {
  title: string;
  amountCents: number;
  commissionCents: number;
  netCents: number;
  currency?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

function money(cents: number, cur = "MXN") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: cur }).format(cents / 100);
}

export function ReleaseFundsDialog({ title, amountCents, commissionCents, netCents, currency = "MXN", onConfirm, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setError(null);
    try { await onConfirm(); onClose(); }
    catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md border border-yo-border bg-background p-6">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Liberar fondos</p>
        <h2 className="mt-1 font-display text-2xl">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Se transferirá vía Stripe Connect a la cuenta del beneficiario. Esta acción es irreversible.
        </p>

        {error && <div role="alert" className="mt-4 border border-[#FF3B3B] bg-[#FF3B3B]/10 text-[#FF3B3B] p-3 text-sm">{error}</div>}

        <div className="mt-4 border border-yo-border p-4 space-y-2 text-sm">
          <Row k="Monto bruto" v={money(amountCents, currency)} />
          <Row k="Comisión Cumplex" v={`− ${money(commissionCents, currency)}`} />
          <Row k="Neto al beneficiario" v={money(netCents, currency)} strong />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-yo-border text-[12px] uppercase tracking-[0.14em]">Cancelar</button>
          <button disabled={busy} onClick={submit} className="px-4 py-2 bg-yo-ac text-white text-[12px] uppercase tracking-[0.14em] disabled:opacity-50">
            {busy ? "Liberando..." : "Confirmar liberación"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className={`font-mono ${strong ? "text-lg" : ""}`}>{v}</span>
    </div>
  );
}
