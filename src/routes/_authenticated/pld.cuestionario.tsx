import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { submitPldQuestionnaire } from "@/lib/pld.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pld/cuestionario")({
  head: () => ({
    meta: [
      { title: "Cuestionario PLD/FT — CUMPLEX" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PldWizard,
});

type Form = {
  actividad_economica: string;
  actividad_scian: string;
  sector: string;
  origen_recursos: string;
  destino_recursos: string;
  volumen_mensual_estimado: string;
  operaciones_mensuales_estimadas: string;
  ticket_promedio_estimado: string;
  paises_operacion: string; // csv
  usa_efectivo: boolean;
  efectivo_mensual_estimado: string;
  es_pep: boolean;
  familiar_pep: boolean;
  proposito_cuenta: string;
};

const STEPS = [
  { key: "actividad", title: "Actividad económica", desc: "Sector y giro" },
  { key: "recursos",  title: "Origen y volumen",    desc: "Recursos y operación esperada" },
  { key: "geografia", title: "Geografía y efectivo", desc: "Países y uso de efectivo" },
  { key: "pep",       title: "PEP y propósito",     desc: "Autodeclaración y objetivo" },
  { key: "resumen",   title: "Revisión",            desc: "Confirmar y enviar" },
] as const;

function PldWizard() {
  const { currentOrg } = useCurrentOrg();
  const navigate = useNavigate();
  const submit = useServerFn(submitPldQuestionnaire);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; level: string } | null>(null);

  const [form, setForm] = useState<Form>({
    actividad_economica: "",
    actividad_scian: "",
    sector: "",
    origen_recursos: "",
    destino_recursos: "",
    volumen_mensual_estimado: "",
    operaciones_mensuales_estimadas: "",
    ticket_promedio_estimado: "",
    paises_operacion: "MX",
    usa_efectivo: false,
    efectivo_mensual_estimado: "",
    es_pep: false,
    familiar_pep: false,
    proposito_cuenta: "",
  });

  const update = <K extends keyof Form>(k: K, v: Form[K]) => setForm(s => ({ ...s, [k]: v }));

  const canNext = (() => {
    switch (step) {
      case 0: return form.actividad_economica.trim().length >= 3;
      case 1: return form.origen_recursos.trim().length >= 10 && Number(form.volumen_mensual_estimado) >= 0;
      case 2: return true;
      case 3: return form.proposito_cuenta.trim().length >= 10;
      default: return true;
    }
  })();

  async function onSubmit() {
    if (!currentOrg?.id) {
      toast.error("Selecciona una organización antes de enviar el cuestionario.");
      return;
    }
    setSubmitting(true);
    try {
      const paises = form.paises_operacion.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
      const res = await submit({
        data: {
          org_id: currentOrg.id,
          actividad_economica: form.actividad_economica.trim(),
          actividad_scian: form.actividad_scian.trim() || null,
          sector: form.sector.trim() || null,
          origen_recursos: form.origen_recursos.trim(),
          destino_recursos: form.destino_recursos.trim() || null,
          volumen_mensual_estimado: Number(form.volumen_mensual_estimado) || 0,
          operaciones_mensuales_estimadas: Number(form.operaciones_mensuales_estimadas) || 0,
          ticket_promedio_estimado: form.ticket_promedio_estimado ? Number(form.ticket_promedio_estimado) : null,
          paises_operacion: paises.length ? paises : ["MX"],
          estados_operacion: [],
          usa_efectivo: form.usa_efectivo,
          efectivo_mensual_estimado: form.usa_efectivo ? Number(form.efectivo_mensual_estimado) || 0 : null,
          es_pep: form.es_pep,
          pep_detalle: null,
          familiar_pep: form.familiar_pep,
          proposito_cuenta: form.proposito_cuenta.trim(),
          beneficiario_final: null,
        },
      });
      setResult({ score: res.score, level: res.level });
      toast.success(`Perfil evaluado: nivel ${res.level} (${res.score}/100)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar el cuestionario.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const isBad = result.level === "alto" || result.level === "inaceptable";
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="rounded-lg border border-yo-border bg-yo-surface p-8 text-center">
          {isBad ? (
            <AlertTriangle className="h-12 w-12 mx-auto text-orange-500" />
          ) : (
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />
          )}
          <h2 className="mt-4 text-xl font-semibold text-yo-txt">Cuestionario enviado</h2>
          <p className="mt-2 text-sm text-yo-txt-2">
            Perfil de riesgo: <b>{result.level}</b> con puntaje <b>{result.score}/100</b>.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link to="/pld"
              className="inline-flex items-center gap-2 rounded-lg bg-yo-accent px-4 py-2 text-sm font-medium text-yo-bg">
              Ver perfil PLD/FT <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <PageHeader
        icon={ShieldCheck}
        title="Cuestionario PLD/FT"
        subtitle={STEPS[step].desc}
      />

      {/* Stepper */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2 shrink-0">
            <div className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
              i < step ? "bg-yo-accent text-yo-bg border-yo-accent" :
              i === step ? "border-yo-accent text-yo-accent" :
              "border-yo-border text-yo-txt-2",
            )}>{i + 1}</div>
            <span className={cn("text-xs", i === step ? "text-yo-txt font-medium" : "text-yo-txt-2")}>
              {s.title}
            </span>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-yo-border" />}
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-yo-border bg-yo-surface p-6 space-y-4">
        {step === 0 && (
          <>
            <Field label="Actividad económica *">
              <input className={inputCls} value={form.actividad_economica}
                onChange={e => update("actividad_economica", e.target.value)}
                placeholder="p. ej. Servicios de consultoría contable" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Código SCIAN (opcional)">
                <input className={inputCls} value={form.actividad_scian}
                  onChange={e => update("actividad_scian", e.target.value)} placeholder="p. ej. 5417" />
              </Field>
              <Field label="Sector">
                <input className={inputCls} value={form.sector}
                  onChange={e => update("sector", e.target.value)} placeholder="p. ej. Servicios profesionales" />
              </Field>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="Origen de los recursos *" hint="Describe cómo se generan los fondos (mín. 10 caracteres).">
              <textarea className={cn(inputCls, "min-h-[100px]")} value={form.origen_recursos}
                onChange={e => update("origen_recursos", e.target.value)} />
            </Field>
            <Field label="Destino previsto de los recursos">
              <textarea className={cn(inputCls, "min-h-[80px]")} value={form.destino_recursos}
                onChange={e => update("destino_recursos", e.target.value)} />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Volumen mensual (MXN) *">
                <input type="number" min={0} className={inputCls}
                  value={form.volumen_mensual_estimado}
                  onChange={e => update("volumen_mensual_estimado", e.target.value)} />
              </Field>
              <Field label="Operaciones/mes">
                <input type="number" min={0} className={inputCls}
                  value={form.operaciones_mensuales_estimadas}
                  onChange={e => update("operaciones_mensuales_estimadas", e.target.value)} />
              </Field>
              <Field label="Ticket promedio">
                <input type="number" min={0} className={inputCls}
                  value={form.ticket_promedio_estimado}
                  onChange={e => update("ticket_promedio_estimado", e.target.value)} />
              </Field>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="Países de operación (códigos ISO separados por coma)"
              hint="Ejemplo: MX, US, CO. Se detectan automáticamente jurisdicciones de alto riesgo GAFI.">
              <input className={inputCls} value={form.paises_operacion}
                onChange={e => update("paises_operacion", e.target.value)} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-yo-txt">
              <input type="checkbox" checked={form.usa_efectivo}
                onChange={e => update("usa_efectivo", e.target.checked)} />
              La organización recibe o utiliza efectivo
            </label>
            {form.usa_efectivo && (
              <Field label="Efectivo mensual estimado (MXN)">
                <input type="number" min={0} className={inputCls}
                  value={form.efectivo_mensual_estimado}
                  onChange={e => update("efectivo_mensual_estimado", e.target.value)} />
              </Field>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <label className="flex items-center gap-2 text-sm text-yo-txt">
              <input type="checkbox" checked={form.es_pep} onChange={e => update("es_pep", e.target.checked)} />
              Soy Persona Políticamente Expuesta (PEP)
            </label>
            <label className="flex items-center gap-2 text-sm text-yo-txt">
              <input type="checkbox" checked={form.familiar_pep} onChange={e => update("familiar_pep", e.target.checked)} />
              Familiar directo (cónyuge, padres, hijos) de una PEP
            </label>
            <Field label="Propósito de la cuenta *" hint="Explica qué tipo de operaciones planeas realizar (mín. 10 caracteres).">
              <textarea className={cn(inputCls, "min-h-[100px]")} value={form.proposito_cuenta}
                onChange={e => update("proposito_cuenta", e.target.value)} />
            </Field>
          </>
        )}

        {step === 4 && (
          <div className="space-y-3 text-sm">
            <Row k="Actividad" v={form.actividad_economica} />
            <Row k="SCIAN / Sector" v={`${form.actividad_scian || "—"} / ${form.sector || "—"}`} />
            <Row k="Origen" v={form.origen_recursos} />
            <Row k="Volumen mensual" v={`$${Number(form.volumen_mensual_estimado || 0).toLocaleString("es-MX")} · ${form.operaciones_mensuales_estimadas || 0} ops/mes`} />
            <Row k="Países" v={form.paises_operacion} />
            <Row k="Efectivo" v={form.usa_efectivo ? `Sí ($${Number(form.efectivo_mensual_estimado || 0).toLocaleString("es-MX")}/mes)` : "No"} />
            <Row k="PEP" v={form.es_pep ? "Sí (titular)" : form.familiar_pep ? "Familiar PEP" : "No"} />
            <Row k="Propósito" v={form.proposito_cuenta} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          disabled={step === 0}
          onClick={() => setStep(s => Math.max(0, s - 1))}
          className="inline-flex items-center gap-2 rounded-lg border border-yo-border bg-yo-surface px-3 py-2 text-sm text-yo-txt disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" /> Atrás
        </button>
        {step < STEPS.length - 1 ? (
          <button
            disabled={!canNext}
            onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
            className="inline-flex items-center gap-2 rounded-lg bg-yo-accent px-4 py-2 text-sm font-medium text-yo-bg disabled:opacity-40"
          >
            Siguiente <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            disabled={submitting}
            onClick={onSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-yo-accent px-4 py-2 text-sm font-medium text-yo-bg disabled:opacity-40"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Enviar y evaluar
          </button>
        )}
      </div>

      <button
        onClick={() => navigate({ to: "/pld" })}
        className="text-xs text-yo-txt-2 hover:text-yo-txt"
      >
        Cancelar y volver
      </button>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-yo-border bg-yo-bg px-3 py-2 text-sm text-yo-txt placeholder:text-yo-txt-2 focus:outline-none focus:border-yo-accent";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-yo-txt-2 mb-1">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-yo-txt-2">{hint}</p>}
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-3 gap-4 border-b border-yo-border pb-2">
      <div className="text-yo-txt-2 text-[11px] uppercase tracking-wider">{k}</div>
      <div className="col-span-2 text-yo-txt break-words">{v || "—"}</div>
    </div>
  );
}
