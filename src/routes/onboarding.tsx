import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, Loader2, Check,
  User as UserIcon, Building2, Upload, Trash2, FileText, ShieldCheck,
  AlertCircle, X, FileCheck2, KeyRound, PencilLine,
  Smartphone, QrCode as QrIcon, RefreshCw, CheckCircle2, Copy, SkipForward,
} from "lucide-react";
import QRCode from "qrcode";
import { startBiometricEnrollment, getMyBiometricEnrollment, cancelBiometricEnrollment } from "@/lib/biometric.functions";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  checkEmailExists, validateRfcServer, getRfcRazonSocial, validateCurpNubarium, saveOnboardingStep,
  uploadKycDocument, listOwnKycDocuments, deleteOwnKycDocument,
  submitKyc,
  validateCsfNubarium, parseEfirma, validateFielSerialNubarium, lookupPostalCode,
} from "@/lib/onboarding.functions";
import {
  checkOrgSlugAvailable, toSlug, validateInviteeIdentity,
  createInvitationDraft, sendPendingInvitationEmails,
} from "@/lib/invitee-onboarding.functions";
import { validateRfc, normalizeRfc } from "@/lib/validations/rfc";
import { validateCurp, normalizeCurp } from "@/lib/validations/curp";
import { REGIMEN_FISICA, REGIMEN_MORAL, ESTADOS_MX } from "@/lib/validations/sat-catalogs";
import { YoktoLogo } from "@/components/logo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Registro — YOKTO" },
      { name: "description", content: "Crea tu cuenta YOKTO y completa la verificación KYC en 6 pasos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingWizard,
});

type AccountType = "persona_fisica" | "persona_moral";
type StepId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const STEPS: Array<{ id: StepId; title: string; desc: string }> = [
  { id: 1, title: "Cuenta",       desc: "Email y contraseña" },
  { id: 2, title: "Tipo",         desc: "Persona física / moral" },
  { id: 3, title: "Fiscal",       desc: "RFC y datos SAT" },
  { id: 4, title: "Identidad",    desc: "Biométrico + documentos" },
  { id: 5, title: "Organización", desc: "Individual o equipo" },
  { id: 6, title: "Token Móvil",  desc: "2FA autenticador" },
  { id: 7, title: "Confirmación", desc: "Revisar y crear" },
];

const LS_KEY = "yokto.onboarding.v1";
const LS_ORG = "yokto.onboarding.orgkind";

export type InviteeDraft = {
  email: string;
  curp_rfc: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  second_last_name?: string;
  role: "buyer_admin" | "buyer_user" | "seller_admin" | "seller_user" | "auditor";
  confirmed: boolean;
};

export type OrgKindDraft = {
  kind: "individual" | "team";
  name?: string;
  slug?: string;
  invitees?: InviteeDraft[];
};


function OnboardingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<StepId>(1);
  const [session, setSession] = useState<{ userId: string; email: string } | null>(null);
  const [pending, setPending] = useState<{ email: string; password: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restaurar sesión + paso (usuario que ya creó cuenta y vuelve)
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
              sessionStorage.setItem("yokto.onboarding.intentional_exit", "1");
              supabase.auth.signOut().finally(() => navigate({ to: "/auth" }));
              return;
            }
            const next = Math.max(2, Math.min(7, (p.onboarding_step ?? 1) + 1)) as StepId;
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




  // Auto-borrado del borrador si el usuario cierra la ventana sin completar.
  // Marca sessionStorage cuando la navegación es intencional dentro del flujo
  // (Volver a /auth, ir a /onboarding/pendiente) para no disparar el borrado.
  useEffect(() => {
    if (!session) return;
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
      ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
    if (!url || !key) return;

    const onHide = () => {
      if (sessionStorage.getItem("yokto.onboarding.intentional_exit") === "1") return;
      supabase.auth.getSession().then(({ data }) => {
        const token = data.session?.access_token;
        if (!token) return;
        try {
          fetch(`${url}/rest/v1/rpc/cancel_my_onboarding`, {
            method: "POST",
            keepalive: true,
            headers: {
              "Content-Type": "application/json",
              apikey: key,
              Authorization: `Bearer ${token}`,
            },
            body: "{}",
          });
        } catch { /* ignore */ }
      });
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [session]);

  return (
    <div className="min-h-dvh bg-yo-bg text-yo-txt">
      <header className="border-b border-yo-border bg-yo-surface">
        <div className="mx-auto max-w-5xl px-5 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2.5"
            onClick={() => { sessionStorage.setItem("yokto.onboarding.intentional_exit", "1"); }}
          >
            <YoktoLogo variant="auto" className="h-6 w-auto" />
          </Link>
          <Link
            to="/auth"
            className="text-sm text-yo-txt-2 hover:text-yo-txt"
            onClick={() => { sessionStorage.setItem("yokto.onboarding.intentional_exit", "1"); }}
          >
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
              initialEmail={pending?.email ?? ""}
              onCredentials={(email, password) => { setPending({ email, password }); goNext(2); }}
              setError={setError} loading={loading} setLoading={setLoading}
            />
          )}
          {step === 2 && (session || pending) && (
            <Step2Type
              pending={pending}
              hasSession={!!session}
              onSessionCreated={(userId, email) => setSession({ userId, email })}
              onSaved={() => { setPending(null); goNext(3); }}
              onBack={goPrev}
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
            <Step4Biometric
              onDone={() => goNext(5)} onBack={goPrev}
              setError={setError}
            />
          )}
          {step === 5 && session && (
            <Step4AccountKind
              onSaved={() => goNext(6)} onBack={goPrev}
              setError={setError}
            />
          )}
          {step === 6 && session && (
            <Step5MFA
              onDone={() => goNext(7)} onBack={goPrev}
              setError={setError} loading={loading} setLoading={setLoading}
            />
          )}
          {step === 7 && session && (
            <Step6Review
              onFinished={() => {
                sessionStorage.setItem("yokto.onboarding.intentional_exit", "1");
                supabase.auth.signOut().finally(() => navigate({ to: "/auth" }));
              }} onBack={goPrev}
              setError={setError} loading={loading} setLoading={setLoading}
            />
          )}

          {step > 2 && !session && (
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
    <ol className="grid grid-cols-7 gap-2" aria-label="Progreso de registro">
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
        {label}{required && <span className="text-yo-err" aria-hidden="true">*</span>}
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

function Step1Account({ initialEmail, onCredentials, setError, loading, setLoading }: {
  initialEmail: string;
  onCredentials: (email: string, password: string) => void;
  setError: (s: string | null) => void; loading: boolean; setLoading: (b: boolean) => void;
}) {
  const [email, setEmail] = useState(initialEmail);
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
  const pwdScore = pwdChecks.filter((c) => c.ok).length + (password.length >= 12 ? 1 : 0);
  const pwdStrength = password.length === 0
    ? { label: "", pct: 0, tone: "bg-yo-border", text: "text-yo-txt-3" }
    : pwdScore <= 1 ? { label: "Muy débil", pct: 20, tone: "bg-yo-err", text: "text-yo-err" }
    : pwdScore === 2 ? { label: "Débil", pct: 40, tone: "bg-orange-500", text: "text-orange-600" }
    : pwdScore === 3 ? { label: "Aceptable", pct: 60, tone: "bg-yellow-500", text: "text-yellow-700" }
    : pwdScore === 4 ? { label: "Fuerte", pct: 85, tone: "bg-emerald-500", text: "text-emerald-600" }
    : { label: "Muy fuerte", pct: 100, tone: "bg-emerald-600", text: "text-emerald-700" };

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

  async function isPasswordBreached(pwd: string): Promise<boolean> {
    try {
      const buf = new TextEncoder().encode(pwd);
      const digest = await crypto.subtle.digest("SHA-1", buf);
      const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
      const prefix = hex.slice(0, 5);
      const suffix = hex.slice(5);
      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, { headers: { "Add-Padding": "true" } });
      if (!res.ok) return false;
      const text = await res.text();
      return text.split("\n").some((line) => line.split(":")[0]?.trim().toUpperCase() === suffix);
    } catch { return false; }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setPwdError(null); setConfirmError(null);
    const ev = z.string().email().safeParse(email);
    if (!ev.success) { setEmailError("Correo inválido"); return; }
    const pv = passwordSchema.safeParse(password);
    if (!pv.success) { setPwdError(pv.error.issues[0]?.message ?? "Contraseña inválida"); return; }
    if (password !== confirm) { setConfirmError("Las contraseñas no coinciden"); return; }
    if (!terms) { setError("Debes aceptar los términos y el aviso de privacidad."); return; }
    if (emailError) return;

    // Verificación final del email y chequeo de fugas de contraseña (HIBP)
    setLoading(true);
    try {
      const [pwned, r] = await Promise.all([
        isPasswordBreached(password),
        checkEmail({ data: { email: email.toLowerCase() } }),
      ]);
      if (pwned) {
        setPwdError("Contraseña insegura. Está en listas de filtraciones conocidas, elige una diferente.");
        return;
      }
      if (r.exists) { setEmailError("Este correo ya tiene una cuenta. Inicia sesión."); return; }
      // Sin signUp aún: se difiere hasta Paso 3 para evitar cuentas huérfanas.
      onCredentials(email.toLowerCase(), password);
    } catch {
      setError("No se pudo validar el correo. Intenta de nuevo.");
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
        {password.length > 0 && (
          <div className="mt-1 flex items-center gap-2" aria-label="Fortaleza de contraseña">
            <div className="flex-1 h-1.5 rounded-full bg-yo-border overflow-hidden">
              <div className={"h-full transition-all duration-300 " + pwdStrength.tone} style={{ width: `${pwdStrength.pct}%` }} />
            </div>
            <span className={"text-[11px] font-semibold min-w-[70px] text-right " + pwdStrength.text}>{pwdStrength.label}</span>
          </div>
        )}
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
function Step2Type({ pending, hasSession, onSessionCreated, onSaved, onBack, setError, loading, setLoading }: {
  pending: { email: string; password: string } | null;
  hasSession: boolean;
  onSessionCreated: (userId: string, email: string) => void;
  onSaved: () => void; onBack: () => void;
  setError: (s: string | null) => void; loading: boolean; setLoading: (b: boolean) => void;
}) {
  const [tipo, setTipo] = useState<AccountType | null>(null);
  const save = useServerFn(saveOnboardingStep);

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

  async function submit() {
    if (!tipo) { setError("Selecciona un tipo de persona"); return; }
    setLoading(true); setError(null);
    try {
      // Si aún no hay sesión, es el momento de crear la cuenta (flujo híbrido).
      if (!hasSession) {
        if (!pending) { setError("Sesión no disponible. Vuelve al paso 1."); return; }
        const { data, error } = await supabase.auth.signUp({
          email: pending.email,
          password: pending.password,
          options: { emailRedirectTo: `${window.location.origin}/onboarding` },
        });
        if (error) throw error;
        if (!data.user) throw new Error("No se pudo crear el usuario");
        if (!data.session) {
          const { error: signErr } = await supabase.auth.signInWithPassword({
            email: pending.email, password: pending.password,
          });
          if (signErr) {
            setError("Cuenta creada. Confirma tu correo e inicia sesión para continuar.");
            return;
          }
        }
        onSessionCreated(data.user.id, data.user.email ?? pending.email);
      }
      await save({ data: { step: 2, account_type: tipo } });
      try { localStorage.setItem(LS_KEY, JSON.stringify({ account_type: tipo })); } catch {}
      onSaved();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Error";
      setError(translateAuthError(raw));
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
type FillMode = "csf" | "efirma" | "manual" | null;

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(bin);
}

function Step3Fiscal({ onSaved, onBack, setError, loading, setLoading }: {
  onSaved: () => void; onBack: () => void;
  setError: (s: string | null) => void; loading: boolean; setLoading: (b: boolean) => void;
}) {
  const [tipo, setTipo] = useState<AccountType | null>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const [rfcCheck, setRfcCheck] = useState<{ msg: string; ok: boolean } | null>(null);
  const [rfcChecking, setRfcChecking] = useState(false);
  const [curpError, setCurpError] = useState<string | null>(null);
  const [curpChecking, setCurpChecking] = useState(false);
  const [curpVerified, setCurpVerified] = useState<null | {
    nombre: string; apellidoPaterno: string; apellidoMaterno: string;
    sexo: string; fechaNacimiento: string | null; estadoNacimiento: string; estatusCurp: string;
  }>(null);
  const [curpBoxOpen, setCurpBoxOpen] = useState(true);
  // RFC Nubarium verification
  const [rfcVerified, setRfcVerified] = useState<null | {
    tipo: "PF" | "PM"; razonSocial: string; nombres: string; apellidoPaterno: string; apellidoMaterno: string; nombreCompleto: string; match: boolean;
  }>(null);
  const [rfcBoxOpen, setRfcBoxOpen] = useState(true);

  // Fiscal-fill flow
  const [fillMode, setFillMode] = useState<FillMode>(null);
  const [csfBusy, setCsfBusy] = useState(false);
  const [csfErr, setCsfErr] = useState<string | null>(null);
  const [csfInfo, setCsfInfo] = useState<null | {
    rfc: string; razonSocial: string; nombreComercial: string;
    regimenCodigo: string; regimenNombre: string; regimenes: string[];
    fechaInicioOperaciones: string | null;
    domicilio: { street: string; ext: string; int: string; colonia: string; municipio: string; estado: string; cp: string };
  }>(null);
  const [csfBoxOpen, setCsfBoxOpen] = useState(true);
  const [efBusy, setEfBusy] = useState(false);
  const [efErr, setEfErr] = useState<string | null>(null);
  const [efInfo, setEfInfo] = useState<null | {
    rfc: string; curp: string; nombre: string; serial: string;
    validFrom: string; validTo: string; vigente: boolean | null;
  }>(null);
  const [efCer, setEfCer] = useState<File | null>(null);
  const [efKey, setEfKey] = useState<File | null>(null);
  const [efPass, setEfPass] = useState("");
  const [efBoxOpen, setEfBoxOpen] = useState(true);

  // Representante legal (PM) — CURP RENAPO
  const [repCurpError, setRepCurpError] = useState<string | null>(null);
  const [repCurpChecking, setRepCurpChecking] = useState(false);
  const [repCurpVerified, setRepCurpVerified] = useState<null | {
    nombre: string; apellidoPaterno: string; apellidoMaterno: string;
    sexo: string; fechaNacimiento: string | null; estadoNacimiento: string; estatusCurp: string;
  }>(null);
  const [repCurpBoxOpen, setRepCurpBoxOpen] = useState(true);

  // Postal code (Copomex) — se muestra sólo tras consulta exitosa
  const [cpBusy, setCpBusy] = useState(false);
  const [cpErr, setCpErr] = useState<string | null>(null);
  const [cpOptions, setCpOptions] = useState<string[] | null>(null);
  const [cpLocked, setCpLocked] = useState(false); // municipio/estado bloqueados tras consulta

  const save = useServerFn(saveOnboardingStep);
  const validateRfcFn = useServerFn(validateRfcServer);
  const getRfcRazonSocialFn = useServerFn(getRfcRazonSocial);
  const validateCurpFn = useServerFn(validateCurpNubarium);
  const validateCsfFn = useServerFn(validateCsfNubarium);
  const parseEfirmaFn = useServerFn(parseEfirma);
  const validateSerialFn = useServerFn(validateFielSerialNubarium);
  const lookupCpFn = useServerFn(lookupPostalCode);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function lookupCP(cp: string, source: "manual" | "efirma" | "csf" = "manual") {
    setCpErr(null); setCpBusy(true);
    try {
      const r = await lookupCpFn({ data: { cp, source } });
      setCpOptions(r.colonias);
      setCpLocked(true);
      setF((p) => ({
        ...p,
        fiscal_postal_code: r.cp,
        fiscal_municipio: r.municipio,
        fiscal_estado: r.estado,
        fiscal_colonia: r.colonias.includes(p.fiscal_colonia ?? "") ? (p.fiscal_colonia ?? "") : "",
      }));
    } catch (e) {
      setCpOptions(null);
      setCpLocked(false);
      setCpErr(e instanceof Error ? e.message : "No se pudo consultar el CP");
    } finally { setCpBusy(false); }
  }

  function onCpChange(v: string) {
    const clean = v.replace(/\D/g, "").slice(0, 5);
    set("fiscal_postal_code", clean);
    if (clean.length < 5) {
      setCpOptions(null); setCpLocked(false); setCpErr(null);
      setF((p) => ({ ...p, fiscal_municipio: "", fiscal_estado: "", fiscal_colonia: "" }));
    } else if (clean.length === 5) {
      void lookupCP(clean, "manual");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        // Fallback a localStorage si no hay sesión o falla la consulta
        const lsRaw = (() => { try { return localStorage.getItem(LS_KEY); } catch { return null; } })();
        const ls = lsRaw ? (JSON.parse(lsRaw) as { account_type?: AccountType }) : null;

        let p: Record<string, unknown> | null = null;
        if (uid) {
          const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
          if (error) console.warn("[onboarding step3] profiles load error", error);
          p = data as Record<string, unknown> | null;
        }
        if (cancelled) return;

        const acct = (p?.account_type as AccountType | undefined) ?? ls?.account_type ?? "persona_fisica";
        setTipo(acct);

        if (p) {
          setF({
            first_name: (p.first_name as string) ?? "", last_name: (p.last_name as string) ?? "",
            second_last_name: (p.second_last_name as string) ?? "", birth_date: (p.birth_date as string) ?? "",
            rfc: (p.rfc as string) ?? "", curp: (p.curp as string) ?? "",
            legal_name: (p.legal_name as string) ?? "", trade_name: (p.trade_name as string) ?? "",
            incorporation_date: (p.incorporation_date as string) ?? "",
            regimen_fiscal: (p.regimen_fiscal as string) ?? "",
            fiscal_street: (p.fiscal_street as string) ?? "", fiscal_ext_number: (p.fiscal_ext_number as string) ?? "",
            fiscal_int_number: (p.fiscal_int_number as string) ?? "", fiscal_colonia: (p.fiscal_colonia as string) ?? "",
            fiscal_municipio: (p.fiscal_municipio as string) ?? "", fiscal_estado: (p.fiscal_estado as string) ?? "",
            fiscal_postal_code: (p.fiscal_postal_code as string) ?? "",
            rep_full_name: (p.legal_rep as { full_name?: string } | null)?.full_name ?? "",
            rep_rfc: (p.legal_rep as { rfc?: string } | null)?.rfc ?? "",
            rep_curp: (p.legal_rep as { curp?: string } | null)?.curp ?? "",
            rep_role: (p.legal_rep as { role?: string } | null)?.role ?? "",
          });
          if (((p.fiscal_postal_code as string) ?? "").length === 5) setCpLocked(true);
        }
      } catch (e) {
        console.error("[onboarding step3] load failed", e);
        if (!cancelled) setTipo("persona_fisica");
      }
    })();
    return () => { cancelled = true; };
  }, []);


  // Auto-cerrar el recuadro de CURP tras 5s
  useEffect(() => {
    if (!curpVerified || !curpBoxOpen) return;
    const t = setTimeout(() => setCurpBoxOpen(false), 5000);
    return () => clearTimeout(t);
  }, [curpVerified, curpBoxOpen]);

  // Auto-cerrar el recuadro de RFC tras 5s (mismo patrón que CURP)
  useEffect(() => {
    if (!rfcVerified || !rfcBoxOpen) return;
    const t = setTimeout(() => setRfcBoxOpen(false), 5000);
    return () => clearTimeout(t);
  }, [rfcVerified, rfcBoxOpen]);

  // Auto-cerrar el recuadro de e.firma tras 5s (sólo si vigente)
  useEffect(() => {
    if (!efInfo || !efBoxOpen) return;
    if (efInfo.vigente === false) return; // mantener visible si NO VIGENTE
    const t = setTimeout(() => setEfBoxOpen(false), 5000);
    return () => clearTimeout(t);
  }, [efInfo, efBoxOpen]);

  async function onRfcBlur() {
    if (!f.rfc) { setRfcCheck(null); setRfcVerified(null); return; }
    const norm = normalizeRfc(f.rfc);
    set("rfc", norm);
    const expected = tipo === "persona_fisica" ? "PF" : "PM";
    const local = validateRfc(norm, expected);
    if (!local.valid) { setRfcCheck({ ok: false, msg: local.error ?? "RFC inválido" }); setRfcVerified(null); return; }
    setRfcChecking(true);
    try {
      const r = await getRfcRazonSocialFn({ data: { rfc: norm, expected } });
      // Comparar nombre completo si es PF y ya se validó CURP
      const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
      const expectedName = tipo === "persona_fisica"
        ? normalize([f.first_name, f.last_name, f.second_last_name].filter(Boolean).join(" "))
        : normalize(f.legal_name ?? "");
      const gotName = normalize(r.nombreCompleto);
      const match = !expectedName || !gotName ? true : (expectedName === gotName || gotName.includes(expectedName) || expectedName.includes(gotName));
      setRfcVerified({
        tipo: r.tipo, razonSocial: r.razonSocial, nombres: r.nombres,
        apellidoPaterno: r.apellidoPaterno, apellidoMaterno: r.apellidoMaterno,
        nombreCompleto: r.nombreCompleto, match,
      });
      setRfcBoxOpen(true);
      setRfcCheck({ ok: match, msg: match ? "RFC verificado en el SAT" : "Los datos vinculados al RFC no coinciden" });
    } catch (e) {
      setRfcCheck({ ok: false, msg: e instanceof Error ? e.message : "No se pudo verificar el RFC" });
      setRfcVerified(null);
    } finally { setRfcChecking(false); }
  }
  function onCurpChange(v: string) {
    const norm = normalizeCurp(v);
    set("curp", norm);
    if (curpVerified) { setCurpVerified(null); setCurpBoxOpen(true); }
    setCurpError(null);
  }
  const validateCurpAction = useCallback(async (curpValue: string) => {
    setCurpError(null);
    const norm = normalizeCurp(curpValue);
    const local = validateCurp(norm);
    if (!local.valid) { setCurpError(local.error ?? "CURP inválida"); return; }
    setCurpChecking(true);
    try {
      const r = await validateCurpFn({ data: { curp: norm } });
      setCurpVerified({
        nombre: r.nombre, apellidoPaterno: r.apellidoPaterno, apellidoMaterno: r.apellidoMaterno,
        sexo: r.sexo, fechaNacimiento: r.fechaNacimiento, estadoNacimiento: r.estadoNacimiento,
        estatusCurp: r.estatusCurp,
      });
      setCurpBoxOpen(true);
      setF((p) => ({
        ...p,
        first_name: r.nombre || p.first_name,
        last_name: r.apellidoPaterno || p.last_name,
        second_last_name: r.apellidoMaterno || p.second_last_name,
        birth_date: r.fechaNacimiento || p.birth_date,
      }));
    } catch (e) {
      setCurpError(e instanceof Error ? e.message : "No se pudo validar la CURP");
    } finally {
      setCurpChecking(false);
    }
  }, [validateCurpFn]);

  // Auto-validar CURP al capturar 18 caracteres válidos (modo manual)
  useEffect(() => {
    if (fillMode !== "manual") return;
    const norm = normalizeCurp(f.curp ?? "");
    if (norm.length !== 18) return;
    if (curpVerified || curpChecking) return;
    if (!validateCurp(norm).valid) return;
    const t = setTimeout(() => { void validateCurpAction(norm); }, 400);
    return () => clearTimeout(t);
  }, [f.curp, fillMode, curpVerified, curpChecking, validateCurpAction]);


  async function onCsfFile(file: File) {
    setCsfErr(null); setCsfBusy(true); setCsfInfo(null); setCsfBoxOpen(true);
    try {
      const b64 = await fileToBase64(file);
      const r = await validateCsfFn({ data: { file_base64: b64, mime_type: file.type || "application/pdf" } });
      const isPM = tipo === "persona_moral";
      const catalog = isPM ? REGIMEN_MORAL : REGIMEN_FISICA;
      // Match régimen por código explícito o por keyword.
      const matched = (r.regimenCodigo && catalog.find((c) => c.code === r.regimenCodigo)) ||
        catalog.find((c) =>
          r.regimenes.some((rg) => rg.toLowerCase().includes(c.label.toLowerCase().split("·")[1]?.trim().slice(0, 15).toLowerCase() ?? ""))
        );
      setF((p) => {
        const next: Record<string, string> = {
          ...p,
          rfc: r.rfc || p.rfc,
          regimen_fiscal: matched?.code ?? r.regimenCodigo ?? p.regimen_fiscal,
          fiscal_street: r.domicilio.street || p.fiscal_street,
          fiscal_ext_number: r.domicilio.ext || p.fiscal_ext_number,
          fiscal_int_number: r.domicilio.int || p.fiscal_int_number,
          fiscal_colonia: r.domicilio.colonia || p.fiscal_colonia,
          fiscal_municipio: r.domicilio.municipio || p.fiscal_municipio,
          fiscal_estado: r.domicilio.estado || p.fiscal_estado,
          fiscal_postal_code: r.domicilio.cp || p.fiscal_postal_code,
        };
        if (isPM) {
          // Concatenar razón social + régimen para el campo legal_name.
          const rs = r.razonSocial || [r.nombres, r.apellidoPaterno, r.apellidoMaterno].filter(Boolean).join(" ").trim();
          const regTag = r.regimenNombre || (matched?.label.split("·")[1]?.trim() ?? "");
          next.legal_name = rs && regTag ? `${rs} · ${regTag}` : (rs || p.legal_name);
          next.trade_name = r.nombreComercial || p.trade_name;
          next.incorporation_date = r.fechaInicioOperaciones || p.incorporation_date;
        } else {
          next.curp = r.curp || p.curp;
        }
        return next;
      });
      setCsfInfo({
        rfc: r.rfc, razonSocial: r.razonSocial, nombreComercial: r.nombreComercial,
        regimenCodigo: r.regimenCodigo, regimenNombre: r.regimenNombre, regimenes: r.regimenes,
        fechaInicioOperaciones: r.fechaInicioOperaciones,
        domicilio: r.domicilio,
      });
      setRfcCheck({ ok: true, msg: "RFC extraído de tu constancia" });
    } catch (e) {
      setCsfErr(e instanceof Error ? e.message : "No se pudo procesar la constancia");
    } finally { setCsfBusy(false); }
  }

  // Auto-cerrar recuadro CSF PM a los 5s
  useEffect(() => {
    if (!csfInfo || !csfBoxOpen) return;
    const t = setTimeout(() => setCsfBoxOpen(false), 5000);
    return () => clearTimeout(t);
  }, [csfInfo, csfBoxOpen]);

  const validateRepCurpAction = useCallback(async (curpValue: string) => {
    setRepCurpError(null);
    const norm = normalizeCurp(curpValue);
    const local = validateCurp(norm);
    if (!local.valid) { setRepCurpError(local.error ?? "CURP inválida"); return; }
    setRepCurpChecking(true);
    try {
      const r = await validateCurpFn({ data: { curp: norm } });
      setRepCurpVerified({
        nombre: r.nombre, apellidoPaterno: r.apellidoPaterno, apellidoMaterno: r.apellidoMaterno,
        sexo: r.sexo, fechaNacimiento: r.fechaNacimiento, estadoNacimiento: r.estadoNacimiento,
        estatusCurp: r.estatusCurp,
      });
      setRepCurpBoxOpen(true);
      setF((p) => ({
        ...p,
        rep_curp: norm,
        rep_full_name: [r.nombre, r.apellidoPaterno, r.apellidoMaterno].filter(Boolean).join(" ").trim() || p.rep_full_name,
      }));
    } catch (e) {
      setRepCurpError(e instanceof Error ? e.message : "No se pudo validar la CURP");
    } finally { setRepCurpChecking(false); }
  }, [validateCurpFn]);

  // Auto-cerrar recuadro CURP representante 5s
  useEffect(() => {
    if (!repCurpVerified || !repCurpBoxOpen) return;
    const t = setTimeout(() => setRepCurpBoxOpen(false), 5000);
    return () => clearTimeout(t);
  }, [repCurpVerified, repCurpBoxOpen]);

  // Auto-validar CURP del representante en modo PM manual/e.firma
  useEffect(() => {
    if (tipo !== "persona_moral") return;
    if (fillMode !== "manual" && fillMode !== "efirma") return;
    const norm = normalizeCurp(f.rep_curp ?? "");
    if (norm.length !== 18) return;
    if (repCurpVerified || repCurpChecking) return;
    if (!validateCurp(norm).valid) return;
    const t = setTimeout(() => { void validateRepCurpAction(norm); }, 400);
    return () => clearTimeout(t);
  }, [f.rep_curp, tipo, fillMode, repCurpVerified, repCurpChecking, validateRepCurpAction]);

  function onRepCurpChange(v: string) {
    const norm = normalizeCurp(v);
    set("rep_curp", norm);
    if (repCurpVerified) { setRepCurpVerified(null); setRepCurpBoxOpen(true); }
    setRepCurpError(null);
  }

  async function runEfirma() {
    if (!efCer || !efKey || !efPass) { setEfErr("Sube tu .cer, .key e ingresa la contraseña"); return; }
    setEfErr(null); setEfBusy(true); setEfInfo(null);
    const isPM = tipo === "persona_moral";
    try {
      const [cerB64, keyB64] = await Promise.all([fileToBase64(efCer), fileToBase64(efKey)]);
      const parsed = await parseEfirmaFn({ data: { cer_base64: cerB64, key_base64: keyB64, password: efPass } });
      let vigente: boolean | null = null;
      try {
        const s = await validateSerialFn({ data: { rfc: parsed.rfc, serial: parsed.serial, serial_hex: parsed.serialHex, valid_to: parsed.validTo } });
        vigente = s.vigente;
      } catch { /* mostramos igual la info */ }

      if (isPM) {
        // PM: RFC del cert → razón social; CURP del cert → representante legal.
        setF((p) => ({ ...p, rfc: parsed.rfc || p.rfc, rep_curp: parsed.curp || p.rep_curp }));
        if (parsed.rfc) {
          try {
            const rr = await getRfcRazonSocialFn({ data: { rfc: parsed.rfc, expected: "PM" } });
            setRfcVerified({
              tipo: rr.tipo, razonSocial: rr.razonSocial, nombres: rr.nombres,
              apellidoPaterno: rr.apellidoPaterno, apellidoMaterno: rr.apellidoMaterno,
              nombreCompleto: rr.nombreCompleto, match: true,
            });
            setRfcBoxOpen(true);
            setF((p) => ({ ...p, legal_name: rr.razonSocial || rr.nombreCompleto || p.legal_name }));
          } catch { /* dejar manual */ }
        }
        if (parsed.curp) {
          try {
            const cu = await validateCurpFn({ data: { curp: parsed.curp } });
            setRepCurpVerified({
              nombre: cu.nombre, apellidoPaterno: cu.apellidoPaterno, apellidoMaterno: cu.apellidoMaterno,
              sexo: cu.sexo, fechaNacimiento: cu.fechaNacimiento, estadoNacimiento: cu.estadoNacimiento,
              estatusCurp: cu.estatusCurp,
            });
            setRepCurpBoxOpen(true);
            setF((p) => ({
              ...p,
              rep_full_name: [cu.nombre, cu.apellidoPaterno, cu.apellidoMaterno].filter(Boolean).join(" ").trim() || p.rep_full_name,
            }));
          } catch { /* editable */ }
        }
      } else if (parsed.curp) {
        // PF: comportamiento original.
        try {
          const cu = await validateCurpFn({ data: { curp: parsed.curp } });
          setCurpVerified({
            nombre: cu.nombre, apellidoPaterno: cu.apellidoPaterno, apellidoMaterno: cu.apellidoMaterno,
            sexo: cu.sexo, fechaNacimiento: cu.fechaNacimiento, estadoNacimiento: cu.estadoNacimiento,
            estatusCurp: cu.estatusCurp,
          });
          setCurpBoxOpen(true);
          setF((p) => ({
            ...p,
            curp: parsed.curp,
            rfc: parsed.rfc || p.rfc,
            first_name: cu.nombre || p.first_name,
            last_name: cu.apellidoPaterno || p.last_name,
            second_last_name: cu.apellidoMaterno || p.second_last_name,
            birth_date: cu.fechaNacimiento || p.birth_date,
          }));
        } catch {
          setF((p) => ({ ...p, curp: parsed.curp, rfc: parsed.rfc || p.rfc }));
        }
      } else {
        setF((p) => ({ ...p, rfc: parsed.rfc || p.rfc }));
      }
      setEfInfo({ ...parsed, vigente });
      setEfBoxOpen(true);
      setRfcCheck({ ok: true, msg: "RFC extraído de tu e.firma" });
    } catch (e) {
      setEfErr(e instanceof Error ? e.message : "No se pudo procesar la e.firma");
    } finally { setEfBusy(false); }
  }

  const regimenes = tipo === "persona_fisica" ? REGIMEN_FISICA : REGIMEN_MORAL;
  const nombreCompleto = [f.first_name, f.last_name, f.second_last_name].filter(Boolean).join(" ").trim();

  async function submit() {
    if (!tipo) return;
    if (tipo === "persona_fisica") {
      if (!fillMode) {
        setError("Selecciona cómo quieres completar tu perfil fiscal");
        return;
      }
      if (fillMode === "manual" && !curpVerified) {
        setError("Debes validar tu CURP antes de continuar");
        return;
      }
      if ((fillMode === "csf" || fillMode === "efirma") && !f.rfc) {
        setError("Sube tu documento para extraer el RFC");
        return;
      }
      if (fillMode === "efirma" && efInfo && efInfo.vigente === false) {
        setError("Tu e.firma aparece como NO VIGENTE en el SAT. No puedes continuar con este método.");
        return;
      }
    }
    if (tipo === "persona_moral") {
      if (!fillMode) { setError("Selecciona cómo quieres completar los datos fiscales de tu empresa"); return; }
      if ((fillMode === "csf" || fillMode === "efirma") && !f.rfc) {
        setError("Sube tu documento para extraer el RFC");
        return;
      }
      if (fillMode === "manual" && !rfcVerified) {
        setError("Valida el RFC de tu empresa antes de continuar");
        return;
      }
      if (fillMode === "efirma" && efInfo && efInfo.vigente === false) {
        setError("Tu e.firma aparece como NO VIGENTE en el SAT. No puedes continuar con este método.");
        return;
      }
      if (!repCurpVerified) {
        setError("Valida la CURP del representante legal");
        return;
      }
    }
    if (!f.regimen_fiscal) {
      setError("Falta el tipo de régimen fiscal. Selecciónalo en la lista.");
      return;
    }
    setError(null); setLoading(true);
    try {
      if (tipo === "persona_fisica") {
        await save({ data: {
          step: 3, account_type: "persona_fisica",
          first_name: f.first_name, last_name: f.last_name,
          second_last_name: f.second_last_name || null,
          birth_date: f.birth_date || null,
          rfc: f.rfc, curp: f.curp,
          regimen_fiscal: f.regimen_fiscal,
          fiscal_street: f.fiscal_street, fiscal_ext_number: f.fiscal_ext_number,
          fiscal_int_number: f.fiscal_int_number || null, fiscal_colonia: f.fiscal_colonia,
          fiscal_municipio: f.fiscal_municipio, fiscal_estado: f.fiscal_estado,
          fiscal_postal_code: f.fiscal_postal_code,
        } });
      } else {
        await save({ data: {
          step: 3, account_type: "persona_moral",
          legal_name: f.legal_name, trade_name: f.trade_name || null,
          rfc: f.rfc, regimen_fiscal: f.regimen_fiscal,
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
      const raw = e instanceof Error ? e.message : "Error al guardar";
      let msg = raw;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed[0]?.message) {
          const issue = parsed[0];
          if (issue.path?.includes("regimen_fiscal")) msg = "Falta el tipo de régimen fiscal. Selecciónalo en la lista.";
          else msg = issue.message;
        }
      } catch { /* not json */ }
      setError(msg);
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
          {/* --- Selector de modo (PRIMER paso) --- */}
          <fieldset className="rounded-xl border border-yo-border p-4">
            <legend className="text-xs font-semibold uppercase tracking-widest text-yo-txt-2 px-1">¿Cómo quieres completar tu perfil fiscal?</legend>
            <p className="mt-2 mb-3 text-sm text-yo-txt-2">
              Elige un método para extraer tu RFC, régimen y domicilio fiscal automáticamente. Si no cuentas con estos documentos, puedes capturarlo manualmente.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <FiscalModeButton icon={<FileCheck2 className="size-4" />} title="Constancia de Situación Fiscal"
                desc="Sube tu CSF en PDF o imagen. No requiere CURP." active={fillMode === "csf"} onClick={() => setFillMode("csf")} />
              <FiscalModeButton icon={<KeyRound className="size-4" />} title="e.firma vigente"
                desc="Extrae RFC y CURP del certificado SAT." active={fillMode === "efirma"} onClick={() => setFillMode("efirma")} />
              <FiscalModeButton icon={<PencilLine className="size-4" />} title="Manualmente"
                desc="Valida tu CURP y captura RFC y régimen." active={fillMode === "manual"} onClick={() => setFillMode("manual")} />
            </div>
          </fieldset>

          {/* --- CSF --- */}
          {fillMode === "csf" && (
            <fieldset className="rounded-xl border border-yo-border p-4">
              <legend className="text-xs font-semibold uppercase tracking-widest text-yo-txt-2 px-1">Constancia de Situación Fiscal</legend>
              <div className="mt-3 rounded-lg border border-dashed border-yo-border bg-yo-raised/40 p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="inline-flex items-center gap-2 min-h-10 px-4 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold">
                    {csfBusy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    Subir constancia
                  </div>
                  <span className="text-xs text-yo-txt-3">PDF, JPG o PNG · máx 8 MB</span>
                  <input type="file" accept="application/pdf,image/*" className="hidden"
                    onChange={(e) => { const fi = e.target.files?.[0]; if (fi) void onCsfFile(fi); }} />
                </label>
                {csfErr && <p className="mt-2 text-xs text-yo-err">{csfErr}</p>}
                {csfInfo && (
                  <div className="mt-3 text-xs text-yo-txt-2">
                    <p className="text-yo-ok font-semibold">Constancia leída correctamente.</p>
                    {csfInfo.regimenes.length > 0 && (
                      <p className="mt-1">Regímenes SAT: {csfInfo.regimenes.join(" · ")}</p>
                    )}
                  </div>
                )}
              </div>
            </fieldset>
          )}

          {/* --- e.firma --- */}
          {fillMode === "efirma" && (
            <fieldset className="rounded-xl border border-yo-border p-4">
              <legend className="text-xs font-semibold uppercase tracking-widest text-yo-txt-2 px-1">e.firma vigente</legend>
              <p className="mt-2 mb-3 text-xs text-yo-txt-3">
                Necesitas tres cosas: el certificado <code className="font-mono">.cer</code>, la llave privada <code className="font-mono">.key</code> y la contraseña de la llave.
                Los archivos se procesan en el servidor y no se almacenan.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <EfirmaDropzone label="Certificado (.cer)" accept=".cer,application/x-x509-ca-cert,application/octet-stream"
                  file={efCer} onFile={setEfCer} icon={<FileCheck2 className="size-4" />} />
                <EfirmaDropzone label="Llave privada (.key)" accept=".key,application/octet-stream"
                  file={efKey} onFile={setEfKey} icon={<KeyRound className="size-4" />} />
              </div>
              <div className="mt-3">
                <Field id="ef_pass" label="Contraseña de la llave privada" type="password" value={efPass} onChange={setEfPass}
                  placeholder="La que definiste al tramitar tu e.firma" />
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button type="button" onClick={runEfirma} disabled={efBusy || !efCer || !efKey || !efPass}
                  className="inline-flex items-center gap-2 min-h-10 px-4 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold disabled:opacity-50">
                  {efBusy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                  Validar e.firma
                </button>
                {efErr && <p className="text-xs text-yo-err">{efErr}</p>}
              </div>
              {efInfo && efBoxOpen && (
                <div className={cn(
                  "relative mt-3 rounded-lg border p-3 pr-9 text-sm",
                  efInfo.vigente === false
                    ? "border-yo-danger/50 bg-yo-danger/10 text-yo-txt"
                    : "border-yo-ok/30 bg-yo-ok/5"
                )}>
                  <button type="button" onClick={() => setEfBoxOpen(false)}
                    aria-label="Cerrar" title="Cerrar"
                    className="absolute top-2 right-2 p-1 rounded-md text-yo-txt-3 hover:text-yo-txt hover:bg-yo-raised">
                    <X className="size-4" />
                  </button>
                  <div className={cn("flex items-center gap-2 font-semibold",
                    efInfo.vigente === false ? "text-yo-danger" : "text-yo-ok")}>
                    {efInfo.vigente === false
                      ? <><AlertCircle className="size-4" /> e.firma NO VIGENTE en el SAT</>
                      : <><Check className="size-4" /> e.firma leída correctamente</>}
                  </div>
                  <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-yo-txt">
                    <div><dt className="text-xs text-yo-txt-3">RFC</dt><dd>{efInfo.rfc}</dd></div>
                    <div><dt className="text-xs text-yo-txt-3">CURP</dt><dd>{efInfo.curp || "—"}</dd></div>
                    <div className="sm:col-span-2"><dt className="text-xs text-yo-txt-3">Titular</dt><dd>{efInfo.nombre}</dd></div>
                    <div><dt className="text-xs text-yo-txt-3">Serial</dt><dd className="font-mono">{efInfo.serial}</dd></div>
                    <div><dt className="text-xs text-yo-txt-3">Vigencia SAT</dt>
                      <dd className={efInfo.vigente === false ? "text-yo-danger font-semibold" : ""}>
                        {efInfo.vigente === true ? "VIGENTE" : efInfo.vigente === false ? "NO VIGENTE" : "No verificado"}
                      </dd></div>
                    <div><dt className="text-xs text-yo-txt-3">Válido desde</dt><dd>{new Date(efInfo.validFrom).toLocaleDateString("es-MX")}</dd></div>
                    <div><dt className="text-xs text-yo-txt-3">Válido hasta</dt><dd>{new Date(efInfo.validTo).toLocaleDateString("es-MX")}</dd></div>
                  </dl>
                  {efInfo.vigente === false ? (
                    <p className="mt-2 text-[12px] text-yo-danger">
                      No puedes continuar con este método. Renueva tu e.firma en el SAT o usa otro método (Constancia o Manual).
                    </p>
                  ) : (
                    <p className="mt-2 text-[11px] text-yo-txt-3">Este recuadro se cerrará automáticamente en 5 segundos.</p>
                  )}
                </div>
              )}
            </fieldset>
          )}

          {/* --- Manual: CURP + RENAPO --- */}
          {fillMode === "manual" && (
            <div className="rounded-xl border border-yo-border bg-yo-raised/40 p-4 flex flex-col gap-2">
              <p className="text-xs text-yo-txt-3">Consulta oficial en RENAPO para autocompletar tus datos personales.</p>
              <Field id="curp" label="CURP (18 caracteres)" value={f.curp ?? ""} onChange={onCurpChange}
                required uppercase maxLength={18} error={curpError}
                trailing={
                  curpChecking ? <Loader2 className="size-4 animate-spin text-yo-txt-3" /> :
                  curpVerified ? <Check className="size-4 text-yo-ok" /> :
                  undefined
                }
                hint={
                  curpChecking ? "Consultando RENAPO…" :
                  curpVerified ? "Validada automáticamente en RENAPO." :
                  "La validación se ejecuta automáticamente al capturar los 18 caracteres."
                }
              />
            </div>
          )}

          {/* Recuadro CURP verificada (aplica a manual y e.firma) */}
          {curpVerified && curpBoxOpen && (
            <div className="relative rounded-lg border border-yo-ok/30 bg-yo-ok/5 p-3 pr-9 text-sm">
              <button type="button" onClick={() => setCurpBoxOpen(false)}
                aria-label="Cerrar" title="Cerrar"
                className="absolute top-2 right-2 p-1 rounded-md text-yo-txt-3 hover:text-yo-txt hover:bg-yo-raised">
                <X className="size-4" />
              </button>
              <div className="flex items-center gap-2 text-yo-ok font-semibold">
                <Check className="size-4" /> CURP verificada en RENAPO
              </div>
              <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-yo-txt">
                <div><dt className="text-xs text-yo-txt-3">Nombre</dt><dd>{curpVerified.nombre}</dd></div>
                <div><dt className="text-xs text-yo-txt-3">Apellido paterno</dt><dd>{curpVerified.apellidoPaterno}</dd></div>
                <div><dt className="text-xs text-yo-txt-3">Apellido materno</dt><dd>{curpVerified.apellidoMaterno || "—"}</dd></div>
                <div><dt className="text-xs text-yo-txt-3">Fecha de nacimiento</dt><dd>{curpVerified.fechaNacimiento ?? "—"}</dd></div>
                <div><dt className="text-xs text-yo-txt-3">Sexo</dt><dd>{curpVerified.sexo}</dd></div>
                <div><dt className="text-xs text-yo-txt-3">Estado de nacimiento</dt><dd>{curpVerified.estadoNacimiento}</dd></div>
              </dl>
              <p className="mt-2 text-[11px] text-yo-txt-3">Este recuadro se cerrará automáticamente en 5 segundos.</p>
            </div>
          )}
          {curpVerified && !curpBoxOpen && (
            <div className="inline-flex items-center gap-2 text-xs text-yo-ok">
              <Check className="size-3.5" /> CURP validada — {curpVerified.nombre} {curpVerified.apellidoPaterno}
              <button type="button" onClick={() => setCurpBoxOpen(true)} className="underline text-yo-txt-3 hover:text-yo-txt">Ver detalle</button>
            </div>
          )}

          {/* Datos personales (bloqueados) — sólo con CURP validada (manual o e.firma) */}
          {curpVerified && (
            <fieldset className="rounded-xl border border-yo-border p-4">
              <legend className="text-xs font-semibold uppercase tracking-widest text-yo-txt-2 px-1">Datos personales</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <Field id="first_name" label="Nombre(s)" value={f.first_name ?? ""} onChange={() => {}} disabled />
                <Field id="last_name" label="Apellido paterno" value={f.last_name ?? ""} onChange={() => {}} disabled />
                <Field id="second_last_name" label="Apellido materno" value={f.second_last_name ?? ""} onChange={() => {}} disabled />
                <Field id="estado_nacimiento" label="Estado de nacimiento" value={curpVerified.estadoNacimiento || ""} onChange={() => {}} disabled />
                <Field id="birth_date" label="Fecha de nacimiento" type="date" value={f.birth_date ?? ""} onChange={() => {}} disabled />
                <Field id="sexo_display" label="Sexo" value={curpVerified.sexo} onChange={() => {}} disabled />
              </div>
              <p className="mt-2 text-[11px] text-yo-txt-3">Estos datos provienen de RENAPO y no son editables.</p>
            </fieldset>
          )}

          {/* RFC + Régimen (siempre que haya un modo elegido) */}
          {fillMode && (
            <fieldset className="rounded-xl border border-yo-border p-4">
              <legend className="text-xs font-semibold uppercase tracking-widest text-yo-txt-2 px-1">RFC y régimen</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <Field id="rfc" label="RFC (13 caracteres)" value={f.rfc ?? ""} onChange={(v) => set("rfc", v)} required uppercase maxLength={13}
                  onBlur={onRfcBlur} error={rfcCheck && !rfcCheck.ok ? rfcCheck.msg : null}
                  hint={rfcCheck?.ok ? rfcCheck.msg : undefined}
                  disabled={fillMode !== "manual"}
                  trailing={rfcChecking ? <Loader2 className="size-4 animate-spin text-yo-txt-3" /> : rfcCheck?.ok ? <Check className="size-4 text-yo-ok" /> : undefined}
                />
                <Field as="select" id="regimen_fiscal" label="Régimen fiscal (SAT)" value={f.regimen_fiscal ?? ""} onChange={(v) => set("regimen_fiscal", v)} required>
                  <option value="">Selecciona…</option>
                  {regimenes.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                </Field>
              </div>
              {rfcVerified && rfcBoxOpen && (
                <div className={cn(
                  "mt-3 rounded-lg border p-3 text-[12.5px]",
                  rfcVerified.match ? "border-yo-ok/40 bg-yo-ok/5 text-yo-txt" : "border-yo-danger/40 bg-yo-danger/5 text-yo-txt"
                )}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold">{rfcVerified.match ? "RFC verificado en el SAT" : "Los datos vinculados al RFC no coinciden"}</p>
                      <p className="mt-1 text-yo-txt-2"><span className="text-yo-txt-3">Nombre / Razón social:</span> {rfcVerified.nombreCompleto || rfcVerified.razonSocial || "—"}</p>
                      <p className={cn("mt-1 text-[11px]", rfcVerified.match ? "text-yo-ok" : "text-yo-danger")}>
                        {rfcVerified.match ? "El nombre coincide con los datos personales." : "El nombre no coincide con los datos personales capturados."}
                      </p>
                    </div>
                    <button type="button" onClick={() => setRfcBoxOpen(false)} className="text-yo-txt-3 hover:text-yo-txt text-xs">Cerrar</button>
                  </div>
                  <p className="mt-2 text-[11px] text-yo-txt-3">Este recuadro se cerrará automáticamente en 5 segundos.</p>
                </div>
              )}
              {rfcVerified && !rfcBoxOpen && (
                <div className="mt-3 inline-flex items-center gap-2 text-xs">
                  <Check className={cn("size-3.5", rfcVerified.match ? "text-yo-ok" : "text-yo-danger")} />
                  <span className={rfcVerified.match ? "text-yo-ok" : "text-yo-danger"}>
                    {rfcVerified.match ? "RFC validado" : "RFC no coincide"} — {rfcVerified.nombreCompleto || rfcVerified.razonSocial || "—"}
                  </span>
                  <button type="button" onClick={() => setRfcBoxOpen(true)} className="underline text-yo-txt-3 hover:text-yo-txt">Ver detalle</button>
                </div>
              )}
              {fillMode !== "manual" && (
                <p className="mt-2 text-[11px] text-yo-txt-3">RFC extraído automáticamente del documento.</p>
              )}
            </fieldset>
          )}
        </>
      ) : (
        <>
          {/* --- Selector de modo (PRIMER paso) --- */}
          <fieldset className="rounded-xl border border-yo-border p-4">
            <legend className="text-xs font-semibold uppercase tracking-widest text-yo-txt-2 px-1">¿Cómo quieres completar los datos fiscales de tu empresa?</legend>
            <p className="mt-2 mb-3 text-sm text-yo-txt-2">
              Elige un método para extraer RFC, razón social, régimen y domicilio automáticamente. Si no cuentas con estos documentos, puedes capturarlo manualmente.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <FiscalModeButton icon={<FileCheck2 className="size-4" />} title="Constancia de Situación Fiscal"
                desc="Sube la CSF de tu empresa (PDF o imagen)." active={fillMode === "csf"} onClick={() => setFillMode("csf")} />
              <FiscalModeButton icon={<KeyRound className="size-4" />} title="e.firma vigente"
                desc="Extrae RFC de la empresa y CURP del representante." active={fillMode === "efirma"} onClick={() => setFillMode("efirma")} />
              <FiscalModeButton icon={<PencilLine className="size-4" />} title="Manualmente"
                desc="Captura el RFC y valida la razón social en el SAT." active={fillMode === "manual"} onClick={() => setFillMode("manual")} />
            </div>
          </fieldset>

          {/* --- CSF --- */}
          {fillMode === "csf" && (
            <fieldset className="rounded-xl border border-yo-border p-4">
              <legend className="text-xs font-semibold uppercase tracking-widest text-yo-txt-2 px-1">Constancia de Situación Fiscal</legend>
              <div className="mt-3 rounded-lg border border-dashed border-yo-border bg-yo-raised/40 p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="inline-flex items-center gap-2 min-h-10 px-4 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold">
                    {csfBusy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    Subir constancia
                  </div>
                  <span className="text-xs text-yo-txt-3">PDF, JPG o PNG · máx 8 MB</span>
                  <input type="file" accept="application/pdf,image/*" className="hidden"
                    onChange={(e) => { const fi = e.target.files?.[0]; if (fi) void onCsfFile(fi); }} />
                </label>
                {csfErr && <p className="mt-2 text-xs text-yo-err">{csfErr}</p>}
              </div>
              {csfInfo && csfBoxOpen && (
                <div className="relative mt-3 rounded-lg border border-yo-ok/30 bg-yo-ok/5 p-3 pr-9 text-sm">
                  <button type="button" onClick={() => setCsfBoxOpen(false)} aria-label="Cerrar"
                    className="absolute top-2 right-2 p-1 rounded-md text-yo-txt-3 hover:text-yo-txt hover:bg-yo-raised">
                    <X className="size-4" />
                  </button>
                  <div className="flex items-center gap-2 text-yo-ok font-semibold">
                    <Check className="size-4" /> Constancia leída correctamente
                  </div>
                  <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-yo-txt text-[13px]">
                    <div><dt className="text-xs text-yo-txt-3">RFC</dt><dd className="font-mono">{csfInfo.rfc || "—"}</dd></div>
                    <div><dt className="text-xs text-yo-txt-3">Razón social</dt><dd>{csfInfo.razonSocial || "—"}</dd></div>
                    <div><dt className="text-xs text-yo-txt-3">Nombre comercial</dt><dd>{csfInfo.nombreComercial || "—"}</dd></div>
                    <div><dt className="text-xs text-yo-txt-3">Régimen</dt><dd>{csfInfo.regimenNombre || csfInfo.regimenes[0] || "—"}</dd></div>
                    <div><dt className="text-xs text-yo-txt-3">Fecha de constitución</dt><dd>{csfInfo.fechaInicioOperaciones || "—"}</dd></div>
                    <div><dt className="text-xs text-yo-txt-3">CP</dt><dd>{csfInfo.domicilio.cp || "—"}</dd></div>
                    <div className="sm:col-span-2"><dt className="text-xs text-yo-txt-3">Domicilio</dt>
                      <dd>{[csfInfo.domicilio.street, csfInfo.domicilio.ext, csfInfo.domicilio.colonia, csfInfo.domicilio.municipio, csfInfo.domicilio.estado].filter(Boolean).join(", ") || "—"}</dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-[11px] text-yo-txt-3">Este recuadro se cerrará automáticamente en 5 segundos.</p>
                </div>
              )}
              {csfInfo && !csfBoxOpen && (
                <div className="mt-3 inline-flex items-center gap-2 text-xs text-yo-ok">
                  <Check className="size-3.5" /> Constancia leída — {csfInfo.razonSocial || csfInfo.rfc}
                  <button type="button" onClick={() => setCsfBoxOpen(true)} className="underline text-yo-txt-3 hover:text-yo-txt">Ver detalle</button>
                </div>
              )}
            </fieldset>
          )}

          {/* --- e.firma --- */}
          {fillMode === "efirma" && (
            <fieldset className="rounded-xl border border-yo-border p-4">
              <legend className="text-xs font-semibold uppercase tracking-widest text-yo-txt-2 px-1">e.firma vigente (PM)</legend>
              <p className="mt-2 mb-3 text-xs text-yo-txt-3">
                Sube el <code className="font-mono">.cer</code> y <code className="font-mono">.key</code> de la empresa. Del certificado extraemos el RFC de la empresa y la CURP del representante legal.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <EfirmaDropzone label="Certificado (.cer)" accept=".cer,application/x-x509-ca-cert,application/octet-stream"
                  file={efCer} onFile={setEfCer} icon={<FileCheck2 className="size-4" />} />
                <EfirmaDropzone label="Llave privada (.key)" accept=".key,application/octet-stream"
                  file={efKey} onFile={setEfKey} icon={<KeyRound className="size-4" />} />
              </div>
              <div className="mt-3">
                <Field id="ef_pass_pm" label="Contraseña de la llave privada" type="password" value={efPass} onChange={setEfPass} />
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button type="button" onClick={runEfirma} disabled={efBusy || !efCer || !efKey || !efPass}
                  className="inline-flex items-center gap-2 min-h-10 px-4 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold disabled:opacity-50">
                  {efBusy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                  Validar e.firma
                </button>
                {efErr && <p className="text-xs text-yo-err">{efErr}</p>}
              </div>
              {efInfo && efBoxOpen && (
                <div className={cn(
                  "relative mt-3 rounded-lg border p-3 pr-9 text-sm",
                  efInfo.vigente === false ? "border-yo-danger/50 bg-yo-danger/10 text-yo-txt" : "border-yo-ok/30 bg-yo-ok/5"
                )}>
                  <button type="button" onClick={() => setEfBoxOpen(false)} aria-label="Cerrar"
                    className="absolute top-2 right-2 p-1 rounded-md text-yo-txt-3 hover:text-yo-txt hover:bg-yo-raised">
                    <X className="size-4" />
                  </button>
                  <div className={cn("flex items-center gap-2 font-semibold", efInfo.vigente === false ? "text-yo-danger" : "text-yo-ok")}>
                    {efInfo.vigente === false
                      ? <><AlertCircle className="size-4" /> e.firma NO VIGENTE en el SAT</>
                      : <><Check className="size-4" /> e.firma leída correctamente</>}
                  </div>
                  <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-yo-txt">
                    <div><dt className="text-xs text-yo-txt-3">RFC empresa</dt><dd className="font-mono">{efInfo.rfc}</dd></div>
                    <div><dt className="text-xs text-yo-txt-3">CURP representante</dt><dd className="font-mono">{efInfo.curp || "—"}</dd></div>
                    <div className="sm:col-span-2"><dt className="text-xs text-yo-txt-3">Titular del certificado</dt><dd>{efInfo.nombre}</dd></div>
                    <div><dt className="text-xs text-yo-txt-3">Serial</dt><dd className="font-mono">{efInfo.serial}</dd></div>
                    <div><dt className="text-xs text-yo-txt-3">Vigencia SAT</dt>
                      <dd className={efInfo.vigente === false ? "text-yo-danger font-semibold" : ""}>
                        {efInfo.vigente === true ? "VIGENTE" : efInfo.vigente === false ? "NO VIGENTE" : "No verificado"}
                      </dd></div>
                    <div><dt className="text-xs text-yo-txt-3">Válido hasta</dt><dd>{new Date(efInfo.validTo).toLocaleDateString("es-MX")}</dd></div>
                  </dl>
                  {efInfo.vigente === false && (
                    <p className="mt-2 text-[12px] text-yo-danger">
                      No puedes continuar con este método. Renueva la e.firma en el SAT o usa otro método.
                    </p>
                  )}
                </div>
              )}
            </fieldset>
          )}

          {/* --- Datos fiscales de la empresa --- */}
          {fillMode && (
            <fieldset className="rounded-xl border border-yo-border p-4">
              <legend className="text-xs font-semibold uppercase tracking-widest text-yo-txt-2 px-1">Datos de la empresa</legend>
              {(fillMode === "manual" || fillMode === "efirma") && (
                <p className="mt-2 mb-3 text-[12px] text-yo-txt-3 rounded-md border border-yo-warn/30 bg-yo-warn/5 p-2">
                  La información capturada manualmente será revisada por el equipo de YOKTO antes de completar tu registro.
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <Field id="rfc" label="RFC (12 caracteres)" value={f.rfc ?? ""} onChange={(v) => set("rfc", v)} required uppercase maxLength={12}
                  onBlur={fillMode === "manual" ? onRfcBlur : undefined}
                  disabled={fillMode !== "manual"}
                  error={rfcCheck && !rfcCheck.ok ? rfcCheck.msg : null}
                  hint={rfcCheck?.ok ? rfcCheck.msg : undefined}
                  trailing={rfcChecking ? <Loader2 className="size-4 animate-spin text-yo-txt-3" /> : rfcCheck?.ok ? <Check className="size-4 text-yo-ok" /> : undefined}
                />
                <Field id="legal_name" label="Razón social" value={f.legal_name ?? ""} onChange={(v) => set("legal_name", v)} required
                  disabled={fillMode === "csf" || fillMode === "efirma"} />
                <Field id="trade_name" label="Nombre comercial (opcional)" value={f.trade_name ?? ""} onChange={(v) => set("trade_name", v)}
                  disabled={fillMode === "csf"} />
                <Field id="incorporation_date" label="Fecha de constitución" type="date"
                  value={f.incorporation_date ?? ""} onChange={(v) => set("incorporation_date", v)}
                  disabled={fillMode === "csf"} required />
                <Field as="select" id="regimen_fiscal" label="Régimen fiscal (SAT)" value={f.regimen_fiscal ?? ""} onChange={(v) => set("regimen_fiscal", v)} required
                  disabled={fillMode === "csf"}>
                  <option value="">Selecciona…</option>
                  {regimenes.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                </Field>
              </div>
              {rfcVerified && rfcBoxOpen && (
                <div className={cn("mt-3 rounded-lg border p-3 text-[12.5px]",
                  rfcVerified.match ? "border-yo-ok/40 bg-yo-ok/5 text-yo-txt" : "border-yo-danger/40 bg-yo-danger/5 text-yo-txt")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold">{rfcVerified.match ? "RFC verificado en el SAT" : "El RFC no fue localizado o no coincide"}</p>
                      <p className="mt-1 text-yo-txt-2"><span className="text-yo-txt-3">Razón social:</span> {rfcVerified.razonSocial || rfcVerified.nombreCompleto || "—"}</p>
                    </div>
                    <button type="button" onClick={() => setRfcBoxOpen(false)} className="text-yo-txt-3 hover:text-yo-txt text-xs">Cerrar</button>
                  </div>
                  <p className="mt-2 text-[11px] text-yo-txt-3">Este recuadro se cerrará automáticamente en 5 segundos.</p>
                </div>
              )}
              {rfcVerified && !rfcBoxOpen && (
                <div className="mt-3 inline-flex items-center gap-2 text-xs">
                  <Check className={cn("size-3.5", rfcVerified.match ? "text-yo-ok" : "text-yo-danger")} />
                  <span className={rfcVerified.match ? "text-yo-ok" : "text-yo-danger"}>
                    {rfcVerified.razonSocial || rfcVerified.nombreCompleto || "RFC verificado"}
                  </span>
                  <button type="button" onClick={() => setRfcBoxOpen(true)} className="underline text-yo-txt-3 hover:text-yo-txt">Ver detalle</button>
                </div>
              )}
            </fieldset>
          )}
        </>
      )}

      {tipo === "persona_moral" && fillMode && (
        <fieldset className="rounded-xl border border-yo-border bg-yo-raised/50 p-4">
          <legend className="text-xs font-semibold uppercase tracking-widest text-yo-txt-2 px-1">Representante legal</legend>
          <p className="mt-2 mb-3 text-xs text-yo-txt-3">
            Captura la CURP del representante — validamos automáticamente en RENAPO y prellenamos su nombre.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <Field id="rep_curp" label="CURP del representante (18)" value={f.rep_curp ?? ""} onChange={onRepCurpChange}
              required uppercase maxLength={18} error={repCurpError}
              disabled={fillMode === "efirma"}
              trailing={
                repCurpChecking ? <Loader2 className="size-4 animate-spin text-yo-txt-3" /> :
                repCurpVerified ? <Check className="size-4 text-yo-ok" /> : undefined
              }
              hint={repCurpChecking ? "Consultando RENAPO…" : repCurpVerified ? "Validada en RENAPO." : "La validación se ejecuta automáticamente al capturar los 18 caracteres."}
            />
            <Field id="rep_full_name" label="Nombre completo" value={f.rep_full_name ?? ""} onChange={(v) => set("rep_full_name", v)} required
              disabled={!!repCurpVerified} />
            <Field id="rep_rfc" label="RFC del representante" value={f.rep_rfc ?? ""} onChange={(v) => set("rep_rfc", v)} required uppercase maxLength={13} />
            <Field id="rep_role" label="Cargo" value={f.rep_role ?? ""} onChange={(v) => set("rep_role", v)} required placeholder="Administrador único" />
          </div>
          {repCurpVerified && repCurpBoxOpen && (
            <div className="relative mt-3 rounded-lg border border-yo-ok/30 bg-yo-ok/5 p-3 pr-9 text-sm">
              <button type="button" onClick={() => setRepCurpBoxOpen(false)} aria-label="Cerrar"
                className="absolute top-2 right-2 p-1 rounded-md text-yo-txt-3 hover:text-yo-txt hover:bg-yo-raised">
                <X className="size-4" />
              </button>
              <div className="flex items-center gap-2 text-yo-ok font-semibold">
                <Check className="size-4" /> CURP del representante verificada en RENAPO
              </div>
              <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-yo-txt">
                <div><dt className="text-xs text-yo-txt-3">Nombre</dt><dd>{repCurpVerified.nombre}</dd></div>
                <div><dt className="text-xs text-yo-txt-3">Apellido paterno</dt><dd>{repCurpVerified.apellidoPaterno}</dd></div>
                <div><dt className="text-xs text-yo-txt-3">Apellido materno</dt><dd>{repCurpVerified.apellidoMaterno || "—"}</dd></div>
                <div><dt className="text-xs text-yo-txt-3">Fecha de nacimiento</dt><dd>{repCurpVerified.fechaNacimiento ?? "—"}</dd></div>
                <div><dt className="text-xs text-yo-txt-3">Sexo</dt><dd>{repCurpVerified.sexo}</dd></div>
                <div><dt className="text-xs text-yo-txt-3">Estado de nacimiento</dt><dd>{repCurpVerified.estadoNacimiento}</dd></div>
              </dl>
              <p className="mt-2 text-[11px] text-yo-txt-3">Este recuadro se cerrará automáticamente en 5 segundos.</p>
            </div>
          )}
          {repCurpVerified && !repCurpBoxOpen && (
            <div className="mt-3 inline-flex items-center gap-2 text-xs text-yo-ok">
              <Check className="size-3.5" /> CURP validada — {repCurpVerified.nombre} {repCurpVerified.apellidoPaterno}
              <button type="button" onClick={() => setRepCurpBoxOpen(true)} className="underline text-yo-txt-3 hover:text-yo-txt">Ver detalle</button>
            </div>
          )}
        </fieldset>
      )}

      {(() => {
        const showAddress = !!fillMode;
        if (!showAddress) return null;
        const cpFromCsf = fillMode === "csf" && !!f.fiscal_postal_code;
        const showRest = cpLocked || cpFromCsf;
        return (
          <fieldset className="rounded-xl border border-yo-border p-4">
            <legend className="text-xs font-semibold uppercase tracking-widest text-yo-txt-2 px-1">Domicilio fiscal</legend>
            <p className="mt-2 mb-3 text-xs text-yo-txt-3">
              {fillMode === "csf"
                ? "Datos extraídos de tu Constancia de Situación Fiscal."
                : "Ingresa tu código postal — consultaremos automáticamente municipio, estado y colonias disponibles."}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              <div className="sm:col-span-2">
                <Field
                  id="fiscal_postal_code" label="Código postal" value={f.fiscal_postal_code ?? ""}
                  onChange={fillMode === "csf" ? (v) => set("fiscal_postal_code", v) : onCpChange}
                  required maxLength={5} inputMode="numeric" disabled={fillMode === "csf"}
                  error={cpErr}
                  trailing={cpBusy ? <Loader2 className="size-4 animate-spin text-yo-txt-3" /> : cpLocked ? <Check className="size-4 text-yo-ok" /> : undefined}
                  hint={!cpLocked && !cpErr && (f.fiscal_postal_code ?? "").length < 5 ? "5 dígitos" : undefined}
                />
              </div>
              {showRest && (
                <>
                  <div className="sm:col-span-2">
                    <Field id="fiscal_municipio" label="Municipio / Alcaldía" value={f.fiscal_municipio ?? ""} onChange={(v) => set("fiscal_municipio", v)} required disabled={fillMode !== "csf" ? cpLocked : true} />
                  </div>
                  <div className="sm:col-span-2">
                    <Field as="select" id="fiscal_estado" label="Estado" value={f.fiscal_estado ?? ""} onChange={(v) => set("fiscal_estado", v)} required disabled={fillMode !== "csf" ? cpLocked : true}>
                      <option value="">Selecciona…</option>
                      {ESTADOS_MX.map((e) => <option key={e} value={e}>{e}</option>)}
                    </Field>
                  </div>
                  <div className="sm:col-span-3">
                    {cpOptions && cpOptions.length > 0 ? (
                      <Field as="select" id="fiscal_colonia" label="Colonia" value={f.fiscal_colonia ?? ""} onChange={(v) => set("fiscal_colonia", v)} required>
                        <option value="">Selecciona una colonia…</option>
                        {cpOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                      </Field>
                    ) : (
                      <Field id="fiscal_colonia" label="Colonia" value={f.fiscal_colonia ?? ""} onChange={(v) => set("fiscal_colonia", v)} required />
                    )}
                  </div>
                  <div className="sm:col-span-4">
                    <Field id="fiscal_street" label="Calle" value={f.fiscal_street ?? ""} onChange={(v) => set("fiscal_street", v)} required />
                  </div>
                  <Field id="fiscal_ext_number" label="Núm. ext." value={f.fiscal_ext_number ?? ""} onChange={(v) => set("fiscal_ext_number", v)} required />
                  <Field id="fiscal_int_number" label="Núm. int." value={f.fiscal_int_number ?? ""} onChange={(v) => set("fiscal_int_number", v)} />
                </>
              )}
            </div>
          </fieldset>
        );
      })()}

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

function FiscalModeButton({ icon, title, desc, active, onClick }: {
  icon: React.ReactNode; title: string; desc: string; active: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`text-left rounded-lg border p-3 transition ${active ? "border-yo-ac bg-yo-ac/5 ring-1 ring-yo-ac" : "border-yo-border hover:border-yo-txt-3"}`}>
      <div className="flex items-center gap-2">
        <span className={active ? "text-yo-ac" : "text-yo-txt-2"}>{icon}</span>
        <span className="text-sm font-semibold text-yo-txt">{title}</span>
      </div>
      <p className="mt-1 text-xs text-yo-txt-3">{desc}</p>
    </button>
  );
}

function EfirmaDropzone({ label, accept, file, onFile, icon }: {
  label: string; accept: string; file: File | null; onFile: (f: File | null) => void; icon: React.ReactNode;
}) {
  const inputId = `ef-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="rounded-lg border border-dashed border-yo-border bg-yo-raised/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-yo-txt-2 mb-2">{label}</p>
      <label htmlFor={inputId} className="flex items-center gap-3 cursor-pointer">
        <span className="inline-flex items-center gap-2 min-h-9 px-3 rounded-md border border-yo-border bg-yo-bg text-yo-txt text-xs font-semibold hover:border-yo-txt-3">
          {icon} Elegir archivo
        </span>
        <span className="text-xs text-yo-txt-3 truncate">
          {file ? file.name : "Ningún archivo seleccionado"}
        </span>
        <input id={inputId} type="file" accept={accept} className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      </label>
      {file && (
        <button type="button" onClick={() => onFile(null)}
          className="mt-2 text-[11px] text-yo-txt-3 hover:text-yo-err underline">
          Quitar archivo
        </button>
      )}
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

// ─── STEP 5 — Token Móvil (MFA TOTP) ─────────────────────────────────────────
function Step5MFA({ onDone, onBack, setError, loading, setLoading }: {
  onDone: () => void; onBack: () => void;
  setError: (s: string | null) => void; loading: boolean; setLoading: (b: boolean) => void;
}) {
  const [enrolling, setEnrolling] = useState(true);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [secret, setSecret] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [otpUri, setOtpUri] = useState<string>("");
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [copied, setCopied] = useState(false);

  // Limpia factores TOTP previos "unverified" para evitar el error de límite/duplicados,
  // luego enrola un nuevo factor y genera el QR.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setEnrolling(true); setError(null);
      try {
        const { data: list } = await supabase.auth.mfa.listFactors();
        const stale = (list?.totp ?? []).filter((f) => f.status !== "verified");
        for (const f of stale) {
          try { await supabase.auth.mfa.unenroll({ factorId: f.id }); } catch { /* ignore */ }
        }
        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `YOKTO-${Date.now()}`,
        });
        if (error) throw error;
        if (cancelled) return;
        setFactorId(data.id);
        setSecret(data.totp.secret);
        setOtpUri(data.totp.uri);
        const png = await QRCode.toDataURL(data.totp.uri, {
          margin: 1, width: 240, color: { dark: "#0A0A0A", light: "#FFFFFF" },
        });
        if (!cancelled) setQrDataUrl(png);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo generar el código QR de 2FA.");
      } finally {
        if (!cancelled) setEnrolling(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setError]);

  async function verify() {
    if (!factorId || code.length !== 6) return;
    setLoading(true); setError(null);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code });
      if (vErr) throw vErr;
      const { data: userRes } = await supabase.auth.getUser();
      if (userRes.user?.id) {
        await supabase.from("profiles").update({ mfa_status: "enabled" }).eq("id", userRes.user.id);
      }
      setVerified(true);
      setTimeout(() => onDone(), 700);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Código incorrecto. Intenta de nuevo.");
    } finally { setLoading(false); }
  }

  async function skipForNow() {
    setLoading(true); setError(null);
    try {
      if (factorId) {
        try { await supabase.auth.mfa.unenroll({ factorId }); } catch { /* ignore */ }
      }
      const { data: userRes } = await supabase.auth.getUser();
      if (userRes.user?.id) {
        await supabase.from("profiles").update({ mfa_status: "pending" }).eq("id", userRes.user.id);
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo omitir la configuración.");
    } finally { setLoading(false); }
  }

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Token Móvil (2FA)</h2>
        <p className="mt-1 text-sm text-yo-txt-2">
          Añade una segunda capa de seguridad. Escanea el código con <strong>Google Authenticator</strong>,{" "}
          <strong>Microsoft Authenticator</strong> o cualquier app compatible con TOTP.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* QR + secreto */}
        <div className="rounded-xl border border-yo-border bg-yo-surface p-5 flex flex-col items-center gap-4">
          {enrolling || !qrDataUrl ? (
            <div className="aspect-square w-full max-w-[240px] grid place-items-center bg-yo-raised rounded-lg">
              <Loader2 className="size-6 animate-spin text-yo-txt-3" />
            </div>
          ) : verified ? (
            <div className="aspect-square w-full max-w-[240px] grid place-items-center bg-yo-ok-bg rounded-lg text-center px-4">
              <div>
                <CheckCircle2 className="size-10 mx-auto text-yo-ok mb-2" />
                <p className="text-sm font-semibold">Token verificado</p>
              </div>
            </div>
          ) : (
            <img src={qrDataUrl} alt="Código QR para configurar 2FA" className="w-full max-w-[240px] aspect-square" />
          )}

          {secret && !verified && (
            <div className="w-full">
              <p className="text-[11px] uppercase tracking-widest font-semibold text-yo-txt-3 mb-1.5">
                ¿No puedes escanear? Ingresa el código manual:
              </p>
              <div className="flex items-center gap-2 rounded-md border border-yo-border bg-yo-raised px-3 py-2">
                <code className="flex-1 text-xs font-mono tracking-wider break-all text-yo-txt">{secret}</code>
                <button onClick={copySecret} type="button"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-yo-ac hover:text-yo-ac-h">
                  {copied ? <><Check className="size-3.5" /> Copiado</> : <><Copy className="size-3.5" /> Copiar</>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Instrucciones + verificación */}
        <div className="rounded-xl border border-yo-border bg-yo-surface p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Smartphone className="size-5 text-yo-ac mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Configuración en 3 pasos</p>
              <ol className="mt-2 text-xs text-yo-txt-2 flex flex-col gap-1.5 list-decimal list-inside">
                <li>Abre tu app autenticadora en el teléfono.</li>
                <li>Escanea el QR o pega el código manual.</li>
                <li>Ingresa el código de 6 dígitos que aparece en la app.</li>
              </ol>
            </div>
          </div>

          <div className="border-t border-yo-border pt-4">
            <Field id="mfa-code" label="Código de 6 dígitos" value={code}
              onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric" maxLength={6} placeholder="000000"
              icon={<KeyRound className="size-4" />} disabled={verified || enrolling} />
            <button onClick={verify} disabled={loading || verified || enrolling || code.length !== 6}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 min-h-10 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold disabled:opacity-50">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <>Verificar y activar 2FA <ShieldCheck className="size-4" /></>}
            </button>
          </div>

          <div className="rounded-md bg-yo-warn-bg border border-yo-warn/20 px-3 py-2 text-[11px] text-yo-warn">
            Puedes omitir este paso y activarlo más tarde desde <strong>Configuración → Seguridad</strong>.
            Tu cuenta quedará marcada como <strong>2FA pendiente</strong>.
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onBack} disabled={loading}
          className="inline-flex items-center gap-1.5 text-sm text-yo-txt-2 hover:text-yo-txt disabled:opacity-50">
          <ArrowLeft className="size-4" /> Regresar
        </button>
        <div className="flex items-center gap-3">
          <button type="button" onClick={skipForNow} disabled={loading || verified}
            className="inline-flex items-center gap-1.5 min-h-10 px-4 rounded-md border border-yo-border text-sm font-medium text-yo-txt-2 hover:bg-yo-raised disabled:opacity-50">
            <SkipForward className="size-4" /> Omitir por ahora
          </button>
          {verified && (
            <button onClick={onDone}
              className="inline-flex items-center gap-2 min-h-10 px-5 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold">
              Continuar <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── STEP 6 — Confirmación (revisar y crear usuario) ─────────────────────────
type ReviewProfile = {
  email: string | null;
  account_type: string | null;
  first_name: string | null;
  last_name: string | null;
  second_last_name: string | null;
  legal_name: string | null;
  trade_name: string | null;
  incorporation_date: string | null;
  legal_rep: { full_name?: string; rfc?: string; curp?: string; role?: string } | null;
  rfc: string | null;
  curp: string | null;
  regimen_fiscal: string | null;
  fiscal_street: string | null;
  fiscal_ext_number: string | null;
  fiscal_int_number: string | null;
  fiscal_colonia: string | null;
  fiscal_postal_code: string | null;
  fiscal_estado: string | null;
  fiscal_municipio: string | null;
  mfa_status: string | null;
};

function Step6Review({ onFinished, onBack, setError, loading, setLoading }: {
  onFinished: () => void; onBack: () => void;
  setError: (s: string | null) => void; loading: boolean; setLoading: (b: boolean) => void;
}) {
  const [profile, setProfile] = useState<ReviewProfile | null>(null);
  const [docsCount, setDocsCount] = useState<number>(0);
  const [bioDone, setBioDone] = useState<boolean>(false);
  const [accepted, setAccepted] = useState(false);
  const submitFn = useServerFn(submitKyc);
  const listDocsFn = useServerFn(listOwnKycDocuments);

  useEffect(() => {
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id; if (!uid) return;
        const [{ data: p }, { data: bio }, docs] = await Promise.all([
          supabase.from("profiles")
            .select("email, account_type, first_name, last_name, second_last_name, legal_name, trade_name, incorporation_date, legal_rep, rfc, curp, regimen_fiscal, fiscal_street, fiscal_ext_number, fiscal_int_number, fiscal_colonia, fiscal_postal_code, fiscal_estado, fiscal_municipio, mfa_status")
            .eq("id", uid).maybeSingle(),
          supabase.from("biometric_enrollments").select("status").eq("user_id", uid).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          listDocsFn({}).catch(() => []),
        ]);
        setProfile((p as ReviewProfile) ?? null);
        setBioDone(bio?.status === "completed");
        setDocsCount(Array.isArray(docs) ? docs.length : 0);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo cargar el resumen");
      }
    })();
  }, [listDocsFn, setError]);

  const createInviteFn = useServerFn(createInvitationDraft);
  const sendInvitesFn = useServerFn(sendPendingInvitationEmails);

  async function finish() {
    if (!accepted) { setError("Confirma que la información es correcta."); return; }
    setError(null); setLoading(true);
    try {
      await submitFn({});

      // Persistir invitaciones capturadas y enviar correos (best-effort)
      try {
        let draft: OrgKindDraft = { kind: "individual" };
        try { const raw = localStorage.getItem(LS_ORG); if (raw) draft = JSON.parse(raw); } catch { /* noop */ }
        const invitees = (draft.invitees ?? []).filter((i) => i.confirmed);
        if (draft.kind === "team" && invitees.length) {
          const { data: u } = await supabase.auth.getUser();
          const uid = u.user?.id;
          if (uid) {
            const { data: org } = await supabase.from("organizations")
              .select("id").eq("owner_user_id", uid).maybeSingle();
            if (org?.id) {
              for (const inv of invitees) {
                try {
                  await createInviteFn({ data: {
                    org_id: org.id,
                    email: inv.email,
                    org_role: inv.role,
                    curp_rfc: inv.curp_rfc,
                    full_name: inv.full_name,
                    first_name: inv.first_name ?? null,
                    last_name: inv.last_name ?? null,
                    second_last_name: inv.second_last_name ?? null,
                  } });
                } catch { /* continuar con las demás */ }
              }
              try { await sendInvitesFn({ data: { org_id: org.id } }); } catch { /* noop */ }
            }
          }
        }
      } catch { /* no bloquear la finalización del onboarding */ }

      onFinished();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar a verificación.");
    } finally { setLoading(false); }
  }

  const isPF = profile?.account_type === "persona_fisica";
  const nombreCompleto = isPF
    ? [profile?.first_name, profile?.last_name, profile?.second_last_name].filter(Boolean).join(" ")
    : (profile?.legal_name ?? "—");
  const mfa = profile?.mfa_status ?? "not_configured";

  const regCatalog = isPF ? REGIMEN_FISICA : REGIMEN_MORAL;
  const regEntry = regCatalog.find((r) => r.code === profile?.regimen_fiscal);
  const regimenLabel = profile?.regimen_fiscal
    ? (regEntry ? `${profile.regimen_fiscal} · ${regEntry.label.replace(/^\d+\s*[·-]\s*/, "")}` : profile.regimen_fiscal)
    : "—";

  const line1 = [
    profile?.fiscal_street,
    profile?.fiscal_ext_number && `#${profile.fiscal_ext_number}`,
    profile?.fiscal_int_number && `Int. ${profile.fiscal_int_number}`,
  ].filter(Boolean).join(" ");
  const line2 = [
    profile?.fiscal_colonia,
    profile?.fiscal_municipio,
    profile?.fiscal_estado,
    profile?.fiscal_postal_code && `C.P. ${profile.fiscal_postal_code}`,
  ].filter(Boolean).join(", ");
  const domicilioFull = [line1, line2].filter(Boolean).join(" · ") || "—";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Revisa y confirma</h2>
        <p className="mt-1 text-sm text-yo-txt-2">
          Verifica que todo esté correcto. Al aceptar, enviaremos tu expediente a verificación KYC.
        </p>
      </div>

      <div className="grid gap-3">
        <ReviewSection title="Cuenta" icon={<Mail className="size-4" />}>
          <ReviewRow k="Correo" v={profile?.email ?? "—"} />
          <ReviewRow k="Tipo" v={isPF ? "Persona Física" : profile?.account_type === "persona_moral" ? "Persona Moral" : "—"} />
        </ReviewSection>

        <ReviewSection title={isPF ? "Datos fiscales" : "Datos de la persona moral"} icon={<FileText className="size-4" />}>
          <ReviewRow k={isPF ? "Nombre completo" : "Razón social"} v={nombreCompleto || "—"} />
          {!isPF && <ReviewRow k="Nombre comercial" v={profile?.trade_name ?? "—"} />}
          <ReviewRow k="RFC" v={profile?.rfc ?? "—"} mono />
          {isPF && <ReviewRow k="CURP" v={profile?.curp ?? "—"} mono />}
          <ReviewRow k="Régimen fiscal" v={regimenLabel} />
          {!isPF && (
            <ReviewRow
              k="Inicio de operaciones"
              v={profile?.incorporation_date
                ? new Date(profile.incorporation_date).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })
                : "—"}
            />
          )}
          <ReviewRow k="Domicilio fiscal" v={domicilioFull} />
        </ReviewSection>

        {!isPF && (
          <ReviewSection title="Representante legal" icon={<ShieldCheck className="size-4" />}>
            <ReviewRow k="Nombre" v={profile?.legal_rep?.full_name ?? "—"} />
            <ReviewRow k="CURP" v={profile?.legal_rep?.curp ?? "—"} mono />
            <ReviewRow k="RFC" v={profile?.legal_rep?.rfc ?? "—"} mono />
            <ReviewRow
              k="Cargo"
              v={profile?.legal_rep?.role === "administrador_unico" ? "Administrador único"
                : profile?.legal_rep?.role === "apoderado_legal" ? "Apoderado legal"
                : profile?.legal_rep?.role === "socio" ? "Socio"
                : profile?.legal_rep?.role ?? "—"}
            />
          </ReviewSection>
        )}



        <ReviewSection title="Identidad" icon={<ShieldCheck className="size-4" />}>
          <ReviewRow
            k="Enrolamiento biométrico"
            v={bioDone ? "Completado" : "Pendiente"}
            tone={bioDone ? "ok" : "warn"}
          />
          <ReviewRow k="Documentos entregados" v={`${docsCount} archivo(s)`} />
        </ReviewSection>

        <ReviewSection title="Espacio de trabajo" icon={<Building2 className="size-4" />}>
          {(() => {
            let d: OrgKindDraft = { kind: "individual" };
            try { const raw = localStorage.getItem(LS_ORG); if (raw) d = JSON.parse(raw); } catch { /* noop */ }
            const confirmed = (d.invitees ?? []).filter((i) => i.confirmed);
            if (d.kind !== "team") {
              return <ReviewRow k="Tipo" v="Cuenta individual" />;
            }
            return (
              <>
                <ReviewRow k="Tipo" v="Organización / equipo" />
                <ReviewRow k="Nombre comercial" v={d.name || "—"} tone={d.name ? undefined : "warn"} />
                <ReviewRow k="Espacio de trabajo" v={d.slug || "—"} mono tone={d.slug ? undefined : "warn"} />
                <ReviewRow k="Miembros invitados" v={`${confirmed.length} verificado(s)`} tone={confirmed.length ? "ok" : undefined} />
                {confirmed.length > 0 && (
                  <div className="pt-2 mt-1 border-t border-yo-border/60 space-y-1.5">
                    {confirmed.map((i) => (
                      <div key={i.email} className="flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="text-yo-txt-1 truncate">{i.full_name || "Sin nombre"}</p>
                          <p className="text-yo-txt-3 font-mono truncate">{i.curp_rfc} · {i.email}</p>
                        </div>
                        <span className="shrink-0 px-1.5 py-0.5 rounded bg-yo-bg-2 border border-yo-border text-[10px] uppercase tracking-wider text-yo-txt-2">
                          {INV_ROLES.find((r) => r.v === i.role)?.label ?? i.role}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </ReviewSection>

        <ReviewSection title="Token Móvil (2FA)" icon={<KeyRound className="size-4" />}>
          <ReviewRow
            k="Estado"
            v={mfa === "enabled" ? "Habilitado" : mfa === "pending" ? "Pendiente (configurar después)" : "No configurado"}
            tone={mfa === "enabled" ? "ok" : mfa === "pending" ? "warn" : undefined}
          />
        </ReviewSection>

      </div>

      <label className="flex items-start gap-2.5 text-sm text-yo-txt-2 cursor-pointer border border-yo-border rounded-md p-3 bg-yo-surface">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 size-4 rounded border-yo-border text-yo-ac focus:ring-yo-ac" />
        <span>
          Confirmo que la información capturada es <strong>verdadera y completa</strong>, y autorizo a YOKTO a
          validarla contra fuentes oficiales (SAT, RENAPO, listas nominales) para completar mi verificación KYC.
        </span>
      </label>

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onBack} disabled={loading}
          className="inline-flex items-center gap-1.5 text-sm text-yo-txt-2 hover:text-yo-txt disabled:opacity-50">
          <ArrowLeft className="size-4" /> Regresar
        </button>
        <button onClick={finish} disabled={!accepted || loading}
          className="inline-flex items-center gap-2 min-h-10 px-5 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold disabled:opacity-50">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <>Aceptar y crear mi usuario <Check className="size-4" /></>}
        </button>
      </div>
    </div>
  );
}

function ReviewSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-yo-border bg-yo-surface overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-yo-raised border-b border-yo-border">
        <span className="text-yo-ac">{icon}</span>
        <p className="text-xs uppercase tracking-widest font-semibold text-yo-txt">{title}</p>
      </div>
      <div className="divide-y divide-yo-border">{children}</div>
    </div>
  );
}

function ReviewRow({ k, v, mono, tone }: { k: string; v: string; mono?: boolean; tone?: "ok" | "warn" }) {
  const toneCls = tone === "ok" ? "text-yo-ok" : tone === "warn" ? "text-yo-warn" : "text-yo-txt";
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <span className="text-yo-txt-3">{k}</span>
      <span className={cn("font-medium text-right", mono && "font-mono tracking-wider", toneCls)}>{v}</span>
    </div>
  );
}

// ─── STEP 4 (nuevo) — Enrolamiento biométrico vía QR ─────────────────────────
function Step4Biometric({ onDone, onBack, setError }: {
  onDone: () => void; onBack: () => void; setError: (s: string | null) => void;
}) {
  const start = useServerFn(startBiometricEnrollment);
  const poll = useServerFn(getMyBiometricEnrollment);
  const cancel = useServerFn(cancelBiometricEnrollment);
  const [session, setSession] = useState<Awaited<ReturnType<typeof start>> | null>(null);
  const [status, setStatus] = useState<Awaited<ReturnType<typeof poll>> | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number>(0);
  const [starting, setStarting] = useState(false);

  const finished = status?.status === "completed";

  async function beginSession() {
    setStarting(true); setError(null);
    try {
      const s = await start({});
      setSession(s);
      const url = `${window.location.origin}/biometrico/${s.token}`;
      const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: "#0A0A0A", light: "#FFFFFF" } });
      setQrDataUrl(dataUrl);
    } catch (e) { setError((e as Error).message); }
    finally { setStarting(false); }
  }

  useEffect(() => { void beginSession(); /* eslint-disable-next-line */ }, []);

  // Polling cada 3s hasta completar/expirar
  useEffect(() => {
    if (!session || finished) return;
    const t = setInterval(async () => {
      try {
        const s = await poll({});
        setStatus(s);
        if (s?.expires_at) {
          const ms = new Date(s.expires_at).getTime() - Date.now();
          setRemaining(Math.max(0, Math.floor(ms / 1000)));
        }
        if (s?.status === "completed") clearInterval(t);
      } catch { /* silencioso */ }
    }, 3000);
    return () => clearInterval(t);
  }, [session, finished, poll]);

  // Countdown local
  useEffect(() => {
    if (!session?.expires_at || finished) return;
    const t = setInterval(() => {
      const ms = new Date(session.expires_at).getTime() - Date.now();
      setRemaining(Math.max(0, Math.floor(ms / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [session, finished]);

  const expired = remaining <= 0 && !!session && !finished;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  const statusLabel: Record<string, string> = {
    pending: "Esperando escaneo del QR…",
    id_captured: "Validando identificación…",
    id_verified: "Identificación validada. Continúa con selfie.",
    face_verified: "Rostro verificado. Confirmando enrolamiento.",
    address_verified: "Confirmando enrolamiento…",
    completed: "Enrolamiento completado.",
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Verificación biométrica</h2>
        <p className="mt-1 text-sm text-yo-txt-2">
          Escanea el código con la cámara de tu teléfono y sigue las instrucciones. La sesión expira en 15 minutos.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="rounded-xl border border-yo-border bg-yo-surface p-5 flex flex-col items-center justify-center gap-3">
          {starting || !qrDataUrl ? (
            <div className="aspect-square w-full max-w-[280px] grid place-items-center bg-yo-raised rounded-lg">
              <Loader2 className="size-6 animate-spin text-yo-txt-3" />
            </div>
          ) : expired ? (
            <div className="aspect-square w-full max-w-[280px] grid place-items-center bg-yo-raised rounded-lg text-center px-4">
              <div>
                <AlertCircle className="size-8 mx-auto text-yo-err mb-2" />
                <p className="text-sm font-semibold">Código expirado</p>
              </div>
            </div>
          ) : finished ? (
            <div className="aspect-square w-full max-w-[280px] grid place-items-center bg-yo-ok-bg rounded-lg text-center px-4">
              <div>
                <CheckCircle2 className="size-10 mx-auto text-yo-ok mb-2" />
                <p className="text-sm font-semibold">¡Biométrico completado!</p>
              </div>
            </div>
          ) : (
            <img src={qrDataUrl} alt="Código QR" className="w-full max-w-[280px] aspect-square" />
          )}
          <div className="flex items-center gap-2 text-xs text-yo-txt-3">
            <QrIcon className="size-3.5" />
            <span>Vigencia: <b className="text-yo-txt tabular-nums">{mm}:{ss}</b></span>
          </div>
          {(expired || (session && !finished && remaining < 60)) && (
            <button onClick={async () => { if (session) await cancel({}).catch(() => {}); setSession(null); setStatus(null); setQrDataUrl(null); await beginSession(); }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-yo-ac hover:text-yo-ac-h">
              <RefreshCw className="size-3.5" /> Generar nuevo código
            </button>
          )}
        </div>

        <div className="rounded-xl border border-yo-border bg-yo-surface p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Smartphone className="size-5 text-yo-ac mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Continúa en tu teléfono</p>
              <p className="text-xs text-yo-txt-3 mt-1">Abre la cámara, apunta al QR y toca el enlace. No cierres esta pestaña.</p>
            </div>
          </div>

          <ol className="text-sm text-yo-txt-2 flex flex-col gap-2">
            <StepLine ok={!!status?.curp_match} active={!status?.curp_match}>Captura de identificación (INE/Pasaporte) + CURP</StepLine>
            <StepLine ok={!!status?.face_match_ok} active={!!status?.curp_match && !status?.face_match_ok}>Selfie y prueba de vida (match ≥ 99.9%)</StepLine>
            <StepLine ok={finished} active={!!status?.face_match_ok && !finished}>Lista nominal + confirmación</StepLine>
          </ol>

          {status && (
            <div className="rounded-md bg-yo-raised px-3 py-2 text-xs text-yo-txt-2">
              {statusLabel[status.status] ?? "En proceso…"}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-yo-txt-2 hover:text-yo-txt">
          <ArrowLeft className="size-4" /> Regresar
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onDone}
            className="inline-flex items-center gap-2 min-h-10 px-4 rounded-md border border-yo-border bg-yo-surface hover:bg-yo-raised text-yo-txt-2 text-sm font-semibold">
            Omitir por ahora
          </button>
          <button onClick={onDone} disabled={!finished}
            className="inline-flex items-center gap-2 min-h-10 px-5 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold disabled:opacity-50">
            Continuar <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StepLine({ ok, active, children }: { ok: boolean; active: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className={"grid place-items-center size-5 rounded-full border text-[10px] " +
        (ok ? "bg-yo-ok border-yo-ok text-white" : active ? "border-yo-ac text-yo-ac" : "border-yo-border text-yo-txt-3")}>
        {ok ? <Check className="size-3" /> : active ? <Loader2 className="size-3 animate-spin" /> : "•"}
      </span>
      <span className={ok ? "text-yo-txt" : active ? "text-yo-txt" : "text-yo-txt-3"}>{children}</span>
    </li>
  );
}

// ─── STEP 4 — Tipo de cuenta: Individual u Organización ───────────────────────
const INV_ROLES: Array<{ v: InviteeDraft["role"]; label: string }> = [
  { v: "buyer_admin", label: "Comprador — Administrador" },
  { v: "buyer_user", label: "Comprador — Operador" },
  { v: "seller_admin", label: "Vendedor — Administrador" },
  { v: "seller_user", label: "Vendedor — Operador" },
  { v: "auditor", label: "Auditor (solo lectura)" },
];

function Step4AccountKind({ onSaved, onBack, setError }: {
  onSaved: () => void; onBack: () => void;
  setError: (s: string | null) => void;
}) {
  const initial: OrgKindDraft = (() => {
    try { const raw = localStorage.getItem(LS_ORG); if (raw) return JSON.parse(raw) as OrgKindDraft; } catch { /* noop */ }
    return { kind: "individual" };
  })();
  const [kind, setKind] = useState<"individual" | "team">(initial.kind ?? "individual");
  const [orgName, setOrgName] = useState<string>(initial.name ?? "");
  const [slug, setSlug] = useState<string>(initial.slug ?? "");
  const [slugTouched, setSlugTouched] = useState<boolean>(!!initial.slug);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "ok" | "taken">("idle");
  const [slugSuggestion, setSlugSuggestion] = useState<string | null>(null);
  const [invitees, setInvitees] = useState<InviteeDraft[]>(initial.invitees ?? []);

  const [newEmail, setNewEmail] = useState("");
  const [newDoc, setNewDoc] = useState("");
  const [newRole, setNewRole] = useState<InviteeDraft["role"]>("buyer_user");
  const [addingBusy, setAddingBusy] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<InviteeDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const checkSlugFn = useServerFn(checkOrgSlugAvailable);
  const validateInviteeFn = useServerFn(validateInviteeIdentity);

  // Auto-derivar slug del nombre comercial mientras el usuario no lo edite manualmente
  useEffect(() => {
    if (kind !== "team") return;
    if (!slugTouched) {
      const auto = toSlug(orgName).slice(0, 32);
      if (auto && auto !== slug) setSlug(auto);
    }
  }, [orgName, kind, slugTouched, slug]);

  // Verificar disponibilidad del slug con debounce
  useEffect(() => {
    if (kind !== "team" || !slug || slug.length < 2) { setSlugStatus("idle"); setSlugSuggestion(null); return; }
    setSlugStatus("checking");
    const t = setTimeout(async () => {
      try {
        const r = await checkSlugFn({ data: { slug } });
        setSlugStatus(r.available ? "ok" : "taken");
        setSlugSuggestion(r.suggestion ?? null);
      } catch { setSlugStatus("idle"); }
    }, 400);
    return () => clearTimeout(t);
  }, [slug, kind, checkSlugFn]);

  async function requestAdd() {
    setError(null);
    const e = newEmail.trim().toLowerCase();
    const doc = newDoc.trim().toUpperCase();
    if (!z.string().email().safeParse(e).success) { setError("Correo del miembro inválido"); return; }
    if (doc.length !== 12 && doc.length !== 13 && doc.length !== 18) {
      setError("Ingresa una CURP (18) o RFC (12/13) válido"); return;
    }
    if (invitees.some((i) => i.email === e)) { setError("Ese correo ya está en la lista"); return; }
    setAddingBusy(true);
    try {
      const r = await validateInviteeFn({ data: { curp_or_rfc: doc } });
      setPendingConfirm({
        email: e,
        curp_rfc: r.curp_rfc,
        full_name: r.full_name,
        first_name: r.first_name,
        last_name: r.last_name,
        second_last_name: r.second_last_name,
        role: newRole,
        confirmed: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo validar la CURP/RFC");
    } finally {
      setAddingBusy(false);
    }
  }
  function confirmAdd() {
    if (!pendingConfirm) return;
    setInvitees([...invitees, { ...pendingConfirm, confirmed: true }]);
    setPendingConfirm(null);
    setNewEmail(""); setNewDoc("");
  }
  function removeInvitee(email: string) {
    setInvitees(invitees.filter((i) => i.email !== email));
  }

  async function submit() {
    setError(null);
    if (kind === "team") {
      if (!orgName.trim()) { setError("El nombre comercial es obligatorio."); return; }
      if (!slug || slug.length < 2) { setError("Define el espacio de trabajo."); return; }
      if (slugStatus === "taken") { setError("El espacio de trabajo ya está en uso. Elige otro."); return; }
      if (slugStatus === "checking") { setError("Verificando espacio de trabajo…"); return; }
    }
    const draft: OrgKindDraft = {
      kind,
      name: kind === "team" ? orgName.trim() : undefined,
      slug: kind === "team" ? slug : undefined,
      invitees: kind === "team" ? invitees : [],
    };
    setSaving(true);
    try {
      localStorage.setItem(LS_ORG, JSON.stringify(draft));
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (uid) {
        const patch: { type: "business" | "individual"; name?: string; slug?: string } = {
          type: kind === "team" ? "business" : "individual",
        };
        if (kind === "team") { if (draft.name) patch.name = draft.name; if (draft.slug) patch.slug = draft.slug; }
        await supabase.from("organizations").update(patch).eq("owner_user_id", uid);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el tipo de cuenta");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tipo de cuenta</h2>
        <p className="mt-1 text-sm text-yo-txt-2">
          Elige cómo vas a operar en YOKTO. Podrás ajustar todo desde <span className="font-medium">Configuración → Equipo</span>.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => setKind("individual")}
          className={cn("text-left rounded-xl border p-4 transition",
            kind === "individual" ? "border-yo-ac ring-2 ring-yo-ac/25 bg-yo-ac-bg" : "border-yo-border bg-yo-surface hover:border-yo-border-s")}>
          <div className="flex items-center gap-2 mb-1.5"><UserIcon className="size-5 text-yo-ac" /><span className="font-semibold text-yo-txt">Cuenta individual</span></div>
          <p className="text-sm text-yo-txt-2">Opera tú mismo. Ideal para freelance, personas físicas y proyectos personales.</p>
        </button>
        <button type="button" onClick={() => setKind("team")}
          className={cn("text-left rounded-xl border p-4 transition",
            kind === "team" ? "border-yo-ac ring-2 ring-yo-ac/25 bg-yo-ac-bg" : "border-yo-border bg-yo-surface hover:border-yo-border-s")}>
          <div className="flex items-center gap-2 mb-1.5"><Building2 className="size-5 text-yo-ac" /><span className="font-semibold text-yo-txt">Organización / equipo</span></div>
          <p className="text-sm text-yo-txt-2">Invita a tu equipo, define roles y comparte operaciones.</p>
        </button>
      </div>

      {kind === "team" && (
        <>
          <div className="rounded-lg border border-yo-ac/30 bg-yo-ac-bg/50 px-4 py-3 flex gap-3">
            <ShieldCheck className="size-4 text-yo-ac shrink-0 mt-0.5" />
            <div className="text-xs text-yo-txt-2 leading-relaxed space-y-3">
              <p>
                La cuenta que estás creando será una <span className="font-semibold text-yo-txt">cuenta de Administrador</span>.
                Toda la configuración de la organización (RFC, régimen fiscal, cuentas bancarias, KYB) podrás completarla
                una vez registrada la cuenta. También podrás invitar más participantes en cualquier momento desde
                <span className="font-medium"> Configuración → Equipo</span>.
              </p>
              <p>
                Puedes omitir este paso: podrás registrar e invitar miembros más tarde desde <span className="font-semibold text-yo-txt">Configuración › Equipo</span> cuando lo necesites.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-yo-border bg-yo-surface p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-yo-ac" />
              <p className="text-xs uppercase tracking-widest font-semibold text-yo-txt">Datos de la organización</p>
            </div>
            <Field id="org-name" label="Nombre comercial *" value={orgName} onChange={setOrgName}
              placeholder="Comercializadora del Pacífico" required
              hint="Nombre visible con el que operarás en YOKTO." />

            <div>
              <label htmlFor="org-slug" className="text-xs font-semibold text-yo-txt-2 mb-1 flex items-center gap-2">
                Espacio de trabajo
                {slugStatus === "checking" && <Loader2 className="size-3 animate-spin text-yo-txt-3" />}
                {slugStatus === "ok" && <CheckCircle2 className="size-3 text-emerald-500" />}
                {slugStatus === "taken" && <AlertCircle className="size-3 text-yo-err" />}
              </label>
              <div className="flex items-center rounded-md border border-yo-border bg-yo-bg overflow-hidden focus-within:border-yo-ac">
                <input
                  id="org-slug"
                  value={slug}
                  onChange={(ev) => { setSlug(toSlug(ev.target.value).slice(0, 32)); setSlugTouched(true); }}
                  className="flex-1 bg-transparent py-2.5 px-3 text-sm text-yo-txt outline-none font-mono"
                  placeholder="mi-empresa"
                  maxLength={32}
                  autoComplete="off"
                />
                {slugTouched && (
                  <button type="button" onClick={() => { setSlugTouched(false); setSlug(toSlug(orgName).slice(0, 32)); }}
                    className="mr-2 text-[11px] text-yo-txt-3 hover:text-yo-ac">Cambiar</button>
                )}
              </div>
              {slugStatus === "taken" && (
                <p className="mt-1 text-[11px] text-yo-err flex items-center gap-2">
                  Ese espacio de trabajo ya está en uso.
                  {slugSuggestion && (
                    <button type="button" onClick={() => { setSlug(slugSuggestion); setSlugTouched(true); }}
                      className="underline text-yo-ac hover:no-underline">Usar {slugSuggestion}</button>
                  )}
                </p>
              )}
              {slugStatus === "ok" && <p className="mt-1 text-[11px] text-emerald-500">Disponible.</p>}
              <p className="mt-1 text-[11px] text-yo-txt-3">Sin espacios, minúsculas y guiones. Es único en toda la plataforma.</p>
            </div>

            <div className="border-t border-yo-border pt-4">
              <p className="text-xs uppercase tracking-widest font-semibold text-yo-txt mb-1">Invitar miembros (opcional)</p>
              <p className="text-[11px] text-yo-txt-3 mb-2">Se validan con RENAPO/SAT y se les enviará el correo de invitación cuando concluyas tu registro. Vigencia de 48 horas.</p>
              <div className="mb-3 rounded-md border border-yo-border bg-yo-raised/40 px-3 py-2 text-[11px] text-yo-txt-2">
                Puedes omitir este paso: podrás registrar e invitar miembros más tarde desde <span className="font-semibold text-yo-txt">Configuración › Equipo</span> cuando lo necesites.
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <Field id="inv-email" label="Correo" value={newEmail} onChange={setNewEmail}
                  type="email" placeholder="colaborador@empresa.com" icon={<Mail className="size-4" />} />
                <Field id="inv-doc" label="CURP o RFC" value={newDoc} onChange={setNewDoc}
                  uppercase maxLength={18} placeholder="XAXX010101000" />
                <Field id="inv-role" label="Rol" as="select" value={newRole}
                  onChange={(v) => setNewRole(v as InviteeDraft["role"])}>
                  {INV_ROLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
                </Field>
              </div>
              <div className="mt-2 flex justify-end">
                <button type="button" onClick={requestAdd} disabled={addingBusy}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold disabled:opacity-50 whitespace-nowrap">
                  {addingBusy ? <Loader2 className="size-4 animate-spin" /> : <>+ Agregar miembro</>}
                </button>
              </div>

              {pendingConfirm && (
                <div className="mt-3 rounded-md border border-yo-ac/50 bg-yo-ac-bg/60 px-3 py-3 flex items-start justify-between gap-3">
                  <div className="text-xs text-yo-txt">
                    <p className="uppercase tracking-widest text-[10px] text-yo-txt-3 mb-1">Confirmar identidad</p>
                    <p><span className="font-semibold">{pendingConfirm.full_name || "Sin nombre en registro"}</span></p>
                    <p className="text-yo-txt-2 font-mono">{pendingConfirm.curp_rfc} · {pendingConfirm.email}</p>
                    <p className="mt-1 text-yo-txt-3">
                      Rol: {INV_ROLES.find(r => r.v === pendingConfirm.role)?.label}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button type="button" onClick={confirmAdd}
                      className="px-3 py-1.5 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-xs font-semibold">Confirmar</button>
                    <button type="button" onClick={() => setPendingConfirm(null)}
                      className="px-3 py-1.5 rounded-md border border-yo-border text-xs text-yo-txt-2 hover:text-yo-txt">Cancelar</button>
                  </div>
                </div>
              )}

              {invitees.length > 0 && (
                <ul className="mt-3 divide-y divide-yo-border border border-yo-border rounded-md overflow-hidden">
                  {invitees.map((i) => (
                    <li key={i.email} className="flex items-center justify-between gap-3 px-3 py-2 text-sm bg-yo-surface">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="truncate text-yo-txt font-medium">{i.full_name}</p>
                          <p className="truncate text-[11px] text-yo-txt-3 font-mono">{i.curp_rfc} · {i.email}</p>
                        </div>
                        <span className="ml-auto text-[10px] uppercase tracking-widest text-yo-txt-3 border border-yo-border rounded px-1.5 py-0.5 shrink-0">
                          {INV_ROLES.find(r => r.v === i.role)?.label ?? i.role}
                        </span>
                        <span className="text-[10px] uppercase tracking-widest text-amber-500 border border-amber-500/40 rounded px-1.5 py-0.5 shrink-0">Pendiente envío</span>
                      </div>
                      <button type="button" onClick={() => removeInvitee(i.email)}
                        className="text-yo-txt-3 hover:text-yo-err" aria-label={`Quitar ${i.email}`}>
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onBack} disabled={saving}
          className="inline-flex items-center gap-1.5 text-sm text-yo-txt-2 hover:text-yo-txt disabled:opacity-50">
          <ArrowLeft className="size-4" /> Regresar
        </button>
        <button onClick={submit} disabled={saving}
          className="inline-flex items-center gap-2 min-h-10 px-5 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold disabled:opacity-50">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <>Continuar <ArrowRight className="size-4" /></>}
        </button>
      </div>
    </div>
  );
}

