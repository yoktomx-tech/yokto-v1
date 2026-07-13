import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export function AppHeader({ email, section }: { email?: string | null; section?: string }) {
  const navigate = useNavigate();
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <header className="border-b border-yokto-black bg-background sticky top-0 z-40">
      <div className="container-editorial flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid place-items-center size-7 bg-yokto-black text-yokto-cream font-display text-lg leading-none">Y</span>
            <span className="font-display text-2xl tracking-wide text-foreground">YOKTO</span>
            {section && (
              <span className="ml-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground border-l border-yokto-black/30 pl-3">
                {section}
              </span>
            )}
          </Link>
          <nav className="hidden md:flex items-center gap-4 text-[11px] uppercase tracking-[0.16em] font-semibold">
            <Link to="/dashboard" className="text-foreground hover:text-yokto-black/60" activeProps={{ className: "underline underline-offset-4" }}>Panel</Link>
            <Link to="/transactions" className="text-foreground hover:text-yokto-black/60" activeProps={{ className: "underline underline-offset-4" }}>Transacciones</Link>
            <Link to="/kyc" className="text-foreground hover:text-yokto-black/60" activeProps={{ className: "underline underline-offset-4" }}>KYC</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {email && (
            <span className="hidden sm:inline text-xs uppercase tracking-[0.14em] text-muted-foreground">{email}</span>
          )}
          <button
            onClick={signOut}
            className="text-[12px] uppercase tracking-[0.14em] font-semibold border border-yokto-black px-3 py-2 hover:bg-yokto-black hover:text-yokto-cream"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
