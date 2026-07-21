import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, RefreshCw, Timer, Lock, ShieldCheck, Clock, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getEmailVerificationStatus,
  requestEmailOtp,
  verifyEmailOtp,
} from "@/lib/email-verification.functions";
import { Button } from "@/components/ui/button";
import { YoktoLogo } from "@/components/logo";
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
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl p-8">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <YoktoLogo variant="auto" className="h-8" />
        </div>

        <div className="text-center mb-6">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 grid place-items-center mb-3">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Verifica tu correo electrónico</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Enviamos un código de 6 dígitos a{" "}
            <span className="text-foreground font-medium inline-flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" /> {data.email}
            </span>
          </p>
        </div>

        {/* Explicación */}
        <div className="mb-6 rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground space-y-2">
          <p className="text-foreground font-medium text-sm">¿Por qué es necesario?</p>
          <ul className="space-y-1.5">
            <li className="flex gap-2">
              <ShieldCheck className="h-3.5 w-3.5 mt-0.5 text-primary flex-shrink-0" />
              <span><strong className="text-foreground">Seguridad de tu cuenta:</strong> confirma que el correo te pertenece y evita accesos no autorizados.</span>
            </li>
            <li className="flex gap-2">
              <Mail className="h-3.5 w-3.5 mt-0.5 text-primary flex-shrink-0" />
              <span><strong className="text-foreground">Comunicaciones críticas:</strong> notificaciones de operaciones, liberaciones de fondos, disputas y alertas de cumplimiento se envían a este correo.</span>
            </li>
            <li className="flex gap-2">
              <Clock className="h-3.5 w-3.5 mt-0.5 text-primary flex-shrink-0" />
              <span><strong className="text-foreground">Recuperación:</strong> es el canal oficial para restablecer contraseña y confirmar cambios sensibles.</span>
            </li>
            <li className="flex gap-2">
              <Ban className="h-3.5 w-3.5 mt-0.5 text-primary flex-shrink-0" />
              <span><strong className="text-foreground">Cumplimiento PLD/FT:</strong> YOKTO requiere identificar de forma fehaciente a cada usuario antes de operar.</span>
            </li>
          </ul>
        </div>

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
          <OtpBoxes value={code} onChange={setCode} disabled={isLocked} onComplete={() => handleVerify()} />

          {/* Barra de progreso de expiración */}
          {expiresAt && (
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Timer className="h-3.5 w-3.5" />
                  {remainingMs > 0 ? "El código expira en" : "Código expirado"}
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
            <p className="text-xs text-amber-500 text-center">
              Intentos restantes: {attemptsRemaining}
            </p>
          )}

          <Button
            type="submit"
            disabled={code.length !== 6 || verifying || isLocked || remainingMs === 0}
            className="w-full h-11"
          >
            {verifying ? "Verificando…" : "Verificar y continuar"}
          </Button>

          <div className="flex items-center justify-between text-xs pt-2">
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
              className="text-muted-foreground hover:text-foreground"
            >
              Cerrar sesión
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OtpBoxes({
  value,
  onChange,
  disabled,
  onComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  onComplete?: () => void;
}) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  function setDigit(i: number, d: string) {
    const clean = d.replace(/\D/g, "");
    if (!clean) {
      const next = value.slice(0, i) + value.slice(i + 1);
      onChange(next);
      return;
    }
    const arr = value.padEnd(6, " ").split("");
    arr[i] = clean[0];
    const joined = arr.join("").replace(/\s/g, "");
    onChange(joined.slice(0, 6));
    if (i < 5) inputsRef.current[i + 1]?.focus();
    if (joined.length === 6) onComplete?.();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    onChange(text);
    const focusIdx = Math.min(text.length, 5);
    inputsRef.current[focusIdx]?.focus();
    if (text.length === 6) onComplete?.();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (!digits[i].trim() && i > 0) {
        inputsRef.current[i - 1]?.focus();
        const arr = value.split("");
        arr.splice(i - 1, 1);
        onChange(arr.join(""));
        e.preventDefault();
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      inputsRef.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < 5) {
      inputsRef.current[i + 1]?.focus();
    }
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputsRef.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={digits[i].trim()}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.currentTarget.select()}
          autoFocus={i === 0}
          className="h-14 w-12 rounded-lg border border-input bg-background text-center text-2xl font-mono font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 transition-all"
        />
      ))}
    </div>
  );
}
