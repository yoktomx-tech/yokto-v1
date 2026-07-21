import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, ShieldCheck, RefreshCw, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getEmailVerificationStatus,
  requestEmailOtp,
  verifyEmailOtp,
} from "@/lib/email-verification.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function EmailVerificationGate({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const getStatus = useServerFn(getEmailVerificationStatus);
  const requestOtp = useServerFn(requestEmailOtp);
  const verifyOtp = useServerFn(verifyEmailOtp);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["email-verification-status"],
    queryFn: () => getStatus(),
    staleTime: 30_000,
  });

  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [autoSent, setAutoSent] = useState(false);

  // Enviar OTP automáticamente al mostrar el gate
  useEffect(() => {
    if (!data || data.verified || autoSent) return;
    const last = data.lastOtp;
    const hasActive = last && !last.consumed && new Date(last.expires_at).getTime() > Date.now();
    if (hasActive) {
      setExpiresAt(last.expires_at);
      setAutoSent(true);
      return;
    }
    setAutoSent(true);
    (async () => {
      try {
        setSending(true);
        const r = await requestOtp();
        if (r?.expires_at) setExpiresAt(r.expires_at);
        setCooldown(60);
        toast.success("Enviamos un código a tu correo");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo enviar el código");
      } finally {
        setSending(false);
      }
    })();
  }, [data, autoSent, requestOtp]);

  // Tick para cooldown y expiración
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const remainingMs = useMemo(() => {
    if (!expiresAt) return 0;
    return Math.max(0, new Date(expiresAt).getTime() - now);
  }, [expiresAt, now]);
  const mm = Math.floor(remainingMs / 60000).toString().padStart(2, "0");
  const ss = Math.floor((remainingMs % 60000) / 1000).toString().padStart(2, "0");

  if (isLoading || !data) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">
        Cargando…
      </div>
    );
  }
  if (data.verified) return <>{children}</>;

  async function handleResend() {
    try {
      setSending(true);
      const r = await requestOtp();
      if (r?.expires_at) setExpiresAt(r.expires_at);
      setCooldown(60);
      setCode("");
      toast.success("Nuevo código enviado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo reenviar");
    } finally {
      setSending(false);
    }
  }

  async function handleVerify(e?: React.FormEvent) {
    e?.preventDefault();
    if (code.length !== 6) return;
    try {
      setVerifying(true);
      await verifyOtp({ data: { code } });
      toast.success("Correo verificado");
      await qc.invalidateQueries({ queryKey: ["email-verification-status"] });
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Código inválido");
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
          . El código expira en 5 minutos.
        </p>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoFocus
              placeholder="••••••"
              className="text-center text-2xl tracking-[0.5em] font-mono h-14"
            />
            {expiresAt && remainingMs > 0 && (
              <p className="mt-2 text-xs text-muted-foreground text-center">
                Vigente por {mm}:{ss}
              </p>
            )}
            {expiresAt && remainingMs === 0 && (
              <p className="mt-2 text-xs text-destructive text-center">Código expirado. Solicita uno nuevo.</p>
            )}
          </div>

          <Button type="submit" disabled={code.length !== 6 || verifying} className="w-full h-11">
            {verifying ? "Verificando…" : "Verificar y continuar"}
          </Button>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleResend}
              disabled={sending || cooldown > 0}
              className="inline-flex items-center gap-1.5 text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${sending ? "animate-spin" : ""}`} />
              {cooldown > 0 ? `Reenviar en ${cooldown}s` : "Reenviar código"}
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
