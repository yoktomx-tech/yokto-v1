import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Loader2, ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CumplexLogo } from "@/components/logo";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Recuperar contraseña — Cumplex" },
      { name: "description", content: "Recupera el acceso a tu cuenta Cumplex." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el correo");
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
          <p className="text-xs uppercase tracking-widest text-yokto-text-3 font-semibold">
            Recuperación
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">
            {sent ? "Revisa tu correo" : "¿Olvidaste tu contraseña?"}
          </h2>
          <p className="mt-1.5 text-sm text-yokto-text-2">
            {sent
              ? "Te enviamos un enlace para restablecer tu contraseña. Revisa también la carpeta de spam."
              : "Ingresa tu correo y te enviaremos un enlace para restablecerla."}
          </p>

          {!sent ? (
            <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-medium text-yokto-text-2">
                  Correo electrónico
                </label>
                <div className="group flex items-center gap-2.5 rounded-md border border-white/[0.08] bg-yokto-base h-11 px-3 transition focus-within:border-yokto-accent focus-within:ring-2 focus-within:ring-yokto-accent/20 hover:border-white/[0.15]">
                  <Mail className="size-4 text-yokto-text-3 shrink-0 group-focus-within:text-yokto-accent transition" aria-hidden />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    inputMode="email"
                    placeholder="tucorreo@ejemplo.com"
                    className="flex-1 min-w-0 bg-transparent text-sm text-yokto-text-1 outline-none placeholder:text-yokto-text-3"
                  />
                </div>
              </div>

              {error && (
                <div role="alert" className="rounded-md border border-yokto-error/25 bg-yokto-error/10 px-3 py-2.5 text-sm text-yokto-error">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group mt-1 inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-md bg-yokto-accent hover:bg-yokto-accent-h text-white text-sm font-semibold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yokto-accent focus-visible:ring-offset-2 focus-visible:ring-offset-yokto-card"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Enviando…
                  </>
                ) : (
                  <>
                    Enviar enlace
                    <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="mt-7 rounded-md border border-yokto-accent/25 bg-yokto-accent/10 px-4 py-3 text-sm text-yokto-accent flex items-start gap-2.5">
              <ShieldCheck className="size-4 mt-0.5 shrink-0" aria-hidden />
              <span>Enlace enviado a <strong>{email}</strong>. Expira en 1 hora.</span>
            </div>
          )}

          <p className="mt-6 text-sm text-yokto-text-2 text-center">
            <Link to="/auth" className="inline-flex items-center gap-1.5 font-semibold text-yokto-accent hover:text-yokto-accent-h underline-offset-4 hover:underline">
              <ArrowLeft className="size-3.5" aria-hidden />
              Volver al inicio de sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
