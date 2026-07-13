import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Scale, Handshake, Landmark } from "lucide-react";
import { PageShell } from "../components/page-shell";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <PageShell>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-x-0 -top-40 h-[520px] pointer-events-none opacity-70"
          style={{
            background:
              "radial-gradient(60% 60% at 70% 20%, oklch(0.88 0.055 40 / 0.6), transparent 70%)",
          }}
        />
        <div className="container-editorial relative pt-20 pb-24 md:pt-28 md:pb-32">
          <div className="max-w-4xl">
            <p className="text-xs uppercase tracking-[0.28em] text-primary font-medium">
              Escrow moderno · México
            </p>
            <h1 className="mt-5 font-display text-6xl md:text-8xl leading-[0.95] text-foreground text-balance">
              Paga cuando se cumpla.
              <span className="block italic text-secondary">No antes.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed">
              YOKTO es el tercero neutral que retiene los fondos de una operación
              B2B o B2C y los libera únicamente cuando se verifican las condiciones
              de cumplimiento pactadas entre las partes.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                to="/contacto"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                style={{ boxShadow: "var(--shadow-editorial)" }}
              >
                Solicitar acceso
                <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/como-funciona"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-6 py-3.5 text-sm font-medium text-foreground hover:bg-muted"
              >
                Ver cómo funciona
              </Link>
            </div>

            <dl className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6 border-t border-border/60 pt-10">
              {[
                ["Pasarelas", "Stripe · SPEI"],
                ["Rol", "Tercero neutral"],
                ["Fondos", "No custodiados"],
                ["Mercado", "B2B y B2C MX"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {k}
                  </dt>
                  <dd className="mt-2 font-display text-xl text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* PROBLEMA / VALOR */}
      <section className="rule-top">
        <div className="container-editorial py-24 grid md:grid-cols-12 gap-12">
          <div className="md:col-span-5">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              El problema
            </p>
            <h2 className="mt-4 font-display text-4xl md:text-5xl leading-tight text-foreground text-balance">
              En México, pagar por adelantado es un acto de fe.
            </h2>
          </div>
          <div className="md:col-span-7 md:pt-14 space-y-6 text-lg text-foreground/85 leading-relaxed">
            <p>
              El comprador se expone a que no le entreguen. El vendedor se expone
              a que no le paguen. La solución habitual —transferencia SPEI directa,
              anticipo total, contrato sin garantía— traslada todo el riesgo a una
              de las dos partes.
            </p>
            <p className="text-foreground">
              YOKTO reordena el juego: los fondos entran, quedan retenidos en una
              pasarela certificada y solo salen cuando ambas partes reconocen que
              se cumplió lo acordado.
            </p>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA — 4 PASOS */}
      <section className="rule-top bg-muted/50">
        <div className="container-editorial py-24">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.24em] text-primary font-medium">
              Cuatro pasos
            </p>
            <h2 className="mt-4 font-display text-4xl md:text-5xl text-foreground text-balance">
              Un flujo claro, auditable y neutral.
            </h2>
          </div>

          <ol className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                n: "01",
                t: "Acuerdo",
                d: "Comprador y vendedor definen monto, plazo y condiciones de cumplimiento verificables.",
              },
              {
                n: "02",
                t: "Depósito",
                d: "El comprador deposita vía Stripe o SPEI. Los fondos quedan retenidos en la pasarela.",
              },
              {
                n: "03",
                t: "Verificación",
                d: "El vendedor sube evidencia. Ambas partes marcan los milestones cumplidos.",
              },
              {
                n: "04",
                t: "Liberación",
                d: "YOKTO libera los fondos al vendedor. Si hay disputa, se activa un proceso formal.",
              },
            ].map((s) => (
              <li
                key={s.n}
                className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4"
                style={{ boxShadow: "var(--shadow-soft)" }}
              >
                <span className="font-display text-2xl text-primary">{s.n}</span>
                <h3 className="font-display text-2xl text-foreground">{s.t}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* PILARES */}
      <section className="rule-top">
        <div className="container-editorial py-24 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: ShieldCheck,
              t: "Neutralidad garantizada",
              d: "No representamos a comprador ni vendedor. Solo somos el mecanismo de retención y liberación.",
            },
            {
              icon: Landmark,
              t: "Sin custodia de fondos",
              d: "Los fondos viven en pasarelas certificadas (Stripe Connect, SPEI). YOKTO nunca los toca.",
            },
            {
              icon: Handshake,
              t: "B2B y B2C",
              d: "Servicios profesionales, marketplaces, obra, remodelaciones, contratos de freelance.",
            },
            {
              icon: Scale,
              t: "Fuera de IFPE/CNBV",
              d: "Al no custodiar, YOKTO opera como facilitador tecnológico entre partes y pasarelas.",
            },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="border-t border-border/70 pt-6">
              <Icon className="size-6 text-primary" />
              <h3 className="mt-4 font-display text-2xl text-foreground">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="rule-top">
        <div className="container-editorial py-24">
          <div
            className="rounded-3xl px-8 md:px-14 py-16 md:py-20 relative overflow-hidden"
            style={{
              backgroundColor: "var(--forest)",
              color: "oklch(0.96 0.02 82)",
            }}
          >
            <div
              aria-hidden
              className="absolute -right-24 -top-24 size-80 rounded-full opacity-25"
              style={{ background: "var(--gradient-coral)" }}
            />
            <div className="relative max-w-2xl">
              <p className="text-xs uppercase tracking-[0.28em] opacity-70">
                Acceso anticipado
              </p>
              <h2 className="mt-4 font-display text-4xl md:text-5xl leading-tight text-balance">
                Empieza a operar con la seguridad de que los fondos solo se mueven cuando se cumple lo pactado.
              </h2>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/contacto"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  Solicitar acceso <ArrowRight className="size-4" />
                </Link>
                <Link
                  to="/precios"
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3.5 text-sm font-medium hover:bg-white/10"
                >
                  Ver precios
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
