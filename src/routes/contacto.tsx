import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell, PageHero } from "../components/page-shell";
import { z } from "zod";

export const Route = createFileRoute("/contacto")({
  head: () => ({
    meta: [
      { title: "Contacto y acceso anticipado — YOKTO" },
      {
        name: "description",
        content:
          "Solicita acceso a YOKTO o cuéntanos sobre tu caso de uso. Respondemos en menos de 24 horas hábiles.",
      },
      { property: "og:title", content: "Contacto YOKTO" },
      { property: "og:description", content: "Solicita acceso anticipado o hablemos de tu caso." },
    ],
  }),
  component: Page,
});

const schema = z.object({
  nombre: z.string().trim().min(2, "Ingresa tu nombre").max(120),
  email: z.string().trim().email("Correo inválido").max(255),
  empresa: z.string().trim().max(160).optional(),
  tipo: z.enum(["b2b", "b2c", "marketplace", "otro"]),
  mensaje: z.string().trim().min(10, "Cuéntanos un poco más").max(2000),
});

function Page() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errs[String(issue.path[0])] = issue.message;
      }
      setErrors(errs);
      return;
    }
    setState("sending");
    // Persistencia real se conecta en la Fase 2 con Lovable Cloud.
    setTimeout(() => setState("sent"), 600);
  };

  return (
    <PageShell>
      <PageHero
        eyebrow="Contacto"
        title="Hablemos de tu operación."
        lead="Cuéntanos qué tipo de transacción quieres proteger. Respondemos personalmente en menos de 24 horas hábiles."
      />

      <section className="container-editorial py-20 grid md:grid-cols-12 gap-12">
        <aside className="md:col-span-4 space-y-8">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Correo</p>
            <p className="mt-2 font-display text-2xl text-foreground">hola@yokto.mx</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Sede</p>
            <p className="mt-2 text-foreground">Ciudad de México</p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/50 p-5 text-sm text-muted-foreground leading-relaxed">
            Estamos en acceso anticipado. Priorizamos a operadores con volumen
            recurrente y casos donde el pago contra cumplimiento aporta valor claro.
          </div>
        </aside>

        <div className="md:col-span-8">
          {state === "sent" ? (
            <div className="rounded-3xl border border-border bg-card p-10" style={{ boxShadow: "var(--shadow-soft)" }}>
              <h2 className="font-display text-3xl text-foreground">Recibido.</h2>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Gracias por escribirnos. Te contactamos en las próximas 24 horas hábiles al correo que registraste.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="rounded-3xl border border-border bg-card p-8 md:p-10 space-y-5" style={{ boxShadow: "var(--shadow-soft)" }}>
              <Field label="Nombre" name="nombre" error={errors.nombre} required />
              <Field label="Correo" name="email" type="email" error={errors.email} required />
              <Field label="Empresa (opcional)" name="empresa" error={errors.empresa} />

              <div className="space-y-2">
                <label className="text-sm text-foreground/80" htmlFor="tipo">Tipo de operación</label>
                <select
                  id="tipo"
                  name="tipo"
                  defaultValue="b2b"
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="b2b">B2B — Servicios profesionales</option>
                  <option value="b2c">B2C — Particulares</option>
                  <option value="marketplace">Marketplace / plataforma</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-foreground/80" htmlFor="mensaje">Cuéntanos tu caso</label>
                <textarea
                  id="mensaje"
                  name="mensaje"
                  rows={5}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Volumen aproximado, tipo de contraparte, condiciones típicas…"
                />
                {errors.mensaje && <p className="text-xs text-destructive">{errors.mensaje}</p>}
              </div>

              <button
                type="submit"
                disabled={state === "sending"}
                className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {state === "sending" ? "Enviando…" : "Enviar solicitud"}
              </button>

              <p className="text-xs text-muted-foreground">
                Al enviar aceptas que YOKTO te contacte al correo proporcionado.
              </p>
            </form>
          )}
        </div>
      </section>
    </PageShell>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  error,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm text-foreground/80" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
