import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Monitor, Smartphone, LogOut, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SettingsCard } from "@/components/settings/settings-shell";

export const Route = createFileRoute("/_authenticated/settings/sessions")({
  component: SessionsPage,
});

type Session = {
  id: string;
  device: string;
  browser: string;
  ip: string;
  location: string;
  lastActive: string;
  current: boolean;
};

const MOCK_SESSIONS: Session[] = [
  { id: "s1", device: "MacBook Pro", browser: "Chrome 131 · macOS", ip: "189.***.***.42", location: "CDMX, MX", lastActive: "Ahora", current: true },
  { id: "s2", device: "iPhone 15", browser: "Safari · iOS 18", ip: "189.***.***.11", location: "CDMX, MX", lastActive: "hace 2 h", current: false },
  { id: "s3", device: "Windows Desktop", browser: "Edge · Windows 11", ip: "200.***.***.87", location: "Guadalajara, MX", lastActive: "hace 3 días", current: false },
];

function SessionsPage() {
  const [sessions, setSessions] = useState(MOCK_SESSIONS);
  const navigate = useNavigate();

  function revoke(id: string) {
    setSessions((s) => s.filter((x) => x.id !== id));
    toast.success("Sesión cerrada");
  }

  async function revokeAllOthers() {
    setSessions((s) => s.filter((x) => x.current));
    toast.success("Se cerraron todas las demás sesiones");
  }

  async function signOutEverywhere() {
    await supabase.auth.signOut({ scope: "global" });
    navigate({ to: "/auth" });
  }

  return (
    <SettingsCard
      icon={Monitor}
      title="Sesiones activas"
      description="Dispositivos y navegadores donde tu cuenta tiene sesión abierta."
      actions={
        <div className="flex gap-2">
          <button onClick={revokeAllOthers} className="h-9 px-3 rounded-md border border-yo-border text-sm">
            Cerrar otras
          </button>
          <button onClick={signOutEverywhere} className="h-9 px-3 rounded-md border border-red-200 bg-red-50 text-red-700 text-sm inline-flex items-center gap-1.5">
            <LogOut className="size-3.5" /> Cerrar en todas
          </button>
        </div>
      }
    >
      <ul className="divide-y divide-yo-border">
        {sessions.map((s) => {
          const Icon = s.device.toLowerCase().includes("iphone") ? Smartphone : Monitor;
          return (
            <li key={s.id} className="flex items-center justify-between py-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="size-9 rounded-md bg-yo-raised grid place-items-center text-yo-txt-2 shrink-0">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-yo-txt flex items-center gap-2">
                    {s.device}
                    {s.current && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-medium">
                        <Check className="size-2.5" /> Esta sesión
                      </span>
                    )}
                  </div>
                  <div className="text-[11.5px] text-yo-txt-3 mt-0.5">
                    {s.browser} · <span className="font-mono">{s.ip}</span> · {s.location} · {s.lastActive}
                  </div>
                </div>
              </div>
              {!s.current && (
                <button onClick={() => revoke(s.id)} className="h-8 px-2.5 rounded-md border border-yo-border text-xs">
                  Cerrar
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </SettingsCard>
  );
}
