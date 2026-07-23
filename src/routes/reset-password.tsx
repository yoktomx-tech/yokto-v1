import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Eye, EyeOff, Loader2, ArrowRight, CheckCircle2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CumplexLogo } from "@/components/logo";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nueva contraseña — Cumplex" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

const requirements = [
  { key: "length", label: "Mínimo 8 caracteres", test: (v: string) => v.length >= 8 },
  { key: "upper", label: "Una mayúscula", test: (v: string) => /[A-Z]/.test(v) },
  { key: "lower", label: "Una minúscula", test: (v: string) => /[a-z]/.test(v) },
  { key: "number", label: "Un número", test: (v: string) => /\d/.test(v) },
];

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase attaches session via the recovery link automatically.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else {
        // Give the client a beat to process the URL hash tokens
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: d2 }) => {
            if (d2.session) setReady(true);
            else setInvalidLink(true);
          });
        }, 800);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const allValid = requirements.every((r) => r.test(password));
  const match = password.length > 0 && password === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!allValid) return setError("La contraseña no cumple los requisitos");
    if (!match) return setError("Las contraseñas no coinciden");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      await supabase.auth.signOut();
      setTimeout(() => navigate({ to: "/auth" }), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la contraseña");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-yokto-base text-yokto-text-1 px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5 justify-center">
          <CumplexLogo variant="auto" className="h-7 w-auto" />
        </div>

        <div className="rounded-2xl bg-yokto-card border border-white/[0.06] shadow-lg p-7 sm:p-8">
          {invalidLink ? (
            <>
              <p className="text-xs uppercase tracking-widest text-yokto-error font-semibold">Enlace inválido</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">Enlace expirado</h2>
              <p className="mt-1.5 text-sm text-yokto-text-2">
                El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo.
              </p>
              <Link
                to="/forgot-password"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 min-h-11 px-5 rounded-md bg-yokto-accent hover:bg-yokto-accent-h text-white text-sm font-semibold transition"
              >
                Solicitar nuevo enlace
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </>
          ) : done ? (
            <div className="text-center">
              <div className="mx-auto grid place-items-center size-12 rounded-full bg-yokto-accent/10 border border-yokto-accent/25 text-yokto-accent">
                <CheckCircle2 className="size-6" />
              </div>
              <h2 className="mt-4 text-2xl font-bold tracking-tight">Contraseña actualizada</h2>
              <p className="mt-1.5 text-sm text-yokto-text-2">Redirigiendo al inicio de sesión…</p>
            </div>
          ) : !ready ? (
            <div className="py-12 grid place-items-center">
              <Loader2 className="size-6 animate-spin text-yokto-text-3" aria-hidden />
              <p className="mt-3 text-sm text-yokto-text-2">Validando enlace…</p>
            </div>
          ) : (
            <>
              <p className="text-xs uppercase tracking-widest text-yokto-text-3 font-semibold">Recuperación</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">Nueva contraseña</h2>
              <p className="mt-1.5 text-sm text-yokto-text-2">Define una contraseña segura para tu cuenta.</p>

              <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4" noValidate>
                <PwdField
                  id="password" label="Contraseña" value={password} onChange={setPassword}
                  show={showPwd} onToggle={() => setShowPwd((v) => !v)} autoComplete="new-password"
                />

                <ul className="flex flex-col gap-1.5 -mt-1">
                  {requirements.map((r) => {
                    const ok = r.test(password);
                    return (
                      <li key={r.key} className={`flex items-center gap-2 text-xs ${ok ? "text-yokto-accent" : "text-yokto-text-3"}`}>
                        <CheckCircle2 className={`size-3.5 ${ok ? "opacity-100" : "opacity-40"}`} aria-hidden />
                        {r.label}
                      </li>
                    );
                  })}
                </ul>

                <PwdField
                  id="confirm" label="Confirmar contraseña" value={confirm} onChange={setConfirm}
                  show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} autoComplete="new-password"
                  placeholder="Repite tu contraseña"
                />
                {confirm.length > 0 && (
                  <p className={`text-xs -mt-2 ${match ? "text-yokto-accent" : "text-yokto-error"}`}>
                    {match ? "Las contraseñas coinciden" : "Las contraseñas no coinciden"}
                  </p>
                )}

                {error && (
                  <div role="alert" className="rounded-md border border-yokto-error/25 bg-yokto-error/10 px-3 py-2.5 text-sm text-yokto-error">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !allValid || !match}
                  className="group mt-1 inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-md bg-yokto-accent hover:bg-yokto-accent-h text-white text-sm font-semibold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Actualizando…
                    </>
                  ) : (
                    <>
                      Actualizar contraseña
                      <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-6 text-sm text-yokto-text-2 text-center">
                <Link to="/auth" className="inline-flex items-center gap-1.5 font-semibold text-yokto-accent hover:text-yokto-accent-h underline-offset-4 hover:underline">
                  <ArrowLeft className="size-3.5" aria-hidden />
                  Volver al inicio de sesión
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PwdField({
  id, label, value, onChange, show, onToggle, autoComplete, placeholder = "••••••••",
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; autoComplete: string; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-yokto-text-2">{label}</label>
      <div className="group flex items-center gap-2.5 rounded-md border border-white/[0.08] bg-yokto-base h-11 px-3 transition focus-within:border-yokto-accent focus-within:ring-2 focus-within:ring-yokto-accent/20 hover:border-white/[0.15]">
        <Lock className="size-4 text-yokto-text-3 shrink-0 group-focus-within:text-yokto-accent transition" aria-hidden />
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent text-sm text-yokto-text-1 outline-none placeholder:text-yokto-text-3"
        />
        <button
          type="button"
          onClick={onToggle}
          className="grid place-items-center size-8 rounded-md text-yokto-text-3 hover:text-yokto-text-1 hover:bg-yokto-hover transition"
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          tabIndex={-1}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}
