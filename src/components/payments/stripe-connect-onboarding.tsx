interface Props {
  status: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingUrl?: string | null;
  onCreate: () => void;
  onVerify?: () => void;
  busy?: boolean;
  stripeReal: boolean;
}

export function StripeConnectOnboarding({ status, chargesEnabled, payoutsEnabled, onboardingUrl, onCreate, onVerify, busy, stripeReal }: Props) {
  const complete = status === "verified" && chargesEnabled && payoutsEnabled;

  return (
    <div className="border border-yo-border bg-background p-5">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        Stripe Connect {stripeReal ? "Custom Account" : "(simulación)"}
      </p>
      <h3 className="mt-1 font-display text-xl">
        {complete ? "Cuenta lista para recibir payouts" : "Configura tu cuenta para recibir pagos"}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Para recibir liberaciones de CUMPLEX necesitas una cuenta Stripe Connect verificada (KYB + CLABE de payout + TOS).
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] uppercase tracking-[0.14em]">
        <Chip on={status === "verified"} label={`Estado: ${status}`} />
        <Chip on={chargesEnabled} label={chargesEnabled ? "Cobros activos" : "Cobros inactivos"} />
        <Chip on={payoutsEnabled} label={payoutsEnabled ? "Payouts activos" : "Payouts inactivos"} />
      </div>

      {!complete && (
        <div className="mt-5 flex flex-wrap gap-2">
          {status === "pending" && (
            <button disabled={busy} onClick={onCreate} className="px-5 py-2.5 bg-yo-ac text-white text-[12px] uppercase tracking-[0.14em] font-semibold border border-yo-border disabled:opacity-50">
              Crear cuenta conectada
            </button>
          )}
          {onboardingUrl && (
            <a href={onboardingUrl} target="_blank" rel="noreferrer" className="px-5 py-2.5 border border-yo-border text-[12px] uppercase tracking-[0.14em] font-semibold hover:bg-yo-ac-h hover:text-white">
              Abrir onboarding Stripe →
            </a>
          )}
          {!stripeReal && onVerify && (
            <button disabled={busy} onClick={onVerify} className="px-5 py-2.5 border border-yo-border text-[12px] uppercase tracking-[0.14em] font-semibold hover:bg-yo-ac-h hover:text-white disabled:opacity-50">
              Simular verificación aprobada
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={`border px-2 py-1 text-center ${on ? "border-yo-ac bg-yo-ac/10 text-yo-ac" : "border-yo-border text-muted-foreground"}`}>
      {label}
    </span>
  );
}
