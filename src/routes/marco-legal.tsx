import { createFileRoute } from "@tanstack/react-router";
import { PageShell, PageHero } from "../components/page-shell";

export const Route = createFileRoute("/marco-legal")({
  head: () => ({
    meta: [
      { title: "Marco legal — YOKTO" },
      {
        name: "description",
        content:
          "YOKTO opera fuera del régimen IFPE/CNBV al no custodiar directamente los fondos. Aquí explicamos el modelo legal y operativo.",
      },
      { property: "og:title", content: "Marco legal YOKTO" },
      { property: "og:description", content: "Modelo neutral apoyado en pasarelas certificadas." },
    ],
  }),
  component: Page,
});

const blocks = [
  {
    t: "Qué es YOKTO",
    d: "YOKTO es una plataforma tecnológica que coordina operaciones de pago contra cumplimiento entre dos partes. Actúa como tercero neutral: no representa al comprador ni al vendedor y no interviene en la relación comercial subyacente.",
  },
  {
    t: "Qué NO es YOKTO",
    d: "YOKTO no es una institución financiera, no es una IFPE (Institución de Fondos de Pago Electrónico), no es una casa de bolsa, ni una fintech de custodia. No mantiene fondos de terceros en su balance ni en cuentas propias.",
  },
  {
    t: "Por qué opera fuera de IFPE/CNBV",
    d: "La Ley Fintech aplica cuando una entidad emite, administra o custodia fondos de pago electrónico. YOKTO no realiza ninguna de esas funciones: los fondos siempre viven en pasarelas de pago autorizadas (Stripe Connect, procesadores SPEI). YOKTO opera como capa de coordinación, orquestación e instrucción.",
  },
  {
    t: "Dónde viven los fondos",
    d: "Los fondos retenidos permanecen en cuentas de la pasarela de pago —regulada y certificada— hasta que se cumplen las condiciones acordadas. En ese momento, YOKTO instruye a la pasarela para liberar los fondos al destinatario correspondiente.",
  },
  {
    t: "Equivalencia con escrow",
    d: "El modelo es equivalente funcionalmente al escrow anglosajón, adaptado a la realidad fiscal, operativa y legal de México. Sin embargo, YOKTO no se autodenomina 'depositario' en sentido jurídico: es un facilitador tecnológico entre partes y pasarelas.",
  },
  {
    t: "Relación contractual",
    d: "Comprador y vendedor mantienen su relación comercial directa. YOKTO documenta las condiciones, registra la evidencia y ejecuta la instrucción de liberación o reembolso conforme al reglamento aceptado por las partes al crear la transacción.",
  },
  {
    t: "Disputas",
    d: "En caso de disputa, YOKTO no arbitra: activa un protocolo formal donde ambas partes presentan evidencia. La resolución puede ser: liberación al vendedor, reembolso al comprador, o escalamiento a mediación externa según lo pactado.",
  },
];

function Page() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Marco legal y operativo"
        title="Neutrales, transparentes, fuera del marco IFPE."
        lead="Nuestro modelo está diseñado para operar con claridad regulatoria en México, apalancándonos en la infraestructura de pasarelas ya certificadas."
      />

      <section className="container-editorial py-20 max-w-3xl">
        <div className="space-y-14">
          {blocks.map((b) => (
            <article key={b.t} className="border-t border-border/60 pt-8">
              <h2 className="font-display text-3xl text-foreground text-balance">{b.t}</h2>
              <p className="mt-4 text-lg text-foreground/85 leading-relaxed">{b.d}</p>
            </article>
          ))}
        </div>

        <div className="mt-20 rounded-2xl border border-border bg-muted/60 p-6 text-sm text-muted-foreground leading-relaxed">
          Este documento tiene fines informativos y no constituye asesoría legal ni
          fiscal. YOKTO recomienda a cada parte revisar la operación con su propio
          asesor. Los términos y condiciones vinculantes se aceptan al crear cada
          transacción dentro de la plataforma.
        </div>
      </section>
    </PageShell>
  );
}
