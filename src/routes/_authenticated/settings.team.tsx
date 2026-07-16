import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Users, Save } from "lucide-react";
import { toast } from "sonner";
import { SettingsCard, SettingsRow } from "@/components/settings/settings-shell";

export const Route = createFileRoute("/_authenticated/settings/team")({
  component: TeamSettingsPage,
});

function TeamSettingsPage() {
  const [policy, setPolicy] = useState({
    requireMfaAdmins: true,
    requireMfaAll: false,
    allowedDomains: "empresa.com, empresa.mx",
    hideAmountsReadonly: false,
    defaultWorkflow: "single-approver",
    ipRestrict: "",
    sessionTimeout: 60,
  });

  function save() {
    toast.success("Políticas globales guardadas. Se registró en la auditoría de la organización.");
  }

  return (
    <SettingsCard
      icon={Users}
      title="Políticas globales del equipo"
      description="Aplica a todos los usuarios de la organización activa."
      actions={
        <button onClick={save} className="h-9 px-4 rounded-md bg-yo-ac text-white text-sm font-medium inline-flex items-center gap-1.5">
          <Save className="size-3.5" /> Guardar políticas
        </button>
      }
    >
      <SettingsRow label="Requerir MFA a administradores">
        <Toggle on={policy.requireMfaAdmins} onChange={(v) => setPolicy({ ...policy, requireMfaAdmins: v })} />
      </SettingsRow>
      <SettingsRow label="Requerir MFA a todos los usuarios">
        <Toggle on={policy.requireMfaAll} onChange={(v) => setPolicy({ ...policy, requireMfaAll: v })} />
      </SettingsRow>
      <SettingsRow label="Dominios de correo autorizados" hint="Sólo se puede invitar a estos dominios.">
        <input value={policy.allowedDomains} onChange={(e) => setPolicy({ ...policy, allowedDomains: e.target.value })}
          className="w-72 h-9 rounded-md border border-yo-border bg-background px-3 text-sm font-mono" />
      </SettingsRow>
      <SettingsRow label="Ocultar montos a rol Solo lectura">
        <Toggle on={policy.hideAmountsReadonly} onChange={(v) => setPolicy({ ...policy, hideAmountsReadonly: v })} />
      </SettingsRow>
      <SettingsRow label="Workflow de aprobación predeterminado">
        <select value={policy.defaultWorkflow} onChange={(e) => setPolicy({ ...policy, defaultWorkflow: e.target.value })}
          className="h-9 rounded-md border border-yo-border bg-background px-2 text-sm">
          <option value="single-approver">Un aprobador</option>
          <option value="dual-control">Doble control (4 ojos)</option>
          <option value="threshold">Por umbral de monto</option>
        </select>
      </SettingsRow>
      <SettingsRow label="Restricción de IP (CIDR, opcional)">
        <input value={policy.ipRestrict} onChange={(e) => setPolicy({ ...policy, ipRestrict: e.target.value })}
          className="w-72 h-9 rounded-md border border-yo-border bg-background px-3 text-sm font-mono" placeholder="200.10.1.0/24" />
      </SettingsRow>
      <SettingsRow label="Timeout de sesión (minutos)">
        <input type="number" min={5} max={1440} value={policy.sessionTimeout}
          onChange={(e) => setPolicy({ ...policy, sessionTimeout: Number(e.target.value) })}
          className="w-24 h-9 rounded-md border border-yo-border bg-background px-3 text-sm" />
      </SettingsRow>
    </SettingsCard>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={`w-10 h-6 rounded-full transition relative ${on ? "bg-yo-ac" : "bg-yo-border"}`}>
      <span className={`absolute top-0.5 size-5 bg-white rounded-full transition ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}
