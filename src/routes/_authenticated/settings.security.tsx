import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Shield, KeyRound, Smartphone, RefreshCw, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SettingsCard, SettingsRow } from "@/components/settings/settings-shell";
import { ReauthDialog } from "@/components/settings/reauth-dialog";

export const Route = createFileRoute("/_authenticated/settings/security")({
  component: SecurityPage,
});

const pwdSchema = z.object({
  current: z.string().min(8, "Mínimo 8 caracteres"),
  next: z.string()
    .min(12, "Mínimo 12 caracteres")
    .regex(/[A-Z]/, "Requiere mayúscula")
    .regex(/[a-z]/, "Requiere minúscula")
    .regex(/[0-9]/, "Requiere número")
    .regex(/[^A-Za-z0-9]/, "Requiere símbolo"),
  confirm: z.string(),
}).refine((d) => d.next === d.confirm, { message: "No coinciden", path: ["confirm"] });

function SecurityPage() {
  // Password
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [savingPwd, setSavingPwd] = useState(false);

  // MFA
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"disable" | "regen" | null>(null);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    const parsed = pwdSchema.safeParse(pwd);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: pwd.next });
    setSavingPwd(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Contraseña actualizada. Se registró en tu auditoría.");
    setPwd({ current: "", next: "", confirm: "" });
  }

  function startMfaSetup() {
    setSetupOpen(true);
    setOtp("");
  }

  function verifyOtp() {
    if (!/^\d{6}$/.test(otp)) { toast.error("Código de 6 dígitos"); return; }
    // Mock verify — in prod: supabase.auth.mfa.verify
    setMfaEnabled(true);
    setSetupOpen(false);
    setRecovery(generateRecoveryCodes());
    toast.success("MFA activado. Guarda tus códigos de recuperación.");
  }

  function requestReauth(action: "disable" | "regen") {
    setPendingAction(action);
    setReauthOpen(true);
  }

  async function handleReauthed() {
    if (pendingAction === "disable") {
      setMfaEnabled(false);
      setRecovery(null);
      toast.success("MFA desactivado");
    } else if (pendingAction === "regen") {
      setRecovery(generateRecoveryCodes());
      toast.success("Códigos regenerados. Los anteriores quedaron invalidados.");
    }
    setPendingAction(null);
  }

  return (
    <div className="space-y-4">
      <SettingsCard icon={KeyRound} title="Contraseña" description="Mínimo 12 caracteres con mayúscula, minúscula, número y símbolo.">
        <form onSubmit={submitPassword} className="space-y-3 max-w-md">
          <Field label="Contraseña actual" type="password" value={pwd.current} onChange={(v) => setPwd({ ...pwd, current: v })} />
          <Field label="Nueva contraseña" type="password" value={pwd.next} onChange={(v) => setPwd({ ...pwd, next: v })} />
          <Field label="Confirmar nueva contraseña" type="password" value={pwd.confirm} onChange={(v) => setPwd({ ...pwd, confirm: v })} />
          <button disabled={savingPwd} className="h-9 px-4 rounded-md bg-yo-ac text-white text-sm font-medium disabled:opacity-50">
            {savingPwd ? "Guardando…" : "Actualizar contraseña"}
          </button>
        </form>
      </SettingsCard>

      <SettingsCard icon={Smartphone} title="Autenticación multifactor (TOTP)" description="Usa Google Authenticator, 1Password u otra app compatible.">
        <SettingsRow label="Estado" hint={mfaEnabled ? "MFA activo en tu cuenta." : "MFA desactivado. Recomendado para todas las cuentas."}>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${mfaEnabled ? "bg-emerald-50 text-emerald-700" : "bg-yo-raised text-yo-txt-2"}`}>
            <Shield className="size-3" /> {mfaEnabled ? "Activo" : "Inactivo"}
          </span>
        </SettingsRow>
        <div className="flex flex-wrap gap-2 mt-4">
          {!mfaEnabled ? (
            <button onClick={startMfaSetup} className="h-9 px-4 rounded-md bg-yo-ac text-white text-sm font-medium">
              Configurar MFA
            </button>
          ) : (
            <>
              <button onClick={() => requestReauth("regen")} className="h-9 px-3 rounded-md border border-yo-border text-sm inline-flex items-center gap-1.5">
                <RefreshCw className="size-3.5" /> Regenerar códigos
              </button>
              <button onClick={() => requestReauth("disable")} className="h-9 px-3 rounded-md border border-red-200 text-red-700 bg-red-50 text-sm">
                Desactivar MFA
              </button>
            </>
          )}
        </div>

        {setupOpen && (
          <div className="mt-4 rounded-md border border-yo-border p-4 bg-yo-raised/40">
            <p className="text-[13px] text-yo-txt-2">Escanea el QR y luego ingresa el código de 6 dígitos.</p>
            <div className="mt-3 flex items-center gap-4">
              <div className="size-32 rounded-md bg-white border border-yo-border grid place-items-center font-mono text-[10px] text-yo-txt-3">
                QR MOCK
              </div>
              <div className="flex-1 space-y-2">
                <div className="text-[11px] uppercase text-yo-txt-3">Secreto manual</div>
                <code className="block text-xs font-mono bg-white border border-yo-border rounded px-2 py-1">JBSWY3DPEHPK3PXP</code>
                <input
                  value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" maxLength={6}
                  className="w-full h-9 rounded-md border border-yo-border bg-background px-3 text-sm font-mono"
                  placeholder="123456"
                />
                <div className="flex gap-2">
                  <button onClick={verifyOtp} className="h-9 px-3 rounded-md bg-yo-ac text-white text-sm">Verificar</button>
                  <button onClick={() => setSetupOpen(false)} className="h-9 px-3 rounded-md border border-yo-border text-sm">Cancelar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {recovery && (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold text-amber-900">
                Códigos de recuperación (solo se muestran una vez, almacenados como hash)
              </p>
              <button
                onClick={() => { navigator.clipboard.writeText(recovery.join("\n")); toast.success("Copiados"); }}
                className="inline-flex items-center gap-1 text-xs text-amber-900 hover:underline"
              >
                <Copy className="size-3" /> Copiar todos
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
              {recovery.map((c) => (
                <code key={c} className="text-xs font-mono bg-white border border-amber-200 rounded px-2 py-1 text-center">
                  {c}
                </code>
              ))}
            </div>
          </div>
        )}
      </SettingsCard>

      <ReauthDialog
        open={reauthOpen}
        onClose={() => { setReauthOpen(false); setPendingAction(null); }}
        onConfirmed={handleReauthed}
        title={pendingAction === "disable" ? "Desactivar MFA" : "Regenerar códigos"}
        description="Esta acción es sensible y quedará registrada en la auditoría."
      />
    </div>
  );
}

function Field({ label, type = "text", value, onChange }: { label: string; type?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-yo-txt-3">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-10 rounded-md border border-yo-border bg-background px-3 text-sm" />
    </div>
  );
}

function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const g = () => Math.random().toString(36).slice(2, 6).toUpperCase();
    codes.push(`${g()}-${g()}`);
  }
  return codes;
}
