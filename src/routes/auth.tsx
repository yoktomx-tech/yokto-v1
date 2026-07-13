import { createFileRoute, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Mail, Lock, Eye, EyeOff, User, Loader2, ShieldCheck, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import wordmarkWhite from "@/assets/yokto-wordmark-white.png.asset.json";

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
    <div className="min-h-dvh grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] bg-background">
      {/* Left panel — brand */}
      <aside className="relative hidden lg:flex flex-col justify-between bg-yokto-black text-yokto-cream px-12 py-12 overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div
          aria-hidden
          className="absolute -top-40 -right-40 size-[28rem] rounded-full bg-yokto-yellow/10 blur-3xl pointer-events-none"
        />

        <div className="relative flex items-center gap-3">
          <span className="grid place-items-center size-9 border border-yokto-cream/40 font-display text-xl leading-none">
            Y
          </span>
          <span className="text-[11px] uppercase tracking-[0.28em] text-yokto-cream/60">
            Escrow · México
          </span>
        </div>

        <div className="relative max-w-lg">
          <img src={wordmarkWhite.url} alt="YOKTO" className="h-16 w-auto" />
          <h2 className="mt-8 font-display text-5xl leading-[0.95] tracking-wide text-yokto-cream">
            Pago seguro contra cumplimiento.
          </h2>
          <p className="mt-5 text-base text-yokto-cream/70 leading-relaxed max-w-md">
            Retención de fondos en pasarelas certificadas y liberación únicamente cuando se verifican
            las condiciones acordadas entre las partes.
          </p>

          <ul className="mt-8 flex flex-col gap-3 text-sm text-yokto-cream/80">
            {[
              "Stripe Connect + SPEI certificados",
              "Verificación KYC integrada",
              "Trazabilidad fiscal CFDI 4.0",
            ].map((f) => (
              <li key={f} className="flex items-center gap-3">
                <span className="grid place-items-center size-5 border border-yokto-yellow/60 text-yokto-yellow">
                  <ShieldCheck className="size-3" />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-yokto-cream/45">
          <span>© {new Date().getFullYear()} YOKTO</span>
          <span>v1.0 · MX</span>
        </div>
      </aside>

      {/* Right panel — form */}
      <main className="flex flex-col justify-center px-5 sm:px-10 lg:px-16 py-10 sm:py-16">
        <div className="w-full max-w-md mx-auto">
          {/* Mobile brand */}
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <span className="grid place-items-center size-10 bg-yokto-black text-yokto-cream font-display text-2xl leading-none">
              Y
            </span>
            <span className="font-display text-3xl tracking-wide text-foreground">YOKTO</span>
          </div>

          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground font-semibold">
            {mode === "login" ? "Acceso" : "Registro"}
          </p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl tracking-wide text-foreground">
            {mode === "login" ? "Bienvenido" : "Crea tu cuenta"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "login"
              ? "Ingresa tus credenciales para continuar"
              : "Regístrate para iniciar tu verificación KYC"}
          </p>

          <form onSubmit={handleEmail} className="mt-8 flex flex-col gap-4" noValidate>
            {mode === "signup" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <IconField
                  id="first-name"
                  icon={<User className="size-4" aria-hidden />}
                  label="Nombre" value={firstName} onChange={setFirstName}
                  required autoComplete="given-name" placeholder="Nombre"
                />
                <IconField
                  id="last-name"
                  icon={<User className="size-4" aria-hidden />}
                  label="Apellido" value={lastName} onChange={setLastName}
                  required autoComplete="family-name" placeholder="Apellido"
                />
              </div>
            )}

            <IconField
              id="email"
              icon={<Mail className="size-4" aria-hidden />}
              label="Correo electrónico" type="email" value={email} onChange={setEmail}
              required autoComplete="email" placeholder="tucorreo@ejemplo.com"
              inputMode="email"
            />

            <IconField
              id="password"
              icon={<Lock className="size-4" aria-hidden />}
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
                  className="grid place-items-center size-8 -mr-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yokto-black focus-visible:ring-offset-2 focus-visible:ring-offset-background transition"
                  aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPwd}
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              }
            />

            {mode === "login" && (
              <div className="flex justify-end -mt-1">
                <Link
                  to="/auth"
                  className="text-xs font-medium text-foreground/70 hover:text-foreground underline-offset-4 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-md border border-yokto-alert/70 bg-yokto-alert/10 px-3 py-2.5 text-sm text-yokto-alert"
              >
                {error}
              </div>
            )}
            {info && (
              <div
                role="status"
                className="rounded-md border border-yokto-black/80 bg-yokto-cream-2 px-3 py-2.5 text-sm text-yokto-black"
              >
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group mt-2 inline-flex items-center justify-center gap-2 min-h-12 px-5 rounded-md bg-yokto-black text-yokto-cream text-sm uppercase tracking-[0.14em] font-semibold shadow-sm transition hover:bg-yokto-yellow hover:text-yokto-black hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yokto-black focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 disabled:cursor-not-allowed"
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

          <div className="my-6 flex items-center gap-3" aria-hidden>
            <div className="h-px flex-1 bg-yokto-black/15" />
            <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">o</span>
            <div className="h-px flex-1 bg-yokto-black/15" />
          </div>

          <button
            onClick={handleGoogle}
            disabled={loading}
            type="button"
            className="w-full inline-flex items-center justify-center gap-3 min-h-12 px-5 rounded-md border border-yokto-black/80 bg-background text-sm font-semibold text-foreground transition hover:bg-muted hover:border-yokto-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yokto-black focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <GoogleIcon className="size-5" />
            Continuar con Google
          </button>

          <p className="mt-8 text-sm text-muted-foreground text-center">
            {mode === "login" ? "¿No tienes una cuenta? " : "¿Ya tienes cuenta? "}
            <button
              type="button"
              onClick={() => { setError(null); setInfo(null); setMode(mode === "login" ? "signup" : "login"); }}
              className="font-semibold text-foreground underline underline-offset-4 hover:text-yokto-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yokto-black focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
            >
              {mode === "login" ? "Crear cuenta" : "Iniciar sesión"}
            </button>
          </p>

          <p className="mt-6 text-[11px] text-muted-foreground text-center leading-relaxed">
            Al continuar aceptas nuestros{" "}
            <Link to="/marco-legal" className="underline underline-offset-4 hover:text-foreground">
              términos y aviso de privacidad
            </Link>.
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
      <label htmlFor={id} className="text-xs font-semibold text-foreground">
        {label}
      </label>
      <div className="group flex items-center gap-2.5 rounded-md border border-yokto-black/80 bg-background px-3.5 h-12 transition focus-within:border-yokto-black focus-within:ring-2 focus-within:ring-yokto-yellow focus-within:ring-offset-0 hover:border-yokto-black">
        <span className="text-muted-foreground shrink-0 group-focus-within:text-foreground transition">
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
          className="flex-1 min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
        />
        {trailing}
      </div>
      {hint && (
        <p id={hintId} className="text-[11px] text-muted-foreground">
          {hint}
        </p>
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
