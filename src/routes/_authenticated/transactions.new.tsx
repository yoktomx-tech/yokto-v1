import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app-header";
import { SECTORS, formatMoney, commissionAmount } from "@/lib/tx";

export const Route = createFileRoute("/_authenticated/transactions/new")({
  head: () => ({ meta: [{ title: "Nueva transacción — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: NewTransaction,
});

type Form = {
  counterparty_email: string;
  title: string;
  description: string;
  sector: string;
  amount: string; // MXN input
  currency: "MXN" | "USD";
  payment_method: "spei" | "card";
  commission_bps: number;
  commission_payer: "buyer" | "seller" | "split";
  funding_deadline: string;
  delivery_deadline: string;
  conditions: string[];
};

const initial: Form = {
  counterparty_email: "",
  title: "",
  description: "",
  sector: SECTORS[0],
  amount: "",
  currency: "MXN",
  payment_method: "spei",
  commission_bps: 250,
  commission_payer: "split",
  funding_deadline: "",
  delivery_deadline: "",
  conditions: [""],
};

function NewTransaction() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kycOk, setKycOk] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.from("profiles").select("kyc_status").eq("id", user.id).maybeSingle().then(({ data }) => {
      setKycOk(data?.kyc_status === "approved");
    });
  }, [user.id]);

  function up<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const amountCents = Math.round(parseFloat(form.amount || "0") * 100);
  const commission = commissionAmount(amountCents, form.commission_bps);

  function validStep(n: number): string | null {
    if (n === 1) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.counterparty_email)) return "Correo de contraparte inválido.";
      if (form.title.trim().length < 4) return "Título muy corto.";
    }
    if (n === 2) {
      if (!amountCents || amountCents < 10000) return "Monto mínimo: $100.00.";
      if (!form.funding_deadline) return "Define fecha límite de fondeo.";
      if (!form.delivery_deadline) return "Define fecha límite de entrega.";
    }
    if (n === 3) {
      const list = form.conditions.map((c) => c.trim()).filter(Boolean);
      if (list.length === 0) return "Agrega al menos una condición de liberación.";
    }
    return null;
  }

  function next() {
    const err = validStep(step);
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => Math.min(4, s + 1));
  }

  async function submit(publish: boolean) {
    for (let s = 1; s <= 3; s++) {
      const err = validStep(s);
      if (err) { setError(`Paso ${s}: ${err}`); setStep(s); return; }
    }
    setSubmitting(true); setError(null);
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .insert({
        buyer_id: user.id,
        counterparty_email: form.counterparty_email.toLowerCase(),
        title: form.title.trim(),
        description: form.description.trim() || null,
        sector: form.sector,
        amount_cents: amountCents,
        currency: form.currency,
        payment_method: form.payment_method,
        commission_bps: form.commission_bps,
        commission_payer: form.commission_payer,
        funding_deadline: new Date(form.funding_deadline).toISOString(),
        delivery_deadline: new Date(form.delivery_deadline).toISOString(),
        status: publish ? "awaiting_funding" : "draft",
      })
      .select("id")
      .single();

    if (txErr || !tx) {
      setSubmitting(false);
      setError(txErr?.message ?? "No se pudo crear la transacción.");
      return;
    }

    const conds = form.conditions.map((c) => c.trim()).filter(Boolean);
    if (conds.length) {
      await supabase.from("transaction_conditions").insert(
        conds.map((description, i) => ({ transaction_id: tx.id, description, position: i }))
      );
    }

    await supabase.from("transaction_events").insert({
      transaction_id: tx.id,
      actor_id: user.id,
      event_type: publish ? "transaction.published" : "transaction.draft_created",
      metadata: { amount_cents: amountCents, currency: form.currency },
    });

    navigate({ to: "/transactions/$id", params: { id: tx.id } });
  }

  if (kycOk === false) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <AppHeader email={user.email} section="Nueva transacción" />
        <main className="flex-1">
          <div className="container-editorial py-16 max-w-2xl">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Requisito</p>
            <h1 className="mt-2 font-display text-5xl tracking-wide">Completa tu KYC</h1>
            <p className="mt-3 text-muted-foreground">
              Necesitas verificación aprobada para crear operaciones en YOKTO.
            </p>
            <Link
              to="/kyc"
              className="mt-6 inline-flex items-center px-5 py-2.5 bg-yokto-yellow text-yokto-black text-[12px] uppercase tracking-[0.14em] font-semibold border border-yokto-black"
            >
              Ir a KYC
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader email={user.email} section="Nueva transacción" />
      <main className="flex-1">
        <div className="container-editorial py-10 max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Módulo C · Paso {step} de 4</p>
          <h1 className="mt-1 font-display text-5xl tracking-wide text-foreground">
            {step === 1 && "Contraparte y objeto"}
            {step === 2 && "Monto y términos"}
            {step === 3 && "Condiciones de liberación"}
            {step === 4 && "Revisión"}
          </h1>

          <div className="mt-6 flex gap-1">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className={`h-1.5 flex-1 border border-yokto-black ${n <= step ? "bg-yokto-yellow" : "bg-background"}`} />
            ))}
          </div>

          {error && (
            <div className="mt-6 border border-[#FF3B3B] bg-[#FF3B3B]/10 p-3 text-sm text-[#FF3B3B]">{error}</div>
          )}

          <div className="mt-8 border border-yokto-black bg-background p-6 md:p-8 space-y-5">
            {step === 1 && (
              <>
                <Field label="Correo del vendedor / contraparte">
                  <input
                    type="email"
                    value={form.counterparty_email}
                    onChange={(e) => up("counterparty_email", e.target.value)}
                    placeholder="vendedor@empresa.mx"
                    className="input-editorial"
                  />
                </Field>
                <Field label="Título de la operación">
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => up("title", e.target.value)}
                    placeholder="Ej. Desarrollo landing corporativa"
                    maxLength={120}
                    className="input-editorial"
                  />
                </Field>
                <Field label="Descripción (opcional)">
                  <textarea
                    value={form.description}
                    onChange={(e) => up("description", e.target.value)}
                    rows={4}
                    className="input-editorial resize-y"
                  />
                </Field>
                <Field label="Sector">
                  <select value={form.sector} onChange={(e) => up("sector", e.target.value)} className="input-editorial">
                    {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Monto">
                    <input
                      type="number"
                      step="0.01"
                      min="100"
                      value={form.amount}
                      onChange={(e) => up("amount", e.target.value)}
                      placeholder="10000.00"
                      className="input-editorial"
                    />
                  </Field>
                  <Field label="Moneda">
                    <select value={form.currency} onChange={(e) => up("currency", e.target.value as "MXN" | "USD")} className="input-editorial">
                      <option value="MXN">MXN</option>
                      <option value="USD">USD</option>
                    </select>
                  </Field>
                  <Field label="Método de pago">
                    <select value={form.payment_method} onChange={(e) => up("payment_method", e.target.value as "spei" | "card")} className="input-editorial">
                      <option value="spei">SPEI</option>
                      <option value="card">Tarjeta</option>
                    </select>
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Comisión YOKTO (bps)">
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={form.commission_bps}
                      onChange={(e) => up("commission_bps", parseInt(e.target.value || "0"))}
                      className="input-editorial"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {(form.commission_bps / 100).toFixed(2)}% · {formatMoney(commission, form.currency)} sobre {formatMoney(amountCents, form.currency)}
                    </p>
                  </Field>
                  <Field label="Quién paga la comisión">
                    <select value={form.commission_payer} onChange={(e) => up("commission_payer", e.target.value as Form["commission_payer"])} className="input-editorial">
                      <option value="split">Compartida 50/50</option>
                      <option value="buyer">Comprador</option>
                      <option value="seller">Vendedor</option>
                    </select>
                  </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Fecha límite de fondeo">
                    <input type="datetime-local" value={form.funding_deadline} onChange={(e) => up("funding_deadline", e.target.value)} className="input-editorial" />
                  </Field>
                  <Field label="Fecha límite de entrega">
                    <input type="datetime-local" value={form.delivery_deadline} onChange={(e) => up("delivery_deadline", e.target.value)} className="input-editorial" />
                  </Field>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <p className="text-sm text-muted-foreground">
                  Define condiciones verificables que deben cumplirse antes de liberar los fondos al vendedor.
                </p>
                <div className="space-y-3">
                  {form.conditions.map((c, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="w-8 h-10 grid place-items-center border border-yokto-black bg-yokto-cream font-mono text-sm">{i + 1}</span>
                      <input
                        type="text"
                        value={c}
                        onChange={(e) => {
                          const next = [...form.conditions];
                          next[i] = e.target.value;
                          up("conditions", next);
                        }}
                        placeholder="Ej. Entrega de código fuente en repositorio Git"
                        className="input-editorial flex-1"
                      />
                      {form.conditions.length > 1 && (
                        <button
                          onClick={() => up("conditions", form.conditions.filter((_, j) => j !== i))}
                          className="px-3 border border-yokto-black text-[11px] uppercase tracking-[0.14em] hover:bg-[#FF3B3B] hover:text-yokto-cream"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => up("conditions", [...form.conditions, ""])}
                  className="text-[12px] uppercase tracking-[0.14em] font-semibold border border-yokto-black px-3 py-2 hover:bg-yokto-black hover:text-yokto-cream"
                >
                  + Agregar condición
                </button>
              </>
            )}

            {step === 4 && (
              <div className="space-y-4 text-sm">
                <Summary label="Contraparte" value={form.counterparty_email} />
                <Summary label="Título" value={form.title} />
                <Summary label="Sector" value={form.sector} />
                <Summary label="Monto" value={`${formatMoney(amountCents, form.currency)} · ${form.payment_method.toUpperCase()}`} />
                <Summary
                  label="Comisión YOKTO"
                  value={`${(form.commission_bps / 100).toFixed(2)}% (${formatMoney(commission, form.currency)}) · ${
                    form.commission_payer === "split" ? "50/50" : form.commission_payer === "buyer" ? "Comprador" : "Vendedor"
                  }`}
                />
                <Summary label="Fondeo hasta" value={new Date(form.funding_deadline).toLocaleString("es-MX")} />
                <Summary label="Entrega hasta" value={new Date(form.delivery_deadline).toLocaleString("es-MX")} />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Condiciones</p>
                  <ol className="mt-2 list-decimal list-inside space-y-1 text-foreground">
                    {form.conditions.filter((c) => c.trim()).map((c, i) => <li key={i}>{c}</li>)}
                  </ol>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-between gap-3">
            <button
              onClick={() => (step === 1 ? navigate({ to: "/transactions" }) : setStep((s) => s - 1))}
              className="px-5 py-2.5 border border-yokto-black text-[12px] uppercase tracking-[0.14em] font-semibold hover:bg-yokto-black hover:text-yokto-cream"
            >
              {step === 1 ? "Cancelar" : "Atrás"}
            </button>
            {step < 4 ? (
              <button
                onClick={next}
                className="px-6 py-2.5 bg-yokto-black text-yokto-cream text-[12px] uppercase tracking-[0.14em] font-semibold border border-yokto-black hover:bg-yokto-yellow hover:text-yokto-black"
              >
                Continuar
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => submit(false)}
                  disabled={submitting}
                  className="px-5 py-2.5 border border-yokto-black text-[12px] uppercase tracking-[0.14em] font-semibold hover:bg-yokto-cream disabled:opacity-50"
                >
                  Guardar borrador
                </button>
                <button
                  onClick={() => submit(true)}
                  disabled={submitting}
                  className="px-6 py-2.5 bg-yokto-yellow text-yokto-black text-[12px] uppercase tracking-[0.14em] font-semibold border border-yokto-black hover:bg-yokto-black hover:text-yokto-yellow disabled:opacity-50"
                >
                  {submitting ? "Publicando…" : "Publicar y solicitar fondeo"}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-[0.14em] font-semibold text-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-yokto-black/20 pb-2">
      <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <span className="text-foreground text-right">{value}</span>
    </div>
  );
}
