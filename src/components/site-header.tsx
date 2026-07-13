import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import wordmarkDark from "@/assets/yokto-wordmark-dark.png.asset.json";

const nav = [
  { to: "/como-funciona", label: "Cómo funciona" },
  { to: "/casos-de-uso", label: "Sectores" },
  { to: "/precios", label: "Precios" },
  { to: "/marco-legal", label: "Marco legal" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setAuthed(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);



  return (
    <header className="sticky top-0 z-40 border-b border-yokto-black/90 bg-background">
      <div className="container-editorial flex h-14 items-center justify-between">
        <Link to="/" className="flex items-center" onClick={() => setOpen(false)} aria-label="YOKTO">
          <img src={wordmarkDark.url} alt="YOKTO" className="h-6 w-auto" />
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-[13px] uppercase tracking-[0.14em] font-medium text-foreground/70 transition hover:text-foreground"
              activeProps={{ className: "text-[13px] uppercase tracking-[0.14em] font-medium text-foreground border-b border-yokto-black" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link
            to="/contacto"
            className="text-[13px] uppercase tracking-[0.14em] font-medium text-foreground/70 hover:text-foreground px-3"
          >
            Contacto
          </Link>
          {authed ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center px-5 py-2.5 bg-yokto-yellow text-yokto-black text-[13px] uppercase tracking-[0.14em] font-semibold border border-yokto-black transition hover:bg-yokto-black hover:text-yokto-yellow"
            >
              Ir al panel
            </Link>
          ) : (
            <>
              <Link
                to="/auth"
                className="text-[13px] uppercase tracking-[0.14em] font-medium text-foreground/70 hover:text-foreground px-3"
              >
                Entrar
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="inline-flex items-center px-5 py-2.5 bg-yokto-yellow text-yokto-black text-[13px] uppercase tracking-[0.14em] font-semibold border border-yokto-black transition hover:bg-yokto-black hover:text-yokto-yellow"
              >
                Crear cuenta
              </Link>
            </>
          )}
        </div>



        <button
          className="md:hidden inline-flex items-center justify-center p-2 text-foreground"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menú"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-yokto-black/90 bg-background">
          <div className="container-editorial flex flex-col py-4 gap-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 text-sm uppercase tracking-[0.12em] text-foreground/80 hover:bg-muted"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to={authed ? "/dashboard" : "/auth"}
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center justify-center px-4 py-3 bg-yokto-yellow text-yokto-black text-sm uppercase tracking-[0.14em] font-semibold border border-yokto-black"
            >
              {authed ? "Ir al panel" : "Entrar / Crear cuenta"}
            </Link>

          </div>
        </div>
      )}
    </header>
  );
}
