import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import {
  X, Check, AlertTriangle, Info, Upload, FileText, Paperclip, Lock,
  FileCheck, ShieldAlert, ArrowLeft,
} from "lucide-react";
import { z } from "zod";
import { REASON_LABEL, type DisputeReason } from "@/lib/disputes-mock";
import { useViewRole } from "@/hooks/use-view-role";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  tx: z.string().optional(),
  hito: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/disputes/new")({
  head: () => ({ meta: [{ title: "Abrir disputa — CUMPLEX" }, { name: "robots", content: "noindex" }] }),
  validateSearch: (s) => searchSchema.parse(s),
  component: NewDisputePage,
});

const OP_NUMERO = "OP2607200001";
const OP_TITLE = "Flete Mazatlán → Monterrey";
const HITO_LABEL = "Entrega en destino";
const DISPUTABLE_CENTS = 120_000_000; // $1,200,000
const DEPOSIT_PCT = 2;
const DEPOSIT_MIN = 50_000;
const DEPOSIT_MAX = 5_000_000;

const money = (c: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(c / 100);

const REASONS: { key: DisputeReason; title: string; desc: string; icon: string }[] = [
  { key: "NON_DELIVERY",              title: "Incumplimiento de hito",          desc: "El hito no se cumplió según lo pactado.",                       icon: "⚠️" },
  { key: "DOCUMENT_REJECTED",         title: "Documentos inválidos",            desc: "CFDI, contrato, Carta Porte, BL u otro documento no es correcto.", icon: "📄" },
  { key: "PARTIAL_DELIVERY",          title: "Mercancía / avance incompleto",   desc: "Faltan piezas, cantidad o especificaciones acordadas.",         icon: "📦" },
  { key: "QUALITY_ISSUE",             title: "Calidad insuficiente",            desc: "El resultado no cumple el estándar acordado.",                  icon: "🔍" },
  { key: "LATE_DELIVERY",             title: "Plazo vencido",                   desc: "Se superó la fecha límite sin cumplimiento.",                   icon: "⏱️" },
  { key: "EVIDENCE_INSUFFICIENT",     title: "Rechazo injustificado",           desc: "Un hito fue rechazado sin motivo válido o suficiente.",         icon: "🚫" },
  { key: "PAYMENT_RELEASE_OBJECTION", title: "Desacuerdo de liberación",        desc: "Existe desacuerdo sobre liberar, retener o devolver fondos.",   icon: "💳" },
  { key: "REFUND_REQUEST",            title: "Documento fiscal incorrecto",     desc: "CFDI PPD, REP, forma de pago o parcialidad no coincide.",       icon: "🧾" },
  { key: "OTHER",                     title: "Otro motivo",                     desc: "Ninguna de las opciones anteriores describe la situación.",     icon: "•" },
];

const DESC_HELPER: Record<DisputeReason, string> = {
  NON_DELIVERY: "Describe qué se pactó, qué se recibió y las fechas relevantes.",
  DOCUMENT_REJECTED: "Indica qué documento es incorrecto, cuál era el dato esperado y cuál el recibido.",
  PARTIAL_DELIVERY: "Detalla qué se pidió, qué llegó y adjunta cantidades o especificaciones si las tienes.",
  QUALITY_ISSUE: "Explica qué estándar se acordó y por qué el resultado no lo cumple.",
  LATE_DELIVERY: "Menciona la fecha límite pactada y cuántos días han pasado sin cumplimiento.",
  EVIDENCE_INSUFFICIENT: "Explica qué evidencia presentaste y por qué consideras que el rechazo no corresponde.",
  PAYMENT_RELEASE_OBJECTION: "Describe qué monto está en desacuerdo y qué liberación o devolución esperas.",
  REFUND_REQUEST: "Indica el UUID, tipo de documento fiscal y qué dato no coincide con la operación.",
  OTHER: "Describe lo sucedido con fechas, personas involucradas y el impacto en la operación.",
};

const STEPS = ["Motivo", "Descripción", "Evidencia", "Confirmar"] as const;

const MAX_FILES = 6;
const MAX_MB = 15;
const ACCEPTED = ".jpg,.jpeg,.png,.pdf,.xml,.mp4,.mov";

function NewDisputePage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/disputes/new" });
  const { role } = useViewRole();

  const [step, setStep] = useState(0);
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [description, setDescription] = useState("");
  const [expected, setExpected] = useState("");
  const [received, setReceived] = useState("");
  const [hitoId] = useState(search.hito ?? "hito-2");
  const [files, setFiles] = useState<File[]>([]);
  const [accept, setAccept] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deposit = useMemo(() => {
    const raw = Math.round(DISPUTABLE_CENTS * (DEPOSIT_PCT / 100));
    return Math.min(Math.max(raw, DEPOSIT_MIN), DEPOSIT_MAX);
  }, []);

  const canNext = useMemo(() => {
    if (step === 0) return !!reason;
    if (step === 1) return description.trim().length >= 100 && description.length <= 3000;
    if (step === 2) return true;
    if (step === 3) return accept;
    return false;
  }, [step, reason, description, accept]);

  const opNumero = search.tx ?? OP_NUMERO;

  const close = () => {
    if (search.tx) navigate({ to: "/disputes" });
    else navigate({ to: "/disputes" });
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 900));
      navigate({ to: "/disputes" });
    } catch {
      setError("No se pudo abrir la disputa. Conserva la información capturada e intenta nuevamente.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F8F8FB]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[#EBEBF0] bg-white px-5 py-4">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[12px] text-[#A1A1AA]">{opNumero}</p>
            <h1 className="text-xl font-semibold text-[#18181B]">Abrir disputa</h1>
            <p className="mt-0.5 text-sm text-[#52525B]">Operación: {OP_TITLE}</p>
          </div>
          <button
            onClick={close}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[#71717A] hover:bg-[#F4F4F7]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Stepper */}
        <div className="mx-auto mt-4 flex max-w-3xl items-center gap-2">
          {STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <div key={label} className="flex flex-1 items-center gap-2">
                <div
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
                    done && "bg-[#18181B] text-white",
                    active && "bg-[#4F46E5] text-white ring-4 ring-[#4F46E5]/15",
                    !done && !active && "border border-[#EBEBF0] bg-white text-[#A1A1AA]"
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={cn("text-xs", active ? "font-medium text-[#18181B]" : "text-[#71717A]")}>
                  {label}
                </span>
                {i < STEPS.length - 1 && <div className="h-px flex-1 bg-[#EBEBF0]" />}
              </div>
            );
          })}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <section className="overflow-hidden rounded-[12px] border border-[#EBEBF0] bg-white shadow-[0_1px_2px_rgb(0_0_0/.04)]">
            {step === 0 && (
              <StepReason reason={reason} onSelect={setReason} role={role} />
            )}
            {step === 1 && reason && (
              <StepDescription
                reason={reason}
                hitoId={hitoId}
                description={description}
                onDescription={setDescription}
                expected={expected}
                onExpected={setExpected}
                received={received}
                onReceived={setReceived}
              />
            )}
            {step === 2 && reason && (
              <StepEvidence reason={reason} files={files} setFiles={setFiles} />
            )}
            {step === 3 && reason && (
              <StepConfirm
                reason={reason}
                filesCount={files.length}
                deposit={deposit}
                accept={accept}
                onAccept={setAccept}
                error={error}
              />
            )}
          </section>
        </div>
      </main>

      {/* Footer nav */}
      <footer className="sticky bottom-0 border-t border-[#EBEBF0] bg-white px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <button
            onClick={() => (step === 0 ? close() : setStep(step - 1))}
            className="inline-flex items-center gap-1.5 rounded-[8px] px-3 py-2 text-sm text-[#52525B] hover:bg-[#F4F4F7]"
          >
            <ArrowLeft className="h-4 w-4" />
            {step === 0 ? "Cancelar" : "Regresar"}
          </button>

          {step < 3 ? (
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={() => canNext && setStep(step + 1)}
                disabled={!canNext}
                className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#4F46E5] px-4 py-2 text-sm font-medium text-white hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continuar →
              </button>
              {!canNext && step === 0 && (
                <span className="text-[11px] text-[#A1A1AA]">Selecciona un motivo para continuar.</span>
              )}
              {!canNext && step === 1 && (
                <span className="text-[11px] text-[#A1A1AA]">Mínimo 100 caracteres para continuar.</span>
              )}
            </div>
          ) : (
            <button
              onClick={submit}
              disabled={!canNext || submitting}
              aria-label={`Pagar ${money(deposit)} y abrir disputa`}
              className="inline-flex items-center gap-2 rounded-[8px] bg-[#DC2626] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {submitting ? "Procesando…" : `Pagar ${money(deposit)} y abrir disputa`}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

// -------------------------------------------------------------------------
// STEP 1 — Motivo
// -------------------------------------------------------------------------
function StepReason({
  reason, onSelect, role,
}: { reason: DisputeReason | null; onSelect: (r: DisputeReason) => void; role: "buyer" | "seller" }) {
  return (
    <div className="p-5">
      <h2 className="text-base font-semibold text-[#18181B]">¿Cuál es el motivo principal de la disputa?</h2>
      <p className="mt-1 text-sm text-[#52525B]">
        Selecciona el caso que mejor describa el problema. Podrás agregar detalles y evidencia en los pasos siguientes.
      </p>

      <div className="mt-4 space-y-2">
        {REASONS.map((r) => {
          const selected = reason === r.key;
          return (
            <button
              key={r.key}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(r.key)}
              className={cn(
                "flex w-full items-start gap-3 rounded-[10px] border p-4 text-left transition-colors",
                selected
                  ? "border-[1.5px] border-[#4F46E5] bg-[#EEF2FF]"
                  : "border-[#EBEBF0] bg-white hover:border-[#D8D8E0] hover:bg-[#F4F4F7]"
              )}
            >
              <span className="text-lg leading-none">{r.icon}</span>
              <div className="flex-1">
                <div className={cn("text-sm font-medium", selected ? "text-[#3730A3]" : "text-[#18181B]")}>
                  {r.title}
                </div>
                <div className="mt-0.5 text-xs text-[#52525B]">{r.desc}</div>
              </div>
              {selected && <Check className="h-4 w-4 text-[#4F46E5]" />}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] text-[#A1A1AA]">
        Estás abriendo la disputa como {role === "buyer" ? "comprador" : "vendedor"} de esta operación.
      </p>
    </div>
  );
}

// -------------------------------------------------------------------------
// STEP 2 — Descripción
// -------------------------------------------------------------------------
function StepDescription({
  reason, hitoId, description, onDescription, expected, onExpected, received, onReceived,
}: {
  reason: DisputeReason;
  hitoId: string;
  description: string; onDescription: (v: string) => void;
  expected: string; onExpected: (v: string) => void;
  received: string; onReceived: (v: string) => void;
}) {
  const len = description.length;
  const enough = len >= 100;

  return (
    <div className="p-5">
      <h2 className="text-base font-semibold text-[#18181B]">Describe lo sucedido</h2>
      <p className="mt-1 text-sm text-[#52525B]">{DESC_HELPER[reason]}</p>

      <div className="mt-4 space-y-4">
        <Field label="Hito relacionado">
          <select
            defaultValue={hitoId}
            className={inputCls}
          >
            <option value="hito-1">Hito 1 · Confirmación de recolección</option>
            <option value="hito-2">Hito 2 · {HITO_LABEL}</option>
            <option value="hito-3">Hito 3 · Cierre y CFDI</option>
          </select>
        </Field>

        <Field label="Descripción">
          <textarea
            value={description}
            onChange={(e) => onDescription(e.target.value.slice(0, 3000))}
            rows={5}
            placeholder="Escribe aquí los detalles del problema, fechas y personas involucradas."
            className={cn(inputCls, "resize-y")}
            aria-describedby="desc-counter"
          />
          <div id="desc-counter" className="mt-1 flex items-center justify-between">
            <span className={cn("text-[11px]", enough ? "text-[#059669]" : "text-[#A1A1AA]")}>
              {enough ? "✓ Descripción suficiente" : "Mínimo 100 caracteres"}
            </span>
            <span className="font-mono text-[11px] text-[#A1A1AA]">{len}/3000</span>
          </div>
        </Field>

        <Field label="Resultado esperado (opcional)">
          <input
            value={expected}
            onChange={(e) => onExpected(e.target.value.slice(0, 500))}
            placeholder="Lo que debía ocurrir según lo pactado."
            className={inputCls}
          />
        </Field>

        <Field label="Resultado recibido (opcional)">
          <input
            value={received}
            onChange={(e) => onReceived(e.target.value.slice(0, 500))}
            placeholder="Lo que realmente ocurrió o recibiste."
            className={inputCls}
          />
        </Field>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// STEP 3 — Evidencia
// -------------------------------------------------------------------------
const EVIDENCE_SUGGESTED: Record<DisputeReason, string[]> = {
  NON_DELIVERY: ["Fotos o video", "Checklist de entrega", "Contrato / anexo", "Evidencia de recepción"],
  DOCUMENT_REJECTED: ["Documento cuestionado (PDF / XML)", "Comparativo esperado vs recibido", "Validación SAT si aplica"],
  PARTIAL_DELIVERY: ["Fotos del faltante", "Lista de empaque", "Pedido original", "Acta de recepción"],
  QUALITY_ISSUE: ["Fotos o video", "Reporte técnico", "Checklist / estándares", "Contrato / anexo"],
  LATE_DELIVERY: ["Cronograma pactado", "Mensajes o correos", "Fecha límite contractual"],
  EVIDENCE_INSUFFICIENT: ["Evidencia originalmente subida", "Comentarios del rechazo", "Checklist cumplido"],
  PAYMENT_RELEASE_OBJECTION: ["Hito relacionado", "Reglas de liberación", "Historial de aprobaciones"],
  REFUND_REQUEST: ["XML CFDI / REP", "UUID relacionado", "Validación SAT", "Parcialidad esperada"],
  OTHER: ["Cualquier documento o imagen que ayude a explicar la situación"],
};

function StepEvidence({
  reason, files, setFiles,
}: { reason: DisputeReason; files: File[]; setFiles: (f: File[]) => void }) {
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const incoming = Array.from(list);
    const merged = [...files];
    for (const f of incoming) {
      if (merged.length >= MAX_FILES) {
        setErr("Solo puedes adjuntar hasta 6 archivos al abrir la disputa.");
        break;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        setErr(`El archivo "${f.name}" supera el límite de ${MAX_MB}MB.`);
        continue;
      }
      const ok = /\.(jpe?g|png|pdf|xml|mp4|mov)$/i.test(f.name);
      if (!ok) {
        setErr(`El archivo "${f.name}" no está permitido. Usa JPG, PNG, PDF, XML, MP4 o MOV.`);
        continue;
      }
      merged.push(f);
    }
    setFiles(merged);
  };

  const remove = (i: number) => setFiles(files.filter((_, idx) => idx !== i));

  return (
    <div className="p-5">
      <h2 className="text-base font-semibold text-[#18181B]">Evidencia</h2>
      <p className="mt-1 text-sm text-[#52525B]">
        Puedes continuar sin evidencia, pero agregarla ayuda a revisar el caso con mayor claridad.
      </p>

      <div className="mt-4 rounded-[10px] border border-[#EBEBF0] bg-[#F0F9FF] px-3 py-2.5">
        <div className="flex items-start gap-2 text-[#075985]">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="text-xs">
            <div className="font-medium">Evidencia sugerida para este motivo</div>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[#0C4A6E]">
              {EVIDENCE_SUGGESTED[reason].map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
        </div>
      </div>

      {/* Linked existing evidence */}
      <div className="mt-4 rounded-[10px] border border-[#EBEBF0] bg-white p-3">
        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wide text-[#71717A]">
          <FileCheck className="h-3.5 w-3.5" /> Evidencia vinculada del hito
        </div>
        <ul className="space-y-1 text-xs text-[#52525B]">
          <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#059669]" /> Carta Porte 2.0 (PDF)</li>
          <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#059669]" /> Foto de descarga</li>
          <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#059669]" /> Firma del receptor</li>
        </ul>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "mt-4 cursor-pointer rounded-[10px] border-2 border-dashed px-4 py-8 text-center transition",
          drag ? "border-[#4F46E5] bg-[#EEF2FF]" : "border-[#EBEBF0] bg-white hover:bg-[#F4F4F7]"
        )}
      >
        <Upload className="mx-auto h-5 w-5 text-[#71717A]" />
        <p className="mt-2 text-sm text-[#52525B]">Arrastra o haz clic para agregar archivos</p>
        <p className="mt-1 text-[11px] text-[#A1A1AA]">JPG · PNG · PDF · XML · MP4 · MOV — máx {MAX_MB}MB · hasta {MAX_FILES} archivos</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => add(e.target.files)}
        />
      </div>

      {err && (
        <div role="alert" className="mt-3 rounded-[8px] border border-[#DC2626]/20 bg-[#FEF2F2] px-3 py-2 text-xs text-[#DC2626]">
          {err}
        </div>
      )}

      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-[8px] border border-[#EBEBF0] bg-white px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <Paperclip className="h-3.5 w-3.5 text-[#71717A]" />
                <span className="truncate text-xs text-[#18181B]">{f.name}</span>
                <span className="font-mono text-[10px] text-[#A1A1AA]">{(f.size / 1024).toFixed(0)} KB</span>
              </div>
              <button onClick={() => remove(i)} aria-label={`Eliminar ${f.name}`} className="rounded p-1 text-[#71717A] hover:bg-[#F4F4F7]">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// STEP 4 — Confirmar
// -------------------------------------------------------------------------
function StepConfirm({
  reason, filesCount, deposit, accept, onAccept, error,
}: {
  reason: DisputeReason; filesCount: number; deposit: number;
  accept: boolean; onAccept: (v: boolean) => void; error: string | null;
}) {
  return (
    <div className="p-5">
      <h2 className="text-base font-semibold text-[#18181B]">Revisa antes de continuar</h2>
      <p className="mt-1 text-sm text-[#52525B]">Esta acción notifica de inmediato a la contraparte.</p>

      <dl className="mt-4 divide-y divide-[#EBEBF0] rounded-[10px] border border-[#EBEBF0] bg-white text-sm">
        <Row k="Transacción" v={OP_NUMERO} mono />
        <Row k="Hito relacionado" v={HITO_LABEL} />
        <Row k="Motivo" v={REASON_LABEL[reason]} />
        <Row k="Archivos adjuntos" v={String(filesCount)} />
      </dl>

      <div className="mt-4 rounded-[10px] border border-[#EBEBF0] bg-[#F4F4F7] p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#52525B]">Monto disputable</span>
          <span className="font-mono text-sm font-semibold text-[#18181B]">{money(DISPUTABLE_CENTS)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-sm text-[#52525B]">Depósito de seriedad ({DEPOSIT_PCT}%)</span>
          <span className="font-mono text-sm font-semibold text-[#18181B]">{money(deposit)}</span>
        </div>
        <p className="mt-3 text-xs text-[#52525B]">
          Se reembolsa si la resolución te favorece. Puede aplicarse a la contraparte si la resolución no te favorece.
        </p>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-[10px] border border-[#D97706]/25 bg-[#FFFBEB] p-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#D97706]" />
        <p className="text-xs text-[#78350F]">
          La operación se bloquea para nuevas aprobaciones y liberaciones del hito disputado hasta resolver la disputa.
        </p>
      </div>

      <label className="mt-4 flex items-start gap-2 rounded-[8px] border border-[#EBEBF0] bg-white p-3 text-xs text-[#52525B]">
        <input
          type="checkbox"
          checked={accept}
          onChange={(e) => onAccept(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Entiendo que se cobrará un depósito de <span className="font-mono font-semibold text-[#18181B]">{money(deposit)}</span> y acepto los términos de apertura de disputa.
        </span>
      </label>

      {error && (
        <div role="alert" className="mt-3 flex items-start gap-2 rounded-[8px] border border-[#DC2626]/20 bg-[#FEF2F2] px-3 py-2 text-xs text-[#DC2626]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5" /> {error}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Shared UI
// -------------------------------------------------------------------------
const inputCls =
  "w-full rounded-[8px] border border-[#EBEBF0] bg-white px-3 py-2 text-sm text-[#18181B] placeholder:text-[#A1A1AA] focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/15";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[#52525B]">{label}</span>
      {children}
    </label>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <dt className="text-xs text-[#71717A]">{k}</dt>
      <dd className={cn("text-sm text-[#18181B]", mono && "font-mono")}>{v}</dd>
    </div>
  );
}
