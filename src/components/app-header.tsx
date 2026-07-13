import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const nav = [
  { to: "/dashboard", label: "Panel" },
  { to: "/transactions", label: "Transacciones" },
  { to: "/kyc", label: "KYC" },
] as const;

export function AppHeader({ email, section }: { email?: string | null; section?: string }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-yokto-elevated/80 backdrop-blur-md">
      <div className="container-editorial flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-6 min-w-0">
          <Link to="/dashboard" className="flex items-center gap-2.5 shrink-0" aria-label="YOKTO — Panel">
            <span className="grid place-items-center size-8 rounded-md gradient-accent text-white font-bold text-base leading-none shadow-glow-accent">
              Y
            </span>
            <span className="font-extrabold text-base tracking-[0.14em] text-yokto-text-1">YOKTO</span>
            {section && (
              <span className="ml-3 hidden sm:inline text-xs font-medium text-yokto-text-3 border-l border-white/[0.08] pl-3">
                {section}
              </span>
            )}
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {nav.map((item) => {
              const active = pathname === item.to || pathname.startsWith(item.to + "/");
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={
                    active
                      ? "px-3 py-2 rounded-md text-sm font-semibold text-white bg-yokto-accent/15 border border-yokto-accent/25"
                      : "px-3 py-2 rounded-md text-sm font-medium text-yokto-text-2 hover:text-yokto-text-1 hover:bg-yokto-hover"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {email && (
            <span className="hidden sm:inline text-xs text-yokto-text-3 truncate max-w-[180px]">{email}</span>
          )}
          <button
            onClick={signOut}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] hover:border-white/[0.20] bg-yokto-card hover:bg-yokto-hover text-sm font-medium text-yokto-text-1 px-3 py-2 transition"
          >
            <LogOut className="size-4" aria-hidden />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
}
