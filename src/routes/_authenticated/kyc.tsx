import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteFooter } from "@/components/site-footer";
import { CheckCircle2, Circle, Upload, FileText, X, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/kyc")({
  head: () => ({
    meta: [
      { title: "Verificación KYC — YOKTO" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: KycWizard,
});

type AccountType = "persona_fisica" | "persona_moral";
type IndustrySector =
  | "autotransporte" | "construccion" | "inmobiliario" | "vehiculos"
  | "servicios_profesionales" | "comercio" | "manufactura" | "otro";
type KycStatus = "pending" | "in_review" | "approved" | "rejected";

type FiscalForm = {
  first_name: string;
  last_name: string;
  phone: string;
  account_type: AccountType | "";
  industry_sector: IndustrySector | "";
  legal_name: string;
  rfc: string;
  regimen_fiscal: string;
  uso_cfdi: string;
  fiscal_address: string;
  fiscal_postal_code: string;
};

type DocRow = {
  id: string;
  document_type: string;
  file_name: string | null;
  storage_path: string;
  status: KycStatus;
  created_at: string;
};

const RFC_PF = /^[A-ZÑ&]{4}\d{6}[A-Z\d]{3}$/;
const RFC_PM = /^[A-ZÑ&]{3}\d{6}[A-Z\d]{3}$/;
const CP_REGEX = /^\d{5}$/;

const REGIMENES_PF = [
  { v: "605", l: "605 — Sueldos y salarios" },
  { v: "612", l: "612 — Actividades empresariales y profesionales" },
  { v: "621", l: "621 — Incorporación fiscal" },
  { v: "626", l: "626 — RESICO Personas físicas" },
];
const REGIMENES_PM = [
  { v: "601", l: "601 — General de ley" },
  { v: "603", l: "603 — Personas morales sin fines de lucro" },
  { v: "620", l: "620 — Sociedades cooperativas de producción" },
  { v: "626", l: "626 — RESICO Personas morales" },
];
const USOS_CFDI = [
  { v: "G03", l: "G03 — Gastos en general" },
  { v: "S01", l: "S01 — Sin efectos fiscales" },
  { v: "P01", l: "P01 — Por definir" },
  { v: "I08", l: "I08 — Otra maquinaria y equipo" },
];
const SECTORES: { v: IndustrySector; l: string }[] = [
  { v: "autotransporte", l: "Autotransporte" },
  { v: "construccion", l: "Construcción" },
  { v: "inmobiliario", l: "Inmobiliario" },
  { v: "vehiculos", l: "Compra-venta de vehículos" },
  { v: "servicios_profesionales", l: "Servicios profesionales" },
  { v: "comercio", l: "Comercio" },
  { v: "manufactura", l: "Manufactura" },
  { v: "otro", l: "Otro" },
];

const REQUIRED_DOCS_PF = [
  { type: "ine", label: "Identificación oficial (INE / Pasaporte)" },
  { type: "proof_of_address", label: "Comprobante de domicilio (≤ 3 meses)" },
  { type: "constancia_fiscal", label: "Constancia de situación fiscal" },
];
const REQUIRED_DOCS_PM = [
  { type: "acta_constitutiva", label: "Acta constitutiva" },
  { type: "poder_notarial", label: "Poder notarial del representante legal" },
  { type: "ine", label: "INE del representante legal" },
  { type: "proof_of_address", label: "Comprobante de domicilio fiscal" },
  { type: "constancia_fiscal", label: "Constancia de situación fiscal" },
];

function KycWizard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [kycStatus, setKycStatus] = useState<KycStatus>("pending");
  const [form, setForm] = useState<FiscalForm>({
    first_name: "", last_name: "", phone: "",
    account_type: "", industry_sector: "",
    legal_name: "", rfc: "", regimen_fiscal: "", uso_cfdi: "",
    fiscal_address: "", fiscal_postal_code: "",
  });
  const [docs, setDocs] = useState<DocRow[]>([]);

  useEffect(() => {
    (async () => {
      const [p, d] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("kyc_documents").select("id,document_type,file_name,storage_path,status,created_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      if (p.data) {
        setKycStatus(p.data.kyc_status);
        setForm({
          first_name: p.data.first_name ?? "",
          last_name: p.data.last_name ?? "",
          phone: p.data.phone ?? "",
          account_type: (p.data.account_type as AccountType) ?? "",
          industry_sector: (p.data.industry_sector as IndustrySector) ?? "",
          legal_name: p.data.legal_name ?? "",
          rfc: p.data.rfc ?? "",
          regimen_fiscal: p.data.regimen_fiscal ?? "",
          uso_cfdi: p.data.uso_cfdi ?? "",
          fiscal_address: p.data.fiscal_address ?? "",
          fiscal_postal_code: p.data.fiscal_postal_code ?? "",
        });
        setStep(Math.max(0, Math.min(3, p.data.onboarding_step ?? 0)) as 0 | 1 | 2 | 3);
      }
      setDocs((d.data as DocRow[]) ?? []);
      setLoading(false);
    })();
  }, [user.id]);

  const requiredDocs = form.account_type === "persona_moral" ? REQUIRED_DOCS_PM : REQUIRED_DOCS_PF;
  const uploadedByType = useMemo(() => {
    const m = new Map<string, DocRow>();
    for (const d of docs) if (!m.has(d.document_type)) m.set(d.document_type, d);
    return m;
  }, [docs]);
  const allDocsUploaded = requiredDocs.every((r) => uploadedByType.has(r.type));

  const readOnly = kycStatus === "in_review" || kycStatus === "approved";

  function validateStep1(): string | null {
    const schema = z.object({
      first_name: z.string().trim().min(1, "Nombre requerido").max(80),
      last_name: z.string().trim().min(1, "Apellido requerido").max(80),
      phone: z.string().trim().regex(/^[+\d\s()-]{8,20}$/, "Teléfono inválido"),
      account_type: z.enum(["persona_fisica", "persona_moral"]),
      industry_sector: z.enum([
        "autotransporte","construccion","inmobiliario","vehiculos",
        "servicios_profesionales","comercio","manufactura","otro",
      ]),
    });
    const r = schema.safeParse(form);
    return r.success ? null : r.error.issues[0]?.message ?? "Datos inválidos";
  }

  function validateStep2(): string | null {
    const isPM = form.account_type === "persona_moral";
    const rfcRegex = isPM ? RFC_PM : RFC_PF;
    if (isPM && !form.legal_name.trim()) return "Razón social requerida";
    if (!rfcRegex.test(form.rfc.trim().toUpperCase())) return "RFC inválido";
    if (!form.regimen_fiscal) return "Régimen fiscal requerido";
    if (!form.uso_cfdi) return "Uso de CFDI requerido";
    if (form.fiscal_address.trim().length < 5) return "Dirección fiscal requerida";
    if (!CP_REGEX.test(form.fiscal_postal_code.trim())) return "Código postal inválido (5 dígitos)";
    return null;
  }

  async function persistProfile(nextStep: 0 | 1 | 2 | 3, extra: Partial<Record<string, unknown>> = {}) {
    setSaving(true);
    try {
      const payload = {
        id: user.id,
        email: user.email,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        account_type: form.account_type || null,
        industry_sector: form.industry_sector || null,
        legal_name: form.legal_name.trim() || null,
        rfc: form.rfc.trim().toUpperCase() || null,
        regimen_fiscal: form.regimen_fiscal || null,
        uso_cfdi: form.uso_cfdi || null,
        fiscal_address: form.fiscal_address.trim() || null,
        fiscal_postal_code: form.fiscal_postal_code.trim() || null,
        onboarding_step: nextStep,
        ...extra,
      };
      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (error) throw error;
      setStep(nextStep);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    setError(null);
    if (step === 0) {
      const e = validateStep1();
      if (e) return setError(e);
      await persistProfile(1);
    } else if (step === 1) {
      const e = validateStep2();
      if (e) return setError(e);
      await persistProfile(2);
    } else if (step === 2) {
      if (!allDocsUploaded) return setError("Sube todos los documentos requeridos");
      await persistProfile(3);
    }
  }

  async function handleSubmit() {
    if (!allDocsUploaded) return setError("Sube todos los documentos requeridos");
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        kyc_status: "in_review",
        kyc_submitted_at: new Date().toISOString(),
        onboarding_completed: true,
        onboarding_step: 3,
      }).eq("id", user.id);
      if (error) throw error;
      setKycStatus("in_review");
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setSaving(false);
    }
  }

  const uploadDoc = useCallback(async (docType: string, file: File) => {
    setError(null);
    const path = `${user.id}/${docType}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("kyc-documents").upload(path, file, {
      contentType: file.type, upsert: false,
    });
    if (upErr) { setError(upErr.message); return; }
    const { data, error: insErr } = await supabase.from("kyc_documents").insert({
      user_id: user.id,
      document_type: docType as "acta_constitutiva" | "constancia_fiscal" | "ine" | "other" | "passport" | "poder_notarial" | "proof_of_address",
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      status: "pending",
    }).select("id,document_type,file_name,storage_path,status,created_at").single();
    if (insErr) { setError(insErr.message); return; }
    setDocs((prev) => [data as DocRow, ...prev]);
  }, [user.id]);

  async function removeDoc(doc: DocRow) {
    await supabase.storage.from("kyc-documents").remove([doc.storage_path]);
    await supabase.from("kyc_documents").delete().eq("id", doc.id);
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        <Loader2 className="animate-spin size-6" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-yokto-black bg-background">
        <div className="container-editorial flex h-14 items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <span className="grid place-items-center size-7 bg-yokto-black text-yokto-cream font-display text-lg leading-none">Y</span>
            <span className="font-display text-2xl tracking-wide text-foreground">YOKTO</span>
            <span className="ml-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground border-l border-yokto-black/30 pl-3">KYC</span>
          </Link>
          <Link to="/dashboard" className="text-[12px] uppercase tracking-[0.14em] font-semibold text-muted-foreground hover:text-foreground">
            Salir del wizard
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="container-editorial py-10 max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Módulo A · Verificación de identidad</p>
          <h1 className="mt-2 font-display text-5xl tracking-wide text-foreground">Onboarding KYC</h1>
          <p className="mt-3 text-muted-foreground">
            Completa los 4 pasos para habilitar tu cuenta y operar pagos contra cumplimiento.
          </p>

          <Stepper current={step} status={kycStatus} />

          {readOnly && (
            <div className="mt-6 border border-yokto-black bg-yokto-cream/60 p-4 text-sm">
              {kycStatus === "in_review"
                ? "Tu verificación está en revisión. Te avisaremos cuando concluya."
                : "Tu cuenta está aprobada. No hace falta modificar tus datos."}
            </div>
          )}

          <fieldset disabled={readOnly} className={`mt-8 ${readOnly ? "opacity-60" : ""}`}>
            {step === 0 && <StepIdentity form={form} setForm={setForm} />}
            {step === 1 && <StepFiscal form={form} setForm={setForm} />}
            {step === 2 && (
              <StepDocuments
                required={requiredDocs}
                uploadedByType={uploadedByType}
                onUpload={uploadDoc}
                onRemove={removeDoc}
              />
            )}
            {step === 3 && <StepReview form={form} docs={docs} />}
          </fieldset>

          {error && (
            <div className="mt-6 border border-yokto-alert bg-yokto-alert/10 px-3 py-2 text-sm text-yokto-alert">
              {error}
            </div>
          )}

          {!readOnly && (
            <div className="mt-8 flex items-center justify-between border-t border-yokto-black/20 pt-6">
              <button
                onClick={() => setStep((s) => (s > 0 ? ((s - 1) as 0 | 1 | 2 | 3) : s))}
                disabled={step === 0 || saving}
                className="px-4 py-2.5 text-[12px] uppercase tracking-[0.14em] font-semibold border border-yokto-black hover:bg-muted disabled:opacity-40"
              >
                Atrás
              </button>

              {step < 3 ? (
                <button
                  onClick={handleNext}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-yokto-yellow text-yokto-black text-[12px] uppercase tracking-[0.14em] font-semibold border border-yokto-black hover:bg-yokto-black hover:text-yokto-yellow disabled:opacity-60"
                >
                  {saving && <Loader2 className="animate-spin size-4" />}
                  Continuar
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={saving || !allDocsUploaded}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-yokto-black text-yokto-cream text-[12px] uppercase tracking-[0.14em] font-semibold border border-yokto-black hover:bg-yokto-yellow hover:text-yokto-black disabled:opacity-60"
                >
                  {saving && <Loader2 className="animate-spin size-4" />}
                  Enviar a revisión
                </button>
              )}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Stepper({ current, status }: { current: number; status: KycStatus }) {
  const steps = ["Identidad", "Datos fiscales", "Documentos", "Revisión"];
  return (
    <div className="mt-8 flex items-center gap-2">
      {steps.map((label, i) => {
        const done = i < current || status !== "pending";
        const active = i === current;
        return (
          <div key={label} className="flex-1 flex items-center gap-2">
            <div className={`flex items-center gap-2 flex-1 border p-2.5 ${active ? "border-yokto-black bg-yokto-yellow" : done ? "border-yokto-black/60 bg-yokto-black text-yokto-cream" : "border-yokto-black/30 bg-transparent"}`}>
              {done ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
              <span className="text-[11px] uppercase tracking-[0.14em] font-semibold truncate">{i + 1}. {label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StepIdentity({ form, setForm }: { form: FiscalForm; setForm: (u: FiscalForm) => void }) {
  const upd = (k: keyof FiscalForm) => (v: string) => setForm({ ...form, [k]: v });
  return (
    <div className="grid gap-4">
      <SectionTitle n={1} title="Identidad y tipo de cuenta" />
      <div className="grid md:grid-cols-2 gap-4">
        <Input label="Nombre" value={form.first_name} onChange={upd("first_name")} />
        <Input label="Apellido" value={form.last_name} onChange={upd("last_name")} />
      </div>
      <Input label="Teléfono" value={form.phone} onChange={upd("phone")} placeholder="+52 55 1234 5678" />
      <Select
        label="Tipo de cuenta"
        value={form.account_type}
        onChange={(v) => setForm({ ...form, account_type: v as AccountType })}
        options={[
          { v: "persona_fisica", l: "Persona física" },
          { v: "persona_moral", l: "Persona moral (empresa)" },
        ]}
      />
      <Select
        label="Sector / industria"
        value={form.industry_sector}
        onChange={(v) => setForm({ ...form, industry_sector: v as IndustrySector })}
        options={SECTORES.map((s) => ({ v: s.v, l: s.l }))}
      />
    </div>
  );
}

function StepFiscal({ form, setForm }: { form: FiscalForm; setForm: (u: FiscalForm) => void }) {
  const upd = (k: keyof FiscalForm) => (v: string) => setForm({ ...form, [k]: v });
  const isPM = form.account_type === "persona_moral";
  const regimenes = isPM ? REGIMENES_PM : REGIMENES_PF;
  return (
    <div className="grid gap-4">
      <SectionTitle n={2} title="Datos fiscales (SAT)" />
      {isPM && (
        <Input label="Razón social" value={form.legal_name} onChange={upd("legal_name")} />
      )}
      <div className="grid md:grid-cols-2 gap-4">
        <Input label={isPM ? "RFC (12 caracteres)" : "RFC (13 caracteres)"} value={form.rfc} onChange={(v) => upd("rfc")(v.toUpperCase())} />
        <Input label="Código postal fiscal" value={form.fiscal_postal_code} onChange={upd("fiscal_postal_code")} placeholder="03100" />
      </div>
      <Input label="Dirección fiscal completa" value={form.fiscal_address} onChange={upd("fiscal_address")} />
      <div className="grid md:grid-cols-2 gap-4">
        <Select label="Régimen fiscal" value={form.regimen_fiscal} onChange={upd("regimen_fiscal")} options={regimenes.map((r) => ({ v: r.v, l: r.l }))} />
        <Select label="Uso de CFDI" value={form.uso_cfdi} onChange={upd("uso_cfdi")} options={USOS_CFDI.map((u) => ({ v: u.v, l: u.l }))} />
      </div>
    </div>
  );
}

function StepDocuments({
  required, uploadedByType, onUpload, onRemove,
}: {
  required: { type: string; label: string }[];
  uploadedByType: Map<string, DocRow>;
  onUpload: (type: string, file: File) => Promise<void>;
  onRemove: (doc: DocRow) => Promise<void>;
}) {
  return (
    <div className="grid gap-4">
      <SectionTitle n={3} title="Documentos" />
      <p className="text-sm text-muted-foreground">
        Formatos aceptados: PDF, JPG, PNG. Máximo 10 MB por archivo.
      </p>
      {required.map((r) => {
        const doc = uploadedByType.get(r.type);
        return (
          <DocSlot key={r.type} label={r.label} doc={doc} onUpload={(f) => onUpload(r.type, f)} onRemove={onRemove} />
        );
      })}
    </div>
  );
}

function DocSlot({
  label, doc, onUpload, onRemove,
}: {
  label: string;
  doc: DocRow | undefined;
  onUpload: (file: File) => Promise<void>;
  onRemove: (doc: DocRow) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const inputId = `f-${label.replace(/\s+/g, "-")}`;

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { alert("Archivo mayor a 10 MB"); return; }
    setBusy(true);
    try { await onUpload(f); } finally { setBusy(false); e.target.value = ""; }
  }

  return (
    <div className="border border-yokto-black p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`size-9 grid place-items-center border border-yokto-black ${doc ? "bg-yokto-yellow" : "bg-transparent"}`}>
          {doc ? <CheckCircle2 className="size-4" /> : <FileText className="size-4" />}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground truncate">{label}</p>
          {doc ? (
            <p className="text-xs text-muted-foreground truncate">{doc.file_name}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Pendiente</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {doc ? (
          <button
            onClick={() => onRemove(doc)}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-yokto-black text-[11px] uppercase tracking-[0.14em] font-semibold hover:bg-yokto-alert hover:text-yokto-cream hover:border-yokto-alert"
          >
            <X className="size-3.5" /> Quitar
          </button>
        ) : (
          <>
            <input id={inputId} type="file" className="sr-only" accept="application/pdf,image/png,image/jpeg" onChange={pick} disabled={busy} />
            <label
              htmlFor={inputId}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-yokto-black text-yokto-cream text-[11px] uppercase tracking-[0.14em] font-semibold cursor-pointer hover:bg-yokto-yellow hover:text-yokto-black"
            >
              {busy ? <Loader2 className="animate-spin size-3.5" /> : <Upload className="size-3.5" />}
              {busy ? "Subiendo…" : "Subir"}
            </label>
          </>
        )}
      </div>
    </div>
  );
}

function StepReview({ form, docs }: { form: FiscalForm; docs: DocRow[] }) {
  const isPM = form.account_type === "persona_moral";
  return (
    <div className="grid gap-6">
      <SectionTitle n={4} title="Revisión y envío" />
      <div className="border border-yokto-black p-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Identidad</p>
        <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
          <Field label="Nombre" value={`${form.first_name} ${form.last_name}`} />
          <Field label="Teléfono" value={form.phone} />
          <Field label="Tipo" value={isPM ? "Persona moral" : "Persona física"} />
          <Field label="Sector" value={SECTORES.find((s) => s.v === form.industry_sector)?.l ?? "—"} />
        </dl>
      </div>
      <div className="border border-yokto-black p-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Datos fiscales</p>
        <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
          {isPM && <Field label="Razón social" value={form.legal_name} />}
          <Field label="RFC" value={form.rfc} />
          <Field label="CP fiscal" value={form.fiscal_postal_code} />
          <Field label="Régimen" value={form.regimen_fiscal} />
          <Field label="Uso CFDI" value={form.uso_cfdi} />
          <Field label="Dirección" value={form.fiscal_address} full />
        </dl>
      </div>
      <div className="border border-yokto-black p-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Documentos subidos ({docs.length})</p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-yokto-black" />
              <span className="font-medium">{d.document_type}</span>
              <span className="text-muted-foreground truncate">— {d.file_name}</span>
            </li>
          ))}
          {docs.length === 0 && <li className="text-muted-foreground">Sin documentos.</li>}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">
        Al enviar, tu información entrará a revisión. No podrás modificarla hasta que concluya el proceso.
      </p>
    </div>
  );
}

function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid place-items-center size-7 bg-yokto-black text-yokto-cream font-display text-base leading-none">{n}</span>
      <h2 className="font-display text-2xl tracking-wide text-foreground">{title}</h2>
    </div>
  );
}

function Field({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value || "—"}</dd>
    </div>
  );
}

function Input({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.16em] text-foreground/70 font-semibold">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="border border-yokto-black bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-yokto-yellow disabled:bg-muted"
      />
    </label>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.16em] text-foreground/70 font-semibold">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-yokto-black bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-yokto-yellow disabled:bg-muted"
      >
        <option value="">— Selecciona —</option>
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.l}</option>
        ))}
      </select>
    </label>
  );
}
