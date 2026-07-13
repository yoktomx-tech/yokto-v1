import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const nav = [
  { to: "/como-funciona", label: "Cómo funciona" },
  { to: "/casos-de-uso", label: "Casos de uso" },
  { to: "/precios", label: "Precios" },
  { to: "/marco-legal", label: "Marco legal" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="container-editorial flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="font-display text-2xl tracking-tight text-foreground">
            YOKTO<span className="text-primary">.</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm text-foreground/70 transition hover:text-foreground"
              activeProps={{ className: "text-sm text-foreground font-medium" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/contacto"
            className="text-sm text-foreground/70 hover:text-foreground"
          >
            Contacto
          </Link>
          <Link
            to="/contacto"
            className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Solicitar acceso
          </Link>
        </div>

        <button
          className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-foreground"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menú"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border/60 bg-background">
          <div className="container-editorial flex flex-col py-4 gap-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-foreground/80 hover:bg-muted"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/contacto"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
            >
              Solicitar acceso
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
