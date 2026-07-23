interface Movement {
  id: string;
  created_at: string;
  kind: "deposito" | "liberacion" | "comision" | "devolucion" | "payout";
  amount_cents: number;
  currency: string;
  description: string;
  transaction_numero?: string | null;
  status: string;
  provider_ref?: string | null;
}

function money(cents: number, cur = "MXN") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: cur }).format(cents / 100);
}

const KIND_LABEL: Record<Movement["kind"], string> = {
  deposito: "Depósito",
  liberacion: "Liberación",
  comision: "Comisión Cumplex",
  devolucion: "Devolución",
  payout: "Payout",
};

export function PaymentHistory({ movements, onExport }: { movements: Movement[]; onExport?: () => void }) {
  return (
    <div className="border border-yo-border bg-background">
      <div className="flex items-center justify-between border-b border-yo-border p-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Historial</p>
          <h3 className="font-display text-xl">Movimientos ({movements.length})</h3>
        </div>
        {onExport && (
          <button onClick={onExport} className="text-[11px] uppercase tracking-[0.14em] underline underline-offset-4">
            Exportar CSV
          </button>
        )}
      </div>
      {movements.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">Aún no hay movimientos.</p>
      ) : (
        <ul className="divide-y divide-yo-border">
          {movements.map((m) => (
            <li key={m.id} className="grid grid-cols-[auto_1fr_auto] gap-4 p-4 items-center">
              <span className="text-[10px] uppercase tracking-[0.14em] border border-yo-border px-2 py-1">
                {KIND_LABEL[m.kind]}
              </span>
              <div>
                <p className="text-sm">{m.description}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(m.created_at).toLocaleString("es-MX")}
                  {m.transaction_numero && ` · ${m.transaction_numero}`}
                  {m.provider_ref && ` · ${m.provider_ref}`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono">{money(m.amount_cents, m.currency)}</p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{m.status}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
