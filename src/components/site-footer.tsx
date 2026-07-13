import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-muted/40">
      <div className="container-editorial py-14 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <span className="font-display text-3xl tracking-tight text-foreground">
            YOKTO<span className="text-primary">.</span>
          </span>
          <p className="mt-4 max-w-sm text-sm text-muted-foreground leading-relaxed">
            Pago Seguro contra Cumplimiento. Retenemos fondos vía pasarelas certificadas
            y los liberamos únicamente cuando se verifican las condiciones acordadas
            entre las partes.
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-foreground/60">Producto</p>
          <ul className="mt-4 space-y-2 text-sm text-foreground/80">
            <li><Link to="/como-funciona" className="hover:text-foreground">Cómo funciona</Link></li>
            <li><Link to="/casos-de-uso" className="hover:text-foreground">Casos de uso</Link></li>
            <li><Link to="/precios" className="hover:text-foreground">Precios</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-foreground/60">Compañía</p>
          <ul className="mt-4 space-y-2 text-sm text-foreground/80">
            <li><Link to="/marco-legal" className="hover:text-foreground">Marco legal</Link></li>
            <li><Link to="/contacto" className="hover:text-foreground">Contacto</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/60">
        <div className="container-editorial py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} YOKTO. Hecho en México.</p>
          <p className="max-w-2xl md:text-right">
            YOKTO no es entidad financiera ni custodio de fondos. Opera como facilitador tecnológico
            fuera del marco IFPE/CNBV, apoyado en pasarelas de pago certificadas.
          </p>
        </div>
      </div>
    </footer>
  );
}
