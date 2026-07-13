import { createFileRoute } from "@tanstack/react-router";
import { PageShell, PageHero } from "../components/page-shell";
import { Briefcase, HardHat, Users, ShoppingBag, Code2, Home } from "lucide-react";

export const Route = createFileRoute("/casos-de-uso")({
  head: () => ({
    meta: [
      { title: "Casos de uso — YOKTO Pago contra Cumplimiento" },
      {
        name: "description",
        content:
          "Servicios profesionales, marketplaces, obra, remodelaciones, freelance y operaciones B2B: YOKTO cubre transacciones donde el pago debe atarse al cumplimiento.",
      },
      { property: "og:title", content: "Casos de uso YOKTO" },
      { property: "og:description", content: "B2B y B2C: dónde tiene sentido usar pago contra cumplimiento." },
    ],
  }),
  component: Page,
});

const b2b = [
  { icon: Briefcase, t: "Servicios profesionales", d: "Consultoría, legal, contabilidad. Anticipo retenido, liberación por entregable." },
  { icon: Code2, t: "Software y desarrollo", d: "Sprints, milestones técnicos, integraciones. Cada fase se libera al aceptarse." },
  { icon: HardHat, t: "Obra y construcción", d: "Avances de obra verificados con evidencia fotográfica y acta." },
];

const b2c = [
  { icon: ShoppingBag, t: "Marketplace de artículos", d: "Compradores y vendedores particulares que no se conocen previamente." },
  { icon: Home, t: "Remodelaciones", d: "Pago por fases al contratista, contra recepción del cliente." },
  { icon: Users, t: "Freelance C2C", d: "Diseño, contenido, tutorías. Fondos retenidos hasta entrega aceptada." },
];

function Page() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Casos de uso"
        title="Donde el pago necesita atarse al cumplimiento."
        lead="YOKTO opera para cualquier transacción entre dos partes donde una entrega algo y la otra paga por ello. Estos son los escenarios más comunes."
      />

      <Bucket title="B2B" subtitle="Empresas, despachos y proveedores" items={b2b} />
      <Bucket title="B2C" subtitle="Particulares, marketplaces y contratistas" items={b2c} muted />

      <section className="rule-top">
        <div className="container-editorial py-20 grid md:grid-cols-12 gap-10">
          <div className="md:col-span-5">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Fuera del alcance
            </p>
            <h2 className="mt-4 font-display text-3xl text-foreground text-balance">
              Qué NO hace YOKTO
            </h2>
          </div>
          <ul className="md:col-span-7 space-y-4 text-lg text-foreground/85 leading-relaxed">
            <li>· No custodiamos ni invertimos fondos.</li>
            <li>· No emitimos crédito ni financiamos operaciones.</li>
            <li>· No sustituimos un contrato: lo hacemos ejecutable.</li>
            <li>· No arbitramos: documentamos evidencia y activamos protocolos.</li>
          </ul>
        </div>
      </section>
    </PageShell>
  );
}

function Bucket({
  title,
  subtitle,
  items,
  muted,
}: {
  title: string;
  subtitle: string;
  items: { icon: React.ComponentType<{ className?: string }>; t: string; d: string }[];
  muted?: boolean;
}) {
  return (
    <section className={muted ? "rule-top bg-muted/50" : "rule-top"}>
      <div className="container-editorial py-20">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-primary font-medium">{title}</p>
            <h2 className="mt-3 font-display text-4xl text-foreground">{subtitle}</h2>
          </div>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {items.map(({ icon: Icon, t, d }) => (
            <article
              key={t}
              className="rounded-2xl border border-border bg-card p-6"
              style={{ boxShadow: "var(--shadow-soft)" }}
            >
              <Icon className="size-6 text-primary" />
              <h3 className="mt-4 font-display text-2xl text-foreground">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{d}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
