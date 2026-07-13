import { createFileRoute, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Mail, Lock, Eye, EyeOff, User } from "lucide-react";
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
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      {/* Left panel — brand */}
      <aside className="relative hidden md:flex flex-col items-center justify-center bg-yokto-black text-yokto-cream px-10 py-16 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative flex flex-col items-center gap-8 max-w-md text-center">
          <div className="grid place-items-center size-32 border-4 border-yokto-cream">
            <span className="font-display text-[7rem] leading-none text-yokto-cream">Y</span>
          </div>
          <img
            src={wordmarkWhite.url}
            alt="YOKTO"
            className="h-14 w-auto"
          />
          <p className="text-sm tracking-wide text-yokto-cream/70">
            Plataforma Profesional de Escrow Digital
          </p>
          <div className="mt-8 pt-8 border-t border-yokto-cream/15 w-full">
            <p className="text-[11px] uppercase tracking-[0.24em] text-yokto-cream/50">
              Pago seguro contra cumplimiento
            </p>
            <p className="mt-3 text-xs text-yokto-cream/60 leading-relaxed">
              Retención de fondos en pasarelas certificadas · Liberación por condiciones verificables · México B2B/B2C
            </p>
          </div>
        </div>
      </aside>

      {/* Right panel — form */}
      <main className="flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-16">
        <div className="w-full max-w-md mx-auto">
          <div className="md:hidden mb-8 flex items-center gap-3">
            <span className="grid place-items-center size-10 bg-yokto-black text-yokto-cream font-display text-2xl leading-none">Y</span>
            <span className="font-display text-3xl tracking-wide text-foreground">YOKTO</span>
          </div>

          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            {mode === "login" ? "Acceso" : "Registro"}
          </p>
          <h1 className="mt-2 font-display text-5xl tracking-wide text-foreground">
            {mode === "login" ? "Bienvenido" : "Crea tu cuenta"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "login"
              ? "Ingresa tus credenciales para continuar"
              : "Regístrate para iniciar tu verificación KYC"}
          </p>

          <form onSubmit={handleEmail} className="mt-8 flex flex-col gap-5">
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-3">
                <IconField
                  icon={<User className="size-4" />}
                  label="Nombre" value={firstName} onChange={setFirstName}
                  required autoComplete="given-name" placeholder="Nombre"
                />
                <IconField
                  icon={<User className="size-4" />}
                  label="Apellido" value={lastName} onChange={setLastName}
                  required autoComplete="family-name" placeholder="Apellido"
                />
              </div>
            )}

            <IconField
              icon={<Mail className="size-4" />}
              label="Correo Electrónico" type="email" value={email} onChange={setEmail}
              required autoComplete="email" placeholder="tucorreo@ejemplo.com"
            />

            <IconField
              icon={<Lock className="size-4" />}
              label="Contraseña"
              type={showPwd ? "text" : "password"}
              value={password} onChange={setPassword}
              required minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="••••••••"
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              }
            />

            {error && (
              <div className="border border-yokto-alert bg-yokto-alert/10 px-3 py-2 text-sm text-yokto-alert">
                {error}
              </div>
            )}
            {info && (
              <div className="border border-yokto-black bg-yokto-cream px-3 py-2 text-sm text-yokto-black">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 inline-flex items-center justify-center px-5 py-3.5 bg-yokto-black text-yokto-cream text-sm uppercase tracking-[0.16em] font-semibold transition hover:bg-yokto-yellow hover:text-yokto-black disabled:opacity-50"
            >
              {loading ? "Procesando…" : mode === "login" ? "Iniciar Sesión" : "Crear cuenta"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-yokto-black/15" />
            <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">o</span>
            <div className="h-px flex-1 bg-yokto-black/15" />
          </div>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 border border-yokto-black bg-background text-[13px] uppercase tracking-[0.14em] font-semibold text-foreground hover:bg-muted disabled:opacity-50"
          >
            <GoogleIcon className="size-4" />
            Continuar con Google
          </button>

          <p className="mt-8 text-sm text-muted-foreground text-center">
            {mode === "login" ? "¿No tienes una cuenta? " : "¿Ya tienes cuenta? "}
            <button
              type="button"
              onClick={() => { setError(null); setInfo(null); setMode(mode === "login" ? "signup" : "login"); }}
              className="font-semibold text-foreground underline underline-offset-4 hover:text-yokto-black"
            >
              {mode === "login" ? "Crear cuenta" : "Iniciar sesión"}
            </button>
          </p>

          <p className="mt-6 text-[11px] text-muted-foreground text-center">
            Al continuar aceptas nuestros{" "}
            <Link to="/marco-legal" className="underline underline-offset-4">términos y aviso de privacidad</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}

function IconField({
  icon, label, value, onChange, type = "text", required, minLength, autoComplete, placeholder, trailing,
}: {
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
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-foreground">{label}</span>
      <div className="flex items-center gap-2 border border-yokto-black bg-background px-3 py-2.5 focus-within:ring-2 focus-within:ring-yokto-yellow">
        <span className="text-muted-foreground shrink-0">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
        />
        {trailing}
      </div>
    </label>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.12c-.22-.66-.35-1.36-.35-2.12s.13-1.46.35-2.12V7.04H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.96l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
