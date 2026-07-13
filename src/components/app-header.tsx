import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NotificationsBell } from "@/components/notifications-bell";

const nav = [
  { to: "/dashboard", label: "Panel" },
  { to: "/transactions", label: "Transacciones" },
  { to: "/disputes", label: "Disputas" },
  { to: "/payments", label: "Pagos" },
  { to: "/kyc", label: "KYC" },
  { to: "/reports", label: "Reportes" },
  { to: "/api-clients", label: "API" },
  { to: "/admin", label: "Admin" },
] as const;


export function AppHeader({ email, section, userId }: { email?: string | null; section?: string; userId?: string }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-yo-border bg-yo-surface">
      <div className="container-editorial flex h-14 items-center justify-between gap-4">
        <div className="flex items-center gap-6 min-w-0">
          <Link to="/dashboard" className="flex items-center gap-2.5 shrink-0" aria-label="YOKTO — Panel">
            <span className="grid place-items-center size-7 rounded-md bg-yo-ac text-white font-bold text-sm leading-none">
              Y
            </span>
            <span className="font-bold text-[13px] tracking-tight text-yo-txt">YOKTO</span>
            <span className="text-[10px] font-semibold bg-yo-ac-bg text-yo-ac-txt px-1.5 py-0.5 rounded">Beta</span>
            {section && (
              <span className="ml-3 hidden sm:inline text-xs font-medium text-yo-txt-3 border-l border-yo-border pl-3">
                {section}
              </span>
            )}
          </Link>
          <nav className="hidden md:flex items-center gap-0.5">
            {nav.map((item) => {
              const active = pathname === item.to || pathname.startsWith(item.to + "/");
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={
                    active
                      ? "px-3 py-1.5 rounded-md text-[12.5px] font-semibold text-yo-ac-txt bg-yo-ac-bg"
                      : "px-3 py-1.5 rounded-md text-[12.5px] font-medium text-yo-txt-2 hover:text-yo-txt hover:bg-yo-raised"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {userId && <NotificationsBell userId={userId} />}
          {email && (
            <span className="hidden sm:inline text-xs text-yo-txt-3 truncate max-w-[180px]">{email}</span>
          )}
          <button
            onClick={signOut}
            className="inline-flex items-center gap-1.5 rounded-md border border-yo-border hover:border-yo-border-s bg-yo-surface hover:bg-yo-raised text-[12.5px] font-medium text-yo-txt px-3 py-1.5 transition"
          >
            <LogOut className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
}
