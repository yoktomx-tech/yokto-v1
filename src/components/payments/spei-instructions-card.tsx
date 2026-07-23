import { QRCodeSVG } from "qrcode.react";

interface Props {
  clabe: string;
  beneficiary: string;
  bank: string;
  amountCents: number;
  currency: string;
  reference: string;
  expiresAt?: string | null;
}

function money(cents: number, cur = "MXN") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: cur }).format(cents / 100);
}

export function SPEIInstructionsCard({ clabe, beneficiary, bank, amountCents, currency, reference, expiresAt }: Props) {
  const payload = JSON.stringify({ clabe, beneficiary, bank, amount: amountCents / 100, currency, reference });

  async function copy(v: string) {
    try { await navigator.clipboard.writeText(v); } catch { /* ignore */ }
  }

  return (
    <div className="border border-yo-border bg-background p-5 grid gap-5 md:grid-cols-[1fr_auto]">
      <div className="space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Instrucciones SPEI</p>
          <h3 className="mt-1 font-display text-2xl">Deposita exactamente {money(amountCents, currency)}</h3>
        </div>
        <Row label="CLABE" value={clabe} onCopy={() => copy(clabe)} mono />
        <Row label="Beneficiario" value={beneficiary} />
        <Row label="Banco" value={bank} />
        <Row label="Concepto / Referencia" value={reference} onCopy={() => copy(reference)} mono />
        <Row label="Monto" value={money(amountCents, currency)} onCopy={() => copy((amountCents / 100).toFixed(2))} />
        {expiresAt && (
          <p className="text-xs text-muted-foreground">
            CLABE virtual válida hasta {new Date(expiresAt).toLocaleString("es-MX")}.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Depósito de una sola vez. Cumplex confirmará automáticamente por webhook Stripe al recibir los fondos.
        </p>
      </div>
      <div className="flex flex-col items-center gap-2 border-l border-yo-border pl-5">
        <QRCodeSVG value={payload} size={140} bgColor="transparent" fgColor="currentColor" />
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Escanea con tu app bancaria</p>
      </div>
    </div>
  );
}

function Row({ label, value, mono, onCopy }: { label: string; value: string; mono?: boolean; onCopy?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-yo-border pt-3">
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className={`mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
      {onCopy && (
        <button onClick={onCopy} className="text-[11px] uppercase tracking-[0.14em] underline underline-offset-4">
          Copiar
        </button>
      )}
    </div>
  );
}
