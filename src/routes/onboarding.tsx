import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, Loader2, Check,
  User as UserIcon, Building2, Upload, Trash2, FileText, ShieldCheck,
  Landmark, AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  checkEmailExists, validateRfcServer, validateCurpNubarium, saveOnboardingStep,
  uploadKycDocument, listOwnKycDocuments, deleteOwnKycDocument,
  registerClabe, startPennyTest, confirmPennyTest, submitKyc,
} from "@/lib/onboarding.functions";
import { validateClabe, normalizeClabe, getBanco } from "@/lib/validations/clabe";
import { validateRfc, normalizeRfc } from "@/lib/validations/rfc";
import { validateCurp, normalizeCurp } from "@/lib/validations/curp";
import { REGIMEN_FISICA, REGIMEN_MORAL, USO_CFDI, ESTADOS_MX } from "@/lib/validations/sat-catalogs";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Registro — YOKTO" },
      { name: "description", content: "Crea tu cuenta YOKTO y completa la verificación KYC en 5 pasos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingWizard,
});

type AccountType = "persona_fisica" | "persona_moral";
type StepId = 1 | 2 | 3 | 4 | 5;

const STEPS: Array<{ id: StepId; title: string; desc: string }> = [
  { id: 1, title: "Cuenta",    desc: "Email y contraseña" },
  { id: 2, title: "Tipo",      desc: "Persona física / moral" },
  { id: 3, title: "Fiscal",    desc: "RFC y datos SAT" },
  { id: 4, title: "Identidad", desc: "Documentos oficiales" },
  { id: 5, title: "Bancario",  desc: "CLABE de cobro" },
];

const LS_KEY = "yokto.onboarding.v1";

function OnboardingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<StepId>(1);
  const [session, setSession] = useState<{ userId: string; email: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restaurar sesión + paso
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session?.user) {
        setSession({ userId: data.session.user.id, email: data.session.user.email ?? "" });
        supabase.from("profiles").select("onboarding_step, onboarding_completed, kyc_status")
          .eq("id", data.session.user.id).maybeSingle()
          .then(({ data: p }) => {
            if (!mounted || !p) return;
            if (p.onboarding_completed || p.kyc_status === "in_review" || p.kyc_status === "approved") {
              navigate({ to: "/onboarding/pendiente" });
              return;
            }
            const next = Math.max(2, Math.min(5, (p.onboarding_step ?? 1) + 1)) as StepId;
            setStep(next);
          });
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user) setSession({ userId: s.user.id, email: s.user.email ?? "" });
      else setSession(null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [navigate]);

  const goNext = (n: StepId) => { setError(null); setStep(n); };
  const goPrev = () => { setError(null); if (step > 1) setStep((step - 1) as StepId); };

  return (
    <div className="min-h-dvh bg-yo-bg text-yo-txt">
      <header className="border-b border-yo-border bg-yo-surface">
        <div className="mx-auto max-w-5xl px-5 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid place-items-center size-8 rounded-md gradient-accent text-white font-bold text-base leading-none">Y</span>
            <span className="font-extrabold text-lg tracking-[0.14em]">YOKTO</span>
          </Link>
          <Link to="/auth" className="text-sm text-yo-txt-2 hover:text-yo-txt">
            ¿Ya tienes cuenta? <span className="text-yo-ac font-medium">Iniciar sesión</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <Stepper active={step} />

        {error && (
          <div role="alert" className="mt-6 flex items-start gap-2 rounded-md border border-yo-err/25 bg-yo-err-bg px-3.5 py-2.5 text-sm text-yo-err">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <section className="mt-6 rounded-2xl bg-yo-surface border border-yo-border shadow-sm p-6 sm:p-8">
          {step === 1 && (
            <Step1Account
              onSignedUp={(userId, email) => { setSession({ userId, email }); goNext(2); }}
              setError={setError} loading={loading} setLoading={setLoading}
            />
          )}
          {step === 2 && session && (
            <Step2Type
              onSaved={() => goNext(3)} onBack={goPrev}
              setError={setError} loading={loading} setLoading={setLoading}
            />
          )}
          {step === 3 && session && (
            <Step3Fiscal
              onSaved={() => goNext(4)} onBack={goPrev}
              setError={setError} loading={loading} setLoading={setLoading}
            />
          )}
          {step === 4 && session && (
            <Step4Identity
              onDone={() => goNext(5)} onBack={goPrev}
              setError={setError} loading={loading} setLoading={setLoading}
            />
          )}
          {step === 5 && session && (
            <Step5Bank
              onFinished={() => navigate({ to: "/onboarding/pendiente" })} onBack={goPrev}
              setError={setError} loading={loading} setLoading={setLoading}
            />
          )}
          {step > 1 && !session && (
            <div className="text-sm text-yo-txt-2">
              Debes iniciar sesión para continuar.
              <button type="button" onClick={() => setStep(1)} className="ml-2 text-yo-ac font-medium">Volver al paso 1</button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// ─── Stepper ────────────────────────────────────────────────────────────────
function Stepper({ active }: { active: StepId }) {
  return (
    <ol className="grid grid-cols-5 gap-2" aria-label="Progreso de registro">
      {STEPS.map((s) => {
        const done = active > s.id;
        const current = active === s.id;
        return (
          <li key={s.id} className="flex flex-col items-center text-center">
            <div className={
              "grid place-items-center size-9 rounded-full text-sm font-semibold border transition " +
              (done ? "bg-yo-txt text-white border-yo-txt"
                : current ? "bg-yo-ac text-white border-yo-ac shadow-glow-accent"
                : "bg-yo-surface text-yo-txt-3 border-yo-border")
            }>
              {done ? <Check className="size-4" /> : s.id}
            </div>
            <p className={"mt-2 text-[11px] uppercase tracking-widest font-semibold " + (current ? "text-yo-txt" : "text-yo-txt-3")}>
              {s.title}
            </p>
            <p className="hidden sm:block text-[11px] text-yo-txt-3 leading-tight">{s.desc}</p>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Reusable field ─────────────────────────────────────────────────────────
function Field(props: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; hint?: string; error?: string | null;
  autoComplete?: string; required?: boolean; onBlur?: () => void; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number; uppercase?: boolean; icon?: React.ReactNode; disabled?: boolean; trailing?: React.ReactNode;
  as?: "input" | "select"; children?: React.ReactNode;
}) {
  const { id, label, value, onChange, type = "text", placeholder, hint, error, autoComplete,
    required, onBlur, inputMode, maxLength, uppercase, icon, disabled, trailing, as = "input", children } = props;
  const desc = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-yo-txt-2">
        {label}{required && <span className="text-yo-err"> *</span>}
      </label>
      <div className={
        "group flex items-center gap-2.5 rounded-md border h-11 px-3 transition bg-yo-surface " +
        (error ? "border-yo-err ring-2 ring-yo-err/15" : "border-yo-border focus-within:border-yo-ac focus-within:ring-2 focus-within:ring-yo-ac/20 hover:border-yo-border-s")
      }>
        {icon && <span className="text-yo-txt-3 shrink-0 group-focus-within:text-yo-ac transition">{icon}</span>}
        {as === "select" ? (
          <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required={required} disabled={disabled}
            className="flex-1 min-w-0 bg-transparent text-sm text-yo-txt outline-none">
            {children}
          </select>
        ) : (
          <input id={id} type={type} value={value} onChange={(e) => onChange(uppercase ? e.target.value.toUpperCase() : e.target.value)}
            onBlur={onBlur} required={required} autoComplete={autoComplete} placeholder={placeholder}
            inputMode={inputMode} maxLength={maxLength} disabled={disabled}
            aria-describedby={desc}
            className={"flex-1 min-w-0 bg-transparent text-sm text-yo-txt outline-none placeholder:text-yo-txt-4 " + (uppercase ? "uppercase tracking-wider" : "")} />
        )}
        {trailing}
      </div>
      {error ? <p id={`${id}-err`} className="text-[11px] text-yo-err">{error}</p>
        : hint ? <p id={`${id}-hint`} className="text-[11px] text-yo-txt-3">{hint}</p>
        : null}
    </div>
  );
}

// ─── STEP 1 — Cuenta ─────────────────────────────────────────────────────────
const passwordSchema = z.string().min(8, "Mínimo 8 caracteres")
  .regex(/[A-Z]/, "Requiere al menos una mayúscula")
  .regex(/[0-9]/, "Requiere al menos un número")
  .regex(/[^A-Za-z0-9]/, "Requiere al menos un símbolo");

function Step1Account({ onSignedUp, setError, loading, setLoading }: {
  onSignedUp: (userId: string, email: string) => void;
  setError: (s: string | null) => void; loading: boolean; setLoading: (b: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const checkEmail = useServerFn(checkEmailExists);

  const pwdChecks = [
    { label: "Mínimo 8 caracteres", ok: password.length >= 8 },
    { label: "Una mayúscula", ok: /[A-Z]/.test(password) },
    { label: "Un número", ok: /[0-9]/.test(password) },
    { label: "Un símbolo", ok: /[^A-Za-z0-9]/.test(password) },
  ];

  async function onEmailBlur() {
    setEmailError(null);
    if (!email) return;
    const parsed = z.string().email().safeParse(email);
    if (!parsed.success) { setEmailError("Correo inválido"); return; }
    setCheckingEmail(true);
    try {
      const r = await checkEmail({ data: { email: email.toLowerCase() } });
      if (r.exists) setEmailError("Este correo ya tiene una cuenta. Inicia sesión.");
    } finally { setCheckingEmail(false); }
  }

  function translateAuthError(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes("weak_password") || m.includes("known to be weak") || m.includes("pwned")) return "Contraseña insegura. Está en listas de filtraciones conocidas, elige una diferente.";
    if (m.includes("already registered") || m.includes("user already")) return "Este correo ya tiene una cuenta. Inicia sesión.";
    if (m.includes("invalid email")) return "Correo inválido.";
    if (m.includes("password should be")) return "La contraseña no cumple los requisitos mínimos.";
    if (m.includes("rate limit")) return "Demasiados intentos. Espera unos minutos y vuelve a intentar.";
    if (m.includes("network")) return "Error de red. Verifica tu conexión e intenta de nuevo.";
    return "No se pudo crear la cuenta. Intenta de nuevo.";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setPwdError(null); setConfirmError(null);
    const pv = passwordSchema.safeParse(password);
    if (!pv.success) { setPwdError(pv.error.issues[0]?.message ?? "Contraseña inválida"); return; }
    if (password !== confirm) { setConfirmError("Las contraseñas no coinciden"); return; }
    if (!terms) { setError("Debes aceptar los términos y el aviso de privacidad."); return; }
    if (emailError) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/onboarding` },
      });
      if (error) throw error;
      if (!data.user) throw new Error("No se pudo crear el usuario");
      // Asegurar sesión (para que las server functions autenticadas funcionen).
      if (!data.session) {
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email: email.toLowerCase(),
          password,
        });
        if (signErr) {
          setError("Cuenta creada. Confirma tu correo e inicia sesión para continuar.");
          setLoading(false);
          return;
        }
      }
      onSignedUp(data.user.id, data.user.email ?? email);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Error al crear cuenta";
      setError(translateAuthError(raw));
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Crea tu cuenta</h2>
        <p className="mt-1 text-sm text-yo-txt-2">Empecemos con tu correo y una contraseña segura.</p>
      </div>

      <Field id="email" label="Correo electrónico" value={email} onChange={setEmail}
        type="email" placeholder="tucorreo@empresa.com" autoComplete="email" required
        icon={<Mail className="size-4" />} onBlur={onEmailBlur} error={emailError}
        trailing={checkingEmail ? <Loader2 className="size-4 animate-spin text-yo-txt-3" /> : undefined}
      />

      <div className="flex flex-col gap-2">
        <Field id="password" label="Contraseña" value={password} onChange={setPassword}
          type={showPwd ? "text" : "password"} placeholder="Mínimo 8 caracteres" required
          autoComplete="new-password"
          error={pwdError} icon={<Lock className="size-4" />}
          trailing={
            <button type="button" onClick={() => setShowPwd((v) => !v)} tabIndex={-1}
              className="grid place-items-center size-8 rounded-md text-yo-txt-3 hover:text-yo-txt hover:bg-yo-raised"
              aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}>
              {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          }
        />
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-0.5" aria-label="Requisitos de contraseña">
          {pwdChecks.map((c) => (
            <li key={c.label} className={"flex items-center gap-1.5 text-[11px] " + (c.ok ? "text-emerald-600" : "text-yo-txt-3")}>
              <span className={"grid place-items-center size-4 rounded-full border " + (c.ok ? "bg-emerald-500 border-emerald-500 text-white" : "border-yo-border")}>
                {c.ok ? <Check className="size-3" strokeWidth={3} /> : null}
              </span>
              {c.label}
            </li>
          ))}
        </ul>
      </div>

      <Field id="confirm" label="Confirma contraseña" value={confirm} onChange={setConfirm}
        type={showConfirm ? "text" : "password"} placeholder="Confirmar contraseña" required autoComplete="new-password"
        error={confirmError} icon={<Lock className="size-4" />}
        trailing={
          <button type="button" onClick={() => setShowConfirm((v) => !v)} tabIndex={-1}
            className="grid place-items-center size-8 rounded-md text-yo-txt-3 hover:text-yo-txt hover:bg-yo-raised"
            aria-label={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}>
            {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        }
      />

      <label className="flex items-start gap-2.5 text-sm text-yo-txt-2 cursor-pointer">
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)}
          className="mt-0.5 size-4 rounded border-yo-border text-yo-ac focus:ring-yo-ac" />
        <span>Acepto los términos de servicio y el aviso de privacidad de YOKTO.</span>
      </label>

      <button type="submit" disabled={loading}
        className="mt-2 inline-flex items-center justify-center gap-2 min-h-11 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold disabled:opacity-50">
        {loading ? <Loader2 className="size-4 animate-spin" /> : <>Continuar <ArrowRight className="size-4" /></>}
      </button>
    </form>
  );
}


// ─── STEP 2 — Tipo de persona ────────────────────────────────────────────────
function Step2Type({ onSaved, onBack, setError, loading, setLoading }: {
  onSaved: () => void; onBack: () => void;
  setError: (s: string | null) => void; loading: boolean; setLoading: (b: boolean) => void;
}) {
  const [tipo, setTipo] = useState<AccountType | null>(null);
  const save = useServerFn(saveOnboardingStep);

  async function submit() {
    if (!tipo) { setError("Selecciona un tipo de persona"); return; }
    setLoading(true); setError(null);
    try {
      await save({ data: { step: 2, account_type: tipo } });
      try { localStorage.setItem(LS_KEY, JSON.stringify({ account_type: tipo })); } catch {}
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setLoading(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">¿Qué tipo de cuenta abres?</h2>
        <p className="mt-1 text-sm text-yo-txt-2">Esto determina los datos fiscales y documentos que te pediremos.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TypeCard
          selected={tipo === "persona_fisica"}
          onClick={() => setTipo("persona_fisica")}
          icon={<UserIcon className="size-6" />}
          title="Persona Física"
          desc="Individuo, freelance o autónomo con RFC personal."
        />
        <TypeCard
          selected={tipo === "persona_moral"}
          onClick={() => setTipo("persona_moral")}
          icon={<Building2 className="size-6" />}
          title="Persona Moral"
          desc="Empresa, S.A., S. de R.L., asociación o cooperativa."
        />
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-yo-txt-2 hover:text-yo-txt">
          <ArrowLeft className="size-4" /> Regresar
        </button>
        <button onClick={submit} disabled={loading || !tipo}
          className="inline-flex items-center gap-2 min-h-10 px-5 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold disabled:opacity-50">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <>Continuar <ArrowRight className="size-4" /></>}
        </button>
      </div>
    </div>
  );
}

function TypeCard({ selected, onClick, icon, title, desc }: {
  selected: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string;
}) {
  return (
    <button type="button" onClick={onClick}
      className={"text-left rounded-xl border p-5 transition " + (selected
        ? "border-yo-ac bg-yo-ac-bg ring-2 ring-yo-ac/20"
        : "border-yo-border bg-yo-surface hover:border-yo-border-s hover:bg-yo-raised")}>
      <div className={"grid place-items-center size-10 rounded-md mb-3 " + (selected ? "bg-yo-ac text-white" : "bg-yo-raised text-yo-txt-2")}>
        {icon}
      </div>
      <p className="font-semibold text-yo-txt">{title}</p>
      <p className="mt-1 text-sm text-yo-txt-2 leading-relaxed">{desc}</p>
    </button>
  );
}

// ─── STEP 3 — Datos fiscales ─────────────────────────────────────────────────
function Step3Fiscal({ onSaved, onBack, setError, loading, setLoading }: {
  onSaved: () => void; onBack: () => void;
  setError: (s: string | null) => void; loading: boolean; setLoading: (b: boolean) => void;
}) {
  const [tipo, setTipo] = useState<AccountType | null>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const [rfcCheck, setRfcCheck] = useState<{ msg: string; ok: boolean } | null>(null);
  const [rfcChecking, setRfcChecking] = useState(false);
  const [curpError, setCurpError] = useState<string | null>(null);
  const save = useServerFn(saveOnboardingStep);
  const validateRfcFn = useServerFn(validateRfcServer);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id; if (!uid) return;
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle().then(({ data: p }) => {
        if (!p) return;
        setTipo(p.account_type as AccountType);
        setF({
          first_name: p.first_name ?? "", last_name: p.last_name ?? "",
          second_last_name: p.second_last_name ?? "", birth_date: p.birth_date ?? "",
          rfc: p.rfc ?? "", curp: p.curp ?? "",
          legal_name: p.legal_name ?? "", trade_name: p.trade_name ?? "",
          incorporation_date: p.incorporation_date ?? "",
          regimen_fiscal: p.regimen_fiscal ?? "", uso_cfdi_default: p.uso_cfdi_default ?? "",
          fiscal_street: p.fiscal_street ?? "", fiscal_ext_number: p.fiscal_ext_number ?? "",
          fiscal_int_number: p.fiscal_int_number ?? "", fiscal_colonia: p.fiscal_colonia ?? "",
          fiscal_municipio: p.fiscal_municipio ?? "", fiscal_estado: p.fiscal_estado ?? "",
          fiscal_postal_code: p.fiscal_postal_code ?? "",
          rep_full_name: (p.legal_rep as { full_name?: string } | null)?.full_name ?? "",
          rep_rfc: (p.legal_rep as { rfc?: string } | null)?.rfc ?? "",
          rep_curp: (p.legal_rep as { curp?: string } | null)?.curp ?? "",
          rep_role: (p.legal_rep as { role?: string } | null)?.role ?? "",
        });
      });
    });
  }, []);

  async function onRfcBlur() {
    if (!f.rfc) return setRfcCheck(null);
    const norm = normalizeRfc(f.rfc);
    set("rfc", norm);
    const local = validateRfc(norm, tipo === "persona_fisica" ? "PF" : "PM");
    if (!local.valid) { setRfcCheck({ ok: false, msg: local.error ?? "RFC inválido" }); return; }
    setRfcChecking(true);
    try {
      const r = await validateRfcFn({ data: { rfc: norm, expected: tipo === "persona_fisica" ? "PF" : "PM" } });
      setRfcCheck({ ok: r.valid, msg: r.valid ? "RFC con formato válido" : (r.error ?? "RFC inválido") });
    } finally { setRfcChecking(false); }
  }
  function onCurpBlur() {
    if (!f.curp) return setCurpError(null);
    const norm = normalizeCurp(f.curp); set("curp", norm);
    const c = validateCurp(norm);
    setCurpError(c.valid ? null : (c.error ?? "CURP inválida"));
  }

  const regimenes = tipo === "persona_fisica" ? REGIMEN_FISICA : REGIMEN_MORAL;

  async function submit() {
    if (!tipo) return;
    setError(null); setLoading(true);
    try {
      if (tipo === "persona_fisica") {
        await save({ data: {
          step: 3, account_type: "persona_fisica",
          first_name: f.first_name, last_name: f.last_name,
          second_last_name: f.second_last_name || null,
          birth_date: f.birth_date || null,
          rfc: f.rfc, curp: f.curp,
          regimen_fiscal: f.regimen_fiscal, uso_cfdi_default: f.uso_cfdi_default,
          fiscal_street: f.fiscal_street, fiscal_ext_number: f.fiscal_ext_number,
          fiscal_int_number: f.fiscal_int_number || null, fiscal_colonia: f.fiscal_colonia,
          fiscal_municipio: f.fiscal_municipio, fiscal_estado: f.fiscal_estado,
          fiscal_postal_code: f.fiscal_postal_code,
        } });
      } else {
        await save({ data: {
          step: 3, account_type: "persona_moral",
          legal_name: f.legal_name, trade_name: f.trade_name || null,
          rfc: f.rfc, regimen_fiscal: f.regimen_fiscal, uso_cfdi_default: f.uso_cfdi_default,
          incorporation_date: f.incorporation_date || null,
          legal_rep: { full_name: f.rep_full_name, rfc: f.rep_rfc, curp: f.rep_curp, role: f.rep_role },
          fiscal_street: f.fiscal_street, fiscal_ext_number: f.fiscal_ext_number,
          fiscal_int_number: f.fiscal_int_number || null, fiscal_colonia: f.fiscal_colonia,
          fiscal_municipio: f.fiscal_municipio, fiscal_estado: f.fiscal_estado,
          fiscal_postal_code: f.fiscal_postal_code,
        } });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally { setLoading(false); }
  }

  if (!tipo) return <p className="text-sm text-yo-txt-2">Cargando…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Datos fiscales</h2>
        <p className="mt-1 text-sm text-yo-txt-2">
          Debe coincidir con tu Constancia de Situación Fiscal ({tipo === "persona_fisica" ? "Persona Física" : "Persona Moral"}).
        </p>
      </div>

      {tipo === "persona_fisica" ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field id="first_name" label="Nombre(s)" value={f.first_name ?? ""} onChange={(v) => set("first_name", v)} required />
            <Field id="last_name" label="Apellido paterno" value={f.last_name ?? ""} onChange={(v) => set("last_name", v)} required />
            <Field id="second_last_name" label="Apellido materno" value={f.second_last_name ?? ""} onChange={(v) => set("second_last_name", v)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field id="birth_date" label="Fecha de nacimiento" type="date" value={f.birth_date ?? ""} onChange={(v) => set("birth_date", v)} />
            <Field id="rfc" label="RFC (13 caracteres)" value={f.rfc ?? ""} onChange={(v) => set("rfc", v)} required uppercase maxLength={13}
              onBlur={onRfcBlur} error={rfcCheck && !rfcCheck.ok ? rfcCheck.msg : null}
              hint={rfcCheck?.ok ? rfcCheck.msg : undefined}
              trailing={rfcChecking ? <Loader2 className="size-4 animate-spin text-yo-txt-3" /> : rfcCheck?.ok ? <Check className="size-4 text-yo-ok" /> : undefined}
            />
            <Field id="curp" label="CURP (18 caracteres)" value={f.curp ?? ""} onChange={(v) => set("curp", v)} required uppercase maxLength={18}
              onBlur={onCurpBlur} error={curpError} />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="legal_name" label="Razón social" value={f.legal_name ?? ""} onChange={(v) => set("legal_name", v)} required />
            <Field id="trade_name" label="Nombre comercial (opcional)" value={f.trade_name ?? ""} onChange={(v) => set("trade_name", v)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="rfc" label="RFC (12 caracteres)" value={f.rfc ?? ""} onChange={(v) => set("rfc", v)} required uppercase maxLength={12}
              onBlur={onRfcBlur} error={rfcCheck && !rfcCheck.ok ? rfcCheck.msg : null}
              hint={rfcCheck?.ok ? rfcCheck.msg : undefined}
              trailing={rfcChecking ? <Loader2 className="size-4 animate-spin text-yo-txt-3" /> : rfcCheck?.ok ? <Check className="size-4 text-yo-ok" /> : undefined}
            />
            <Field id="incorporation_date" label="Fecha de constitución" type="date"
              value={f.incorporation_date ?? ""} onChange={(v) => set("incorporation_date", v)} />
          </div>
        </>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field as="select" id="regimen_fiscal" label="Régimen fiscal (SAT)" value={f.regimen_fiscal ?? ""} onChange={(v) => set("regimen_fiscal", v)} required>
          <option value="">Selecciona…</option>
          {regimenes.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
        </Field>
        <Field as="select" id="uso_cfdi_default" label="Uso de CFDI por defecto" value={f.uso_cfdi_default ?? ""} onChange={(v) => set("uso_cfdi_default", v)} required>
          <option value="">Selecciona…</option>
          {USO_CFDI.map((u) => <option key={u.code} value={u.code}>{u.label}</option>)}
        </Field>
      </div>

      {tipo === "persona_moral" && (
        <fieldset className="rounded-xl border border-yo-border bg-yo-raised/50 p-4">
          <legend className="text-xs font-semibold uppercase tracking-widest text-yo-txt-2 px-1">Representante legal</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <Field id="rep_full_name" label="Nombre completo" value={f.rep_full_name ?? ""} onChange={(v) => set("rep_full_name", v)} required />
            <Field id="rep_role" label="Cargo" value={f.rep_role ?? ""} onChange={(v) => set("rep_role", v)} required placeholder="Administrador único" />
            <Field id="rep_rfc" label="RFC del representante" value={f.rep_rfc ?? ""} onChange={(v) => set("rep_rfc", v)} required uppercase maxLength={13} />
            <Field id="rep_curp" label="CURP del representante" value={f.rep_curp ?? ""} onChange={(v) => set("rep_curp", v)} required uppercase maxLength={18} />
          </div>
        </fieldset>
      )}

      <fieldset className="rounded-xl border border-yo-border p-4">
        <legend className="text-xs font-semibold uppercase tracking-widest text-yo-txt-2 px-1">Domicilio fiscal</legend>
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 mt-2">
          <div className="sm:col-span-4"><Field id="fiscal_street" label="Calle" value={f.fiscal_street ?? ""} onChange={(v) => set("fiscal_street", v)} required /></div>
          <Field id="fiscal_ext_number" label="Núm. ext." value={f.fiscal_ext_number ?? ""} onChange={(v) => set("fiscal_ext_number", v)} required />
          <Field id="fiscal_int_number" label="Núm. int." value={f.fiscal_int_number ?? ""} onChange={(v) => set("fiscal_int_number", v)} />
          <div className="sm:col-span-3"><Field id="fiscal_colonia" label="Colonia" value={f.fiscal_colonia ?? ""} onChange={(v) => set("fiscal_colonia", v)} required /></div>
          <div className="sm:col-span-2"><Field id="fiscal_municipio" label="Municipio / Alcaldía" value={f.fiscal_municipio ?? ""} onChange={(v) => set("fiscal_municipio", v)} required /></div>
          <Field id="fiscal_postal_code" label="C.P." value={f.fiscal_postal_code ?? ""} onChange={(v) => set("fiscal_postal_code", v)} required maxLength={5} inputMode="numeric" />
          <div className="sm:col-span-3">
            <Field as="select" id="fiscal_estado" label="Estado" value={f.fiscal_estado ?? ""} onChange={(v) => set("fiscal_estado", v)} required>
              <option value="">Selecciona…</option>
              {ESTADOS_MX.map((e) => <option key={e} value={e}>{e}</option>)}
            </Field>
          </div>
        </div>
      </fieldset>

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-yo-txt-2 hover:text-yo-txt">
          <ArrowLeft className="size-4" /> Regresar
        </button>
        <button onClick={submit} disabled={loading}
          className="inline-flex items-center gap-2 min-h-10 px-5 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold disabled:opacity-50">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <>Continuar <ArrowRight className="size-4" /></>}
        </button>
      </div>
    </div>
  );
}

// ─── STEP 4 — Identidad (documentos) ─────────────────────────────────────────
type DocRow = { id: string; document_type: string; file_name: string | null; status: string; created_at: string };

const DOC_LABELS: Record<string, string> = {
  ine_frente: "INE — Frente",
  ine_reverso: "INE — Reverso",
  passport: "Pasaporte",
  selfie_con_id: "Selfie con identificación",
  acta_constitutiva: "Acta constitutiva",
  poder_notarial: "Poder notarial del representante",
  cedula_fiscal: "Cédula de identificación fiscal",
  constancia_fiscal: "Constancia de situación fiscal",
  proof_of_address: "Comprobante de domicilio",
  other: "Otro documento",
};

function Step4Identity({ onDone, onBack, setError, loading, setLoading }: {
  onDone: () => void; onBack: () => void;
  setError: (s: string | null) => void; loading: boolean; setLoading: (b: boolean) => void;
}) {
  const [tipo, setTipo] = useState<AccountType | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const list = useServerFn(listOwnKycDocuments);
  const upload = useServerFn(uploadKycDocument);
  const remove = useServerFn(deleteOwnKycDocument);

  const required = useMemo(() => tipo === "persona_moral"
    ? ["acta_constitutiva", "poder_notarial", "cedula_fiscal"]
    : ["ine_frente", "ine_reverso"], [tipo]);
  const optional = tipo === "persona_moral"
    ? ["proof_of_address", "selfie_con_id"]
    : ["selfie_con_id", "passport", "proof_of_address"];

  async function refresh() {
    const r = await list();
    setDocs(r as DocRow[]);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id; if (!uid) return;
      supabase.from("profiles").select("account_type").eq("id", uid).maybeSingle().then(({ data: p }) => {
        setTipo((p?.account_type ?? "persona_fisica") as AccountType);
      });
    });
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpload(type: string, file: File) {
    if (file.size > 8 * 1024 * 1024) { setError("Archivo mayor a 8 MB"); return; }
    setLoading(true); setError(null);
    try {
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      await upload({ data: {
        document_type: type as never, file_base64: b64,
        file_name: file.name, mime_type: file.type || "application/octet-stream",
      } });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir archivo");
    } finally { setLoading(false); }
  }

  async function handleRemove(id: string) {
    try { await remove({ data: { id } }); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); }
  }

  const uploaded = new Set(docs.map((d) => d.document_type));
  const allRequiredUploaded = required.every((r) => uploaded.has(r));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Verificación de identidad</h2>
        <p className="mt-1 text-sm text-yo-txt-2">
          Sube documentos legibles (fotos o PDF). Máximo 8 MB por archivo.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-widest font-semibold text-yo-txt-2">Requeridos</p>
        {required.map((t) => (
          <DocUploader key={t} type={t} label={DOC_LABELS[t]} required
            doc={docs.find((d) => d.document_type === t)} onUpload={handleUpload} onRemove={handleRemove}
            disabled={loading} />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-widest font-semibold text-yo-txt-2">Opcionales</p>
        {optional.map((t) => (
          <DocUploader key={t} type={t} label={DOC_LABELS[t]}
            doc={docs.find((d) => d.document_type === t)} onUpload={handleUpload} onRemove={handleRemove}
            disabled={loading} />
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-yo-txt-2 hover:text-yo-txt">
          <ArrowLeft className="size-4" /> Regresar
        </button>
        <button onClick={onDone} disabled={!allRequiredUploaded || loading}
          className="inline-flex items-center gap-2 min-h-10 px-5 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold disabled:opacity-50">
          Continuar <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

function DocUploader({ type, label, doc, onUpload, onRemove, required, disabled }: {
  type: string; label: string; required?: boolean;
  doc?: DocRow; onUpload: (type: string, file: File) => void; onRemove: (id: string) => void; disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputId = `file-${type}`;
  return (
    <div className={"rounded-xl border p-4 transition " + (doc ? "border-yo-ok/30 bg-yo-ok-bg/40" : dragging ? "border-yo-ac bg-yo-ac-bg" : "border-dashed border-yo-border-s bg-yo-surface")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={"grid place-items-center size-9 rounded-md " + (doc ? "bg-yo-ok text-white" : "bg-yo-raised text-yo-txt-2")}>
            {doc ? <Check className="size-4" /> : <FileText className="size-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-yo-txt">
              {label} {required && <span className="text-yo-err">*</span>}
            </p>
            {doc ? (
              <p className="text-xs text-yo-txt-2 truncate">{doc.file_name} · <span className="uppercase">{doc.status}</span></p>
            ) : (
              <p className="text-xs text-yo-txt-3">Arrastra o selecciona un archivo (JPG, PNG o PDF)</p>
            )}
          </div>
        </div>
        {doc ? (
          <button onClick={() => onRemove(doc.id)} disabled={disabled}
            className="inline-flex items-center gap-1.5 text-xs text-yo-err hover:underline">
            <Trash2 className="size-3.5" /> Eliminar
          </button>
        ) : (
          <label htmlFor={inputId} className="inline-flex items-center gap-1.5 text-xs font-semibold text-yo-ac hover:text-yo-ac-h cursor-pointer">
            <Upload className="size-3.5" /> Subir
          </label>
        )}
      </div>
      {!doc && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragging(false);
            const f = e.dataTransfer.files?.[0]; if (f) onUpload(type, f);
          }}
          className="sr-only"
        />
      )}
      <input id={inputId} type="file" accept="image/*,application/pdf" className="hidden"
        disabled={disabled}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(type, f); e.target.value = ""; }} />
    </div>
  );
}

// ─── STEP 5 — CLABE + Penny-test ─────────────────────────────────────────────
function Step5Bank({ onFinished, onBack, setError, loading, setLoading }: {
  onFinished: () => void; onBack: () => void;
  setError: (s: string | null) => void; loading: boolean; setLoading: (b: boolean) => void;
}) {
  const [clabe, setClabe] = useState("");
  const [clabeErr, setClabeErr] = useState<string | null>(null);
  const [banco, setBanco] = useState<string | null>(null);
  const [verId, setVerId] = useState<string | null>(null);
  const [mockCode, setMockCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const registerFn = useServerFn(registerClabe);
  const startFn = useServerFn(startPennyTest);
  const confirmFn = useServerFn(confirmPennyTest);
  const submitFn = useServerFn(submitKyc);

  function onClabeChange(v: string) {
    const c = normalizeClabe(v).slice(0, 18);
    setClabe(c);
    setBanco(getBanco(c));
    if (c.length === 18) {
      const r = validateClabe(c);
      setClabeErr(r.valid ? null : (r.error ?? null));
    } else setClabeErr(null);
  }

  async function registerAndStart() {
    setError(null);
    const r = validateClabe(clabe);
    if (!r.valid) { setClabeErr(r.error ?? "CLABE inválida"); return; }
    setLoading(true);
    try {
      const row = await registerFn({ data: { clabe } });
      setVerId(row.id);
      const p = await startFn({ data: { clabe_verification_id: row.id } });
      setMockCode(p.mockCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setLoading(false); }
  }

  async function confirm() {
    if (!verId) return;
    setError(null); setLoading(true);
    try {
      await confirmFn({ data: { clabe_verification_id: verId, code } });
      setConfirmed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Código incorrecto");
    } finally { setLoading(false); }
  }

  async function finish() {
    setError(null); setLoading(true);
    try { await submitFn({}); onFinished(); }
    catch (e) { setError(e instanceof Error ? e.message : "Error al enviar KYC"); }
    finally { setLoading(false); }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Cuenta bancaria de cobro</h2>
        <p className="mt-1 text-sm text-yo-txt-2">
          Registra la CLABE donde recibirás los fondos liberados. Debe estar a nombre del titular fiscal.
        </p>
      </div>

      <Field id="clabe" label="CLABE interbancaria (18 dígitos)" value={clabe} onChange={onClabeChange}
        required maxLength={18} inputMode="numeric" error={clabeErr}
        hint={banco ? `Banco identificado: ${banco}` : undefined}
        icon={<Landmark className="size-4" />} disabled={!!verId} />

      {!verId && (
        <button onClick={registerAndStart} disabled={loading || clabe.length !== 18 || !!clabeErr}
          className="self-start inline-flex items-center gap-2 min-h-10 px-4 rounded-md bg-yo-txt text-white text-sm font-semibold hover:bg-yo-txt/90 disabled:opacity-50">
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Validar y enviar depósito de prueba"}
        </button>
      )}

      {verId && !confirmed && (
        <div className="rounded-xl border border-yo-ac/25 bg-yo-ac-bg p-4 flex flex-col gap-3">
          <p className="text-sm text-yo-ac-txt font-medium">
            <ShieldCheck className="inline size-4 mr-1" />
            Depósito de $0.01 MXN enviado con referencia MOCK. Ingresa el código de 4 dígitos para confirmar tu titularidad.
          </p>
          {mockCode && (
            <p className="text-xs text-yo-txt-2 bg-yo-surface border border-yo-border rounded-md px-2.5 py-1.5">
              <span className="font-semibold text-yo-warn">MODO SIMULACIÓN:</span> tu código de prueba es <span className="font-mono font-bold">{mockCode}</span> (en producción llegaría por tu estado de cuenta / SMS).
            </p>
          )}
          <div className="flex items-end gap-3">
            <div className="max-w-[160px]">
              <Field id="code" label="Código de 4 dígitos" value={code} onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric" maxLength={4} placeholder="0000" />
            </div>
            <button onClick={confirm} disabled={loading || code.length !== 4}
              className="min-h-10 px-4 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold disabled:opacity-50">
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Confirmar"}
            </button>
          </div>
        </div>
      )}

      {confirmed && (
        <div className="rounded-xl border border-yo-ok/30 bg-yo-ok-bg p-4 text-sm text-yo-ok">
          <Check className="inline size-4 mr-1.5" />
          CLABE verificada. Lista para envío a revisión KYC.
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-yo-txt-2 hover:text-yo-txt">
          <ArrowLeft className="size-4" /> Regresar
        </button>
        <button onClick={finish} disabled={!confirmed || loading}
          className="inline-flex items-center gap-2 min-h-10 px-5 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold disabled:opacity-50">
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Enviar a verificación"}
        </button>
      </div>
    </div>
  );
}
