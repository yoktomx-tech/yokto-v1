import { createFileRoute } from "@tanstack/react-router";
import { PageShell, PageHero } from "../components/page-shell";

export const Route = createFileRoute("/como-funciona")({
  head: () => ({
    meta: [
      { title: "Cómo funciona YOKTO — Pago contra Cumplimiento" },
      {
        name: "description",
        content:
          "El flujo de YOKTO en cuatro pasos: acuerdo, depósito en pasarela certificada, verificación de cumplimiento y liberación de fondos.",
      },
      { property: "og:title", content: "Cómo funciona YOKTO" },
      {
        property: "og:description",
        content: "Escrow moderno para México: acuerdo, depósito, verificación y liberación.",
      },
    ],
  }),
  component: Page,
});

const steps = [
  {
    n: "01",
    t: "Acuerdo",
    d: "Comprador y vendedor crean una transacción en YOKTO y definen las condiciones de cumplimiento: milestones, evidencia requerida, plazo y monto.",
    detail:
      "Cada condición debe ser verificable: entrega de producto, firma de acta, publicación de contenido, cierre de obra, etc. Ambas partes aceptan explícitamente los términos.",
  },
  {
    n: "02",
    t: "Depósito",
    d: "El comprador deposita el monto acordado vía Stripe (tarjeta) o SPEI. Los fondos quedan retenidos en la pasarela certificada.",
    detail:
      "YOKTO no custodia los fondos: viven en Stripe Connect o en la referencia SPEI del proveedor. Nosotros solo instruimos qué sucede con ellos.",
  },
  {
    n: "03",
    t: "Verificación",
    d: "El vendedor sube la evidencia del cumplimiento. Ambas partes marcan los milestones como cumplidos.",
    detail:
      "Cada acción se registra en una bitácora inmutable con fecha, hora y actor. Si algo no cuadra, cualquiera de las partes puede abrir una disputa antes de la liberación.",
  },
  {
    n: "04",
    t: "Liberación",
    d: "Con todos los milestones aprobados, YOKTO instruye la liberación al vendedor menos la comisión. En caso de disputa se activa un proceso formal.",
    detail:
      "Si la disputa procede a favor del comprador, los fondos regresan íntegros. Si procede al vendedor, se liberan normalmente. YOKTO documenta, no decide unilateralmente.",
  },
];

function Page() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Cómo funciona"
        title="Un flujo claro, neutral y auditable."
        lead="YOKTO ordena la operación en cuatro pasos. Cada uno queda documentado y cada movimiento de fondos requiere una condición verificada."
      />

      <section className="container-editorial py-20">
        <ol className="space-y-14">
          {steps.map((s) => (
            <li key={s.n} className="grid md:grid-cols-12 gap-8 border-t border-border/60 pt-10">
              <div className="md:col-span-3">
                <p className="font-display text-6xl text-primary leading-none">{s.n}</p>
                <h2 className="mt-4 font-display text-3xl text-foreground">{s.t}</h2>
              </div>
              <div className="md:col-span-9 space-y-4 text-lg text-foreground/85 leading-relaxed">
                <p>{s.d}</p>
                <p className="text-base text-muted-foreground">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rule-top bg-muted/50">
        <div className="container-editorial py-20 max-w-3xl">
          <p className="text-xs uppercase tracking-[0.24em] text-primary font-medium">
            Modelo de retención
          </p>
          <h2 className="mt-4 font-display text-4xl text-foreground text-balance">
            YOKTO nunca toca tu dinero.
          </h2>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            Todos los fondos permanecen dentro de pasarelas de pago reguladas.
            YOKTO opera como capa de coordinación e instrucción: define las reglas,
            registra los eventos y dispara la transferencia final cuando corresponde.
            Este diseño nos permite operar fuera del régimen IFPE/CNBV.
          </p>
        </div>
      </section>
    </PageShell>
  );
}
