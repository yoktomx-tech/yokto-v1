import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const nav = [
  { to: "/como-funciona", label: "Cómo funciona" },
  { to: "/casos-de-uso", label: "Sectores" },
  { to: "/precios", label: "Precios" },
  { to: "/marco-legal", label: "Marco legal" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setAuthed(!!session));
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-colors ${
        scrolled
          ? "border-white/[0.08] bg-yokto-elevated/80 backdrop-blur-md"
          : "border-transparent bg-yokto-base"
      }`}
    >
      <div className="container-editorial flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group" onClick={() => setOpen(false)} aria-label="YOKTO — Inicio">
          <span
            className="grid place-items-center size-8 rounded-md gradient-accent text-white font-bold text-base leading-none shadow-glow-accent transition group-hover:scale-105"
            aria-hidden
          >
            Y
          </span>
          <span className="font-extrabold text-lg tracking-[0.14em] text-yokto-text-1">YOKTO</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="px-3 py-2 rounded-md text-sm font-medium text-yokto-text-2 transition hover:text-yokto-text-1 hover:bg-yokto-hover"
              activeProps={{ className: "px-3 py-2 rounded-md text-sm font-semibold text-yokto-text-1 bg-yokto-hover" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link
            to="/contacto"
            className="px-3 py-2 rounded-md text-sm font-medium text-yokto-text-2 hover:text-yokto-text-1 hover:bg-yokto-hover transition"
          >
            Contacto
          </Link>
          {authed ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-yokto-accent hover:bg-yokto-accent-h text-white text-sm font-semibold shadow-sm hover:shadow-glow-accent transition"
            >
              Ir al panel
            </Link>
          ) : (
            <>
              <Link
                to="/auth"
                className="px-3 py-2 rounded-md text-sm font-medium text-yokto-text-2 hover:text-yokto-text-1 hover:bg-yokto-hover transition"
              >
                Entrar
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-yokto-accent hover:bg-yokto-accent-h text-white text-sm font-semibold shadow-sm hover:shadow-glow-accent transition"
              >
                Crear cuenta
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden inline-flex items-center justify-center size-10 rounded-md text-yokto-text-1 hover:bg-yokto-hover"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/[0.06] bg-yokto-elevated">
          <div className="container-editorial flex flex-col py-4 gap-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 rounded-md text-sm font-medium text-yokto-text-2 hover:text-yokto-text-1 hover:bg-yokto-hover"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to={authed ? "/dashboard" : "/auth"}
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center justify-center px-4 py-3 rounded-md bg-yokto-accent hover:bg-yokto-accent-h text-white text-sm font-semibold"
            >
              {authed ? "Ir al panel" : "Entrar / Crear cuenta"}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
