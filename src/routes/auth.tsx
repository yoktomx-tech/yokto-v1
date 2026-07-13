import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Mail, Lock, Eye, EyeOff, User, Loader2, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

const searchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(["login", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Acceso — YOKTO" },
      { name: "description", content: "Ingresa o crea tu cuenta en YOKTO, plataforma profesional de escrow digital." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">(search.mode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const redirectTo = search.redirect && search.redirect.startsWith("/") ? search.redirect : "/dashboard";

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) navigate({ to: redirectTo });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.invalidate();
        navigate({ to: redirectTo });
      }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [navigate, redirectTo, router]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null); setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}${redirectTo}`,
            data: { first_name: firstName, last_name: lastName },
          },
        });
        if (error) throw error;
        setInfo("Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de autenticación");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null); setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error con Google");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] bg-yokto-base text-yokto-text-1">
      {/* Left — hero */}
      <aside className="relative hidden lg:flex flex-col justify-between p-12 bg-yokto-elevated border-r border-white/[0.06] overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.20)_0%,transparent_60%)] pointer-events-none"
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.5] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, #EBEBF0 1px, transparent 1px), linear-gradient(to bottom, #EBEBF0 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />

        <div className="relative flex items-center gap-2.5">
          <YoktoLogo variant="dark" className="h-7 w-auto" />
        </div>

        <div className="relative max-w-lg">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-yokto-accent bg-yokto-accent/10 border border-yokto-accent/25 rounded-full px-2.5 py-1">
            <Sparkles className="size-3" />
            Escrow digital · México
          </span>
          <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight text-yo-txt">
            Tu dinero,<br />
            <span className="text-yo-ac">
              hasta que
            </span>
            <br />se cumpla.
          </h1>
          <p className="mt-6 text-base text-yokto-text-2 leading-relaxed max-w-md">
            Retención de fondos en pasarelas certificadas y liberación únicamente cuando se verifican
            las condiciones acordadas entre las partes.
          </p>

          <ul className="mt-8 flex flex-col gap-3 text-sm text-yokto-text-2">
            {["Stripe Connect + SPEI certificados", "Verificación KYC integrada", "Trazabilidad fiscal CFDI 4.0"].map((f) => (
              <li key={f} className="flex items-center gap-3">
                <span className="grid place-items-center size-6 rounded-md bg-yokto-accent/10 border border-yokto-accent/25 text-yokto-accent">
                  <ShieldCheck className="size-3.5" />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between text-xs text-yokto-text-3">
          <span>© {new Date().getFullYear()} YOKTO</span>
          <span className="uppercase tracking-widest">v2.0 · MX</span>
        </div>
      </aside>

      {/* Right — form */}
      <main className="flex flex-col justify-center items-center px-5 sm:px-10 py-12 sm:py-16">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="lg:hidden mb-8 flex items-center gap-2.5">
            <YoktoLogo variant="dark" className="h-7 w-auto" />
          </div>

          <div className="rounded-2xl bg-yokto-card border border-white/[0.06] shadow-lg p-7 sm:p-8">
            <p className="text-xs uppercase tracking-widest text-yokto-text-3 font-semibold">
              {mode === "login" ? "Acceso" : "Registro"}
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-yokto-text-1">
              {mode === "login" ? "Bienvenido de vuelta" : "Crea tu cuenta"}
            </h2>
            <p className="mt-1.5 text-sm text-yokto-text-2">
              {mode === "login"
                ? "Ingresa tus credenciales para continuar"
                : "Regístrate para iniciar tu verificación KYC"}
            </p>

            <form onSubmit={handleEmail} className="mt-7 flex flex-col gap-4" noValidate>
              {mode === "signup" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <IconField
                    id="first-name" icon={<User className="size-4" aria-hidden />}
                    label="Nombre" value={firstName} onChange={setFirstName}
                    required autoComplete="given-name" placeholder="Nombre"
                  />
                  <IconField
                    id="last-name" icon={<User className="size-4" aria-hidden />}
                    label="Apellido" value={lastName} onChange={setLastName}
                    required autoComplete="family-name" placeholder="Apellido"
                  />
                </div>
              )}

              <IconField
                id="email" icon={<Mail className="size-4" aria-hidden />}
                label="Correo electrónico" type="email" value={email} onChange={setEmail}
                required autoComplete="email" placeholder="tucorreo@ejemplo.com" inputMode="email"
              />

              <IconField
                id="password" icon={<Lock className="size-4" aria-hidden />}
                label="Contraseña"
                type={showPwd ? "text" : "password"}
                value={password} onChange={setPassword}
                required minLength={8}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="••••••••"
                hint={mode === "signup" ? "Mínimo 8 caracteres" : undefined}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="grid place-items-center size-8 rounded-md text-yokto-text-3 hover:text-yokto-text-1 hover:bg-yokto-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yokto-accent transition"
                    aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={showPwd}
                    tabIndex={-1}
                  >
                    {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                }
              />

              {error && (
                <div role="alert" className="rounded-md border border-yokto-error/25 bg-yokto-error/10 px-3 py-2.5 text-sm text-yokto-error">
                  {error}
                </div>
              )}
              {info && (
                <div role="status" className="rounded-md border border-yokto-accent/25 bg-yokto-accent/10 px-3 py-2.5 text-sm text-yokto-accent">
                  {info}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group mt-1 inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-md bg-yokto-accent hover:bg-yokto-accent-h text-white text-sm font-semibold shadow-sm hover:shadow-glow-accent transition disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yokto-accent focus-visible:ring-offset-2 focus-visible:ring-offset-yokto-card"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Procesando…
                  </>
                ) : (
                  <>
                    {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
                    <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                  </>
                )}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3" aria-hidden>
              <div className="h-px flex-1 bg-white/[0.08]" />
              <span className="text-[11px] uppercase tracking-widest text-yokto-text-3">o</span>
              <div className="h-px flex-1 bg-white/[0.08]" />
            </div>

            <button
              onClick={handleGoogle}
              disabled={loading}
              type="button"
              className="w-full inline-flex items-center justify-center gap-3 min-h-11 px-5 rounded-md border border-white/[0.10] hover:border-white/[0.20] bg-yokto-hover/50 hover:bg-yokto-hover text-sm font-medium text-yokto-text-1 transition disabled:opacity-50"
            >
              <GoogleIcon className="size-4" />
              Continuar con Google
            </button>

            <p className="mt-6 text-sm text-yokto-text-2 text-center">
              {mode === "login" ? "¿No tienes una cuenta? " : "¿Ya tienes cuenta? "}
              {mode === "login" ? (
                <a href="/onboarding" className="font-semibold text-yokto-accent hover:text-yokto-accent-h underline-offset-4 hover:underline">
                  Crear cuenta
                </a>
              ) : (
                <button type="button" onClick={() => { setError(null); setInfo(null); setMode("login"); }}
                  className="font-semibold text-yokto-accent hover:text-yokto-accent-h underline-offset-4 hover:underline">
                  Iniciar sesión
                </button>
              )}
            </p>
          </div>

          <p className="mt-6 text-xs text-yokto-text-3 text-center leading-relaxed">
            Al continuar aceptas nuestros términos y aviso de privacidad.
          </p>
        </div>
      </main>
    </div>
  );
}

function IconField({
  id, icon, label, value, onChange, type = "text", required, minLength,
  autoComplete, placeholder, trailing, hint, inputMode,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  placeholder?: string;
  trailing?: React.ReactNode;
  hint?: string;
  inputMode?: "text" | "email" | "tel" | "url" | "numeric" | "decimal" | "search";
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-yokto-text-2">
        {label}
      </label>
      <div className="group flex items-center gap-2.5 rounded-md border border-white/[0.08] bg-yokto-base h-11 px-3 transition focus-within:border-yokto-accent focus-within:ring-2 focus-within:ring-yokto-accent/20 hover:border-white/[0.15]">
        <span className="text-yokto-text-3 shrink-0 group-focus-within:text-yokto-accent transition">
          {icon}
        </span>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
          inputMode={inputMode}
          aria-describedby={hintId}
          className="flex-1 min-w-0 bg-transparent text-sm text-yokto-text-1 outline-none placeholder:text-yokto-text-3"
        />
        {trailing}
      </div>
      {hint && (
        <p id={hintId} className="text-[11px] text-yokto-text-3">{hint}</p>
      )}
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.12c-.22-.66-.35-1.36-.35-2.12s.13-1.46.35-2.12V7.04H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.96l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
