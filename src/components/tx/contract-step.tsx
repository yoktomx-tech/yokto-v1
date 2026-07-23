// Paso "Contrato" del wizard de creación de operación protegida.
// UI-first: método de contrato (subir PDF o generar), plantilla, métodos
// de firma por parte, canvas de firma autógrafa, y placeholder de e.firma.
// El bloque legal Cumplex se incluye siempre en los contratos generados.

import { useMemo, useRef, useState } from "react";
import {
  FileText, Upload, Sparkles, CheckCircle2, ShieldCheck, PenLine, KeyRound,
  AlertTriangle, Eye, Trash2, Info,
} from "lucide-react";
import type { SectorId } from "@/lib/sectors";
import {
  type ContractState, type ContractMethod, type SignatureMethod,
  templatesForSector, recommendedTemplate, Cumplex_LEGAL_BLOCK, sha256Hex,
  suggestSignatureMethod,
} from "@/lib/contract-catalog";

type Props = {
  sector: SectorId;
  monto: number;
  descripcion: string;
  contraparteNombre: string | null;
  creatorRoleLabel: string;
  state: ContractState;
  setState: (s: ContractState) => void;
};

export function ContractStep({
  sector, monto, descripcion, contraparteNombre, creatorRoleLabel, state, setState,
}: Props) {
  const templates = useMemo(() => templatesForSector(sector), [sector]);
  const suggested = useMemo(() => suggestSignatureMethod(sector, monto), [sector, monto]);

  function setMethod(m: ContractMethod) {
    const patch: Partial<ContractState> = { method: m };
    if (m === "GENERATED" && !state.templateKey) {
      patch.templateKey = recommendedTemplate(sector).key;
    }
    if (!state.buyerSignatureMethod) patch.buyerSignatureMethod = suggested;
    if (!state.sellerSignatureMethod) patch.sellerSignatureMethod = suggested;
    setState({ ...state, ...patch });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-yo-txt">Contrato</h2>
        <p className="text-sm text-yo-txt-2 mt-0.5">
          Puedes subir un contrato firmado o generar uno automáticamente con los datos de la operación.
        </p>
      </div>

      {/* Método selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MethodCard
          active={state.method === "UPLOADED_PDF"}
          onClick={() => setMethod("UPLOADED_PDF")}
          icon={<Upload className="h-5 w-5" />}
          title="Subir contrato PDF"
          descripcion="Ya tengo un contrato preparado."
        />
        <MethodCard
          active={state.method === "GENERATED"}
          onClick={() => setMethod("GENERATED")}
          icon={<Sparkles className="h-5 w-5" />}
          title="Generar contrato Cumplex"
          descripcion="Crearlo con los datos capturados en el wizard."
        />
      </div>

      {state.method === "UPLOADED_PDF" && (
        <UploadPanel state={state} setState={setState} />
      )}

      {state.method === "GENERATED" && (
        <GeneratedPanel
          state={state}
          setState={setState}
          templates={templates}
          sector={sector}
          descripcion={descripcion}
          contraparteNombre={contraparteNombre}
          creatorRoleLabel={creatorRoleLabel}
          monto={monto}
        />
      )}

      {state.method && state.requiresCumplexSignature && (
        <SignatureConfigPanel state={state} setState={setState} suggested={suggested} />
      )}

      <div className="rounded-lg bg-yo-info-bg border border-[#BAE6FD] p-3 flex items-start gap-2">
        <Info className="h-4 w-4 text-yo-info shrink-0 mt-0.5" />
        <p className="text-xs text-yo-txt-2">
          Cumplex no sustituye asesoría legal. El contrato generado es una plantilla operativa basada en la información
          registrada por las partes. Las partes son responsables de revisar y aceptar su contenido antes de firmar.
        </p>
      </div>
    </div>
  );
}

// ─── Method card ────────────────────────────────────────────────────────────
function MethodCard({
  active, onClick, icon, title, descripcion,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; title: string; descripcion: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-4 rounded-lg border-2 transition ${
        active
          ? "border-yo-ac bg-yo-ac-bg shadow-sm"
          : "border-yo-border bg-yo-surface hover:border-yo-border-s"
      }`}
    >
      <div className={`inline-flex items-center justify-center h-9 w-9 rounded-md ${active ? "bg-yo-ac text-white" : "bg-yo-raised text-yo-txt-2"}`}>
        {icon}
      </div>
      <div className="mt-2 text-sm font-semibold text-yo-txt">{title}</div>
      <div className="mt-0.5 text-xs text-yo-txt-2">{descripcion}</div>
    </button>
  );
}

// ─── Upload PDF ─────────────────────────────────────────────────────────────
function UploadPanel({ state, setState }: { state: ContractState; setState: (s: ContractState) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(file: File) {
    setErr(null);
    if (file.type !== "application/pdf") { setErr("Solo se admiten archivos PDF."); return; }
    if (file.size > 25 * 1024 * 1024) { setErr("Tamaño máximo: 25 MB."); return; }
    setProcessing(true);
    try {
      const buf = await file.arrayBuffer();
      const hash = await sha256Hex(buf);
      setState({
        ...state,
        pdfName: file.name,
        pdfSize: file.size,
        pdfHash: hash,
        title: state.title || file.name.replace(/\.pdf$/i, ""),
      });
    } catch (e) {
      setErr((e as Error).message ?? "No pudimos procesar el PDF.");
    } finally {
      setProcessing(false);
    }
  }

  const kb = state.pdfSize ? (state.pdfSize / 1024).toFixed(0) : null;

  return (
    <section className="space-y-4">
      {!state.pdfHash ? (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          className="rounded-lg border-2 border-dashed border-yo-border bg-yo-raised p-8 text-center cursor-pointer hover:border-yo-ac hover:bg-yo-ac-bg transition"
        >
          <Upload className="h-8 w-8 text-yo-txt-3 mx-auto" />
          <p className="mt-2 text-sm font-medium text-yo-txt">Arrastra tu PDF aquí o haz clic para seleccionar</p>
          <p className="text-xs text-yo-txt-3 mt-1">Formato: PDF · Máximo 25 MB · Sin contraseña</p>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-yo-border bg-yo-surface p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-md bg-yo-ac-bg text-yo-ac-txt flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-yo-txt truncate">{state.pdfName}</div>
              <div className="text-xs text-yo-txt-3 font-mono truncate">{kb} KB · sha256:{state.pdfHash?.slice(0, 12)}…</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button type="button" className="p-1.5 text-yo-txt-3 hover:text-yo-txt" title="Ver">
                <Eye className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setState({ ...state, pdfName: null, pdfSize: null, pdfHash: null })}
                className="p-1.5 text-yo-txt-3 hover:text-yo-err"
                title="Reemplazar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {processing && <p className="text-xs text-yo-txt-3">Calculando hash…</p>}
      {err && (
        <div className="flex items-start gap-2 rounded-md bg-yo-err-bg border border-[#FECACA] p-3">
          <AlertTriangle className="h-4 w-4 text-yo-err shrink-0 mt-0.5" />
          <p className="text-xs text-yo-err">{err}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="block font-medium text-yo-txt mb-1">Título del contrato</span>
          <input
            value={state.title}
            onChange={(e) => setState({ ...state, title: e.target.value })}
            className="w-full px-3 py-2 border border-yo-border rounded-md bg-yo-surface text-sm focus:outline-none focus:ring-2 focus:ring-yo-ac"
          />
        </label>
        <label className="text-sm">
          <span className="block font-medium text-yo-txt mb-1">Versión</span>
          <input
            value={state.version}
            onChange={(e) => setState({ ...state, version: e.target.value })}
            className="w-full px-3 py-2 border border-yo-border rounded-md bg-yo-surface text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yo-ac"
          />
        </label>
      </div>

      <fieldset className="rounded-lg border border-yo-border bg-yo-raised p-4 space-y-2">
        <legend className="px-1 text-xs font-semibold text-yo-txt-2">Estado del contrato</legend>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="radio"
            checked={!state.alreadySigned}
            onChange={() => setState({ ...state, alreadySigned: false, requiresCumplexSignature: true })}
            className="mt-0.5"
          />
          <span className="text-sm text-yo-txt">Se firmará dentro de Cumplex (recomendado)</span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="radio"
            checked={state.alreadySigned}
            onChange={() => setState({ ...state, alreadySigned: true, requiresCumplexSignature: false })}
            className="mt-0.5"
          />
          <span className="text-sm text-yo-txt">Ya viene firmado — Cumplex solo lo vinculará a la operación</span>
        </label>
      </fieldset>
    </section>
  );
}

// ─── Generated contract ─────────────────────────────────────────────────────
function GeneratedPanel({
  state, setState, templates, sector, descripcion, contraparteNombre, creatorRoleLabel, monto,
}: {
  state: ContractState;
  setState: (s: ContractState) => void;
  templates: ReturnType<typeof templatesForSector>;
  sector: SectorId;
  descripcion: string;
  contraparteNombre: string | null;
  creatorRoleLabel: string;
  monto: number;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-yo-txt mb-2">Selecciona una plantilla</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {templates.map((t) => {
            const active = state.templateKey === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setState({ ...state, templateKey: t.key, title: t.title })}
                className={`text-left p-3 rounded-lg border-2 transition ${
                  active
                    ? "border-yo-ac bg-yo-ac-bg"
                    : "border-yo-border bg-yo-surface hover:border-yo-border-s"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-yo-ac-txt" />
                  <span className="text-sm font-medium text-yo-txt">{t.title}</span>
                  {t.recomendado && (
                    <span className="ml-auto text-[10px] bg-yo-ac text-white px-1.5 py-0.5 rounded">Recomendado</span>
                  )}
                </div>
                <p className="text-xs text-yo-txt-3 mt-1">{t.descripcion}</p>
              </button>
            );
          })}
        </div>
      </div>

      {state.templateKey && (
        <div className="rounded-lg border border-yo-border bg-yo-surface">
          <div className="flex items-center justify-between px-4 py-3 border-b border-yo-border">
            <h4 className="text-sm font-semibold text-yo-txt">Vista previa</h4>
            <button
              type="button"
              onClick={() => setPreviewOpen((v) => !v)}
              className="text-xs text-yo-ac-txt hover:underline"
            >
              {previewOpen ? "Ocultar" : "Ver contenido completo"}
            </button>
          </div>
          <div className="p-4 space-y-3 text-xs text-yo-txt-2">
            <p><strong className="text-yo-txt">Sector:</strong> {sector}</p>
            <p><strong className="text-yo-txt">Rol del creador:</strong> {creatorRoleLabel}</p>
            <p><strong className="text-yo-txt">Contraparte:</strong> {contraparteNombre || "—"}</p>
            <p><strong className="text-yo-txt">Monto:</strong> ${monto.toLocaleString("es-MX")} MXN</p>
            <p><strong className="text-yo-txt">Objeto:</strong> {descripcion.slice(0, 180)}{descripcion.length > 180 ? "…" : ""}</p>

            {previewOpen && (
              <ol className="list-decimal list-inside space-y-1 mt-2 text-yo-txt-2">
                <li>Identificación de las partes</li>
                <li>Declaraciones</li>
                <li>Objeto de la operación</li>
                <li>Descripción del bien o servicio</li>
                <li>Monto y desglose de la operación</li>
                <li>Hitos y condiciones de cumplimiento (del wizard)</li>
                <li>Documentos y evidencia requerida (del wizard)</li>
                <li>Reglas de liberación de pagos</li>
                <li>CFDI y REP: obligaciones fiscales del proveedor</li>
                <li>Disputas y resolución</li>
                <li>Rol neutral de Cumplex</li>
                <li>Limitación de custodia de fondos</li>
                <li>Auditoría y trazabilidad</li>
                <li>Firmas</li>
              </ol>
            )}

            <div className="mt-3 rounded-md bg-yo-raised border border-yo-border p-3">
              <p className="text-[11px] text-yo-txt-3 uppercase tracking-wider mb-1 font-semibold">Bloque legal Cumplex (no editable)</p>
              <p className="text-[11px] text-yo-txt-2 leading-relaxed">{Cumplex_LEGAL_BLOCK}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Signature config ───────────────────────────────────────────────────────
function SignatureConfigPanel({
  state, setState, suggested,
}: {
  state: ContractState; setState: (s: ContractState) => void; suggested: SignatureMethod;
}) {
  return (
    <section className="rounded-lg border border-yo-border bg-yo-surface p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-yo-ac" />
        <h3 className="text-sm font-semibold text-yo-txt">Método de firma por parte</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SignerBlock
          label="Comprador"
          value={state.buyerSignatureMethod}
          onChange={(m) => setState({ ...state, buyerSignatureMethod: m })}
          suggested={suggested}
        />
        <SignerBlock
          label="Vendedor"
          value={state.sellerSignatureMethod}
          onChange={(m) => setState({ ...state, sellerSignatureMethod: m })}
          suggested={suggested}
        />
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-yo-txt-2 pt-2 border-t border-yo-border">
        <label className="inline-flex items-center gap-1.5">
          <input
            type="radio"
            checked={state.signatureOrder === "PARALLEL"}
            onChange={() => setState({ ...state, signatureOrder: "PARALLEL" })}
          />
          Firma paralela
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input
            type="radio"
            checked={state.signatureOrder === "SEQUENTIAL"}
            onChange={() => setState({ ...state, signatureOrder: "SEQUENTIAL" })}
          />
          Firma secuencial (comprador → vendedor)
        </label>
      </div>

      <div className="rounded-md bg-yo-warn-bg border border-[#FDE68A] p-3">
        <p className="text-xs text-yo-warn">
          La operación no podrá activarse hasta que ambas partes hayan firmado el contrato o hayas indicado que ya viene firmado.
        </p>
      </div>
    </section>
  );
}

function SignerBlock({
  label, value, onChange, suggested,
}: {
  label: string;
  value: SignatureMethod | null;
  onChange: (m: SignatureMethod) => void;
  suggested: SignatureMethod;
}) {
  return (
    <div className="rounded-md border border-yo-border p-3 space-y-2">
      <div className="text-xs font-semibold text-yo-txt-2 uppercase tracking-wider">{label}</div>
      <div className="space-y-1.5">
        <SignerRadio
          checked={value === "AUTOGRAFA_BIOMETRICA"}
          onChange={() => onChange("AUTOGRAFA_BIOMETRICA")}
          icon={<PenLine className="h-3.5 w-3.5" />}
          label="Autógrafa digital + biometría"
          hint={suggested === "AUTOGRAFA_BIOMETRICA" ? "Sugerido" : undefined}
        />
        <SignerRadio
          checked={value === "EFIRMA_SAT"}
          onChange={() => onChange("EFIRMA_SAT")}
          icon={<KeyRound className="h-3.5 w-3.5" />}
          label="e.firma SAT"
          hint={suggested === "EFIRMA_SAT" ? "Sugerido" : undefined}
        />
      </div>
      {value === "EFIRMA_SAT" && (
        <p className="text-[11px] text-yo-txt-3 mt-1 pt-2 border-t border-yo-border">
          Tu llave privada y contraseña no se almacenan. Se usan solo durante la firma.
        </p>
      )}
      {value === "AUTOGRAFA_BIOMETRICA" && (
        <p className="text-[11px] text-yo-txt-3 mt-1 pt-2 border-t border-yo-border">
          Se solicitará canvas de firma, selfie y prueba de vida al momento de firmar.
        </p>
      )}
    </div>
  );
}

function SignerRadio({
  checked, onChange, icon, label, hint,
}: {
  checked: boolean; onChange: () => void; icon: React.ReactNode; label: string; hint?: string;
}) {
  return (
    <label className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition ${
      checked ? "border-yo-ac bg-yo-ac-bg" : "border-yo-border bg-yo-surface hover:bg-yo-raised"
    }`}>
      <input type="radio" checked={checked} onChange={onChange} className="shrink-0" />
      <span className={`shrink-0 ${checked ? "text-yo-ac-txt" : "text-yo-txt-3"}`}>{icon}</span>
      <span className="text-xs font-medium text-yo-txt flex-1">{label}</span>
      {hint && <span className="text-[10px] bg-yo-ac text-white px-1.5 py-0.5 rounded">{hint}</span>}
      {checked && <CheckCircle2 className="h-3.5 w-3.5 text-yo-ac" />}
    </label>
  );
}

// Helper para validar si el paso está completo
export function isContractStepValid(state: ContractState): string | null {
  if (!state.method) return "Selecciona cómo integrarás el contrato.";
  if (state.method === "UPLOADED_PDF" && !state.pdfHash) return "Sube el PDF del contrato.";
  if (state.method === "GENERATED" && !state.templateKey) return "Selecciona una plantilla de contrato.";
  if (state.requiresCumplexSignature) {
    if (!state.buyerSignatureMethod) return "Selecciona el método de firma del comprador.";
    if (!state.sellerSignatureMethod) return "Selecciona el método de firma del vendedor.";
  }
  return null;
}
