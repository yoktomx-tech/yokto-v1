// Onboarding exclusivo para usuarios invitados a una organización.
// Flujo (4 pasos): 1) Cuenta+Domicilio (precargados)  2) Biométrico
//                  3) Token móvil (MFA)               4) Confirmación.
// Token único por invitación con vigencia de 48 horas.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Lock, Eye, EyeOff, ArrowRight, ArrowLeft, Loader2, CheckCircle2,
  Mail, ShieldCheck, MapPin, Smartphone, KeyRound, Copy, RefreshCw,
  QrCode as QrIcon, AlertCircle, User as UserIcon, SkipForward,
} from "lucide-react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import {
  getInvitationByToken, createInviteeAccount, finalizeInviteeOnboarding,
} from "@/lib/invitee-onboarding.functions";
import { startBiometricEnrollment, getMyBiometricEnrollment } from "@/lib/biometric.functions";
import { CumplexLogo } from "@/components/logo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/invitations/$token/onboarding")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Aceptar invitación — Cumplex" },
    { name: "robots", content: "noindex" },
  ] }),
  component: InviteeOnboarding,
});

type Step = 1 | 2 | 3 | 4;
type Address = {
  fiscal_street?: string | null; fiscal_ext_number?: string | null; fiscal_int_number?: string | null;
  fiscal_colonia?: string | null; fiscal_postal_code?: string | null;
  fiscal_municipio?: string | null; fiscal_estado?: string | null;
};
type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; invitation: { id: string; email: string; org_role: string; expires_at: string; full_name: string | null; first_name: string | null; last_name: string | null; second_last_name: string | null; curp_rfc: string | null }; organization: { id?: string | null; name?: string | null; slug?: string | null }; address: Address | null };

function InviteeOnboarding() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [bioDone, setBioDone] = useState(false);
  const [mfaEnrolled, setMfaEnrolled] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);

  const load = useServerFn(getInvitationByToken);

  useEffect(() => {
    (async () => {
      try {
        const r = await load({ data: { token } });
        if (r.status === "not_found") { setState({ status: "error", message: "Invitación no encontrada." }); return; }
        if (r.status === "already_used") { setState({ status: "error", message: "Esta invitación ya fue utilizada." }); return; }
        if (r.status === "expired") { setState({ status: "error", message: "La invitación expiró (vigencia de 48 horas)." }); return; }
        setState({ status: "ok", invitation: r.invitation, organization: r.organization, address: r.address });
        const { data: u } = await supabase.auth.getUser();
        if (u.user?.email?.toLowerCase() === r.invitation.email.toLowerCase()) {
          setSignedInEmail(u.user.email!);
          setStep(2); // ya con sesión → salta al biométrico
        }
      } catch (e) {
        setState({ status: "error", message: e instanceof Error ? e.message : "No se pudo cargar la invitación." });
      }
    })();
  }, [token, load]);

  if (state.status === "loading") {
    return (
      <div className="min-h-dvh grid place-items-center bg-yo-bg">
        <Loader2 className="size-6 animate-spin text-yo-ac" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="min-h-dvh grid place-items-center bg-yo-bg p-4">
        <div className="max-w-sm w-full rounded-xl border border-yo-border bg-yo-surface p-6 text-center">
          <AlertCircle className="size-8 mx-auto text-yo-err mb-2" />
          <h1 className="text-lg font-bold text-yo-txt mb-1">No podemos continuar</h1>
          <p className="text-sm text-yo-txt-2">{state.message}</p>
          <a href="/" className="mt-4 inline-block text-xs text-yo-ac hover:underline">Ir al inicio</a>
        </div>
      </div>
    );
  }

  const inv = state.invitation;
  const org = state.organization;
  const addr = state.address ?? {};

  return (
    <div className="min-h-dvh bg-yo-bg text-yo-txt">
      <header className="border-b border-yo-border bg-yo-surface">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-3 flex items-center justify-between">
          <CumplexLogo className="h-7" />
          <div className="text-[11px] text-yo-txt-3">Invitación · {org.name ?? "Organización"}</div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-6 sm:py-10">
        <StepsIndicator step={step} />
        {error && (
          <div className="mb-4 rounded-md border border-yo-err/40 bg-yo-err/10 text-yo-err text-xs px-3 py-2 flex items-center gap-2">
            <AlertCircle className="size-4" /> {error}
          </div>
        )}
        <div className="rounded-xl border border-yo-border bg-yo-surface p-5 sm:p-7">
          {step === 1 && (
            <Step1Account
              token={token} inv={inv} org={org} addr={addr}
              onDone={(email) => { setSignedInEmail(email); setStep(2); }}
              setError={setError}
            />
          )}
          {step === 2 && (
            <Step2Biometric
              onDone={() => { setBioDone(true); setStep(3); }}
              onSkip={() => setStep(3)}
              onBack={() => setStep(1)}
              setError={setError}
            />
          )}
          {step === 3 && (
            <Step3Mfa
              email={signedInEmail ?? inv.email}
              onDone={(enabled) => { setMfaEnrolled(enabled); setStep(4); }}
              onBack={() => setStep(2)}
              setError={setError}
            />
          )}
          {step === 4 && (
            <Step4Confirm
              token={token} inv={inv} org={org} addr={addr}
              bioDone={bioDone} mfaEnrolled={mfaEnrolled}
              onBack={() => setStep(3)}
              onFinished={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
              setError={setError}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function StepsIndicator({ step }: { step: Step }) {
  const items: Array<{ n: Step; t: string }> = [
    { n: 1, t: "Cuenta" }, { n: 2, t: "Identidad" }, { n: 3, t: "Token móvil" }, { n: 4, t: "Confirmar" },
  ];
  return (
    <ol className="mb-5 grid grid-cols-4 gap-1">
      {items.map((it) => (
        <li key={it.n} className={cn(
          "flex flex-col items-start rounded-md border px-3 py-2",
          step === it.n ? "border-yo-ac bg-yo-ac-bg" :
          step > it.n ? "border-yo-border bg-yo-surface" : "border-yo-border bg-yo-bg opacity-70",
        )}>
          <span className="text-[10px] uppercase tracking-widest text-yo-txt-3">Paso {it.n}</span>
          <span className={cn("text-xs font-semibold", step >= it.n ? "text-yo-txt" : "text-yo-txt-3")}>{it.t}</span>
        </li>
      ))}
    </ol>
  );
}

// ─── STEP 1: Cuenta + Domicilio precargado ─────────────────────────────────────
function Step1Account({ token, inv, org, addr, onDone, setError }: {
  token: string;
  inv: Extract<LoadState, { status: "ok" }>["invitation"];
  org: Extract<LoadState, { status: "ok" }>["organization"];
  addr: Address;
  onDone: (email: string) => void;
  setError: (s: string | null) => void;
}) {
  const createFn = useServerFn(createInviteeAccount);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const rules = useMemo(() => ({
    len: password.length >= 8,
    upper: /[A-Z]/.test(password),
    num: /\d/.test(password),
    sym: /[^A-Za-z0-9]/.test(password),
  }), [password]);
  const passOk = rules.len && rules.upper && rules.num && rules.sym;
  const match = password && password === confirm;

  async function submit() {
    setError(null);
    if (!passOk) { setError("La contraseña no cumple los requisitos."); return; }
    if (!match) { setError("Las contraseñas no coinciden."); return; }
    setSaving(true);
    try {
      const r = await createFn({ data: { token, password } });
      // Autologin
      const { error: sErr } = await supabase.auth.signInWithPassword({ email: r.email, password });
      if (sErr) throw sErr;
      onDone(r.email);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la cuenta.");
    } finally {
      setSaving(false);
    }
  }

  const fullName = [inv.first_name, inv.last_name, inv.second_last_name].filter(Boolean).join(" ") || inv.full_name || "—";
  const addrLine = [
    addr.fiscal_street, addr.fiscal_ext_number && `#${addr.fiscal_ext_number}`,
    addr.fiscal_int_number && `Int. ${addr.fiscal_int_number}`,
    addr.fiscal_colonia, addr.fiscal_postal_code,
    addr.fiscal_municipio, addr.fiscal_estado,
  ].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Bienvenido{inv.first_name ? `, ${inv.first_name}` : ""}</h2>
        <p className="mt-1 text-sm text-yo-txt-2">
          Fuiste invitado a unirte a <span className="font-semibold text-yo-txt">{org.name}</span> en Cumplex.
          Confirma tus datos y define una contraseña para continuar.
        </p>
      </div>

      <section className="rounded-lg border border-yo-border bg-yo-bg p-4">
        <p className="text-[11px] uppercase tracking-widest font-semibold text-yo-txt-3 mb-2 flex items-center gap-2">
          <UserIcon className="size-3.5" /> Datos personales (verificados)
        </p>
        <dl className="grid gap-1.5 text-xs sm:grid-cols-2">
          <ReadRow k="Nombre" v={fullName} />
          <ReadRow k="Correo" v={inv.email} icon={<Mail className="size-3.5" />} />
          <ReadRow k={inv.curp_rfc?.length === 18 ? "CURP" : "RFC"} v={inv.curp_rfc ?? "—"} mono />
          <ReadRow k="Rol asignado" v={inv.org_role} />
        </dl>
      </section>

      <section className="rounded-lg border border-yo-border bg-yo-bg p-4">
        <p className="text-[11px] uppercase tracking-widest font-semibold text-yo-txt-3 mb-2 flex items-center gap-2">
          <MapPin className="size-3.5" /> Domicilio heredado de la organización
        </p>
        <p className="text-xs text-yo-txt">{addrLine || <span className="text-yo-txt-3">Sin domicilio configurado aún — se actualizará más adelante.</span>}</p>
      </section>

      <section className="rounded-lg border border-yo-border p-4">
        <p className="text-[11px] uppercase tracking-widest font-semibold text-yo-txt-3 mb-3 flex items-center gap-2">
          <Lock className="size-3.5" /> Define tu contraseña
        </p>
        <div className="grid gap-3">
          <PasswordField id="pwd" label="Contraseña" value={password} onChange={setPassword} show={showPwd} onToggle={() => setShowPwd(!showPwd)} />
          <PasswordField id="pwd2" label="Confirmar contraseña" value={confirm} onChange={setConfirm} show={showConfirm} onToggle={() => setShowConfirm(!showConfirm)}
            placeholder="••••••••" />
        </div>
        <ul className="mt-3 grid gap-1 text-[11px] sm:grid-cols-2">
          <Rule ok={rules.len}>Mínimo 8 caracteres</Rule>
          <Rule ok={rules.upper}>Una letra mayúscula</Rule>
          <Rule ok={rules.num}>Un número</Rule>
          <Rule ok={rules.sym}>Un símbolo (!@#$%^&*)</Rule>
          <Rule ok={!!match}>Coinciden ambas contraseñas</Rule>
        </ul>
      </section>

      <div className="flex items-center justify-end pt-2">
        <button onClick={submit} disabled={saving || !passOk || !match}
          className="inline-flex items-center gap-2 min-h-10 px-5 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold disabled:opacity-50">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <>Continuar <ArrowRight className="size-4" /></>}
        </button>
      </div>
    </div>
  );
}

// ─── STEP 2: Biométrico ────────────────────────────────────────────────────────
function Step2Biometric({ onDone, onSkip, onBack, setError }: {
  onDone: () => void; onSkip: () => void; onBack: () => void; setError: (s: string | null) => void;
}) {
  const startFn = useServerFn(startBiometricEnrollment);
  const getFn = useServerFn(getMyBiometricEnrollment);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  async function start() {
    setBusy(true); setError(null);
    try {
      const r = await startFn({});
      const url = r.token ? `${window.location.origin}/biometrico/${r.token}` : null;
      if (!url) throw new Error("No se pudo iniciar el enrolamiento.");
      setLink(url);
      setQr(await QRCode.toDataURL(url, { margin: 1, width: 240 }));
      setPolling(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar el enrolamiento.");
    } finally { setBusy(false); }
  }
  useEffect(() => {
    if (!polling) return;
    const t = setInterval(async () => {
      try {
        const r = await getFn({});
        if (r?.status === "completed") { setPolling(false); onDone(); }
      } catch { /* noop */ }
    }, 3000);
    return () => clearInterval(t);
  }, [polling, getFn, onDone]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Verifica tu identidad</h2>
        <p className="mt-1 text-sm text-yo-txt-2">Necesitamos comparar tu identificación oficial con una selfie. Usa la cámara de tu teléfono escaneando el QR.</p>
      </div>

      {!link ? (
        <div className="rounded-lg border border-yo-border bg-yo-bg p-6 text-center">
          <ShieldCheck className="size-8 mx-auto text-yo-ac mb-2" />
          <p className="text-sm text-yo-txt-2 mb-4">Al iniciar generaremos un enlace seguro para tu móvil.</p>
          <button onClick={start} disabled={busy}
            className="inline-flex items-center gap-2 min-h-10 px-5 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Iniciar verificación"}
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-yo-border bg-yo-bg p-4 flex flex-col sm:flex-row gap-4 items-center">
          {qr && <img src={qr} alt="QR" className="size-40 rounded bg-white p-2" />}
          <div className="flex-1 text-sm">
            <p className="font-semibold text-yo-txt mb-1">Escanea con tu teléfono</p>
            <p className="text-xs text-yo-txt-3 mb-2">O abre el enlace:</p>
            <div className="flex items-center gap-2">
              <code className="text-[11px] font-mono truncate bg-yo-surface border border-yo-border rounded px-2 py-1 flex-1">{link}</code>
              <button onClick={() => navigator.clipboard.writeText(link)} className="text-yo-txt-3 hover:text-yo-ac" aria-label="Copiar">
                <Copy className="size-4" />
              </button>
            </div>
            <p className="mt-3 text-[11px] text-yo-txt-3 flex items-center gap-2">
              <Loader2 className="size-3 animate-spin" /> Esperando confirmación desde tu móvil…
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-yo-txt-2 hover:text-yo-txt">
          <ArrowLeft className="size-4" /> Regresar
        </button>
        <button type="button" onClick={onSkip}
          className="inline-flex items-center gap-1.5 text-xs text-yo-txt-3 hover:text-yo-txt">
          <SkipForward className="size-3.5" /> Omitir por ahora
        </button>
      </div>
    </div>
  );
}

// ─── STEP 3: MFA (TOTP) ────────────────────────────────────────────────────────
function Step3Mfa({ email, onDone, onBack, setError }: {
  email: string; onDone: (enabled: boolean) => void; onBack: () => void; setError: (s: string | null) => void;
}) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function enroll() {
    setError(null); setBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Cumplex" });
      if (error) throw error;
      setFactorId(data.id);
      setSecret((data as { totp?: { secret?: string } }).totp?.secret ?? null);
      const u = (data as { totp?: { uri?: string } }).totp?.uri ?? null;
      setUri(u);
      if (u) setQr(await QRCode.toDataURL(u, { margin: 1, width: 220 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar la configuración de MFA.");
    } finally { setBusy(false); }
  }
  async function verify() {
    if (!factorId) return;
    setError(null); setBusy(true);
    try {
      const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
      if (cErr) throw cErr;
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code });
      if (vErr) throw vErr;
      onDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Código incorrecto.");
    } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Token móvil (opcional)</h2>
        <p className="mt-1 text-sm text-yo-txt-2">Añade una capa extra de seguridad. Usa Google Authenticator, Authy o 1Password.</p>
      </div>
      {!factorId ? (
        <div className="rounded-lg border border-yo-border bg-yo-bg p-6 text-center">
          <KeyRound className="size-8 mx-auto text-yo-ac mb-2" />
          <p className="text-sm text-yo-txt-2 mb-4">Configura ahora tu autenticador para <span className="font-mono text-xs">{email}</span></p>
          <button onClick={enroll} disabled={busy}
            className="inline-flex items-center gap-2 min-h-10 px-5 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Configurar autenticador"}
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-yo-border bg-yo-bg p-4 flex flex-col sm:flex-row gap-4">
          {qr && <img src={qr} alt="QR TOTP" className="size-40 rounded bg-white p-2" />}
          <div className="flex-1">
            <p className="text-xs text-yo-txt-3 mb-1">Escanea el QR o ingresa el código manualmente:</p>
            {secret && (
              <div className="flex items-center gap-2 mb-3">
                <code className="text-[11px] font-mono bg-yo-surface border border-yo-border rounded px-2 py-1">{secret}</code>
                <button onClick={() => secret && navigator.clipboard.writeText(secret)} className="text-yo-txt-3 hover:text-yo-ac" aria-label="Copiar">
                  <Copy className="size-4" />
                </button>
              </div>
            )}
            <label htmlFor="totp" className="text-xs font-semibold text-yo-txt-2">Ingresa el código de 6 dígitos</label>
            <div className="flex gap-2 mt-1">
              <input id="totp" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="w-32 bg-yo-surface border border-yo-border rounded-md py-2 px-3 text-sm font-mono outline-none focus:border-yo-ac" />
              <button onClick={verify} disabled={busy || code.length !== 6}
                className="inline-flex items-center gap-2 px-4 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold disabled:opacity-50">
                {busy ? <Loader2 className="size-4 animate-spin" /> : "Verificar"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-yo-txt-2 hover:text-yo-txt">
          <ArrowLeft className="size-4" /> Regresar
        </button>
        <button type="button" onClick={() => onDone(false)} className="inline-flex items-center gap-1.5 text-xs text-yo-txt-3 hover:text-yo-txt">
          <SkipForward className="size-3.5" /> Omitir por ahora
        </button>
      </div>
    </div>
  );
}

// ─── STEP 4: Confirmación ──────────────────────────────────────────────────────
function Step4Confirm({ token, inv, org, addr, bioDone, mfaEnrolled, onBack, onFinished, setError }: {
  token: string;
  inv: Extract<LoadState, { status: "ok" }>["invitation"];
  org: Extract<LoadState, { status: "ok" }>["organization"];
  addr: Address;
  bioDone: boolean; mfaEnrolled: boolean;
  onBack: () => void; onFinished: () => void;
  setError: (s: string | null) => void;
}) {
  const finalizeFn = useServerFn(finalizeInviteeOnboarding);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  async function finish() {
    if (!accepted) { setError("Confirma que la información es correcta."); return; }
    setError(null); setSaving(true);
    try {
      await finalizeFn({ data: { token, biometric_completed: bioDone, mfa_enrolled: mfaEnrolled } });
      onFinished();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar el registro.");
    } finally { setSaving(false); }
  }

  const fullName = [inv.first_name, inv.last_name, inv.second_last_name].filter(Boolean).join(" ") || inv.full_name || "—";
  const addrLine = [addr.fiscal_street, addr.fiscal_ext_number, addr.fiscal_colonia, addr.fiscal_postal_code, addr.fiscal_municipio, addr.fiscal_estado].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Confirma y crea tu cuenta</h2>
        <p className="mt-1 text-sm text-yo-txt-2">Verifica que todo esté correcto antes de finalizar.</p>
      </div>
      <section className="rounded-lg border border-yo-border bg-yo-bg p-4 grid gap-1.5 text-xs sm:grid-cols-2">
        <ReadRow k="Organización" v={org.name ?? "—"} />
        <ReadRow k="Rol" v={inv.org_role} />
        <ReadRow k="Nombre" v={fullName} />
        <ReadRow k="Correo" v={inv.email} />
        <ReadRow k={inv.curp_rfc?.length === 18 ? "CURP" : "RFC"} v={inv.curp_rfc ?? "—"} mono />
        <ReadRow k="Domicilio" v={addrLine || "—"} />
        <ReadRow k="Identidad biométrica" v={bioDone ? "Verificada" : "Pendiente (podrás completarla más tarde)"}
          tone={bioDone ? "ok" : "warn"} />
        <ReadRow k="Token móvil (MFA)" v={mfaEnrolled ? "Activo" : "No configurado"} tone={mfaEnrolled ? "ok" : undefined} />
      </section>

      <label className="flex items-start gap-2 text-xs text-yo-txt-2">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 accent-[color:var(--yo-ac)]" />
        <span>Confirmo que los datos son correctos y acepto unirme a la organización <span className="font-semibold text-yo-txt">{org.name}</span>.</span>
      </label>

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onBack} disabled={saving}
          className="inline-flex items-center gap-1.5 text-sm text-yo-txt-2 hover:text-yo-txt disabled:opacity-50">
          <ArrowLeft className="size-4" /> Regresar
        </button>
        <button onClick={finish} disabled={saving || !accepted}
          className="inline-flex items-center gap-2 min-h-10 px-5 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold disabled:opacity-50">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <>Aceptar y unirme <ArrowRight className="size-4" /></>}
        </button>
      </div>
    </div>
  );
}

// ─── UI helpers ────────────────────────────────────────────────────────────────
function ReadRow({ k, v, mono, icon, tone }: { k: string; v: string; mono?: boolean; icon?: React.ReactNode; tone?: "ok" | "warn" }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-[10px] uppercase tracking-widest text-yo-txt-3 w-28 shrink-0 flex items-center gap-1">{icon}{k}</dt>
      <dd className={cn("text-yo-txt", mono && "font-mono text-[11px]",
        tone === "ok" && "text-emerald-500", tone === "warn" && "text-amber-500")}>{v}</dd>
    </div>
  );
}
function Rule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={cn("flex items-center gap-1.5", ok ? "text-emerald-500" : "text-yo-txt-3")}>
      <CheckCircle2 className={cn("size-3", ok ? "opacity-100" : "opacity-40")} />
      <span>{children}</span>
    </li>
  );
}
function PasswordField({ id, label, value, onChange, show, onToggle, placeholder }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold text-yo-txt-2 mb-1 block">{label}</label>
      <div className="flex items-center rounded-md border border-yo-border bg-yo-bg focus-within:border-yo-ac">
        <span className="pl-3 text-yo-txt-3"><Lock className="size-4" /></span>
        <input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "Crea una contraseña segura"} autoComplete="new-password"
          className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none" />
        <button type="button" onClick={onToggle} className="pr-3 text-yo-txt-3 hover:text-yo-ac" aria-label={show ? "Ocultar" : "Mostrar"}>
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}
