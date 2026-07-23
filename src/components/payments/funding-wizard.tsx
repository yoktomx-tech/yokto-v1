import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Check, Loader2, Copy, Printer, ArrowLeft, ArrowRight, Landmark, CreditCard, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { createFundingIntent, simulateFundingReceived } from "@/lib/payments.functions";
import { listFundableTransactions } from "@/lib/funding.functions";

type Method = "spei" | "card";

type Tx = {
  id: string;
  numero: string | null;
  title: string | null;
  amount_cents: number;
  currency: string;
  beneficiario_nombre: string | null;
  counterparty_email: string | null;
};

type Intent = {
  id: string;
  provider_ref: string | null;
  method: string | null;
  amount_cents: number;
  currency: string;
  clabe: string | null;
  reference_code: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown> | null;
};

interface Props {
  open: boolean;
  onClose: () => void;
  presetTransactionId?: string;
  onSuccess?: () => void;
}

function fmtMoney(cents: number, currency = "MXN") {
  return (cents / 100).toLocaleString("es-MX", { style: "currency", currency });
}

export function FundingWizard({ open, onClose, presetTransactionId, onSuccess }: Props) {
  const listFn = useServerFn(listFundableTransactions);
  const createFn = useServerFn(createFundingIntent);
  const confirmFn = useServerFn(simulateFundingReceived);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [txId, setTxId] = useState<string | null>(presetTransactionId ?? null);
  const [method, setMethod] = useState<Method>("spei");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const selectedTx = useMemo(() => txs.find((t) => t.id === txId) ?? null, [txs, txId]);

  useEffect(() => {
    if (!open) return;
    setStep(presetTransactionId ? 2 : 1);
    setIntent(null);
    setMethod("spei");
    setTxId(presetTransactionId ?? null);
    setLoading(true);
    listFn()
      .then((rows) => setTxs(rows as Tx[]))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Error al cargar transacciones"))
      .finally(() => setLoading(false));
  }, [open, presetTransactionId, listFn]);

  if (!open) return null;

  const canNext =
    (step === 1 && !!txId) ||
    (step === 2 && !!txId && !!method) ||
    step === 3 ||
    step === 4;

  const goNext = async () => {
    if (step === 1 && txId) setStep(2);
    else if (step === 2 && txId) {
      setCreating(true);
      try {
        const pi = await createFn({ data: { transactionId: txId, method } });
        setIntent(pi as Intent);
        setStep(3);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo crear el intent");
      } finally {
        setCreating(false);
      }
    }
  };

  const simulate = async () => {
    if (!intent) return;
    setConfirming(true);
    try {
      await confirmFn({ data: { paymentIntentId: intent.id } });
      toast.success("Fondeo confirmado");
      setStep(4);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al confirmar");
    } finally {
      setConfirming(false);
    }
  };

  const copy = (v: string | null | undefined, label: string) => {
    if (!v) return;
    navigator.clipboard.writeText(v);
    toast.success(`${label} copiado`);
  };

  const steps = ["Transacción", "Método", "Instrucciones", "Confirmación"];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-2xl bg-yo-card border border-yo-border rounded-xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-yo-border">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-yo-t2">Fondear transacción</p>
            <h2 className="mt-0.5 font-display text-xl text-yo-t1">Wizard de fondeo</h2>
          </div>
          <button onClick={onClose} className="text-yo-t2 hover:text-yo-t1 p-1"><X className="size-5" /></button>
        </div>

        {/* Stepper */}
        <div className="px-6 py-3 border-b border-yo-border bg-yo-bg2/50">
          <div className="flex items-center gap-2">
            {steps.map((label, i) => {
              const n = (i + 1) as 1 | 2 | 3 | 4;
              const active = step === n;
              const done = step > n;
              return (
                <div key={label} className="flex items-center gap-2 flex-1">
                  <div className={`size-6 rounded-full grid place-items-center text-[11px] font-medium ${done ? "bg-yo-ac text-white" : active ? "bg-yo-ac/10 text-yo-ac border border-yo-ac" : "bg-yo-bg2 text-yo-t2 border border-yo-border"}`}>
                    {done ? <Check className="size-3.5" /> : n}
                  </div>
                  <span className={`text-xs ${active ? "text-yo-t1 font-medium" : "text-yo-t2"}`}>{label}</span>
                  {i < steps.length - 1 && <div className="flex-1 h-px bg-yo-border" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-yo-t2">Selecciona la transacción que deseas fondear.</p>
              {loading ? (
                <div className="py-10 text-center text-sm text-yo-t2"><Loader2 className="size-4 animate-spin inline mr-2" />Cargando…</div>
              ) : txs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-yo-border p-8 text-center text-sm text-yo-t2">
                  No hay transacciones esperando fondeo.
                </div>
              ) : (
                <div className="space-y-2">
                  {txs.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTxId(t.id)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${txId === t.id ? "border-yo-ac bg-yo-ac/5" : "border-yo-border hover:bg-yo-bg2"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-yo-t1 truncate">{t.title ?? "Sin título"}</p>
                          <p className="text-[11px] font-mono text-yo-t2">{t.numero ?? t.id.slice(0, 8)}</p>
                          <p className="text-xs text-yo-t2 mt-0.5 truncate">A: {t.beneficiario_nombre ?? t.counterparty_email ?? "—"}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono text-sm text-yo-t1">{fmtMoney(t.amount_cents, t.currency)}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && selectedTx && (
            <div className="space-y-4">
              <div className="rounded-lg border border-yo-border bg-yo-bg2/40 p-3 flex items-center justify-between text-sm">
                <div>
                  <p className="text-yo-t1 font-medium truncate">{selectedTx.title ?? "Sin título"}</p>
                  <p className="text-[11px] font-mono text-yo-t2">{selectedTx.numero}</p>
                </div>
                <p className="font-mono text-yo-t1">{fmtMoney(selectedTx.amount_cents, selectedTx.currency)}</p>
              </div>
              <p className="text-sm text-yo-t2">Elige el método de fondeo.</p>
              <div className="grid grid-cols-2 gap-3">
                <MethodCard
                  icon={<Landmark className="size-5" />}
                  title="SPEI"
                  desc="Transferencia bancaria con CLABE virtual. Sin comisión adicional."
                  active={method === "spei"}
                  onClick={() => setMethod("spei")}
                />
                <MethodCard
                  icon={<CreditCard className="size-5" />}
                  title="Tarjeta"
                  desc="Pago con débito o crédito vía checkout hospedado."
                  active={method === "card"}
                  onClick={() => setMethod("card")}
                />
              </div>
            </div>
          )}

          {step === 3 && intent && selectedTx && (
            <div className="space-y-4">
              {intent.method === "spei" && intent.clabe ? (
                <div className="border border-yo-border rounded-lg p-5 grid gap-5 md:grid-cols-[1fr_auto] bg-background">
                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-yo-t2">Instrucciones SPEI</p>
                      <h3 className="mt-1 font-display text-xl text-yo-t1">Deposita {fmtMoney(intent.amount_cents, intent.currency)}</h3>
                    </div>
                    <InstrRow label="CLABE" value={intent.clabe} mono onCopy={() => copy(intent.clabe, "CLABE")} />
                    <InstrRow label="Beneficiario" value={String((intent.metadata?.beneficiary as string) ?? "Cumplex ESCROW")} />
                    <InstrRow label="Banco" value={String((intent.metadata?.bank as string) ?? "STP")} />
                    <InstrRow label="Referencia" value={intent.reference_code ?? "—"} mono onCopy={() => copy(intent.reference_code, "Referencia")} />
                    <InstrRow label="Monto" value={fmtMoney(intent.amount_cents, intent.currency)} onCopy={() => copy((intent.amount_cents / 100).toFixed(2), "Monto")} />
                    {intent.expires_at && (
                      <p className="text-xs text-yo-t2">CLABE válida hasta {new Date(intent.expires_at).toLocaleString("es-MX")}.</p>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-2 border-t md:border-t-0 md:border-l border-yo-border pt-4 md:pt-0 md:pl-5">
                    <QRCodeSVG
                      value={JSON.stringify({ clabe: intent.clabe, amount: intent.amount_cents / 100, ref: intent.reference_code })}
                      size={130}
                      bgColor="transparent"
                      fgColor="currentColor"
                    />
                    <p className="text-[10px] uppercase tracking-[0.14em] text-yo-t2 text-center">Escanea con<br />tu app bancaria</p>
                  </div>
                </div>
              ) : (
                <div className="border border-yo-border rounded-lg p-6 text-center space-y-3 bg-background">
                  <CreditCard className="size-8 mx-auto text-yo-t2" />
                  <div>
                    <p className="text-yo-t1 font-medium">Checkout hospedado</p>
                    <p className="text-sm text-yo-t2">Continúa el pago con tarjeta en la ventana segura de la pasarela.</p>
                  </div>
                  {(intent.metadata?.hosted_url as string) && (
                    <a
                      href={intent.metadata?.hosted_url as string}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-yo-ac text-white text-sm rounded-md hover:bg-yo-ac-h"
                    >
                      Abrir checkout <ExternalLink className="size-4" />
                    </a>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-yo-border text-sm rounded-md text-yo-t2 hover:bg-yo-bg2"
                >
                  <Printer className="size-4" /> Imprimir instrucciones
                </button>
                <button
                  onClick={simulate}
                  disabled={confirming}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-yo-ac text-white text-sm font-medium rounded-md hover:bg-yo-ac-h disabled:opacity-50"
                >
                  {confirming ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  Simular pago recibido
                </button>
              </div>

              <p className="text-[11px] text-yo-t2 text-center">
                Cumplex confirmará automáticamente por webhook cuando la pasarela reciba los fondos.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="text-center py-8 space-y-3">
              <div className="size-14 rounded-full bg-emerald-500/10 text-emerald-600 grid place-items-center mx-auto">
                <Check className="size-7" />
              </div>
              <div>
                <h3 className="font-display text-xl text-yo-t1">Fondeo completado</h3>
                <p className="text-sm text-yo-t2 mt-1">
                  La transacción cambió a <span className="font-medium text-yo-t1">FUNDED</span> y quedó retenida en la pasarela.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-yo-border flex items-center justify-between gap-2 bg-yo-bg2/30">
          <button
            onClick={() => {
              if (step === 1 || step === 4) onClose();
              else if (step === 2) setStep(presetTransactionId ? 1 : 1);
              else if (step === 3) setStep(2);
            }}
            disabled={step === 3 && !!intent}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-yo-t2 hover:text-yo-t1 disabled:opacity-40"
          >
            {step === 1 || step === 4 ? "Cerrar" : <><ArrowLeft className="size-4" /> Atrás</>}
          </button>
          {step < 3 ? (
            <button
              onClick={goNext}
              disabled={!canNext || creating}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-yo-ac text-white text-sm font-medium rounded-md hover:bg-yo-ac-h disabled:opacity-40"
            >
              {creating ? <Loader2 className="size-4 animate-spin" /> : <>Continuar <ArrowRight className="size-4" /></>}
            </button>
          ) : step === 4 ? (
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-yo-ac text-white text-sm font-medium rounded-md hover:bg-yo-ac-h"
            >
              Finalizar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MethodCard({ icon, title, desc, active, onClick }: { icon: React.ReactNode; title: string; desc: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg border p-4 transition-colors ${active ? "border-yo-ac bg-yo-ac/5" : "border-yo-border hover:bg-yo-bg2"}`}
    >
      <div className={`inline-flex size-9 rounded-md items-center justify-center mb-3 ${active ? "bg-yo-ac text-white" : "bg-yo-bg2 text-yo-t2"}`}>
        {icon}
      </div>
      <p className="text-sm font-medium text-yo-t1">{title}</p>
      <p className="text-xs text-yo-t2 mt-0.5">{desc}</p>
    </button>
  );
}

function InstrRow({ label, value, mono, onCopy }: { label: string; value: string; mono?: boolean; onCopy?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-yo-border pt-3">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.14em] text-yo-t2">{label}</p>
        <p className={`mt-0.5 text-yo-t1 truncate ${mono ? "font-mono text-sm" : "text-sm"}`}>{value}</p>
      </div>
      {onCopy && (
        <button onClick={onCopy} className="text-yo-t2 hover:text-yo-t1 shrink-0 mt-1"><Copy className="size-3.5" /></button>
      )}
    </div>
  );
}
