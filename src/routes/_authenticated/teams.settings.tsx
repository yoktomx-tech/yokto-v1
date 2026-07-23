import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Settings, Building2, ReceiptText, Palette, ShieldCheck, Bell, Cog, AlertTriangle } from "lucide-react";
import { TEAM } from "@/lib/teams-mock";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/teams/settings")({
  component: TeamSettingsPage,
});

const SECTIONS = [
  { key: "team",    label: "Datos del equipo",  icon: Building2 },
  { key: "fiscal",  label: "Datos fiscales",    icon: ReceiptText },
  { key: "brand",   label: "Marca",             icon: Palette },
  { key: "security",label: "Seguridad",         icon: ShieldCheck },
  { key: "notif",   label: "Notificaciones",    icon: Bell },
  { key: "rules",   label: "Reglas de operación", icon: Cog },
  { key: "danger",  label: "Zona peligrosa",    icon: AlertTriangle },
];

function TeamSettingsPage() {
  const [tab, setTab] = useState<string>("team");
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">
      <aside className="rounded-lg bg-yo-surface border border-yo-border p-2 shadow-sm h-fit sticky top-4">
        <nav className="space-y-0.5">
          {SECTIONS.map(s => {
            const Icon = s.icon;
            const active = tab === s.key;
            return (
              <button key={s.key} onClick={() => setTab(s.key)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-md text-[13px] text-left",
                  active ? "bg-yo-ac-bg text-yo-ac-txt font-semibold" : "text-yo-txt-2 hover:bg-yo-raised"
                )}
              >
                <Icon className={cn("size-3.5", active ? "text-yo-ac" : "text-yo-txt-3")} />
                {s.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="rounded-lg bg-yo-surface border border-yo-border p-5 shadow-sm">
        {tab === "team" && <TeamSection />}
        {tab === "fiscal" && <FiscalSection />}
        {tab === "brand" && <BrandSection />}
        {tab === "security" && <SecuritySection />}
        {tab === "notif" && <NotifSection />}
        {tab === "rules" && <RulesSection />}
        {tab === "danger" && <DangerSection />}
      </section>
    </div>
  );
}

function SaveBar() {
  return (
    <div className="mt-5 pt-4 border-t border-yo-border flex justify-end gap-2">
      <button className="h-9 px-3 text-[13px] rounded-md border border-yo-border hover:bg-yo-raised">Cancelar</button>
      <button onClick={() => toast.success("Cambios guardados")} className="h-9 px-4 text-[13px] font-semibold rounded-md bg-yo-ac text-white hover:bg-yo-ac-h">Guardar cambios</button>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-yo-txt-3 mt-1">{hint}</span>}
    </label>
  );
}
function Input({ defaultValue, mono }: { defaultValue?: string; mono?: boolean }) {
  return <input defaultValue={defaultValue} className={cn("w-full h-9 px-3 text-[13px] rounded-md border border-yo-border focus:border-yo-ac focus:outline-none", mono && "font-mono")} />;
}
function Toggle({ defaultChecked, label, hint }: { defaultChecked?: boolean; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3 py-2 border-b border-yo-border last:border-0 cursor-pointer">
      <input type="checkbox" defaultChecked={defaultChecked} className="mt-0.5" />
      <div className="min-w-0">
        <div className="text-[13px] text-yo-txt font-medium">{label}</div>
        {hint && <div className="text-[11.5px] text-yo-txt-3">{hint}</div>}
      </div>
    </label>
  );
}

function TeamSection() {
  return (
    <>
      <h3 className="text-[15px] font-semibold text-yo-txt mb-4">Datos del equipo</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nombre comercial"><Input defaultValue={TEAM.nombre} /></Field>
        <Field label="Razón social"><Input defaultValue={TEAM.razon_social} /></Field>
        <Field label="Representante legal"><Input defaultValue={TEAM.representante_legal} /></Field>
        <Field label="Email administrativo"><Input defaultValue={TEAM.email_admin} /></Field>
        <Field label="Teléfono"><Input defaultValue={TEAM.telefono} mono /></Field>
      </div>
      <SaveBar />
    </>
  );
}
function FiscalSection() {
  return (
    <>
      <h3 className="text-[15px] font-semibold text-yo-txt mb-4">Datos fiscales</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="RFC"><Input defaultValue={TEAM.rfc} mono /></Field>
        <Field label="Régimen fiscal"><Input defaultValue={TEAM.regimen_fiscal} /></Field>
        <Field label="Código postal fiscal"><Input defaultValue={TEAM.cp_fiscal} mono /></Field>
        <Field label="Domicilio fiscal"><Input defaultValue={TEAM.domicilio_fiscal} /></Field>
      </div>
      <p className="mt-4 text-[11.5px] text-yo-txt-3">
        Cumplex no emite CFDI ni REP. Los datos fiscales se utilizan para validar coherencia con documentos de la operación.
      </p>
      <SaveBar />
    </>
  );
}
function BrandSection() {
  return (
    <>
      <h3 className="text-[15px] font-semibold text-yo-txt mb-4">Marca y personalización</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Color de marca">
          <div className="flex items-center gap-2">
            <input type="color" defaultValue={TEAM.color_marca} className="size-10 rounded-md border border-yo-border" />
            <Input defaultValue={TEAM.color_marca} mono />
          </div>
        </Field>
        <Field label="Logo empresarial (URL)"><Input defaultValue="" /></Field>
        <Field label="Firma o leyenda para reportes" hint="Aparece al pie de exportaciones PDF.">
          <textarea rows={3} defaultValue="Comercializadora del Pacífico — Documento generado por Cumplex"
            className="w-full px-3 py-2 text-[13px] rounded-md border border-yo-border focus:border-yo-ac focus:outline-none" />
        </Field>
      </div>
      <SaveBar />
    </>
  );
}
function SecuritySection() {
  return (
    <>
      <h3 className="text-[15px] font-semibold text-yo-txt mb-4">Seguridad</h3>
      <Toggle defaultChecked label="Requerir MFA para todos los miembros" hint="Recomendado. Nuevos miembros deberán activarlo al aceptar la invitación." />
      <Toggle label="Bloquear miembros sin MFA después de 7 días" hint="Los usuarios sin MFA no podrán operar hasta activarlo." />
      <Toggle defaultChecked label="Expirar sesión tras 12 horas de inactividad" />
      <Toggle label="Restringir por IP allowlist" hint="Solo se permite acceso desde las IP configuradas en Configuración → Red." />
      <Toggle label="Restringir por dominio de correo" hint="Solo emails del dominio autorizado pueden ser invitados." />
      <Toggle label="Requerir aprobación para miembros externos (dominio distinto)" />
      <SaveBar />
    </>
  );
}
function NotifSection() {
  return (
    <>
      <h3 className="text-[15px] font-semibold text-yo-txt mb-4">Notificaciones</h3>
      {[
        "Nueva operación creada",
        "Operación mayor a un monto configurado",
        "Aprobación pendiente asignada a mi rol",
        "CFDI rechazado",
        "REP rechazado",
        "Contrato pendiente de firma",
        "Disputa abierta",
        "API Key usada desde IP nueva",
      ].map(l => <Toggle key={l} defaultChecked label={l} />)}
      <SaveBar />
    </>
  );
}
function RulesSection() {
  return (
    <>
      <h3 className="text-[15px] font-semibold text-yo-txt mb-4">Reglas de operación</h3>
      <Toggle defaultChecked label="Requerir contrato firmado antes de fondeo" />
      <Toggle defaultChecked label="Requerir CFDI PPD antes de liberar fondos" />
      <Toggle defaultChecked label="Requerir REP posterior a liberación" />
      <Toggle defaultChecked label="Requerir workflow para montos mayores a $200,000 MXN" />
      <Toggle label="Requerir backoffice Cumplex para sectores sensibles (Inmobiliario, Comercio ext.)" />
      <Toggle defaultChecked label="Bloquear liberaciones cuando existe disputa activa" />
      <SaveBar />
    </>
  );
}
function DangerSection() {
  return (
    <>
      <h3 className="text-[15px] font-semibold text-red-700 mb-4 flex items-center gap-2">
        <AlertTriangle className="size-4" /> Zona peligrosa
      </h3>
      <div className="space-y-4">
        <div className="rounded-md border border-red-200 bg-red-50/50 p-4">
          <div className="text-[13px] font-semibold text-yo-txt">Transferir propiedad del equipo</div>
          <p className="text-[12px] text-yo-txt-2 mt-1">Solo el propietario actual puede designar a otro Administrador como nuevo Owner.</p>
          <button className="mt-3 h-9 px-3 text-[12.5px] rounded-md border border-red-300 text-red-700 hover:bg-red-100">Transferir</button>
        </div>
        <div className="rounded-md border border-red-200 bg-red-50/50 p-4">
          <div className="text-[13px] font-semibold text-yo-txt">Eliminar equipo</div>
          <p className="text-[12px] text-yo-txt-2 mt-1">Esta acción no se puede deshacer. Las operaciones en curso deben cerrarse antes.</p>
          <button className="mt-3 h-9 px-3 text-[12.5px] rounded-md bg-red-600 text-white hover:bg-red-700">Eliminar equipo</button>
        </div>
      </div>
    </>
  );
}
