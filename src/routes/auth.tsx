import { createFileRoute, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const searchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(["login", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Acceso — YOKTO" },
      { name: "description", content: "Ingresa o crea tu cuenta en YOKTO para operar pagos contra cumplimiento." },
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
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">YOKTO / Acceso</p>
            <h1 className="mt-2 font-display text-5xl tracking-wide text-foreground">
              {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "login"
                ? "Accede a tu panel para gestionar operaciones de pago contra cumplimiento."
                : "Regístrate para iniciar tu verificación KYC y operar en la plataforma."}
            </p>
          </div>

          <div className="flex border border-yokto-black">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-3 text-[13px] uppercase tracking-[0.14em] font-semibold transition ${
                mode === "login" ? "bg-yokto-black text-yokto-cream" : "bg-transparent text-foreground/70 hover:bg-muted"
              }`}
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 py-3 text-[13px] uppercase tracking-[0.14em] font-semibold border-l border-yokto-black transition ${
                mode === "signup" ? "bg-yokto-black text-yokto-cream" : "bg-transparent text-foreground/70 hover:bg-muted"
              }`}
            >
              Crear cuenta
            </button>
          </div>

          <form onSubmit={handleEmail} className="mt-6 flex flex-col gap-4">
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre" value={firstName} onChange={setFirstName} required autoComplete="given-name" />
                <Field label="Apellido" value={lastName} onChange={setLastName} required autoComplete="family-name" />
              </div>
            )}
            <Field label="Correo" type="email" value={email} onChange={setEmail} required autoComplete="email" />
            <Field
              label="Contraseña" type="password" value={password} onChange={setPassword}
              required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"}
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
              className="mt-2 inline-flex items-center justify-center px-5 py-3 bg-yokto-yellow text-yokto-black text-[13px] uppercase tracking-[0.14em] font-semibold border border-yokto-black transition hover:bg-yokto-black hover:text-yokto-yellow disabled:opacity-50"
            >
              {loading ? "Procesando…" : mode === "login" ? "Entrar" : "Crear cuenta"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-yokto-black/20" />
            <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">o</span>
            <div className="h-px flex-1 bg-yokto-black/20" />
          </div>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 border border-yokto-black bg-background text-[13px] uppercase tracking-[0.14em] font-semibold text-foreground hover:bg-muted disabled:opacity-50"
          >
            Continuar con Google
          </button>

          <p className="mt-6 text-xs text-muted-foreground text-center">
            Al continuar aceptas nuestros{" "}
            <Link to="/marco-legal" className="underline underline-offset-4">términos y aviso de privacidad</Link>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", required, minLength, autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.16em] text-foreground/70 font-semibold">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className="border border-yokto-black bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-yokto-yellow focus:ring-offset-0"
      />
    </label>
  );
}
