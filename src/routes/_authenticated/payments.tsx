import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app-header";
import { ensureConnectedAccount, simulateAccountVerified } from "@/lib/payments.functions";

type Acct = {
  id: string;
  provider: string;
  provider_account_id: string | null;
  status: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  requirements: { onboarding_url?: string | null } | null;
};

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({ meta: [{ title: "Cuenta de pagos — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const { user } = Route.useRouteContext();
  const [acct, setAcct] = useState<Acct | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureFn = useServerFn(ensureConnectedAccount);
  const verifyFn = useServerFn(simulateAccountVerified);

  async function load() {
    const { data } = await supabase.from("connected_accounts").select("*").eq("user_id", user.id).maybeSingle();
    setAcct((data as Acct) ?? null);
  }
  useEffect(() => { load(); }, []);

  async function handleCreate() {
    setBusy(true); setError(null);
    try { await ensureFn(); await load(); } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }
  async function handleVerify() {
    setBusy(true); setError(null);
    try { await verifyFn(); await load(); } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader email={user.email} userId={user.id} section="Cuenta de pagos" />
      <main className="flex-1">
        <div className="container-editorial py-10 max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Módulo E · Payouts</p>
          <h1 className="mt-1 font-display text-5xl tracking-wide">Cuenta de pagos</h1>
          <p className="mt-3 text-muted-foreground">
            Para recibir liberaciones de YOKTO, necesitas una cuenta conectada. En producción esto se realiza vía Stripe Connect Custom Accounts (KYB, CLABE de payout, TOS). Hoy trabajamos en modo simulación.
          </p>

          {error && <div role="alert" className="mt-6 border border-[#FF3B3B] bg-[#FF3B3B]/10 text-[#FF3B3B] p-3 text-sm">{error}</div>}

          <div className="mt-8 border border-yo-border bg-background p-5">
            {!acct && (
              <>
                <p className="text-sm">Aún no tienes cuenta conectada.</p>
                <button disabled={busy} onClick={handleCreate} className="mt-4 px-5 py-2.5 bg-yokto-yellow text-yokto-black text-[12px] uppercase tracking-[0.14em] font-semibold border border-yo-border disabled:opacity-50">
                  Crear cuenta conectada (mock)
                </button>
              </>
            )}
            {acct && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <Kv k="Proveedor" v={acct.provider} />
                  <Kv k="ID" v={acct.provider_account_id ?? "—"} />
                  <Kv k="Estado" v={acct.status} />
                  <Kv k="Cobros" v={acct.charges_enabled ? "activo" : "inactivo"} />
                  <Kv k="Payouts" v={acct.payouts_enabled ? "activo" : "inactivo"} />
                </div>
                {acct.status !== "verified" && (
                  <div className="flex flex-wrap gap-2">
                    {acct.requirements?.onboarding_url && (
                      <a href={acct.requirements.onboarding_url} target="_blank" rel="noreferrer" className="px-5 py-2.5 border border-yo-border text-[12px] uppercase tracking-[0.14em] font-semibold hover:bg-yo-ac-h hover:text-yokto-cream">
                        Abrir onboarding (mock)
                      </a>
                    )}
                    <button disabled={busy} onClick={handleVerify} className="px-5 py-2.5 bg-yokto-yellow text-yokto-black text-[12px] uppercase tracking-[0.14em] font-semibold border border-yo-border disabled:opacity-50">
                      Simular verificación aprobada
                    </button>
                  </div>
                )}
                {acct.status === "verified" && (
                  <p className="text-sm text-muted-foreground">Cuenta lista para recibir payouts.</p>
                )}
              </div>
            )}
          </div>

          <Link to="/dashboard" className="mt-8 inline-block text-[11px] uppercase tracking-[0.14em] underline underline-offset-4">← Volver al panel</Link>
        </div>
      </main>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="border border-yo-border p-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{k}</p>
      <p className="mt-1 font-mono text-sm break-all">{v}</p>
    </div>
  );
}
