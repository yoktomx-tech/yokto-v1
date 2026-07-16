import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plug, Check, Link2 } from "lucide-react";
import { toast } from "sonner";
import { SettingsCard } from "@/components/settings/settings-shell";

export const Route = createFileRoute("/_authenticated/settings/integrations")({
  component: IntegrationsPage,
});

type Integration = {
  id: string; name: string; description: string; category: string; connected: boolean;
};

const INITIAL: Integration[] = [
  { id: "stripe", name: "Stripe Connect", description: "Procesa pagos con tarjeta y payouts a cuentas verificadas.", category: "Pagos", connected: true },
  { id: "contpaqi", name: "Contpaqi", description: "Sincroniza CFDIs y pólizas contables.", category: "Contabilidad", connected: false },
  { id: "sap", name: "SAP Business One", description: "ERP para clientes enterprise.", category: "ERP", connected: false },
  { id: "slack", name: "Slack", description: "Recibe alertas en tus canales de trabajo.", category: "Comunicación", connected: true },
  { id: "teams", name: "Microsoft Teams", description: "Notificaciones y aprobaciones desde Teams.", category: "Comunicación", connected: false },
  { id: "hubspot", name: "HubSpot", description: "Sincroniza contrapartes con tu CRM.", category: "CRM", connected: false },
];

function IntegrationsPage() {
  const [items, setItems] = useState(INITIAL);

  function toggle(id: string) {
    setItems((it) => it.map((x) => x.id === id ? { ...x, connected: !x.connected } : x));
    const item = items.find((x) => x.id === id)!;
    toast.success(item.connected ? `${item.name} desconectado` : `${item.name} conectado. Tokens cifrados en almacén seguro.`);
  }

  return (
    <SettingsCard icon={Plug} title="Integraciones" description="Los tokens OAuth se cifran en reposo y cada conexión queda auditada.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((i) => (
          <div key={i.id} className="rounded-md border border-yo-border p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold">{i.name}</span>
                  <span className="text-[10px] uppercase tracking-wider bg-yo-raised text-yo-txt-3 rounded px-1.5 py-0.5">{i.category}</span>
                </div>
                <p className="text-[12px] text-yo-txt-3 mt-1">{i.description}</p>
              </div>
              {i.connected && <Check className="size-4 text-emerald-600 shrink-0" />}
            </div>
            <button
              onClick={() => toggle(i.id)}
              className={`mt-3 h-8 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 ${
                i.connected ? "border border-red-200 bg-red-50 text-red-700" : "bg-yo-ac text-white"
              }`}
            >
              <Link2 className="size-3" /> {i.connected ? "Desconectar" : "Conectar"}
            </button>
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}
