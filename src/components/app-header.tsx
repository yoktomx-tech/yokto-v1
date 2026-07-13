import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NotificationsBell } from "@/components/notifications-bell";

const BREADCRUMB_MAP: Record<string, string> = {
  "/dashboard": "Panel",
  "/transactions": "Transacciones",
  "/transactions/new": "Nueva transacción",
  "/disputes": "Disputas",
  "/payments": "Pagos",
  "/kyc": "KYC",
  "/reports": "Reportes",
  "/api-clients": "API",
  "/admin": "Admin",
};

export function AppHeader({ email, section, userId }: { email?: string | null; section?: string; userId?: string }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const crumb = section ?? BREADCRUMB_MAP[pathname] ?? "Panel";

  return (
    <header className="sticky top-0 z-30 border-b border-yo-border bg-yo-surface/85 backdrop-blur-sm">
      <div className="flex h-14 items-center gap-4 pl-14 md:pl-6 pr-4 md:pr-6">
        <nav className="flex items-center gap-2 min-w-0" aria-label="Breadcrumb">
          <Link to="/dashboard" className="text-xs text-yo-txt-3 hover:text-yo-txt-2 truncate">YOKTO</Link>
          <span className="text-yo-txt-4" aria-hidden>/</span>
          <span className="text-sm font-semibold text-yo-txt truncate">{crumb}</span>
        </nav>

        <div className="flex-1 hidden lg:flex justify-center max-w-md mx-auto">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-yo-txt-3" />
            <input
              type="search"
              placeholder="Buscar transacción, RFC, contraparte…"
              className="w-full pl-9 pr-3 h-8 rounded-md border border-yo-border bg-yo-bg text-sm focus:outline-none focus:border-yo-ac focus:bg-yo-surface"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {userId && <NotificationsBell userId={userId} />}
          {email && (
            <span className="hidden xl:inline text-xs text-yo-txt-3 truncate max-w-[160px]">{email}</span>
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
