import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, Send, Moon } from "lucide-react";
import { toast } from "sonner";
import { SettingsCard, SettingsRow } from "@/components/settings/settings-shell";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  component: NotificationsPage,
});

type Channel = "email" | "push" | "sms" | "inapp";
type Category = {
  id: string; label: string; description: string; locked?: Partial<Record<Channel, boolean>>;
};

const CATEGORIES: Category[] = [
  { id: "security", label: "Seguridad", description: "Inicio de sesión, cambios de contraseña y MFA.", locked: { email: true, inapp: true } },
  { id: "operations", label: "Operaciones", description: "Actualizaciones de tus transacciones activas." },
  { id: "approvals", label: "Aprobaciones", description: "Solicitudes que requieren tu decisión." },
  { id: "disputes", label: "Disputas", description: "Nuevos mensajes y cambios de estatus." },
  { id: "payments", label: "Pagos y payouts", description: "Depósitos, liberaciones y reembolsos." },
  { id: "fiscal", label: "Fiscal", description: "CFDIs, REPs y validaciones SAT." },
  { id: "team", label: "Equipo", description: "Invitaciones y cambios de rol." },
  { id: "product", label: "Producto", description: "Novedades y anuncios de YOKTO." },
];

const CHANNELS: { id: Channel; label: string }[] = [
  { id: "inapp", label: "En app" },
  { id: "email", label: "Email" },
  { id: "push", label: "Push" },
  { id: "sms", label: "SMS" },
];

const LS_KEY = "yokto.notifPrefs";

function loadPrefs(): Record<string, Record<Channel, boolean>> {
  try {
    const v = JSON.parse(localStorage.getItem(LS_KEY) ?? "null");
    if (v) return v;
  } catch {}
  const p: any = {};
  CATEGORIES.forEach((c) => (p[c.id] = { inapp: true, email: true, push: c.id !== "product", sms: c.id === "security" }));
  return p;
}

function NotificationsPage() {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [quiet, setQuiet] = useState({ enabled: true, from: "22:00", to: "07:00" });
  const [digest, setDigest] = useState<"none" | "daily" | "weekly">("daily");

  function toggle(cat: string, ch: Channel) {
    const locked = CATEGORIES.find((c) => c.id === cat)?.locked?.[ch];
    if (locked) { toast.info("Este canal es obligatorio por seguridad"); return; }
    setPrefs((p) => {
      const next = { ...p, [cat]: { ...p[cat], [ch]: !p[cat][ch] } };
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function testNotif() {
    toast.success("Notificación de prueba enviada a tus canales activos");
  }

  return (
    <div className="space-y-4">
      <SettingsCard
        icon={Bell}
        title="Matriz de notificaciones"
        description="Configura qué categorías quieres recibir y por qué canal."
        actions={
          <button onClick={testNotif} className="h-9 px-3 rounded-md border border-yo-border text-sm inline-flex items-center gap-1.5">
            <Send className="size-3.5" /> Probar
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[620px]">
            <thead>
              <tr className="text-left text-[11px] uppercase text-yo-txt-3">
                <th className="pb-2 font-medium">Categoría</th>
                {CHANNELS.map((c) => <th key={c.id} className="pb-2 font-medium text-center px-2">{c.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-yo-border">
              {CATEGORIES.map((cat) => (
                <tr key={cat.id}>
                  <td className="py-3 pr-4">
                    <div className="font-medium text-yo-txt">{cat.label}</div>
                    <div className="text-[11.5px] text-yo-txt-3">{cat.description}</div>
                  </td>
                  {CHANNELS.map((ch) => {
                    const locked = cat.locked?.[ch.id];
                    const on = prefs[cat.id]?.[ch.id];
                    return (
                      <td key={ch.id} className="py-3 text-center px-2">
                        <button
                          onClick={() => toggle(cat.id, ch.id)}
                          className={`w-10 h-6 rounded-full transition relative ${on ? "bg-yo-ac" : "bg-yo-border"} ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
                          title={locked ? "Obligatorio" : ""}
                        >
                          <span className={`absolute top-0.5 size-5 bg-white rounded-full transition ${on ? "left-[18px]" : "left-0.5"}`} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsCard>

      <SettingsCard icon={Moon} title="Horario silencioso" description="Suspende push y SMS no críticos durante estas horas.">
        <SettingsRow label="Activar quiet hours">
          <input type="checkbox" checked={quiet.enabled} onChange={(e) => setQuiet({ ...quiet, enabled: e.target.checked })} className="size-4" />
        </SettingsRow>
        <SettingsRow label="Rango" hint="Las notificaciones de seguridad siempre se envían.">
          <div className="flex items-center gap-2">
            <input type="time" value={quiet.from} onChange={(e) => setQuiet({ ...quiet, from: e.target.value })} className="h-9 rounded-md border border-yo-border bg-background px-2 text-sm" />
            <span className="text-yo-txt-3">→</span>
            <input type="time" value={quiet.to} onChange={(e) => setQuiet({ ...quiet, to: e.target.value })} className="h-9 rounded-md border border-yo-border bg-background px-2 text-sm" />
          </div>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard icon={Bell} title="Resumen periódico">
        <SettingsRow label="Frecuencia">
          <select value={digest} onChange={(e) => setDigest(e.target.value as any)} className="h-9 rounded-md border border-yo-border bg-background px-2 text-sm">
            <option value="none">Sin resumen</option>
            <option value="daily">Diario</option>
            <option value="weekly">Semanal</option>
          </select>
        </SettingsRow>
      </SettingsCard>
    </div>
  );
}
