import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Zap, Plus, FileCheck, Users, LifeBuoy } from "lucide-react";
import { useViewRole } from "@/hooks/use-view-role";

export function TopbarQuickActions() {
  const [open, setOpen] = useState(false);
  const { role } = useViewRole();

  const actions = [
    { to: "/transactions/new", icon: Plus, label: "Nueva operación" },
    { to: "/approvals", icon: FileCheck, label: "Aprobaciones pendientes" },
    { to: "/crm", icon: Users, label: "Nueva contraparte" },
    { to: "/support/tickets/new", icon: LifeBuoy, label: "Crear ticket de soporte" },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Acciones rápidas"
        title="Acciones rápidas"
        className="size-8 grid place-items-center rounded-md text-yo-txt-2 hover:text-yo-txt hover:bg-yo-raised transition"
      >
        <Zap className="size-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-[320px] z-50 rounded-xl border border-yo-border bg-yo-surface shadow-xl overflow-hidden">
            <div className="p-3 border-b border-yo-border bg-yo-ac-bg">
              <div className="flex items-center gap-2">
                <div className="size-8 grid place-items-center rounded-lg bg-yo-ac text-white">
                  <Zap className="size-4" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-yo-txt">Acciones rápidas</p>
                  <p className="text-[11px] text-yo-txt-3">Vista {role === "buyer" ? "Comprador" : "Vendedor"}</p>
                </div>
              </div>
            </div>

            <div className="p-2">
              {actions.map((a) => (
                <Link
                  key={a.to}
                  to={a.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-yo-txt hover:bg-yo-raised transition"
                >
                  <a.icon className="size-4 text-yo-txt-3" />
                  <span className="flex-1 truncate">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
