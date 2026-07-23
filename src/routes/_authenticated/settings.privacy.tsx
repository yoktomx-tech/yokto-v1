import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Lock, Download, FileText, Eye, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { SettingsCard, SettingsRow } from "@/components/settings/settings-shell";

export const Route = createFileRoute("/_authenticated/settings/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  const [visibility, setVisibility] = useState<"public" | "counterparties" | "private">("counterparties");

  function requestExport() {
    toast.success("Exportación solicitada. Recibirás un correo con el enlace en menos de 24 h.");
  }

  function requestArco(kind: string) {
    toast.success(`Solicitud ARCO (${kind}) registrada. Nuestro DPO responderá en 20 días hábiles.`);
  }

  return (
    <div className="space-y-4">
      <SettingsCard icon={Download} title="Exportar mis datos" description="Descarga un archivo con tu información personal, operaciones y evidencia auditable.">
        <button onClick={requestExport} className="h-9 px-4 rounded-md bg-yo-ac text-white text-sm font-medium">
          Solicitar exportación
        </button>
      </SettingsCard>

      <SettingsCard icon={FileText} title="Derechos ARCO" description="Acceso, Rectificación, Cancelación u Oposición conforme a la LFPDPPP.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {["Acceso", "Rectificación", "Cancelación", "Oposición"].map((k) => (
            <button key={k} onClick={() => requestArco(k)} className="h-10 px-3 rounded-md border border-yo-border text-sm hover:bg-yo-raised">
              {k}
            </button>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard icon={Eye} title="Visibilidad ante contrapartes">
        <SettingsRow label="Quién puede verte en búsquedas">
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as any)} className="h-9 rounded-md border border-yo-border bg-background px-2 text-sm">
            <option value="public">Público (cualquier usuario CUMPLEX)</option>
            <option value="counterparties">Sólo contrapartes con las que operé</option>
            <option value="private">Privado (solo por invitación)</option>
          </select>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard icon={Lock} title="Política de retención" description="CUMPLEX conserva evidencia probatoria según regulaciones fiscales y AML.">
        <ul className="text-[13px] text-yo-txt-2 space-y-2">
          <li>· Expedientes de operación: <b>10 años</b> desde el cierre (Art. 30 CFF).</li>
          <li>· Comprobantes CFDI y REP: <b>5 años</b>.</li>
          <li>· Registros AML/KYC: <b>10 años</b> desde la última operación (LFPIORPI).</li>
          <li>· Logs de auditoría de sesión: <b>2 años</b>.</li>
        </ul>
      </SettingsCard>

      <SettingsCard tone="danger" icon={AlertTriangle} title="Bloqueos activos por obligaciones legales">
        <p className="text-[13px] text-yo-txt-2">
          Tienes obligaciones fiscales pendientes que impiden la eliminación total de datos. Consulta{" "}
          <span className="font-mono text-red-700">/settings/danger-zone</span> para más detalle.
        </p>
      </SettingsCard>
    </div>
  );
}
