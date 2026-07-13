import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, PageHero } from "../components/page-shell";
import { Check } from "lucide-react";

export const Route = createFileRoute("/precios")({
  head: () => ({
    meta: [
      { title: "Precios — YOKTO Pago contra Cumplimiento" },
      {
        name: "description",
        content:
          "Comisión transparente sobre el monto retenido. Sin mensualidades. Cobramos solo cuando se libera la transacción.",
      },
      { property: "og:title", content: "Precios YOKTO" },
      { property: "og:description", content: "Comisión transparente sobre el monto retenido." },
    ],
  }),
  component: Page,
});

const plans = [
  {
    name: "Individual",
    price: "1.9%",
    unit: "sobre monto liberado",
    d: "Para operaciones B2C entre particulares y freelance.",
    features: [
      "Hasta $200,000 MXN por transacción",
      "Depósito con tarjeta o SPEI",
      "Milestones ilimitados",
      "Bitácora auditable",
      "Soporte por email",
    ],
    cta: "Empezar",
  },
  {
    name: "Empresa",
    price: "1.4%",
    unit: "sobre monto liberado",
    d: "Para servicios profesionales, obra y contratos B2B recurrentes.",
    features: [
      "Sin monto máximo por transacción",
      "Onboarding acompañado",
      "Panel para equipos",
      "Integración con contabilidad",
      "Soporte prioritario",
    ],
    highlight: true,
    cta: "Solicitar acceso",
  },
  {
    name: "Marketplace",
    price: "A medida",
    unit: "por volumen y arquitectura",
    d: "Para plataformas que quieren YOKTO como su capa de escrow embebida.",
    features: [
      "API de transacciones",
      "White-label",
      "SLA dedicado",
      "Modelo de comisión personalizado",
    ],
    cta: "Hablar con ventas",
  },
];

function Page() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Precios"
        title="Cobramos solo cuando se libera."
        lead="Sin mensualidades. Sin costos por invitación. Nuestra comisión se aplica sobre el monto retenido al momento de liberar los fondos al vendedor."
      />

      <section className="container-editorial py-20">
        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`rounded-3xl border p-8 flex flex-col ${
                p.highlight
                  ? "bg-secondary text-secondary-foreground border-transparent"
                  : "bg-card border-border"
              }`}
              style={p.highlight ? { boxShadow: "var(--shadow-editorial)" } : undefined}
            >
              <p className={`text-xs uppercase tracking-[0.22em] ${p.highlight ? "opacity-70" : "text-muted-foreground"}`}>
                {p.name}
              </p>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-5xl">{p.price}</span>
                <span className={`text-sm ${p.highlight ? "opacity-70" : "text-muted-foreground"}`}>
                  {p.unit}
                </span>
              </div>
              <p className={`mt-4 text-sm leading-relaxed ${p.highlight ? "opacity-80" : "text-muted-foreground"}`}>
                {p.d}
              </p>

              <ul className="mt-8 space-y-3 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className={`size-4 mt-0.5 shrink-0 ${p.highlight ? "text-primary" : "text-primary"}`} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/contacto"
                className={`mt-10 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium transition ${
                  p.highlight
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "border border-border text-foreground hover:bg-muted"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="rule-top">
        <div className="container-editorial py-16 grid md:grid-cols-2 gap-10">
          <div>
            <h2 className="font-display text-3xl text-foreground">Costos de pasarela</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              A la comisión YOKTO se suman los costos de la pasarela que se utilice:
              Stripe cobra su tarifa estándar por transacción con tarjeta; las
              transferencias SPEI tienen un costo fijo por referencia. Estos costos
              se muestran de forma explícita antes de confirmar el depósito.
            </p>
          </div>
          <div>
            <h2 className="font-display text-3xl text-foreground">Facturación</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              Emitimos CFDI 4.0 por la comisión de YOKTO. El vendedor emite su
              propio CFDI por la operación subyacente al comprador. YOKTO no
              interviene en la relación fiscal entre las partes.
            </p>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
