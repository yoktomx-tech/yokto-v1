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
      <section className="border-b border-yo-border/90">
        <div className="container-editorial pt-16 pb-24 md:pt-20 md:pb-32">
          <p className="text-[11px] uppercase tracking-[0.32em] text-yokto-black font-semibold">
            <span className="inline-block size-1.5 bg-yokto-yellow mr-2 -translate-y-[2px]" />
            Pago contra cumplimiento · México
          </p>

          <h1 className="mt-6 font-display text-[64px] md:text-[136px] leading-[0.88] text-foreground text-balance">
            Paga cuando<br />se cumpla.<br />
            <span className="text-foreground/40">No antes.</span>
          </h1>

          <div className="mt-12 grid md:grid-cols-12 gap-10">
            <p className="md:col-span-7 text-lg md:text-xl text-foreground/75 leading-relaxed max-w-2xl">
              YOKTO es el tercero neutral que retiene los fondos de una operación
              B2B o B2C y los libera únicamente cuando se verifican las condiciones
              de cumplimiento pactadas entre las partes. Vía pasarelas certificadas.
              Sin custodia directa.
            </p>
            <div className="md:col-span-5 flex md:justify-end items-end">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-yo-ac text-white text-[13px] uppercase tracking-[0.16em] font-semibold border border-yo-border transition hover:bg-yo-ac-h"
                >
                  Crear cuenta <ArrowRight className="size-4" />
                </Link>
                <Link
                  to="/marco-legal"
                  className="inline-flex items-center gap-2 px-6 py-3.5 border border-yo-border text-[13px] uppercase tracking-[0.16em] font-semibold text-foreground hover:bg-yo-ac-h hover:text-white"
                >
                  Marco legal
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* METRIC STRIP */}
      <section className="border-b border-yo-border/90 bg-yo-ac text-white">
        <div className="container-editorial py-10 grid grid-cols-2 md:grid-cols-4 divide-x divide-yokto-cream/15">
          {[
            ["Pasarelas", "Stripe · SPEI"],
            ["Rol YOKTO", "Tercero neutral"],
            ["Fondos", "No custodiados"],
            ["Mercado", "B2B y B2C · MX"],
          ].map(([k, v], i) => (
            <div key={k} className={i === 0 ? "pr-6" : "px-6"}>
              <p className="text-[10px] uppercase tracking-[0.24em] text-yokto-yellow font-semibold">{k}</p>
              <p className="mt-3 font-display text-2xl md:text-3xl tracking-wide">{v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PROBLEMA / VALOR */}
      <section>
        <div className="container-editorial py-24 grid md:grid-cols-12 gap-12">
          <div className="md:col-span-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground font-semibold">
              El problema
            </p>
            <h2 className="mt-4 font-display text-5xl md:text-6xl leading-[0.95] text-foreground text-balance">
              En México, pagar por adelantado es un acto de fe.
            </h2>
          </div>
          <div className="md:col-span-7 md:pt-16 space-y-6 text-lg text-foreground/85 leading-relaxed">
            <p>
              El comprador se expone a que no le entreguen. El vendedor se expone
              a que no le paguen. La solución habitual —SPEI directo, anticipo
              total, contrato sin garantía— traslada todo el riesgo a una de las
              dos partes.
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
      <section className="border-y border-yo-border/90 bg-muted">
        <div className="container-editorial py-24">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.24em] text-yokto-black font-semibold">
              <span className="inline-block size-1.5 bg-yokto-yellow mr-2 -translate-y-[2px]" />
              Cuatro pasos
            </p>
            <h2 className="mt-4 font-display text-5xl md:text-6xl text-foreground text-balance">
              Un flujo claro, auditable, neutral.
            </h2>
          </div>

          <ol className="mt-14 grid gap-0 md:grid-cols-4 border border-yo-border bg-background">
            {[
              { n: "01", t: "Acuerdo", d: "Comprador y vendedor definen monto, plazo y condiciones de cumplimiento verificables." },
              { n: "02", t: "Depósito", d: "Depósito vía Stripe o SPEI. Los fondos quedan retenidos en la pasarela certificada." },
              { n: "03", t: "Verificación", d: "El vendedor sube evidencia. Ambas partes aprueban los milestones cumplidos." },
              { n: "04", t: "Liberación", d: "YOKTO instruye la liberación. Si hay disputa, se activa un proceso formal." },
            ].map((s, i) => (
              <li
                key={s.n}
                className={`p-8 flex flex-col gap-4 ${i < 3 ? "md:border-r border-yo-border" : ""} ${i < 2 ? "border-b md:border-b-0" : ""}`}
              >
                <span className="font-display text-4xl text-yokto-black">{s.n}</span>
                <h3 className="font-display text-3xl text-foreground">{s.t}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* PILARES */}
      <section>
        <div className="container-editorial py-24 grid gap-0 md:grid-cols-2 lg:grid-cols-4 border border-yo-border">
          {[
            { icon: ShieldCheck, t: "Neutralidad", d: "No representamos a comprador ni vendedor. Solo somos el mecanismo de retención y liberación." },
            { icon: Landmark, t: "Sin custodia", d: "Los fondos viven en pasarelas certificadas (Stripe Connect, SPEI). YOKTO nunca los toca." },
            { icon: Handshake, t: "B2B y B2C", d: "Servicios profesionales, marketplaces, obra, remodelaciones, contratos de freelance." },
            { icon: Scale, t: "Fuera IFPE/CNBV", d: "Al no custodiar, YOKTO opera como facilitador tecnológico entre partes y pasarelas." },
          ].map(({ icon: Icon, t, d }, i) => (
            <div
              key={t}
              className={`p-8 ${i < 3 ? "lg:border-r border-yo-border" : ""} ${i < 2 ? "border-b lg:border-b-0 border-yo-border" : ""} ${i === 1 ? "md:border-r-0 lg:border-r border-yo-border" : ""}`}
            >
              <div className="grid place-items-center size-10 border border-yo-border">
                <Icon className="size-5 text-yokto-black" />
              </div>
              <h3 className="mt-5 font-display text-3xl text-foreground">{t}</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section>
        <div className="container-editorial py-20">
          <div className="bg-yo-ac text-white border border-yo-border p-10 md:p-16 grid md:grid-cols-12 gap-8 items-end">
            <div className="md:col-span-8">
              <p className="text-[11px] uppercase tracking-[0.28em] text-yokto-yellow font-semibold">
                Acceso anticipado
              </p>
              <h2 className="mt-4 font-display text-5xl md:text-6xl leading-[0.95] text-balance">
                Los fondos solo se mueven cuando se cumple lo pactado.
              </h2>
            </div>
            <div className="md:col-span-4 flex flex-wrap gap-3 md:justify-end">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-yo-ac text-white text-[13px] uppercase tracking-[0.16em] font-semibold border border-yokto-yellow hover:bg-yo-bg hover:border-yokto-cream"
              >
                Crear cuenta <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/marco-legal"
                className="inline-flex items-center gap-2 px-6 py-3.5 border border-yokto-cream/30 text-[13px] uppercase tracking-[0.16em] font-semibold hover:bg-yo-bg/10"
              >
                Marco legal
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
