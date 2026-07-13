import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
}) {
  return (
    <section className="border-b border-border/60">
      <div className="container-editorial py-20 md:py-28 max-w-4xl">
        {eyebrow && (
          <p className="text-xs uppercase tracking-[0.24em] text-primary font-medium">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-4 font-display text-5xl md:text-6xl leading-[1.05] text-foreground text-balance">
          {title}
        </h1>
        {lead && (
          <p className="mt-6 max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed">
            {lead}
          </p>
        )}
      </div>
    </section>
  );
}
