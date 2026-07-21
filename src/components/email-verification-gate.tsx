import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, ShieldCheck, RefreshCw, LogOut, Timer, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getEmailVerificationStatus,
  requestEmailOtp,
  verifyEmailOtp,
} from "@/lib/email-verification.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const OTP_TTL_SECONDS = 5 * 60;

export function EmailVerificationGate({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const getStatus = useServerFn(getEmailVerificationStatus);
  const requestOtp = useServerFn(requestEmailOtp);
  const verifyOtp = useServerFn(verifyEmailOtp);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["email-verification-status"],
    queryFn: () => getStatus(),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [autoSent, setAutoSent] = useState(false);

  // Hidratar estado desde el servidor
  useEffect(() => {
    if (!data) return;
    if (data.lastOtp && !data.lastOtp.consumed) setExpiresAt(data.lastOtp.expires_at);
    if (data.resendAvailableAt) setResendAt(data.resendAvailableAt);
    setLockedUntil(data.lockedUntil ?? null);
    if (data.lastOtp) setAttemptsRemaining(data.lastOtp.attemptsRemaining);
  }, [data]);

  // Auto-envío la primera vez
  useEffect(() => {
    if (!data || data.verified || autoSent) return;
    if (data.lockedUntil) { setAutoSent(true); return; }
    const last = data.lastOtp;
    const hasActive = last && !last.consumed && new Date(last.expires_at).getTime() > Date.now();
    if (hasActive) { setAutoSent(true); return; }
    // Respetar cooldown de reenvío del servidor
    if (data.resendAvailableAt && new Date(data.resendAvailableAt).getTime() > Date.now()) {
      setAutoSent(true); return;
    }
    setAutoSent(true);
    (async () => {
      try {
        setSending(true);
        const r = await requestOtp();
        if (r?.expires_at) setExpiresAt(r.expires_at);
        setResendAt(new Date(Date.now() + 60_000).toISOString());
        toast.success("Enviamos un código a tu correo");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo enviar el código");
      } finally {
        setSending(false);
      }
    })();
  }, [data, autoSent, requestOtp]);

  // Tick global
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remainingMs = useMemo(
    () => (expiresAt ? Math.max(0, new Date(expiresAt).getTime() - now) : 0),
    [expiresAt, now],
  );
  const remainingSec = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(remainingSec / 60).toString().padStart(2, "0");
  const ss = (remainingSec % 60).toString().padStart(2, "0");
  const progressPct = Math.max(0, Math.min(100, (remainingSec / OTP_TTL_SECONDS) * 100));

  const resendSecs = useMemo(
    () => (resendAt ? Math.max(0, Math.ceil((new Date(resendAt).getTime() - now) / 1000)) : 0),
    [resendAt, now],
  );

  const lockSecs = useMemo(
    () => (lockedUntil ? Math.max(0, Math.ceil((new Date(lockedUntil).getTime() - now) / 1000)) : 0),
    [lockedUntil, now],
  );
  const lockMm = Math.floor(lockSecs / 60).toString().padStart(2, "0");
  const lockSs = (lockSecs % 60).toString().padStart(2, "0");
  const isLocked = lockSecs > 0;

  if (isLoading || !data) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">
        Cargando…
      </div>
    );
  }
  if (data.verified) return <>{children}</>;

  async function handleResend() {
    if (isLocked || resendSecs > 0) return;
    try {
      setSending(true);
      const r = await requestOtp();
      if (r?.expires_at) setExpiresAt(r.expires_at);
      setResendAt(new Date(Date.now() + 60_000).toISOString());
      setCode("");
      setAttemptsRemaining(5);
      toast.success("Nuevo código enviado. Revisa tu correo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo reenviar");
      await refetch();
    } finally {
      setSending(false);
    }
  }

  async function handleVerify(e?: React.FormEvent) {
    e?.preventDefault();
    if (code.length !== 6 || isLocked) return;
    try {
      setVerifying(true);
      await verifyOtp({ data: { code } });
      toast.success("Correo verificado");
      await qc.invalidateQueries({ queryKey: ["email-verification-status"] });
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Código inválido");
      setCode("");
      await refetch();
    } finally {
      setVerifying(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-xl bg-primary/10 grid place-items-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Verifica tu correo</h1>
            <p className="text-xs text-muted-foreground">Requerido para activar tu cuenta</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Enviamos un código de 6 dígitos a{" "}
          <span className="text-foreground font-medium inline-flex items-center gap-1">
            <Mail className="h-3.5 w-3.5" /> {data.email}
          </span>
          .
        </p>

        {isLocked && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
            <Lock className="h-4 w-4 mt-0.5" />
            <div>
              <div className="font-medium">Verificación bloqueada</div>
              <div className="text-xs">
                Demasiados intentos incorrectos. Intenta nuevamente en{" "}
                <span className="font-mono">{lockMm}:{lockSs}</span>.
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoFocus
              disabled={isLocked}
              placeholder="••••••"
              className="text-center text-2xl tracking-[0.5em] font-mono h-14"
            />

            {/* Barra de progreso de expiración */}
            {expiresAt && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Timer className="h-3.5 w-3.5" />
                    {remainingMs > 0 ? "Expira en" : "Expirado"}
                  </span>
                  <span
                    className={`font-mono tabular-nums ${
                      remainingMs === 0
                        ? "text-destructive"
                        : remainingSec <= 30
                        ? "text-amber-500"
                        : "text-foreground"
                    }`}
                  >
                    {mm}:{ss}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      remainingSec <= 30 ? "bg-destructive" : "bg-primary"
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {attemptsRemaining !== null && !isLocked && attemptsRemaining < 5 && (
              <p className="mt-2 text-xs text-amber-500 text-center">
                Intentos restantes: {attemptsRemaining}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={code.length !== 6 || verifying || isLocked || remainingMs === 0}
            className="w-full h-11"
          >
            {verifying ? "Verificando…" : "Verificar y continuar"}
          </Button>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleResend}
              disabled={sending || resendSecs > 0 || isLocked}
              className="inline-flex items-center gap-1.5 text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${sending ? "animate-spin" : ""}`} />
              {isLocked
                ? "Reenvío bloqueado"
                : resendSecs > 0
                ? `Reenviar en ${resendSecs}s`
                : "Reenviar código"}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
