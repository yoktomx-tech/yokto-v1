import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy, Mail, MessageCircle, Activity, FileText } from "lucide-react";
import { SettingsCard, SettingsRow } from "@/components/settings/settings-shell";

export const Route = createFileRoute("/_authenticated/settings/support")({
  component: SupportPage,
});

function SupportPage() {
  return (
    <div className="space-y-4">
      <SettingsCard icon={LifeBuoy} title="Contacto" description="Nuestro equipo responde en horas hábiles CDMX.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Contact icon={Mail} label="Soporte por correo" value="soporte@yokto.mx" />
          <Contact icon={MessageCircle} label="Chat en vivo" value="Disponible L–V 9:00 a 18:00" />
        </div>
      </SettingsCard>

      <SettingsCard icon={Activity} title="Estado del servicio">
        <SettingsRow label="API" hint="Latencia promedio 145 ms · uptime 99.98%">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium">
            ● Operacional
          </span>
        </SettingsRow>
        <SettingsRow label="Panel web" hint="Sin incidencias reportadas.">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium">● Operacional</span>
        </SettingsRow>
        <SettingsRow label="Webhooks" hint="Entrega promedio en 1.2 s.">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium">● Operacional</span>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard icon={FileText} title="Diagnóstico">
        <p className="text-[13px] text-yo-txt-2">
          Si nuestro equipo lo solicita, comparte este identificador de sesión para acelerar la resolución.
        </p>
        <code className="mt-2 inline-block text-xs font-mono bg-yo-raised border border-yo-border rounded px-2 py-1">
          diag_{Math.random().toString(36).slice(2, 12)}
        </code>
      </SettingsCard>
    </div>
  );
}

function Contact({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-md border border-yo-border p-4 flex items-start gap-3">
      <div className="size-9 rounded-md bg-yo-ac-bg grid place-items-center text-yo-ac">
        <Icon className="size-4" />
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-yo-txt-3">{label}</div>
        <div className="text-[13px] font-medium text-yo-txt">{value}</div>
      </div>
    </div>
  );
}
