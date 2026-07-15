import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  SECTORES, getSector, calcularFee, PLANTILLAS_HITOS, plantillaToDraft,
  type SectorId, type HitoDraft,
} from "@/lib/sectors";
import { SECTOR_CFG, DOC_BASE, DOC_BY_SECTOR, EVIDENCE_TYPES } from "@/lib/operations-catalog";
import { OPERATION_EXAMPLES, type OperationExample } from "@/lib/operation-examples";
import {
  searchCounterpart,
  upsertTransactionDraft,
  cancelTransactionDraft,
  saveTransactionHitos,
  saveTransactionMonto,
  signAndActivateTransaction,
} from "@/lib/transactions.functions";
import { Step1Schema, Step2Schema, Step3Schema, Step4Schema, Step5Schema } from "@/lib/validations/transaction";
import {
  Info, Check, ChevronRight, ChevronLeft, X, Search, Trash2, Plus, GripVertical,
  ArrowUp, ArrowDown, Sparkles, AlertTriangle, ClipboardList, FileText, Camera, ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/transactions/new")({
  head: () => ({ meta: [{ title: "Crear operación protegida — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: NewOperationWizard,
});

type Rol = "PAGADOR" | "BENEFICIARIO";
type Contraparte = { user_id: string | null; email: string; nombre: string; rfc?: string | null };

const STEP_LABELS = ["Tipo", "Partes", "Hitos", "Cumplimiento", "Pago", "Revisión"] as const;
const TOTAL_STEPS = 6;

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

function NewOperationWizard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [txId, setTxId] = useState<string | null>(null);
  const [numero, setNumero] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showActivation, setShowActivation] = useState(false);

  // Paso 1
  const [sector, setSector] = useState<SectorId | null>(null);
  const [subtipo, setSubtipo] = useState<string>("");
  const [descripcion, setDescripcion] = useState("");
  const [fechaInicio, setFechaInicio] = useState<string>(new Date().toISOString().slice(0, 10));
  const [fechaFin, setFechaFin] = useState<string>("");

  // Paso 2
  const [rol, setRol] = useState<Rol>("PAGADOR");
  const [contraparte, setContraparte] = useState<Contraparte | null>(null);

  // Paso 3 & 4 — hitos con documentos, evidencia y checklist
  const [hitos, setHitos] = useState<HitoDraft[]>([]);
  const [checklist, setChecklist] = useState<Record<number, string[]>>({});

  // Paso 5
  const [monto, setMonto] = useState<number>(0);
  const [metodoPago, setMetodoPago] = useState<"SPEI" | "TARJETA" | "OXXO">("SPEI");
  const [comisionPagadaPor, setComisionPagadaPor] = useState<"COMPRADOR" | "VENDEDOR">("COMPRADOR");

  // Paso 6
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [aceptaRetencion, setAceptaRetencion] = useState(false);
  const [aceptaCumplimiento, setAceptaCumplimiento] = useState(false);
  const [aceptaTraza, setAceptaTraza] = useState(false);
  const [firmando, setFirmando] = useState(false);
  const [firmaResult, setFirmaResult] = useState<{ status: string; activated: boolean } | null>(null);

  const upsertDraft = useServerFn(upsertTransactionDraft);
  const cancelDraft = useServerFn(cancelTransactionDraft);
  const saveHitos = useServerFn(saveTransactionHitos);
  const saveMonto = useServerFn(saveTransactionMonto);
  const signAndActivate = useServerFn(signAndActivateTransaction);

  const sectorDef = useMemo(() => (sector ? getSector(sector) : undefined), [sector]);
  const sectorCfg = useMemo(() => (sector ? SECTOR_CFG[sector] : undefined), [sector]);
  const fee = useMemo(() => (sector ? calcularFee(sector, monto || 0, 0) : null), [sector, monto]);
  const sumaPct = useMemo(() => hitos.reduce((s, h) => s + Number(h.monto_porcentaje || 0), 0), [hitos]);
  const creatorRoleLabel = rol === "PAGADOR" ? "Comprador" : "Vendedor";

  // ─── Autosave silencioso cada 30s cuando hay borrador
  useEffect(() => {
    if (!txId || step < 2 || step > 5 || !sector) return;
    const interval = setInterval(async () => {
      const p = Step2Schema.safeParse({
        rol, descripcion,
        contraparte_user_id: contraparte?.user_id ?? null,
        contraparte_email: contraparte?.email ?? null,
        contraparte_nombre: contraparte?.nombre ?? null,
        contraparte_rfc: contraparte?.rfc ?? null,
      });
      if (!p.success) return;
      try {
        setSaveState("saving");
        await upsertDraft({ data: { transaction_id: txId, step1: { sector }, step2: p.data } });
        setSaveState("saved");
        setLastSavedAt(new Date());
      } catch {
        setSaveState("error");
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [txId, step, sector, rol, descripcion, contraparte, upsertDraft]);

  // ─── Handlers
  const handleCancel = useCallback(async () => {
    if (txId) { try { await cancelDraft({ data: { id: txId } }); } catch { /* noop */ } }
    navigate({ to: "/transactions" });
  }, [txId, cancelDraft, navigate]);

  const handleFirmar = useCallback(async () => {
    setError(null);
    const parsed = Step5Schema.safeParse({ acepta_terminos: aceptaTerminos, acepta_retencion: aceptaRetencion });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Debes aceptar los términos"); return; }
    if (!txId) { setError("No hay borrador guardado"); return; }
    if (!aceptaCumplimiento || !aceptaTraza) { setError("Confirma todas las declaraciones"); return; }
    setFirmando(true);
    try {
      const res = await signAndActivate({ data: { transaction_id: txId, acepta_terminos: true, acepta_retencion: true } });
      setFirmaResult({ status: res.status ?? "pending_signature", activated: res.activated });
      setShowActivation(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFirmando(false);
    }
  }, [aceptaTerminos, aceptaRetencion, aceptaCumplimiento, aceptaTraza, txId, signAndActivate]);

  const validateStep = useCallback((s: number): string | null => {
    if (s === 1) {
      if (!sector) return "Selecciona el tipo de operación";
      if (descripcion.trim().length < 10) return "Describe la operación (mínimo 10 caracteres)";
    }
    if (s === 2) {
      if (!contraparte) return "Selecciona o invita una contraparte";
    }
    if (s === 3) {
      if (hitos.length === 0) return "Agrega al menos un hito";
      if (Math.abs(sumaPct - 100) > 0.01) return "La suma de liberaciones debe ser 100%";
    }
    if (s === 4) {
      const invalid = hitos.some((h) => h.documentos_requeridos.length === 0 && h.evidencia_requerida.length === 0);
      if (invalid) return "Cada hito debe tener al menos un documento o evidencia requerida";
    }
    if (s === 5) {
      if (!monto || monto < 100) return "Ingresa un monto válido (mínimo $100 MXN)";
    }
    return null;
  }, [sector, descripcion, contraparte, hitos, sumaPct, monto]);

  const goNext = useCallback(async () => {
    setError(null);
    const err = validateStep(step);
    if (err) { setError(err); return; }

    if (step === 1) { setStep(2); return; }

    if (step === 2) {
      const p = Step2Schema.safeParse({
        rol, descripcion,
        contraparte_user_id: contraparte?.user_id ?? null,
        contraparte_email: contraparte?.email ?? null,
        contraparte_nombre: contraparte?.nombre ?? null,
        contraparte_rfc: contraparte?.rfc ?? null,
      });
      if (!p.success) { setError(p.error.issues[0]?.message ?? "Revisa los campos"); return; }
      setSaving(true); setSaveState("saving");
      try {
        const res = await upsertDraft({ data: { transaction_id: txId ?? undefined, step1: { sector: sector! }, step2: p.data } });
        setTxId(res.id); setNumero(res.numero ?? null);
        setSaveState("saved"); setLastSavedAt(new Date());
        if (hitos.length === 0 && sector) {
          setHitos(PLANTILLAS_HITOS[sector].map((pl, i) => plantillaToDraft(pl, i + 1, fechaInicio)));
        }
        setStep(3);
      } catch (e) { setSaveState("error"); setError((e as Error).message); }
      finally { setSaving(false); }
      return;
    }

    if (step === 3 || step === 4) {
      const r = Step3Schema.safeParse({ hitos });
      if (!r.success) { setError(r.error.issues[0]?.message ?? "Revisa los hitos"); return; }
      if (!txId) { setError("Falta guardar los pasos anteriores"); return; }
      setSaving(true); setSaveState("saving");
      try {
        await saveHitos({ data: { transaction_id: txId, hitos: r.data.hitos } });
        setSaveState("saved"); setLastSavedAt(new Date());
        setStep((s) => s + 1);
      } catch (e) { setSaveState("error"); setError((e as Error).message); }
      finally { setSaving(false); }
      return;
    }

    if (step === 5) {
      const r = Step4Schema.safeParse({
        monto, metodo_pago: metodoPago,
        fecha_inicio_estimada: fechaInicio || null, fecha_fin_estimada: fechaFin || null,
      });
      if (!r.success) { setError(r.error.issues[0]?.message ?? "Revisa el monto"); return; }
      if (!txId || !sector) { setError("Falta información previa"); return; }
      setSaving(true); setSaveState("saving");
      try {
        await saveMonto({ data: { transaction_id: txId, sector, step4: r.data } });
        setSaveState("saved"); setLastSavedAt(new Date());
        setStep(6);
      } catch (e) { setSaveState("error"); setError((e as Error).message); }
      finally { setSaving(false); }
    }
  }, [step, validateStep, sector, rol, descripcion, contraparte, hitos, monto, metodoPago, fechaInicio, fechaFin, txId, upsertDraft, saveHitos, saveMonto]);

  const goBack = useCallback(() => {
    setError(null);
    if (step === 1) return handleCancel();
    setStep((s) => s - 1);
  }, [step, handleCancel]);

  const handleGuardarYSalir = useCallback(async () => {
    if (step >= 2 && sector) {
      const p = Step2Schema.safeParse({
        rol, descripcion,
        contraparte_user_id: contraparte?.user_id ?? null,
        contraparte_email: contraparte?.email ?? null,
        contraparte_nombre: contraparte?.nombre ?? null,
        contraparte_rfc: contraparte?.rfc ?? null,
      });
      if (p.success) {
        try { await upsertDraft({ data: { transaction_id: txId ?? undefined, step1: { sector }, step2: p.data } }); } catch { /* noop */ }
      }
    }
    navigate({ to: "/transactions" });
  }, [step, sector, rol, descripcion, contraparte, txId, upsertDraft, navigate]);

  // ─── Pantalla de éxito
  if (firmaResult) {
    return (
      <SuccessScreen
        rol={rol}
        numero={numero}
        activated={firmaResult.activated}
        contraparte={contraparte}
        onGoTransactions={() => navigate({ to: "/transactions" })}
        onGoPayments={() => navigate({ to: "/payments" })}
      />
    );
  }

  const stepValidNow = !validateStep(step);

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="bg-yo-surface border border-yo-border rounded-lg px-4 md:px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-semibold text-yo-txt">Crear operación protegida</h1>
              <Badge tone="neutral" dot>Borrador</Badge>
              {numero && <span className="font-mono text-xs text-yo-txt-3">{numero}</span>}
            </div>
            <p className="text-sm text-yo-txt-2 mt-1">
              Define las partes, condiciones, evidencia y reglas de liberación.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SaveIndicator state={saveState} at={lastSavedAt} />
            <button
              onClick={handleGuardarYSalir}
              className="hidden sm:inline-flex items-center px-3 py-2 border border-yo-border text-sm font-medium rounded-md text-yo-txt-2 hover:bg-yo-raised"
            >
              Guardar y salir
            </button>
            <button
              onClick={handleCancel}
              className="inline-flex items-center px-3 py-2 text-sm text-yo-txt-3 hover:text-yo-txt"
              aria-label="Cancelar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Stepper */}
      <div className="bg-yo-surface border border-yo-border rounded-lg px-4 md:px-5 py-3">
        <Stepper current={step} labels={[...STEP_LABELS]} onJump={(n) => { if (n < step) setStep(n); }} />
      </div>

      {/* Contenido 70/30 */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] gap-4">
        <section className="min-w-0 space-y-4">
            {error && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-[#FECACA] bg-yo-err-bg p-3">
                <AlertTriangle className="h-4 w-4 text-yo-err mt-0.5 shrink-0" />
                <p className="text-sm text-yo-err">{error}</p>
              </div>
            )}
            <div className="bg-yo-surface border border-yo-border rounded-lg p-5 md:p-6 shadow-sm">
              {step === 1 && (
                <Step1Tipo
                  sector={sector} setSector={setSector}
                  subtipo={subtipo} setSubtipo={setSubtipo}
                  descripcion={descripcion} setDescripcion={setDescripcion}
                  fechaInicio={fechaInicio} setFechaInicio={setFechaInicio}
                  fechaFin={fechaFin} setFechaFin={setFechaFin}
                />
              )}
              {step === 2 && sector && (
                <Step2Partes
                  sector={sector}
                  rol={rol} setRol={setRol}
                  contraparte={contraparte} setContraparte={setContraparte}
                  currentUserId={user.id}
                />
              )}
              {step === 3 && sector && (
                <Step3Hitos sector={sector} hitos={hitos} setHitos={setHitos} fechaBase={fechaInicio} sumaPct={sumaPct} />
              )}
              {step === 4 && sector && (
                <Step4Cumplimiento
                  sector={sector} hitos={hitos} setHitos={setHitos}
                  checklist={checklist} setChecklist={setChecklist}
                />
              )}
              {step === 5 && sector && (
                <Step5Pago
                  sector={sector}
                  monto={monto} setMonto={setMonto}
                  metodoPago={metodoPago} setMetodoPago={setMetodoPago}
                  comisionPagadaPor={comisionPagadaPor} setComisionPagadaPor={setComisionPagadaPor}
                  fee={fee} hitos={hitos}
                />
              )}
              {step === 6 && (
                <Step6Revision
                  numero={numero} rol={rol}
                  sectorDef={sectorDef} sectorCfg={sectorCfg}
                  subtipo={subtipo} descripcion={descripcion}
                  fechaInicio={fechaInicio} fechaFin={fechaFin}
                  contraparte={contraparte} hitos={hitos} monto={monto}
                  metodoPago={metodoPago} comisionPagadaPor={comisionPagadaPor}
                  fee={fee}
                  aceptaTerminos={aceptaTerminos} setAceptaTerminos={setAceptaTerminos}
                  aceptaRetencion={aceptaRetencion} setAceptaRetencion={setAceptaRetencion}
                  aceptaCumplimiento={aceptaCumplimiento} setAceptaCumplimiento={setAceptaCumplimiento}
                  aceptaTraza={aceptaTraza} setAceptaTraza={setAceptaTraza}
                />
              )}
            </div>
          </section>

          {/* Panel resumen 30% */}
          <aside className="lg:sticky lg:top-[125px] lg:self-start space-y-4">
            <LiveSummary
              sectorDef={sectorDef} sectorCfg={sectorCfg}
              subtipo={subtipo} rol={rol} contraparte={contraparte}
              monto={monto} fee={fee} hitos={hitos} sumaPct={sumaPct}
              metodoPago={metodoPago} step={step}
              creatorRoleLabel={creatorRoleLabel}
            />
            <NoCustodyCard />
          </aside>
      </div>

      {/* Botonera inferior */}
      <footer className="bg-yo-surface border border-yo-border rounded-lg px-4 md:px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={goBack}
            disabled={saving || firmando}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-yo-border text-sm font-medium rounded-md text-yo-txt-2 hover:bg-yo-raised disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 1 ? "Cancelar" : "Atrás"}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGuardarYSalir}
              disabled={saving}
              className="hidden md:inline-flex px-4 py-2 border border-yo-border text-sm font-medium rounded-md text-yo-txt-2 hover:bg-yo-raised disabled:opacity-40"
            >
              Guardar borrador
            </button>
            {step < 6 ? (
              <button
                onClick={goNext}
                disabled={saving || !stepValidNow}
                title={!stepValidNow ? "Completa los campos obligatorios para continuar." : undefined}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-yo-ac text-white text-sm font-semibold rounded-md hover:bg-yo-ac-h disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Guardando…" : "Continuar"}
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => setShowActivation(true)}
                disabled={!aceptaTerminos || !aceptaRetencion || !aceptaCumplimiento || !aceptaTraza}
                title={(!aceptaTerminos || !aceptaRetencion || !aceptaCumplimiento || !aceptaTraza) ? "Acepta todas las declaraciones para continuar." : undefined}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-yo-ac text-white text-sm font-semibold rounded-md hover:bg-yo-ac-h disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {rol === "PAGADOR" ? "Activar operación y continuar a pago" : "Enviar propuesta al comprador"}
              </button>
            )}
          </div>
        </div>
      </footer>

      {showActivation && (
        <ActivationModal
          rol={rol}
          firmando={firmando}
          onClose={() => setShowActivation(false)}
          onConfirm={handleFirmar}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Badge({ children, tone = "neutral", dot = false }: { children: React.ReactNode; tone?: "ok" | "warn" | "err" | "info" | "accent" | "neutral"; dot?: boolean }) {
  const cls: Record<string, string> = {
    ok: "bg-yo-ok-bg text-yo-ok", warn: "bg-yo-warn-bg text-yo-warn",
    err: "bg-yo-err-bg text-yo-err", info: "bg-yo-info-bg text-yo-info",
    accent: "bg-yo-ac-bg text-yo-ac-txt", neutral: "bg-yo-raised text-yo-txt-2",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${cls[tone]}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

function SaveIndicator({ state, at }: { state: "idle" | "saving" | "saved" | "error"; at: Date | null }) {
  if (state === "saving") return <span className="text-xs text-yo-txt-3 hidden sm:inline">Guardando…</span>;
  if (state === "error") return <span className="text-xs text-yo-err hidden sm:inline">Error al guardar</span>;
  if (state === "saved" && at) {
    return <span className="text-xs text-yo-txt-3 hidden sm:inline">Guardado {at.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>;
  }
  return <span className="text-xs text-yo-txt-3 hidden sm:inline">Guardado automáticamente</span>;
}

function Stepper({ current, labels, onJump }: { current: number; labels: string[]; onJump: (n: number) => void }) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto">
      {labels.map((label, i) => {
        const n = i + 1;
        const isDone = n < current;
        const isCurrent = n === current;
        return (
          <li key={label} className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onJump(n)}
              disabled={n >= current}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                isCurrent
                  ? "bg-yo-ac-bg text-yo-ac-txt border border-yo-ac"
                  : isDone
                    ? "text-yo-txt-2 hover:bg-yo-raised"
                    : "text-yo-txt-3 cursor-default"
              }`}
            >
              <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                isDone ? "bg-yo-ok text-white" : isCurrent ? "bg-yo-ac text-white" : "bg-yo-raised text-yo-txt-3"
              }`}>
                {isDone ? <Check className="h-3 w-3" /> : n}
              </span>
              <span className="hidden md:inline">{label}</span>
            </button>
            {n < labels.length && <ChevronRight className="h-3 w-3 text-yo-txt-4" />}
          </li>
        );
      })}
    </ol>
  );
}

function LiveSummary({
  sectorDef, sectorCfg, subtipo, rol, contraparte, monto, fee, hitos, sumaPct, metodoPago, step, creatorRoleLabel,
}: {
  sectorDef: ReturnType<typeof getSector>; sectorCfg?: typeof SECTOR_CFG[SectorId];
  subtipo: string; rol: Rol; contraparte: Contraparte | null; monto: number;
  fee: ReturnType<typeof calcularFee> | null; hitos: HitoDraft[]; sumaPct: number;
  metodoPago: string; step: number; creatorRoleLabel: string;
}) {
  const pctOk = Math.abs(sumaPct - 100) < 0.01;
  return (
    <div className="bg-yo-surface border border-yo-border rounded-lg overflow-hidden">
      <div className="h-1 bg-yo-ac" />
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-yo-txt">Resumen de la operación</h3>
          <Badge tone="neutral" dot>Paso {step}/6</Badge>
        </div>

        <SummaryRow label="Sector">
          {sectorDef ? (
            <span className="inline-flex items-center gap-1.5">
              <span>{sectorCfg?.emoji}</span>
              <span className="text-yo-txt">{sectorDef.titulo}</span>
            </span>
          ) : <span className="text-yo-txt-3">Sin definir</span>}
        </SummaryRow>

        {subtipo && <SummaryRow label="Subtipo"><span className="text-yo-txt">{subtipo}</span></SummaryRow>}

        <SummaryRow label="Tu rol">
          <span className="text-yo-txt">{creatorRoleLabel}</span>
        </SummaryRow>

        <SummaryRow label="Contraparte">
          {contraparte ? (
            <span className="text-yo-txt truncate block">{contraparte.nombre}</span>
          ) : <span className="text-yo-txt-3">Sin definir</span>}
        </SummaryRow>

        <SummaryRow label="Monto">
          <span className="font-mono text-yo-txt">{fmtMoney(monto)}</span>
        </SummaryRow>

        {fee && monto > 0 && (
          <>
            <SummaryRow label="Comisión">
              <span className="font-mono text-yo-txt-2">{fmtMoney(fee.comision_final + fee.iva_comision)}</span>
            </SummaryRow>
            <SummaryRow label="Total a depositar">
              <span className="font-mono font-semibold text-yo-ac-txt">{fmtMoney(fee.total_a_depositar)}</span>
            </SummaryRow>
          </>
        )}

        <SummaryRow label="Hitos">
          <span className="text-yo-txt">
            {hitos.length}
            {hitos.length > 0 && (
              <span className={`ml-2 text-xs ${pctOk ? "text-yo-ok" : "text-yo-warn"}`}>
                {sumaPct.toFixed(0)}%
              </span>
            )}
          </span>
        </SummaryRow>

        <SummaryRow label="Método de pago">
          <span className="text-yo-txt">{metodoPago}</span>
        </SummaryRow>

        <div className="pt-3 border-t border-yo-border">
          <p className="text-xs text-yo-txt-2">
            <span className="font-medium text-yo-txt">Responsabilidad principal:</span>{" "}
            {rol === "PAGADOR"
              ? "fondear la operación, revisar cumplimiento y aprobar liberaciones."
              : "entregar bienes/servicios y cargar evidencia para solicitar liberaciones."}
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-yo-txt-3 text-xs">{label}</span>
      <span className="text-right min-w-0 truncate">{children}</span>
    </div>
  );
}

function NoCustodyCard() {
  return (
    <div className="bg-yo-info-bg border border-[#BAE6FD] rounded-lg p-4">
      <div className="flex items-start gap-2">
        <Info className="h-4 w-4 text-yo-info shrink-0 mt-0.5" />
        <div className="text-xs text-yo-txt-2 leading-relaxed">
          <p className="font-semibold text-yo-info mb-1">YOKTO no custodia fondos</p>
          <p>
            El pago es procesado y retenido por una pasarela certificada. YOKTO registra
            condiciones, evidencia y eventos para ordenar liberación o devolución conforme
            a la operación.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Paso 1 ─────────────────────────────────────────────────────────────────
function Step1Tipo({
  sector, setSector, subtipo, setSubtipo, descripcion, setDescripcion,
  fechaInicio, setFechaInicio, fechaFin, setFechaFin,
}: {
  sector: SectorId | null; setSector: (s: SectorId) => void;
  subtipo: string; setSubtipo: (s: string) => void;
  descripcion: string; setDescripcion: (s: string) => void;
  fechaInicio: string; setFechaInicio: (s: string) => void;
  fechaFin: string; setFechaFin: (s: string) => void;
}) {
  const cfg = sector ? SECTOR_CFG[sector] : undefined;
  const sd = sector ? getSector(sector) : undefined;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-yo-txt">Tipo de operación</h2>
        <p className="text-sm text-yo-txt-2 mt-0.5">Elige la vertical. Sugeriremos hitos, documentos y evidencia adecuados.</p>
      </div>

      <div className="rounded-lg bg-yo-ac-bg border border-[#C7D2FE] p-3 flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-yo-ac-txt shrink-0 mt-0.5" />
        <p className="text-xs text-yo-ac-txt">
          Al elegir un sector, YOKTO precargará hitos, documentos y evidencia comunes. Podrás editarlos antes de activar.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SECTORES.map((s) => {
          const c = SECTOR_CFG[s.id];
          const active = sector === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => { setSector(s.id); setSubtipo(""); }}
              className={`relative text-left p-4 rounded-lg border-2 transition ${
                active ? "border-yo-ac bg-yo-ac-bg shadow-sm" : "border-yo-border bg-yo-surface hover:border-yo-border-s"
              }`}
            >
              {active && (
                <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-yo-ac text-white flex items-center justify-center">
                  <Check className="h-3 w-3" />
                </span>
              )}
              <div className="text-2xl" style={{ color: c.color }}>{c.emoji}</div>
              <div className="mt-2 text-sm font-semibold text-yo-txt">{s.titulo}</div>
              <div className="mt-0.5 text-xs text-yo-txt-2 line-clamp-2">{s.descripcion}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: c.bg, color: c.txt }}>
                  {s.tiempo_tipico}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {sector && cfg && sd && (
        <>
          <div>
            <label className="block text-sm font-medium text-yo-txt mb-1.5">
              Subtipo de operación <span className="text-yo-txt-3 font-normal">(opcional)</span>
            </label>
            <select
              value={subtipo}
              onChange={(e) => setSubtipo(e.target.value)}
              className="w-full px-3 py-2 border border-yo-border rounded-md bg-yo-surface text-sm focus:outline-none focus:ring-2 focus:ring-yo-ac"
            >
              <option value="">— Selecciona subtipo —</option>
              {cfg.subtipos.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-yo-txt mb-1.5">
              Descripción de la operación <span className="text-yo-err">*</span>
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder={sd.placeholder_descripcion}
              className="w-full px-3 py-2 border border-yo-border rounded-md bg-yo-surface text-sm resize-y focus:outline-none focus:ring-2 focus:ring-yo-ac"
            />
            <div className="mt-1 flex items-center justify-between text-xs text-yo-txt-3">
              <span>Mínimo 10 caracteres.</span>
              <span className="font-mono">{descripcion.length}/1000</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-yo-txt mb-1.5">Fecha estimada de inicio</span>
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full px-3 py-2 border border-yo-border rounded-md bg-yo-surface text-sm focus:outline-none focus:ring-2 focus:ring-yo-ac" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-yo-txt mb-1.5">Fecha estimada de fin</span>
              <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
                className="w-full px-3 py-2 border border-yo-border rounded-md bg-yo-surface text-sm focus:outline-none focus:ring-2 focus:ring-yo-ac" />
            </label>
          </div>

          <div className="rounded-lg bg-yo-warn-bg border border-[#FDE68A] p-3 flex items-start gap-2">
            <Info className="h-4 w-4 text-yo-warn shrink-0 mt-0.5" />
            <p className="text-xs text-yo-warn">
              La plantilla es una guía operativa. Las partes pueden ajustar condiciones, documentos y fechas según el acuerdo real.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Paso 2 ─────────────────────────────────────────────────────────────────
type SearchResult = {
  id: string; first_name: string | null; last_name: string | null; legal_name: string | null;
  email: string | null; rfc: string | null; account_type: string | null; kyc_status: string | null;
};

function Step2Partes({
  sector, rol, setRol, contraparte, setContraparte, currentUserId,
}: {
  sector: SectorId;
  rol: Rol; setRol: (r: Rol) => void;
  contraparte: Contraparte | null; setContraparte: (c: Contraparte | null) => void;
  currentUserId: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [inviteMode, setInviteMode] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteNombre, setInviteNombre] = useState("");
  const [inviteRfc, setInviteRfc] = useState("");
  const search = useServerFn(searchCounterpart);
  void sector;

  useEffect(() => {
    if (query.trim().length < 3) { setResults(null); return; }
    const h = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await search({ data: { query: query.trim() } });
        setResults(res.results.filter((r) => r.id !== currentUserId));
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(h);
  }, [query, search, currentUserId]);

  function pickResult(r: SearchResult) {
    const nombre = r.legal_name || [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email || "Contraparte";
    setContraparte({ user_id: r.id, email: r.email ?? "", nombre, rfc: r.rfc });
    setQuery(nombre); setResults(null); setInviteMode(false);
  }

  function applyInvite() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) return;
    if (inviteNombre.trim().length < 2) return;
    setContraparte({ user_id: null, email: inviteEmail.trim().toLowerCase(), nombre: inviteNombre.trim(), rfc: inviteRfc.trim() || null });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-yo-txt">Partes de la operación</h2>
        <p className="text-sm text-yo-txt-2 mt-0.5">Define tu rol y busca o invita a la contraparte.</p>
      </div>

      {/* Rol */}
      <div>
        <label className="block text-sm font-medium text-yo-txt mb-2">Tu rol en esta operación</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <RoleCard
            active={rol === "PAGADOR"}
            onClick={() => setRol("PAGADOR")}
            title="Comprador / Pagador"
            bullets={["Deposita mediante pasarela", "Revisa evidencia", "Aprueba hitos", "Puede abrir disputa"]}
          />
          <RoleCard
            active={rol === "BENEFICIARIO"}
            onClick={() => setRol("BENEFICIARIO")}
            title="Vendedor / Beneficiario"
            bullets={["Acepta condiciones", "Carga documentos y evidencia", "Cumple hitos", "Recibe liberaciones"]}
          />
        </div>
      </div>

      {/* Búsqueda */}
      <div>
        <label className="block text-sm font-medium text-yo-txt mb-1.5">Buscar contraparte</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-yo-txt-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (contraparte?.user_id) setContraparte(null); }}
            placeholder="Busca por email o RFC (ej. ACME850101ABC o contacto@empresa.mx)"
            className="w-full pl-9 pr-3 py-2 border border-yo-border rounded-md bg-yo-surface text-sm focus:outline-none focus:ring-2 focus:ring-yo-ac"
          />
        </div>
        {searching && <p className="mt-1.5 text-xs text-yo-txt-3">Buscando…</p>}
        {results && results.length > 0 && (
          <div className="mt-2 border border-yo-border rounded-md divide-y divide-yo-border overflow-hidden">
            {results.map((r) => {
              const nombre = r.legal_name || [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email;
              const rfcMask = r.rfc ? r.rfc.slice(0, 4) + "••••" + r.rfc.slice(-3) : "sin RFC";
              return (
                <button key={r.id} type="button" onClick={() => pickResult(r)}
                  className="w-full text-left px-4 py-3 hover:bg-yo-raised flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-yo-txt truncate">{nombre}</div>
                    <div className="text-xs text-yo-txt-3 font-mono">{rfcMask} · {r.account_type === "persona_moral" ? "Persona Moral" : "Persona Física"}</div>
                  </div>
                  <Badge tone={r.kyc_status === "approved" ? "ok" : "warn"} dot>
                    {r.kyc_status === "approved" ? "Verificado" : "En revisión"}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
        {results && results.length === 0 && !inviteMode && (
          <div className="mt-2 rounded-md border border-yo-border bg-yo-raised p-3 text-sm text-yo-txt-2 flex items-center justify-between gap-3">
            <span>No encontramos a esa contraparte en YOKTO.</span>
            <button type="button" onClick={() => { setInviteMode(true); setInviteEmail(query.includes("@") ? query : ""); }}
              className="text-yo-ac hover:text-yo-ac-h text-sm font-medium">
              Invitar contraparte
            </button>
          </div>
        )}

        {inviteMode && !contraparte && (
          <div className="mt-3 rounded-lg border border-yo-border bg-yo-raised p-4 space-y-3">
            <div className="text-sm font-semibold text-yo-txt">Invitar contraparte nueva</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email *"
                className="px-3 py-2 border border-yo-border rounded-md bg-yo-surface text-sm focus:outline-none focus:ring-2 focus:ring-yo-ac" />
              <input type="text" value={inviteNombre} onChange={(e) => setInviteNombre(e.target.value)}
                placeholder="Nombre o razón social *"
                className="px-3 py-2 border border-yo-border rounded-md bg-yo-surface text-sm focus:outline-none focus:ring-2 focus:ring-yo-ac" />
              <input type="text" value={inviteRfc} onChange={(e) => setInviteRfc(e.target.value.toUpperCase())}
                placeholder="RFC (opcional)"
                className="px-3 py-2 border border-yo-border rounded-md bg-yo-surface text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yo-ac" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={applyInvite}
                className="px-4 py-2 bg-yo-ac text-white text-sm font-medium rounded-md hover:bg-yo-ac-h">
                Usar como contraparte
              </button>
              <button type="button" onClick={() => setInviteMode(false)}
                className="px-4 py-2 border border-yo-border text-sm font-medium rounded-md text-yo-txt-2 hover:bg-yo-surface">
                Cancelar
              </button>
            </div>
            <p className="text-xs text-yo-txt-3">
              La operación quedará pendiente de aceptación hasta que la contraparte cree su cuenta, complete verificación básica y acepte las condiciones.
            </p>
          </div>
        )}

        {contraparte && (
          <div className="mt-3 rounded-lg border-2 border-yo-ac bg-yo-ac-bg p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-yo-ac-txt font-medium">Contraparte seleccionada</div>
              <div className="mt-0.5 text-sm font-semibold text-yo-txt">{contraparte.nombre}</div>
              <div className="text-xs text-yo-txt-2 font-mono">
                {contraparte.email}{contraparte.rfc ? ` · ${contraparte.rfc}` : ""}
                {" · "}{contraparte.user_id ? "usuario YOKTO" : "por invitar"}
              </div>
            </div>
            <button type="button" onClick={() => { setContraparte(null); setQuery(""); }}
              className="text-xs text-yo-ac hover:text-yo-ac-h font-medium">
              Cambiar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RoleCard({ active, onClick, title, bullets }: { active: boolean; onClick: () => void; title: string; bullets: string[] }) {
  return (
    <button type="button" onClick={onClick}
      className={`relative text-left p-4 rounded-lg border-2 transition ${
        active ? "border-yo-ac bg-yo-ac-bg shadow-sm" : "border-yo-border bg-yo-surface hover:border-yo-border-s"
      }`}>
      {active && (
        <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-yo-ac text-white flex items-center justify-center">
          <Check className="h-3 w-3" />
        </span>
      )}
      <div className="text-sm font-semibold text-yo-txt">{title}</div>
      <ul className="mt-2 space-y-1">
        {bullets.map((b) => (
          <li key={b} className="text-xs text-yo-txt-2 flex items-start gap-1.5">
            <span className="h-1 w-1 rounded-full bg-yo-txt-3 mt-1.5 shrink-0" />
            {b}
          </li>
        ))}
      </ul>
    </button>
  );
}

// ─── Paso 3 ─────────────────────────────────────────────────────────────────
const TIPOS_VERIF: Array<{ id: HitoDraft["tipo_verificacion"]; label: string }> = [
  { id: "DOCUMENTAL", label: "Documental" },
  { id: "EVIDENCIA_FISICA", label: "Evidencia física" },
  { id: "GPS", label: "GPS / tracking" },
  { id: "CHECKLIST", label: "Checklist" },
  { id: "AUTOMATICO", label: "Automático" },
  { id: "MANUAL_YOKTO", label: "Verificado por YOKTO" },
];

function Step3Hitos({
  sector, hitos, setHitos, fechaBase, sumaPct,
}: {
  sector: SectorId; hitos: HitoDraft[]; setHitos: (h: HitoDraft[]) => void;
  fechaBase: string; sumaPct: number;
}) {
  const ok = Math.abs(sumaPct - 100) < 0.01;
  const cfg = SECTOR_CFG[sector];

  function update(idx: number, patch: Partial<HitoDraft>) {
    setHitos(hitos.map((h, i) => (i === idx ? { ...h, ...patch } : h)));
  }
  function remove(idx: number) {
    setHitos(hitos.filter((_, i) => i !== idx).map((h, i) => ({ ...h, orden: i + 1 })));
  }
  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= hitos.length) return;
    const copy = [...hitos];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    setHitos(copy.map((h, i) => ({ ...h, orden: i + 1 })));
  }
  function addBlank() {
    setHitos([...hitos, {
      orden: hitos.length + 1, titulo: "Nuevo hito", descripcion: "",
      monto_porcentaje: 0, fecha_limite: fechaBase, tipo_verificacion: "DOCUMENTAL",
      documentos_requeridos: [], evidencia_requerida: [], responsable: "PAGADOR", auto_release: false,
    }]);
  }
  function resetPlantilla() {
    setHitos(PLANTILLAS_HITOS[sector].map((pl, i) => plantillaToDraft(pl, i + 1, fechaBase)));
  }
  function distribuirIgual() {
    if (hitos.length === 0) return;
    const each = Math.floor((100 / hitos.length) * 100) / 100;
    const resto = 100 - each * hitos.length;
    setHitos(hitos.map((h, i) => ({ ...h, monto_porcentaje: i === 0 ? +(each + resto).toFixed(2) : each })));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-yo-txt">Condiciones e hitos</h2>
        <p className="text-sm text-yo-txt-2 mt-0.5">
          Divide la operación en condiciones verificables. La suma de liberaciones debe ser exactamente 100%.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={resetPlantilla}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-yo-border rounded-md text-xs font-medium text-yo-txt-2 hover:bg-yo-raised">
          <Sparkles className="h-3.5 w-3.5" /> Usar plantilla recomendada
        </button>
        <button type="button" onClick={distribuirIgual}
          className="px-3 py-1.5 border border-yo-border rounded-md text-xs font-medium text-yo-txt-2 hover:bg-yo-raised">
          Distribuir porcentajes automáticamente
        </button>
      </div>

      {/* Distribution bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-yo-txt-2">Distribución de liberaciones</span>
          <span className={`text-xs font-mono font-semibold ${ok ? "text-yo-ok" : sumaPct > 100 ? "text-yo-err" : "text-yo-warn"}`}>
            {sumaPct.toFixed(2)}% {ok && "✓"}
          </span>
        </div>
        <div className="h-2 bg-yo-raised rounded-full overflow-hidden flex">
          {hitos.map((h, i) => (
            <div key={i} style={{ width: `${Math.min(Number(h.monto_porcentaje), 100)}%`, backgroundColor: cfg.color, opacity: 0.4 + (i * 0.15) }} />
          ))}
        </div>
        {!ok && (
          <p className="mt-1.5 text-xs text-yo-warn">
            La suma de liberaciones debe ser exactamente 100% antes de activar la operación.
          </p>
        )}
      </div>

      {/* Milestones */}
      <div className="space-y-3">
        {hitos.map((h, idx) => (
          <div key={idx} className="rounded-lg border border-yo-border bg-yo-surface p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-yo-txt-3" />
                <span className="text-xs font-mono text-yo-txt-3">Hito {h.orden}</span>
                <Badge tone={h.titulo && h.monto_porcentaje > 0 ? "ok" : "warn"} dot>
                  {h.titulo && h.monto_porcentaje > 0 ? "Configurado" : "Incompleto"}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0}
                  className="p-1.5 rounded hover:bg-yo-raised disabled:opacity-30" aria-label="Subir">
                  <ArrowUp className="h-3.5 w-3.5 text-yo-txt-2" />
                </button>
                <button type="button" onClick={() => move(idx, 1)} disabled={idx === hitos.length - 1}
                  className="p-1.5 rounded hover:bg-yo-raised disabled:opacity-30" aria-label="Bajar">
                  <ArrowDown className="h-3.5 w-3.5 text-yo-txt-2" />
                </button>
                <button type="button" onClick={() => remove(idx)}
                  className="p-1.5 rounded hover:bg-yo-err-bg text-yo-err" aria-label="Eliminar">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              <label className="block sm:col-span-4">
                <span className="text-xs font-medium text-yo-txt-2">Título</span>
                <input type="text" value={h.titulo} onChange={(e) => update(idx, { titulo: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-yo-border rounded-md bg-yo-surface text-sm focus:outline-none focus:ring-2 focus:ring-yo-ac" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-yo-txt-2">% liberación</span>
                <input type="number" min={0} max={100} step={0.01} value={h.monto_porcentaje}
                  onChange={(e) => update(idx, { monto_porcentaje: Number(e.target.value) })}
                  className="mt-1 w-full px-3 py-2 border border-yo-border rounded-md bg-yo-surface text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yo-ac" />
              </label>
              <label className="block sm:col-span-6">
                <span className="text-xs font-medium text-yo-txt-2">Descripción</span>
                <textarea rows={2} value={h.descripcion ?? ""} onChange={(e) => update(idx, { descripcion: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-yo-border rounded-md bg-yo-surface text-sm resize-y focus:outline-none focus:ring-2 focus:ring-yo-ac" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-yo-txt-2">Fecha límite</span>
                <input type="date" value={h.fecha_limite} onChange={(e) => update(idx, { fecha_limite: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-yo-border rounded-md bg-yo-surface text-sm focus:outline-none focus:ring-2 focus:ring-yo-ac" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-yo-txt-2">Tipo de verificación</span>
                <select value={h.tipo_verificacion} onChange={(e) => update(idx, { tipo_verificacion: e.target.value as HitoDraft["tipo_verificacion"] })}
                  className="mt-1 w-full px-3 py-2 border border-yo-border rounded-md bg-yo-surface text-sm focus:outline-none focus:ring-2 focus:ring-yo-ac">
                  {TIPOS_VERIF.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-yo-txt-2">Responsable de evidencia</span>
                <select value={h.responsable} onChange={(e) => update(idx, { responsable: e.target.value as "PAGADOR" | "BENEFICIARIO" })}
                  className="mt-1 w-full px-3 py-2 border border-yo-border rounded-md bg-yo-surface text-sm focus:outline-none focus:ring-2 focus:ring-yo-ac">
                  <option value="BENEFICIARIO">Vendedor</option>
                  <option value="PAGADOR">Comprador</option>
                </select>
              </label>
              <label className="flex items-center gap-2 sm:col-span-6">
                <input type="checkbox" checked={h.auto_release} onChange={(e) => update(idx, { auto_release: e.target.checked })}
                  className="rounded border-yo-border text-yo-ac focus:ring-yo-ac" />
                <span className="text-xs text-yo-txt-2">
                  Liberación automática al aprobar (solo si las reglas del hito son verificables automáticamente).
                </span>
              </label>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addBlank}
        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 border-2 border-dashed border-yo-border rounded-lg text-sm font-medium text-yo-txt-2 hover:border-yo-ac hover:text-yo-ac hover:bg-yo-ac-bg transition">
        <Plus className="h-4 w-4" /> Agregar hito
      </button>
    </div>
  );
}

// ─── Paso 4: Cumplimiento y evidencia ───────────────────────────────────────
function Step4Cumplimiento({
  sector, hitos, setHitos, checklist, setChecklist,
}: {
  sector: SectorId; hitos: HitoDraft[]; setHitos: (h: HitoDraft[]) => void;
  checklist: Record<number, string[]>; setChecklist: (v: Record<number, string[]>) => void;
}) {
  const [openIdx, setOpenIdx] = useState<number>(0);
  const docCatalog = useMemo(() => [...DOC_BASE, ...DOC_BY_SECTOR[sector]], [sector]);

  function toggleDoc(idx: number, doc: string) {
    const cur = hitos[idx].documentos_requeridos;
    const next = cur.includes(doc) ? cur.filter((d) => d !== doc) : [...cur, doc];
    setHitos(hitos.map((h, i) => i === idx ? { ...h, documentos_requeridos: next } : h));
  }
  function toggleEvidence(idx: number, ev: string) {
    const cur = hitos[idx].evidencia_requerida;
    const next = cur.includes(ev) ? cur.filter((e) => e !== ev) : [...cur, ev];
    setHitos(hitos.map((h, i) => i === idx ? { ...h, evidencia_requerida: next } : h));
  }
  function addChecklistItem(idx: number, text: string) {
    if (!text.trim()) return;
    setChecklist({ ...checklist, [idx]: [...(checklist[idx] ?? []), text.trim()] });
  }
  function removeChecklistItem(idx: number, i: number) {
    setChecklist({ ...checklist, [idx]: (checklist[idx] ?? []).filter((_, j) => j !== i) });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-yo-txt">Cumplimiento y evidencia</h2>
        <p className="text-sm text-yo-txt-2 mt-0.5">
          Define, por hito, qué documentos, evidencia y checklist deben validarse antes de liberar el pago.
        </p>
      </div>

      <div className="rounded-lg bg-yo-info-bg border border-[#BAE6FD] p-3 flex items-start gap-2">
        <Info className="h-4 w-4 text-yo-info shrink-0 mt-0.5" />
        <p className="text-xs text-yo-txt-2">
          Los documentos y evidencias configurados aquí serán usados para validar hitos, resolver disputas y alimentar el Perfil de Cumplimiento.
        </p>
      </div>

      <div className="space-y-3">
        {hitos.map((h, idx) => {
          const open = openIdx === idx;
          const cnt = h.documentos_requeridos.length + h.evidencia_requerida.length;
          return (
            <div key={idx} className="rounded-lg border border-yo-border bg-yo-surface overflow-hidden">
              <button type="button" onClick={() => setOpenIdx(open ? -1 : idx)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-yo-raised">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono text-yo-txt-3">Hito {h.orden}</span>
                  <span className="text-sm font-medium text-yo-txt truncate">{h.titulo}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge tone={cnt > 0 ? "ok" : "warn"} dot>{cnt} requisito{cnt === 1 ? "" : "s"}</Badge>
                  <ChevronRight className={`h-4 w-4 text-yo-txt-3 transition ${open ? "rotate-90" : ""}`} />
                </div>
              </button>

              {open && (
                <div className="px-4 pb-4 space-y-4 border-t border-yo-border pt-4">
                  {/* Documentos */}
                  <section>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-yo-ac" />
                      <h4 className="text-sm font-semibold text-yo-txt">Documentos requeridos</h4>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {docCatalog.map((doc) => {
                        const on = h.documentos_requeridos.includes(doc);
                        return (
                          <button key={doc} type="button" onClick={() => toggleDoc(idx, doc)}
                            className={`px-2.5 py-1 rounded-full text-xs border transition ${
                              on ? "bg-yo-ac text-white border-yo-ac" : "bg-yo-surface text-yo-txt-2 border-yo-border hover:border-yo-ac"
                            }`}>
                            {on && <Check className="inline h-3 w-3 mr-1" />}
                            {doc}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* Evidencia */}
                  <section>
                    <div className="flex items-center gap-2 mb-2">
                      <Camera className="h-4 w-4 text-yo-ac" />
                      <h4 className="text-sm font-semibold text-yo-txt">Evidencia requerida</h4>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {EVIDENCE_TYPES.map((ev) => {
                        const on = h.evidencia_requerida.includes(ev);
                        return (
                          <button key={ev} type="button" onClick={() => toggleEvidence(idx, ev)}
                            className={`px-2.5 py-1 rounded-full text-xs border transition ${
                              on ? "bg-yo-ac text-white border-yo-ac" : "bg-yo-surface text-yo-txt-2 border-yo-border hover:border-yo-ac"
                            }`}>
                            {on && <Check className="inline h-3 w-3 mr-1" />}
                            {ev}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* Checklist */}
                  <section>
                    <div className="flex items-center gap-2 mb-2">
                      <ClipboardList className="h-4 w-4 text-yo-ac" />
                      <h4 className="text-sm font-semibold text-yo-txt">Checklist operativo</h4>
                    </div>
                    <ChecklistEditor
                      items={checklist[idx] ?? []}
                      onAdd={(t) => addChecklistItem(idx, t)}
                      onRemove={(i) => removeChecklistItem(idx, i)}
                    />
                  </section>

                  {/* Resumen matriz */}
                  <div className="rounded-md bg-yo-raised p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <MiniStat label="Documentos" value={h.documentos_requeridos.length} />
                    <MiniStat label="Evidencia" value={h.evidencia_requerida.length} />
                    <MiniStat label="Checklist" value={(checklist[idx] ?? []).length} />
                    <MiniStat label="Aprueba" value={h.responsable === "PAGADOR" ? "Comprador" : "Vendedor"} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-yo-txt-3">{label}</div>
      <div className="text-yo-txt font-semibold font-mono">{value}</div>
    </div>
  );
}

function ChecklistEditor({ items, onAdd, onRemove }: { items: string[]; onAdd: (t: string) => void; onRemove: (i: number) => void }) {
  const [txt, setTxt] = useState("");
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input value={txt} onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(txt); setTxt(""); } }}
          placeholder="Ej: Mercancía cargada completa"
          className="flex-1 px-3 py-1.5 border border-yo-border rounded-md bg-yo-surface text-sm focus:outline-none focus:ring-2 focus:ring-yo-ac" />
        <button type="button" onClick={() => { onAdd(txt); setTxt(""); }}
          className="px-3 py-1.5 border border-yo-border rounded-md text-xs font-medium text-yo-txt-2 hover:bg-yo-raised">
          Añadir
        </button>
      </div>
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-yo-raised px-2.5 py-1.5">
              <span className="text-xs text-yo-txt-2">☐ {it}</span>
              <button type="button" onClick={() => onRemove(i)} className="text-yo-txt-3 hover:text-yo-err">
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Paso 5: Pago ───────────────────────────────────────────────────────────
function Step5Pago({
  sector, monto, setMonto, metodoPago, setMetodoPago, comisionPagadaPor, setComisionPagadaPor, fee, hitos,
}: {
  sector: SectorId;
  monto: number; setMonto: (n: number) => void;
  metodoPago: "SPEI" | "TARJETA" | "OXXO"; setMetodoPago: (m: "SPEI" | "TARJETA" | "OXXO") => void;
  comisionPagadaPor: "COMPRADOR" | "VENDEDOR"; setComisionPagadaPor: (v: "COMPRADOR" | "VENDEDOR") => void;
  fee: ReturnType<typeof calcularFee> | null;
  hitos: HitoDraft[];
}) {
  const sd = getSector(sector)!;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-yo-txt">Monto y pago</h2>
        <p className="text-sm text-yo-txt-2 mt-0.5">Define monto, comisiones, método de pago y reglas de liberación.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-yo-txt mb-1.5">
          Monto de la operación <span className="text-yo-err">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-yo-txt-3 text-sm font-mono">MXN</span>
          <input type="number" min={100} step={100} value={monto || ""}
            onChange={(e) => setMonto(Number(e.target.value))}
            placeholder="0.00"
            className="w-full pl-14 pr-3 py-3 border border-yo-border rounded-md bg-yo-surface text-2xl font-mono focus:outline-none focus:ring-2 focus:ring-yo-ac" />
        </div>
        <p className="mt-1 text-xs text-yo-txt-3">Rango típico para {sd.titulo}: {sd.monto_tipico}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-yo-txt mb-2">Comisión pagada por</label>
        <div className="grid grid-cols-2 gap-3">
          {(["COMPRADOR", "VENDEDOR"] as const).map((c) => (
            <button key={c} type="button" onClick={() => setComisionPagadaPor(c)}
              className={`p-3 rounded-lg border-2 text-left transition ${
                comisionPagadaPor === c ? "border-yo-ac bg-yo-ac-bg" : "border-yo-border bg-yo-surface hover:border-yo-border-s"
              }`}>
              <div className="text-sm font-medium text-yo-txt">{c === "COMPRADOR" ? "Comprador" : "Vendedor"}</div>
              <div className="text-xs text-yo-txt-3">
                {c === "COMPRADOR" ? "Se suma al total a depositar" : "Se descuenta al liberar"}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-yo-txt mb-2">Método de pago</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {sd.metodos_pago.map((m) => (
            <button key={m} type="button" onClick={() => setMetodoPago(m)}
              className={`p-3 rounded-lg border-2 text-left transition ${
                metodoPago === m ? "border-yo-ac bg-yo-ac-bg" : "border-yo-border bg-yo-surface hover:border-yo-border-s"
              }`}>
              <div className="text-sm font-semibold text-yo-txt">{m}</div>
              <div className="text-xs text-yo-txt-3 mt-0.5">
                {m === "SPEI" ? "Recomendado para operaciones de mayor monto" : m === "TARJETA" ? "Débito o crédito" : "Pago en efectivo"}
              </div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-yo-txt-3">
          El pago será procesado por la pasarela seleccionada. YOKTO no recibe ni custodia directamente los fondos.
        </p>
      </div>

      {/* FeeCalculator */}
      {fee && monto > 0 && (
        <div className="rounded-lg bg-yo-ac-bg border border-[#C7D2FE] p-5 space-y-2">
          <h3 className="text-sm font-semibold text-yo-ac-txt mb-2">Desglose estimado</h3>
          <FeeRow label="Monto protegido" value={fmtMoney(monto)} />
          <FeeRow label={`Comisión servicio${fee.fee_tipo === "FIJO" ? " (fija)" : ""}`} value={fmtMoney(fee.comision_final)} />
          <FeeRow label="IVA comisión (16%)" value={fmtMoney(fee.iva_comision)} />
          <div className="border-t border-[#C7D2FE] pt-2 mt-2">
            <FeeRow label={<span className="font-semibold text-yo-ac-txt">Total a depositar</span>}
              value={<span className="font-mono text-xl font-bold text-yo-ac-txt">{fmtMoney(fee.total_a_depositar)}</span>} />
          </div>
          {fee.descuento_aplicado > 0 && (
            <p className="text-xs text-yo-ok pt-1">Descuento por volumen aplicado: {(fee.descuento_aplicado * 100).toFixed(0)}%.</p>
          )}
        </div>
      )}

      {/* Distribución por hito */}
      {hitos.length > 0 && monto > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-yo-txt mb-2">Distribución por hito</h3>
          <div className="rounded-lg border border-yo-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-yo-raised text-yo-txt-3 text-xs">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Hito</th>
                  <th className="text-right px-3 py-2 font-medium">%</th>
                  <th className="text-right px-3 py-2 font-medium">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-yo-border">
                {hitos.map((h) => (
                  <tr key={h.orden}>
                    <td className="px-3 py-2 text-yo-txt">{h.orden}. {h.titulo}</td>
                    <td className="px-3 py-2 text-right font-mono text-yo-txt-2">{Number(h.monto_porcentaje).toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right font-mono text-yo-txt">{fmtMoney(monto * (Number(h.monto_porcentaje) / 100))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-yo-raised">
                <tr>
                  <td className="px-3 py-2 font-semibold text-yo-txt">Total</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">100%</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{fmtMoney(monto)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function FeeRow({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-yo-txt-2">{label}</span>
      <span className="font-mono text-yo-txt">{value}</span>
    </div>
  );
}

// ─── Paso 6: Revisión ───────────────────────────────────────────────────────
function Step6Revision(props: {
  numero: string | null; rol: Rol;
  sectorDef: ReturnType<typeof getSector>; sectorCfg?: typeof SECTOR_CFG[SectorId];
  subtipo: string; descripcion: string; fechaInicio: string; fechaFin: string;
  contraparte: Contraparte | null; hitos: HitoDraft[]; monto: number;
  metodoPago: string; comisionPagadaPor: string;
  fee: ReturnType<typeof calcularFee> | null;
  aceptaTerminos: boolean; setAceptaTerminos: (v: boolean) => void;
  aceptaRetencion: boolean; setAceptaRetencion: (v: boolean) => void;
  aceptaCumplimiento: boolean; setAceptaCumplimiento: (v: boolean) => void;
  aceptaTraza: boolean; setAceptaTraza: (v: boolean) => void;
}) {
  const {
    numero, rol, sectorDef, sectorCfg, subtipo, descripcion, fechaInicio, fechaFin,
    contraparte, hitos, monto, metodoPago, comisionPagadaPor, fee,
    aceptaTerminos, setAceptaTerminos, aceptaRetencion, setAceptaRetencion,
    aceptaCumplimiento, setAceptaCumplimiento, aceptaTraza, setAceptaTraza,
  } = props;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-yo-txt">Revisión y activación</h2>
        <p className="text-sm text-yo-txt-2 mt-0.5">Verifica el resumen y acepta las declaraciones para activar la operación.</p>
      </div>

      {numero && (
        <div className="rounded-lg bg-yo-raised border border-yo-border p-3">
          <div className="text-xs text-yo-txt-3">Folio interno</div>
          <div className="font-mono text-sm text-yo-txt">{numero}</div>
        </div>
      )}

      <ReviewSection title="Resumen general">
        <ReviewGrid rows={[
          ["Sector", <span key="s">{sectorCfg?.emoji} {sectorDef?.titulo}</span>],
          ["Subtipo", subtipo || "—"],
          ["Descripción", <span key="d" className="text-sm whitespace-pre-wrap">{descripcion}</span>, true],
          ["Fechas estimadas", `${fechaInicio || "—"} → ${fechaFin || "—"}`],
        ]} />
      </ReviewSection>

      <ReviewSection title="Partes">
        <ReviewGrid rows={[
          ["Creador", rol === "PAGADOR" ? "Comprador (Pagador)" : "Vendedor (Beneficiario)"],
          ["Contraparte", <span key="c">
            <div className="font-medium text-yo-txt">{contraparte?.nombre}</div>
            <div className="text-xs text-yo-txt-3 font-mono">{contraparte?.email}{contraparte?.rfc ? ` · ${contraparte.rfc}` : ""}</div>
          </span>],
          ["Estado", contraparte?.user_id
            ? <Badge tone="ok" dot>Usuario YOKTO</Badge>
            : <Badge tone="warn" dot>Por invitar</Badge>],
        ]} />
      </ReviewSection>

      <ReviewSection title={`Hitos y liberaciones (${hitos.length})`}>
        <div className="rounded-md border border-yo-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-yo-raised text-yo-txt-3 text-xs">
              <tr>
                <th className="text-left px-3 py-2 font-medium">#</th>
                <th className="text-left px-3 py-2 font-medium">Hito</th>
                <th className="text-left px-3 py-2 font-medium">Fecha</th>
                <th className="text-right px-3 py-2 font-medium">%</th>
                <th className="text-left px-3 py-2 font-medium">Validación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yo-border">
              {hitos.map((h) => (
                <tr key={h.orden}>
                  <td className="px-3 py-2 font-mono text-yo-txt-3">{h.orden}</td>
                  <td className="px-3 py-2 text-yo-txt">{h.titulo}</td>
                  <td className="px-3 py-2 text-yo-txt-2 font-mono text-xs">{h.fecha_limite}</td>
                  <td className="px-3 py-2 text-right font-mono">{Number(h.monto_porcentaje).toFixed(2)}%</td>
                  <td className="px-3 py-2"><Badge tone="neutral" dot>{h.tipo_verificacion}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReviewSection>

      <ReviewSection title="Cumplimiento">
        <ReviewGrid rows={[
          ["Documentos totales", String(hitos.reduce((s, h) => s + h.documentos_requeridos.length, 0))],
          ["Evidencias totales", String(hitos.reduce((s, h) => s + h.evidencia_requerida.length, 0))],
          ["Impacto en Perfil de Cumplimiento", "Sí"],
        ]} />
      </ReviewSection>

      <ReviewSection title="Pago">
        <ReviewGrid rows={[
          ["Monto operación", <span key="m" className="font-mono">{fmtMoney(monto)}</span>],
          ["Comisión + IVA", <span key="c" className="font-mono">{fmtMoney((fee?.comision_final ?? 0) + (fee?.iva_comision ?? 0))}</span>],
          ["Total a depositar", <span key="t" className="font-mono font-bold text-yo-ac-txt">{fmtMoney(fee?.total_a_depositar ?? 0)}</span>],
          ["Método de pago", metodoPago],
          ["Comisión pagada por", comisionPagadaPor === "COMPRADOR" ? "Comprador" : "Vendedor"],
        ]} />
      </ReviewSection>

      <ReviewSection title="Aceptaciones">
        <div className="space-y-2">
          <Check3 checked={aceptaTerminos} onChange={setAceptaTerminos}
            label="He revisado las condiciones de la operación." />
          <Check3 checked={aceptaCumplimiento} onChange={setAceptaCumplimiento}
            label="Entiendo que la liberación depende del cumplimiento de los hitos y evidencia configurada." />
          <Check3 checked={aceptaRetencion} onChange={setAceptaRetencion}
            label="Entiendo que los fondos son procesados y retenidos por la pasarela de pago, no por YOKTO." />
          <Check3 checked={aceptaTraza} onChange={setAceptaTraza}
            label="Acepto los términos de operación y autorización de trazabilidad." />
        </div>
      </ReviewSection>

      <div className="rounded-lg bg-yo-info-bg border border-[#BAE6FD] p-4 flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 text-yo-info shrink-0 mt-0.5" />
        <p className="text-xs text-yo-txt-2">
          YOKTO no custodia fondos. El pago es procesado y retenido por una pasarela certificada. YOKTO registra
          condiciones, evidencia y eventos para ordenar liberación o devolución conforme a la operación.
        </p>
      </div>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-yo-txt-3 mb-2">{title}</h3>
      {children}
    </section>
  );
}

function ReviewGrid({ rows }: { rows: Array<[string, React.ReactNode] | [string, React.ReactNode, boolean]> }) {
  return (
    <dl className="rounded-lg border border-yo-border divide-y divide-yo-border">
      {rows.map(([label, value, wide], i) => (
        <div key={i} className={`px-4 py-2.5 ${wide ? "block" : "grid grid-cols-1 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)] gap-2"}`}>
          <dt className={`text-xs text-yo-txt-3 ${wide ? "mb-1" : ""}`}>{label}</dt>
          <dd className="text-sm text-yo-txt">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Check3({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded hover:bg-yo-raised">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 rounded border-yo-border text-yo-ac focus:ring-yo-ac" />
      <span className="text-sm text-yo-txt">{label}</span>
    </label>
  );
}

// ─── Modal de activación ────────────────────────────────────────────────────
function ActivationModal({ rol, firmando, onClose, onConfirm }: {
  rol: Rol; firmando: boolean; onClose: () => void; onConfirm: () => void;
}) {
  const isBuyer = rol === "PAGADOR";
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !firmando) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, firmando]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={firmando ? undefined : onClose}>
      <div ref={modalRef} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-yo-surface rounded-xl border border-yo-border shadow-xl overflow-hidden">
        <div className="p-5 border-b border-yo-border">
          <h3 className="text-lg font-semibold text-yo-txt">
            {isBuyer ? "Activar operación protegida" : "Enviar propuesta al comprador"}
          </h3>
          <p className="mt-1 text-sm text-yo-txt-2">
            {isBuyer
              ? "Se registrarán las condiciones, hitos, documentos y reglas de liberación. La contraparte recibirá una invitación para revisar y aceptar."
              : "El comprador recibirá la propuesta y deberá aceptarla, completar su verificación mínima y fondear la operación para iniciar el cumplimiento."}
          </p>
        </div>
        <div className="p-5">
          <div className="rounded-lg bg-yo-info-bg border border-[#BAE6FD] p-3 flex items-start gap-2">
            <Info className="h-4 w-4 text-yo-info shrink-0 mt-0.5" />
            <p className="text-xs text-yo-txt-2">
              YOKTO no custodia fondos. La retención y liberación se realiza mediante la pasarela de pago integrada
              conforme a las reglas aceptadas por las partes.
            </p>
          </div>
        </div>
        <div className="p-4 bg-yo-raised border-t border-yo-border flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={firmando}
            className="px-4 py-2 border border-yo-border rounded-md text-sm font-medium text-yo-txt-2 hover:bg-yo-surface disabled:opacity-40">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={firmando}
            className="px-5 py-2 bg-yo-ac text-white text-sm font-semibold rounded-md hover:bg-yo-ac-h disabled:opacity-40">
            {firmando ? "Procesando…" : isBuyer ? "Activar operación" : "Enviar propuesta"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pantalla de éxito ──────────────────────────────────────────────────────
function SuccessScreen({
  rol, numero, activated, contraparte, onGoTransactions, onGoPayments,
}: {
  rol: Rol; numero: string | null; activated: boolean; contraparte: Contraparte | null;
  onGoTransactions: () => void; onGoPayments: () => void;
}) {
  const isBuyer = rol === "PAGADOR";
  return (
    <div className="min-h-screen bg-yo-bg flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-yo-surface rounded-xl border border-yo-border shadow-sm p-8 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-yo-ok-bg flex items-center justify-center">
          <Check className="h-7 w-7 text-yo-ok" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-yo-txt">
          {isBuyer ? "Operación creada correctamente" : "Operación enviada al comprador"}
        </h2>
        {numero && <p className="mt-1 text-sm font-mono text-yo-txt-3">{numero}</p>}
        <p className="mt-3 text-sm text-yo-txt-2">
          {isBuyer
            ? (activated
                ? "Ahora puedes invitar a la contraparte y continuar con el fondeo mediante la pasarela seleccionada."
                : `Enviamos una invitación a ${contraparte?.email ?? "la contraparte"}. La operación queda en pendiente hasta que acepte y firme.`)
            : "El comprador deberá revisar, aceptar y fondear la operación para iniciar el cumplimiento."}
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          {isBuyer ? (
            <>
              <button onClick={onGoPayments}
                className="px-5 py-2 bg-yo-ac text-white text-sm font-semibold rounded-md hover:bg-yo-ac-h">
                Ir a Centro de Pagos
              </button>
              <button onClick={onGoTransactions}
                className="px-5 py-2 border border-yo-border rounded-md text-sm font-medium text-yo-txt-2 hover:bg-yo-raised">
                Ver operación
              </button>
            </>
          ) : (
            <>
              <button onClick={onGoTransactions}
                className="px-5 py-2 bg-yo-ac text-white text-sm font-semibold rounded-md hover:bg-yo-ac-h">
                Ver operación
              </button>
              <button onClick={() => window.location.reload()}
                className="px-5 py-2 border border-yo-border rounded-md text-sm font-medium text-yo-txt-2 hover:bg-yo-raised">
                Crear otra operación
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
