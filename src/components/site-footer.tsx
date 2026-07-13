import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-yokto-black/90 bg-yokto-black text-yokto-cream">
      <div className="container-editorial py-16 grid gap-12 md:grid-cols-12">
        <div className="md:col-span-5">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center size-9 bg-yokto-yellow text-yokto-black font-display text-2xl leading-none">
              Y
            </span>
            <span className="font-display text-3xl tracking-wide">YOKTO</span>
          </div>
          <p className="mt-6 max-w-md text-sm text-yokto-cream/70 leading-relaxed">
            Pago Seguro contra Cumplimiento. Retenemos fondos vía pasarelas certificadas
            y los liberamos únicamente cuando se verifican las condiciones acordadas
            entre las partes.
          </p>
        </div>

        <div className="md:col-span-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-yokto-yellow font-semibold">Producto</p>
          <ul className="mt-5 space-y-2.5 text-sm text-yokto-cream/85">
            <li><Link to="/como-funciona" className="hover:text-yokto-yellow">Cómo funciona</Link></li>
            <li><Link to="/casos-de-uso" className="hover:text-yokto-yellow">Sectores</Link></li>
            <li><Link to="/precios" className="hover:text-yokto-yellow">Precios</Link></li>
          </ul>
        </div>

        <div className="md:col-span-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-yokto-yellow font-semibold">Compañía</p>
          <ul className="mt-5 space-y-2.5 text-sm text-yokto-cream/85">
            <li><Link to="/marco-legal" className="hover:text-yokto-yellow">Marco legal</Link></li>
            <li><Link to="/contacto" className="hover:text-yokto-yellow">Contacto</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-yokto-cream/15">
        <div className="container-editorial py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-[11px] uppercase tracking-[0.18em] text-yokto-cream/50">
          <p>© {new Date().getFullYear()} YOKTO · Hecho en México</p>
          <p className="max-w-2xl md:text-right normal-case tracking-normal text-xs text-yokto-cream/50">
            YOKTO no es entidad financiera ni custodio de fondos. Opera como facilitador
            tecnológico fuera del marco IFPE/CNBV, apoyado en pasarelas de pago certificadas.
          </p>
        </div>
      </div>
    </footer>
  );
}
