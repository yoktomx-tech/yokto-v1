import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Landmark, ArrowLeft, ArrowRight, Loader2, ShieldCheck, ShieldAlert, Ban, Clock, RefreshCcw, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { validateClabe, BANCO_CODES } from "@/lib/validations/clabe";
import { STATUS_UI, maskCLABE } from "@/lib/bank-verification/decision";
import {
  createBankAccountAndStartPennyTest,
  getBankAccountDetail,
  simulatePennyTestResult,
} from "@/lib/bank-verification.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/compliance/bank-accounts/new")({
  validateSearch: (s) => z.object({ id: z.string().uuid().optional() }).parse(s),
  component: WizardPage,
});

type AccountType = "CLABE" | "DEBIT_CARD";

function WizardPage() {
  const { id: existingId } = Route.useSearch();
  const nav = useNavigate();
  const { currentOrg } = useCurrentOrg();
  const orgId = currentOrg?.type === "business" ? currentOrg.id : null;

  const [step, setStep] = useState(existingId ? 4 : 1);
  const [type, setType] = useState<AccountType>("CLABE");
  const [query, setQuery] = useState("");
  const [bankInstitutionClave, setBankInstitutionClave] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(existingId ?? null);

  const createFn = useServerFn(createBankAccountAndStartPennyTest);

  const clabeCheck = useMemo(() => (type === "CLABE" ? validateClabe(query) : null), [type, query]);
  const cardOk = type === "DEBIT_CARD" && /^\d{15,19}$/.test(query.replace(/\s+/g, "")) && !!bankInstitutionClave;
  const step1Ok = type === "CLABE" ? !!clabeCheck?.valid : cardOk;
  const bankName = type === "CLABE" ? clabeCheck?.banco ?? null : BANCO_CODES[bankInstitutionClave] ?? null;

  async function handleSubmit() {
    setCreating(true);
    try {
      const r = await createFn({
        data: {
          orgId,
          accountType: type,
          query,
          bankInstitutionClave: type === "DEBIT_CARD" ? bankInstitutionClave : null,
          bankName,
        },
      });
      setCreatedId(r.bankAccountId);
      setStep(4);
      toast.success("Prueba de centavo iniciada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        icon={Landmark}
        title="Verificación de cuenta bancaria"
        subtitle="Confirma que la cuenta receptora pertenece al titular registrado en tu Perfil de Cumplimiento."
        actions={
          <Button variant="outline" onClick={() => nav({ to: "/compliance/bank-accounts" })} className="gap-2">
            <ArrowLeft className="size-4" /> Volver
          </Button>
        }
      />

      <Stepper step={step} />

      <div className="rounded-xl border border-yo-border bg-white p-6">
        {step === 1 && (
          <Step1
            type={type} setType={setType}
            query={query} setQuery={setQuery}
            bankInstitutionClave={bankInstitutionClave} setBankInstitutionClave={setBankInstitutionClave}
            bankName={bankName}
            clabeError={type === "CLABE" && query.length === 18 && !clabeCheck?.valid ? clabeCheck?.error ?? null : null}
          />
        )}
        {step === 2 && <Step2 orgId={orgId} />}
        {step === 3 && (
          <Step3 type={type} query={query} bankName={bankName} />
        )}
        {step === 4 && createdId && <Step4 bankAccountId={createdId} />}

        <div className="mt-6 flex items-center justify-between border-t border-yo-border pt-4">
          <Button variant="ghost" onClick={() => (step > 1 ? setStep((s) => (s - 1) as 1 | 2 | 3 | 4) : nav({ to: "/compliance/bank-accounts" }))}>
            {step > 1 ? "Regresar" : "Cancelar"}
          </Button>
          {step < 3 && (
            <Button disabled={step === 1 && !step1Ok} onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)} className="gap-2">
              Continuar <ArrowRight className="size-4" />
            </Button>
          )}
          {step === 3 && (
            <Button disabled={creating || !step1Ok} onClick={handleSubmit} className="gap-2">
              {creating ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              Iniciar validación
            </Button>
          )}
          {step === 4 && (
            <Button onClick={() => nav({ to: "/compliance/bank-accounts" })}>Finalizar</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const items = ["Cuenta bancaria", "Titular esperado", "Enviar validación", "Resultado"];
  return (
    <ol className="flex items-center gap-2 text-[12px]">
      {items.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <li key={label} className="flex items-center gap-2">
            <span className={cn(
              "size-6 rounded-full grid place-items-center text-[11px] font-semibold",
              done ? "bg-yo-ac text-white" : active ? "bg-yo-ac-bg text-yo-ac-txt" : "bg-yo-border text-yo-txt-3"
            )}>{done ? "✓" : n}</span>
            <span className={cn("hidden sm:inline", active ? "text-yo-txt font-medium" : "text-yo-txt-3")}>{label}</span>
            {i < items.length - 1 && <span className="w-6 h-px bg-yo-border" />}
          </li>
        );
      })}
    </ol>
  );
}

function Step1(props: {
  type: AccountType; setType: (t: AccountType) => void;
  query: string; setQuery: (v: string) => void;
  bankInstitutionClave: string; setBankInstitutionClave: (v: string) => void;
  bankName: string | null;
  clabeError: string | null;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-yo-txt">Cuenta bancaria</h2>
        <p className="text-sm text-yo-txt-2">Selecciona el tipo de cuenta que deseas validar.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {(["CLABE", "DEBIT_CARD"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => props.setType(t)}
            className={cn(
              "rounded-xl border p-4 text-left transition",
              props.type === t ? "border-yo-ac bg-yo-ac-bg/30" : "border-yo-border hover:bg-yo-raised"
            )}
          >
            <div className="text-[13px] font-semibold text-yo-txt">
              {t === "CLABE" ? "CLABE interbancaria" : "Tarjeta de débito"}
            </div>
            <div className="text-[12px] text-yo-txt-2 mt-0.5">
              {t === "CLABE" ? "18 dígitos · recomendada para SPEI" : "15–19 dígitos · requiere banco emisor"}
            </div>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="q">{props.type === "CLABE" ? "CLABE (18 dígitos)" : "Tarjeta de débito"}</Label>
        <Input
          id="q"
          className="font-mono tracking-wide"
          inputMode="numeric"
          maxLength={props.type === "CLABE" ? 18 : 19}
          value={props.query}
          onChange={(e) => props.setQuery(e.target.value.replace(/\D/g, ""))}
          placeholder={props.type === "CLABE" ? "058597000007992349" : "4152 3100 0000 1234"}
        />
        {props.clabeError && <p className="text-[12px] text-[#DC2626]">{props.clabeError}</p>}
        {props.bankName && (
          <p className="text-[12px] text-yo-txt-2">
            Banco detectado: <span className="font-medium text-yo-txt">{props.bankName}</span>
          </p>
        )}
      </div>

      {props.type === "DEBIT_CARD" && (
        <div className="space-y-2">
          <Label htmlFor="bank">Institución bancaria (clave)</Label>
          <Input
            id="bank"
            className="font-mono"
            maxLength={4}
            value={props.bankInstitutionClave}
            onChange={(e) => props.setBankInstitutionClave(e.target.value.replace(/\D/g, ""))}
            placeholder="012"
          />
          <p className="text-[11.5px] text-yo-txt-3">Ejemplo: 012 = BBVA México, 014 = Santander, 072 = Banorte.</p>
        </div>
      )}
    </div>
  );
}

function Step2({ orgId }: { orgId: string | null }) {
  // Solo informativo — los datos se leen en backend desde profiles/organizations.
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-yo-txt">Titular esperado</h2>
        <p className="text-sm text-yo-txt-2">
          Compararemos el resultado bancario contra tu Perfil de Cumplimiento
          {orgId ? " de la organización activa" : ""}.
        </p>
      </div>
      <div className="rounded-lg border border-yo-border bg-yo-bg p-4 space-y-2 text-[13px]">
        <p className="text-yo-txt-2">
          Los datos del titular no se editan aquí. Si detectas un error, actualiza primero tu Perfil de Cumplimiento.
        </p>
        <p className="text-[12px] text-yo-txt-3">
          El sistema comparará nombre y RFC/CURP contra {orgId ? "razón social y RFC de la organización" : "tus datos personales registrados"}.
        </p>
      </div>
    </div>
  );
}

function Step3({ type, query, bankName }: { type: AccountType; query: string; bankName: string | null }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-yo-txt">Enviar validación</h2>
        <p className="text-sm text-yo-txt-2">Revisa los datos antes de iniciar la prueba de centavo.</p>
      </div>
      <dl className="grid sm:grid-cols-2 gap-3 text-[13px]">
        <Field label="Tipo de cuenta" value={type === "CLABE" ? "CLABE interbancaria" : "Tarjeta de débito"} />
        <Field label="Cuenta" mono value={type === "CLABE" ? maskCLABE(query) : `${query.slice(0, 6)}••••${query.slice(-4)}`} />
        <Field label="Banco" value={bankName ?? "—"} />
      </dl>
      <div className="rounded-md border border-[#EBEBF0] bg-[#F0F9FF] text-[#0284C7] p-3 text-[12.5px]">
        Esta validación consultará los datos asociados a la cuenta. El resultado puede tardar minutos y se actualizará automáticamente.
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-yo-txt-3">{label}</dt>
      <dd className={cn("mt-0.5", mono && "font-mono")}>{value}</dd>
    </div>
  );
}

function Step4({ bankAccountId }: { bankAccountId: string }) {
  const getDetail = useServerFn(getBankAccountDetail);
  const simulate = useServerFn(simulatePennyTestResult);
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["bank-account", bankAccountId],
    queryFn: () => getDetail({ data: { bankAccountId } }),
    refetchInterval: (q) => {
      const s = (q.state.data as { account?: { verification_status: string } } | undefined)?.account?.verification_status;
      return s === "WAITING_RESULT" || s === "PENNY_CREATED" ? 5000 : false;
    },
  });

  const [simName, setSimName] = useState("");
  const [simRfc, setSimRfc] = useState("");
  const [simLoading, setSimLoading] = useState(false);

  if (!data) return <div className="text-sm text-yo-txt-2">Cargando…</div>;
  const acc = data.account;
  const last = data.tests[0];
  const status = STATUS_UI[acc.verification_status] ?? STATUS_UI.DRAFT;
  const Icon =
    acc.verification_status === "APPROVED" ? ShieldCheck :
    acc.verification_status === "REJECTED" || acc.verification_status === "ERROR" ? Ban :
    acc.verification_status === "MANUAL_REVIEW" ? ShieldAlert : Clock;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className={cn("size-11 rounded-lg grid place-items-center", status.bg)}>
          <Icon className={cn("size-6", status.text)} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-yo-txt">Resultado de la validación</h2>
          <p className="text-[12.5px] text-yo-txt-2">
            <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium mr-2", status.bg, status.text)}>{status.label}</span>
            <span className="font-mono">{acc.query_masked}</span> · {acc.bank_name ?? "Banco no identificado"}
          </p>
        </div>
      </div>

      {last?.provider_uuid && (
        <div className="text-[12px] text-yo-txt-3">
          UUID Verificamex: <span className="font-mono text-yo-txt-2">{last.provider_uuid}</span>
        </div>
      )}

      {acc.verification_status === "APPROVED" && (
        <ApprovedPanel titular={acc.holder_expected_name} received={last?.name_receiver ?? ""} sim={last?.name_similarity ?? null} rfc={last?.rfc_curp_match ?? ""} />
      )}

      {acc.verification_status === "MANUAL_REVIEW" && (
        <div className="rounded-lg border border-[#EBEBF0] bg-[#FFFBEB] p-4 text-[13px] text-[#92400E]">
          {(last?.decision_reasons ?? []).join(". ") || "La cuenta requiere revisión manual."}
        </div>
      )}

      {(acc.verification_status === "REJECTED" || acc.verification_status === "ERROR") && (
        <div className="rounded-lg border border-[#EBEBF0] bg-[#FEF2F2] p-4 text-[13px] text-[#991B1B]">
          {(last?.decision_reasons ?? []).join(". ") || "No pudimos confirmar que la cuenta pertenezca al titular registrado."}
        </div>
      )}

      {(acc.verification_status === "WAITING_RESULT" || acc.verification_status === "PENNY_CREATED") && (
        <>
          <div className="rounded-lg border border-yo-border bg-yo-bg p-4 text-[13px] text-yo-txt-2 flex items-center gap-2">
            <Loader2 className="size-4 animate-spin text-yo-ac" />
            La prueba fue creada correctamente. Estamos esperando el resultado.
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2" disabled={isFetching}>
            <RefreshCcw className={cn("size-3.5", isFetching && "animate-spin")} /> Actualizar estado
          </Button>

          <details className="rounded-lg border border-dashed border-yo-border p-3 text-[12px]">
            <summary className="cursor-pointer text-yo-txt-3">Simular respuesta (solo entornos de prueba)</summary>
            <div className="mt-3 grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px]">Nombre devuelto por el banco</Label>
                <Input value={simName} onChange={(e) => setSimName(e.target.value)} placeholder={acc.holder_expected_name} />
              </div>
              <div>
                <Label className="text-[11px]">RFC / CURP devuelto</Label>
                <Input value={simRfc} onChange={(e) => setSimRfc(e.target.value.toUpperCase())} placeholder={acc.holder_expected_rfc ?? ""} className="font-mono" />
              </div>
              <div className="sm:col-span-2">
                <Button
                  size="sm"
                  disabled={simLoading || simName.trim().length < 3}
                  onClick={async () => {
                    if (!last) return;
                    setSimLoading(true);
                    try {
                      const r = await simulate({ data: { pennyTestId: last.id, receivedName: simName, receivedRfcCurp: simRfc || null } });
                      toast.success(`Resultado: ${r.decision}`);
                      refetch();
                    } catch (e) { toast.error((e as Error).message); }
                    finally { setSimLoading(false); }
                  }}
                >
                  Aplicar simulación
                </Button>
              </div>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function ApprovedPanel({ titular, received, sim, rfc }: { titular: string; received: string; sim: number | null; rfc: string }) {
  return (
    <div className="rounded-lg border border-[#EBEBF0] bg-[#ECFDF5] p-4 space-y-2 text-[13px] text-[#065F46]">
      <div className="flex items-center gap-2 font-semibold">
        <CheckCircle2 className="size-4" /> Cuenta validada
      </div>
      <div className="grid sm:grid-cols-2 gap-2 text-[12.5px]">
        <div><span className="text-yo-txt-3">Titular esperado:</span> <span className="text-yo-txt">{titular}</span></div>
        <div><span className="text-yo-txt-3">Resultado bancario:</span> <span className="text-yo-txt">{received}</span></div>
        {sim !== null && <div><span className="text-yo-txt-3">Similaridad nombre:</span> <span className="font-mono">{(sim * 100).toFixed(0)}%</span></div>}
        <div><span className="text-yo-txt-3">RFC/CURP:</span> <span className="font-mono">{rfc}</span></div>
      </div>
      <p className="text-[12px] text-[#047857]">Esta cuenta ya puede usarse para recibir liberaciones.</p>
    </div>
  );
}
