import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sliders } from "lucide-react";
import { toast } from "sonner";
import { SettingsCard, SettingsRow } from "@/components/settings/settings-shell";

export const Route = createFileRoute("/_authenticated/settings/preferences")({
  component: PreferencesPage,
});

const LS_KEY = "yokto.prefs";
type Prefs = {
  defaultRole: "buyer" | "seller";
  defaultSector: string;
  preferredPayment: "spei" | "card";
  confirmBeforeRelease: boolean;
  requireMfaOnRelease: boolean;
  tableDensity: "compact" | "cozy" | "comfortable";
  defaultRange: "7d" | "30d" | "90d" | "ytd";
};

function load(): Prefs {
  try { return { ...defaults(), ...JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") }; }
  catch { return defaults(); }
}
function defaults(): Prefs {
  return {
    defaultRole: "seller", defaultSector: "servicios_profesionales",
    preferredPayment: "spei", confirmBeforeRelease: true,
    requireMfaOnRelease: false, tableDensity: "cozy", defaultRange: "30d",
  };
}

function PreferencesPage() {
  const [p, setP] = useState<Prefs>(load);

  function update<K extends keyof Prefs>(k: K, v: Prefs[K]) {
    const next = { ...p, [k]: v };
    setP(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    toast.success("Preferencia guardada");
  }

  return (
    <SettingsCard icon={Sliders} title="Preferencias operativas" description="Ajustes personales que aplican al abrir CUMPLEX.">
      <SettingsRow label="Rol predeterminado" hint="Vista con la que abrirás la app.">
        <select value={p.defaultRole} onChange={(e) => update("defaultRole", e.target.value as any)} className="h-9 rounded-md border border-yo-border bg-background px-2 text-sm">
          <option value="seller">Vendedor</option>
          <option value="buyer">Comprador</option>
        </select>
      </SettingsRow>
      <SettingsRow label="Sector predeterminado" hint="Se preselecciona al crear operaciones.">
        <select value={p.defaultSector} onChange={(e) => update("defaultSector", e.target.value)} className="h-9 rounded-md border border-yo-border bg-background px-2 text-sm">
          <option value="servicios_profesionales">Servicios profesionales</option>
          <option value="construccion">Construcción</option>
          <option value="comercio">Comercio</option>
          <option value="agroindustria">Agroindustria</option>
          <option value="tecnologia">Tecnología / SaaS</option>
          <option value="logistica">Logística</option>
        </select>
      </SettingsRow>
      <SettingsRow label="Método de pago preferido">
        <select value={p.preferredPayment} onChange={(e) => update("preferredPayment", e.target.value as any)} className="h-9 rounded-md border border-yo-border bg-background px-2 text-sm">
          <option value="spei">SPEI</option>
          <option value="card">Tarjeta</option>
        </select>
      </SettingsRow>
      <SettingsRow label="Confirmar antes de liberar fondos" hint="Muestra diálogo de doble confirmación.">
        <input type="checkbox" checked={p.confirmBeforeRelease} onChange={(e) => update("confirmBeforeRelease", e.target.checked)} className="size-4" />
      </SettingsRow>
      <SettingsRow label="Requerir MFA para liberar fondos" hint="Solicita segundo factor en cada liberación.">
        <input type="checkbox" checked={p.requireMfaOnRelease} onChange={(e) => update("requireMfaOnRelease", e.target.checked)} className="size-4" />
      </SettingsRow>
      <SettingsRow label="Densidad de tablas">
        <select value={p.tableDensity} onChange={(e) => update("tableDensity", e.target.value as any)} className="h-9 rounded-md border border-yo-border bg-background px-2 text-sm">
          <option value="compact">Compacta</option>
          <option value="cozy">Estándar</option>
          <option value="comfortable">Espaciosa</option>
        </select>
      </SettingsRow>
      <SettingsRow label="Rango inicial del dashboard">
        <select value={p.defaultRange} onChange={(e) => update("defaultRange", e.target.value as any)} className="h-9 rounded-md border border-yo-border bg-background px-2 text-sm">
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
          <option value="90d">Últimos 90 días</option>
          <option value="ytd">En el año</option>
        </select>
      </SettingsRow>
    </SettingsCard>
  );
}
