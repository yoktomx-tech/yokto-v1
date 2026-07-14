interface Props {
  retenidoCents: number;
  porRecibirCents: number;
  depositadoMesCents: number;
  recibidoMesCents: number;
  currency?: string;
}

function money(cents: number, cur = "MXN") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: cur }).format(cents / 100);
}

export function FundsRetentionWidget({ retenidoCents, porRecibirCents, depositadoMesCents, recibidoMesCents, currency = "MXN" }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Como pagador">
        <Line k="Fondos en retención" v={money(retenidoCents, currency)} highlight />
        <Line k="Depositado (30 días)" v={money(depositadoMesCents, currency)} />
      </Panel>
      <Panel title="Como beneficiario">
        <Line k="Pendiente de recibir" v={money(porRecibirCents, currency)} highlight />
        <Line k="Recibido (30 días)" v={money(recibidoMesCents, currency)} />
      </Panel>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-yo-border bg-background p-5">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function Line({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-t border-yo-border pt-2">
      <span className="text-sm text-muted-foreground">{k}</span>
      <span className={`font-mono ${highlight ? "text-xl" : "text-sm"}`}>{v}</span>
    </div>
  );
}
