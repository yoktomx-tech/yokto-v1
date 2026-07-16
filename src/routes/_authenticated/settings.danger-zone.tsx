import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, LogOut, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SettingsCard } from "@/components/settings/settings-shell";
import { ReauthDialog } from "@/components/settings/reauth-dialog";

export const Route = createFileRoute("/_authenticated/settings/danger-zone")({
  component: DangerZonePage,
});

const BLOCKERS = [
  { label: "Operaciones activas", value: 3, blocks: true },
  { label: "Disputas abiertas", value: 1, blocks: true },
  { label: "Saldos pendientes de payout", value: 0, blocks: false },
  { label: "Obligaciones fiscales del año en curso", value: 12, blocks: true },
];

function DangerZonePage() {
  const navigate = useNavigate();
  const [reauth, setReauth] = useState<null | "signout" | "close">(null);

  async function signOutAll() {
    await supabase.auth.signOut({ scope: "global" });
    toast.success("Se cerraron todas tus sesiones");
    navigate({ to: "/auth" });
  }

  async function requestAccountClosure() {
    toast.success("Solicitud registrada. Iniciamos un periodo de enfriamiento de 30 días antes del cierre.");
  }

  const activeBlockers = BLOCKERS.filter((b) => b.blocks && b.value > 0);

  return (
    <div className="space-y-4">
      <SettingsCard tone="danger" icon={AlertTriangle} title="Zona de riesgo" description="Estas acciones son irreversibles. Requieren reautenticación con contraseña y confirmación textual.">
        <div className="rounded-md border border-red-200 bg-red-50/50 p-3">
          <div className="flex items-center gap-2 text-red-700 text-[13px] font-semibold mb-2">
            <ShieldCheck className="size-4" /> Bloqueos de cumplimiento
          </div>
          <ul className="text-[13px] space-y-1">
            {BLOCKERS.map((b) => (
              <li key={b.label} className="flex items-center justify-between">
                <span className="text-yo-txt-2">{b.label}</span>
                <span className={`font-mono text-[12px] ${b.blocks && b.value > 0 ? "text-red-700 font-semibold" : "text-yo-txt-3"}`}>{b.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </SettingsCard>

      <SettingsCard icon={LogOut} title="Cerrar todas mis sesiones" description="Cierra la sesión en todos los dispositivos, incluido este.">
        <button onClick={() => setReauth("signout")} className="h-9 px-4 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm font-medium">
          Cerrar todas las sesiones
        </button>
      </SettingsCard>

      <SettingsCard tone="danger" icon={Trash2} title="Solicitar cierre de cuenta" description="Iniciamos un periodo de enfriamiento de 30 días. La evidencia probatoria se conserva conforme a nuestra política de retención.">
        {activeBlockers.length > 0 ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-[13px] text-red-800">
            No puedes solicitar el cierre mientras existan {activeBlockers.length} bloqueos activos. Resuélvelos primero.
          </div>
        ) : (
          <button onClick={() => setReauth("close")} className="h-9 px-4 rounded-md bg-red-600 text-white text-sm font-medium">
            Solicitar cierre de cuenta
          </button>
        )}
      </SettingsCard>

      <ReauthDialog
        open={reauth === "signout"}
        onClose={() => setReauth(null)}
        onConfirmed={signOutAll}
        title="Cerrar todas las sesiones"
        description="Ingresa tu contraseña para confirmar."
        requireText="CERRAR"
      />
      <ReauthDialog
        open={reauth === "close"}
        onClose={() => setReauth(null)}
        onConfirmed={requestAccountClosure}
        title="Solicitar cierre de cuenta"
        description="Esta acción es irreversible tras el periodo de enfriamiento. Requiere reautenticación y MFA."
        requireText="ELIMINAR MI CUENTA"
      />
    </div>
  );
}
