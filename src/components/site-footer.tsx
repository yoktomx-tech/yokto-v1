import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-white/[0.06] bg-yokto-elevated text-yokto-text-2">
      <div className="container-editorial py-16 grid gap-12 md:grid-cols-12">
        <div className="md:col-span-5">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center size-9 rounded-md gradient-accent text-white font-bold text-lg leading-none shadow-glow-accent">
              Y
            </span>
            <span className="font-extrabold text-xl tracking-[0.14em] text-yokto-text-1">YOKTO</span>
          </div>
          <p className="mt-6 max-w-md text-sm text-yokto-text-2 leading-relaxed">
            Pago Seguro contra Cumplimiento. Retenemos fondos vía pasarelas certificadas
            y los liberamos únicamente cuando se verifican las condiciones acordadas
            entre las partes.
          </p>
        </div>

        <div className="md:col-span-3">
          <p className="text-xs uppercase tracking-widest text-yokto-text-3 font-semibold">Producto</p>
          <ul className="mt-5 space-y-2.5 text-sm">
            <li><Link to="/como-funciona" className="hover:text-yokto-accent transition">Cómo funciona</Link></li>
            <li><Link to="/casos-de-uso" className="hover:text-yokto-accent transition">Sectores</Link></li>
            <li><Link to="/precios" className="hover:text-yokto-accent transition">Precios</Link></li>
          </ul>
        </div>

        <div className="md:col-span-4">
          <p className="text-xs uppercase tracking-widest text-yokto-text-3 font-semibold">Compañía</p>
          <ul className="mt-5 space-y-2.5 text-sm">
            <li><Link to="/marco-legal" className="hover:text-yokto-accent transition">Marco legal</Link></li>
            <li><Link to="/contacto" className="hover:text-yokto-accent transition">Contacto</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/[0.06]">
        <div className="container-editorial py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs text-yokto-text-3">
          <p className="uppercase tracking-widest">© {new Date().getFullYear()} YOKTO · Hecho en México</p>
          <p className="max-w-2xl md:text-right leading-relaxed">
            YOKTO no es entidad financiera ni custodio de fondos. Opera como facilitador
            tecnológico fuera del marco IFPE/CNBV, apoyado en pasarelas de pago certificadas.
          </p>
        </div>
      </div>
    </footer>
  );
}
