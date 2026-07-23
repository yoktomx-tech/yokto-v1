import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";
import { SettingsCard, SettingsRow } from "@/components/settings/settings-shell";

export const Route = createFileRoute("/_authenticated/settings/billing")({
  component: BillingPage,
});

const INVOICES = [
  { id: "F-2026-0087", period: "Julio 2026", amount: "$1,299.00 MXN", status: "Pagada" },
  { id: "F-2026-0076", period: "Junio 2026", amount: "$1,299.00 MXN", status: "Pagada" },
  { id: "F-2026-0065", period: "Mayo 2026", amount: "$1,299.00 MXN", status: "Pagada" },
];

function BillingPage() {
  return (
    <div className="space-y-4">
      <SettingsCard icon={CreditCard} title="Plan activo" description="Cumplex no custodia fondos ni emite CFDI de operaciones entre comprador y vendedor. La facturación aquí corresponde a la suscripción al SaaS.">
        <div className="rounded-md border border-yo-border bg-yo-raised/40 p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-yo-txt-3">Plan</div>
              <div className="text-[18px] font-bold text-yo-txt">Business</div>
              <div className="text-[12px] text-yo-txt-3">Renueva el 12 de agosto 2026</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-yo-txt-3">Costo mensual</div>
              <div className="text-[18px] font-bold font-mono">$1,299.00</div>
              <div className="text-[12px] text-yo-txt-3">MXN + IVA</div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Limit label="Operaciones / mes" value="Ilimitadas" />
          <Limit label="Usuarios" value="15 / 25" />
          <Limit label="Volumen procesado" value="$4.2M / $10M" />
          <Limit label="API calls / mes" value="12K / 100K" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => toast.info("Abriendo portal de facturación…")} className="h-9 px-3 rounded-md bg-yo-ac text-white text-sm inline-flex items-center gap-1.5">
            <ExternalLink className="size-3.5" /> Portal de facturación
          </button>
          <button className="h-9 px-3 rounded-md border border-yo-border text-sm">Cambiar plan</button>
        </div>
      </SettingsCard>

      <SettingsCard icon={FileText} title="Perfil fiscal de billing" description="Datos que Cumplex usará para emitir tu CFDI de suscripción.">
        <SettingsRow label="RFC receptor"><code className="font-mono text-sm">XAXX010101000</code></SettingsRow>
        <SettingsRow label="Razón social"><span className="text-sm">Mi Empresa SA de CV</span></SettingsRow>
        <SettingsRow label="Régimen fiscal"><span className="text-sm">601 · General de Ley Personas Morales</span></SettingsRow>
        <SettingsRow label="Uso de CFDI"><span className="text-sm">G03 · Gastos en general</span></SettingsRow>
        <SettingsRow label="Correo para CFDI"><span className="text-sm">facturas@empresa.com</span></SettingsRow>
      </SettingsCard>

      <SettingsCard icon={FileText} title="Facturas emitidas">
        <ul className="divide-y divide-yo-border">
          {INVOICES.map((i) => (
            <li key={i.id} className="flex items-center justify-between py-3">
              <div>
                <div className="text-[13px] font-medium">{i.id}</div>
                <div className="text-[11.5px] text-yo-txt-3">{i.period}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[13px]">{i.amount}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{i.status}</span>
                <button className="h-8 px-2 rounded-md border border-yo-border text-xs">PDF</button>
                <button className="h-8 px-2 rounded-md border border-yo-border text-xs">XML</button>
              </div>
            </li>
          ))}
        </ul>
      </SettingsCard>
    </div>
  );
}

function Limit({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-yo-border p-3">
      <div className="text-[10.5px] uppercase tracking-wider text-yo-txt-3">{label}</div>
      <div className="text-[13px] font-semibold text-yo-txt mt-1">{value}</div>
    </div>
  );
}
