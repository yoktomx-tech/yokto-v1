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
    <section className="border-b border-yokto-black/90">
      <div className="container-editorial py-20 md:py-28 max-w-5xl">
        {eyebrow && (
          <p className="text-[11px] uppercase tracking-[0.28em] text-yokto-black font-semibold">
            <span className="inline-block size-1.5 bg-yokto-yellow mr-2 -translate-y-[2px]" />
            {eyebrow}
          </p>
        )}
        <h1 className="mt-5 font-display text-6xl md:text-8xl leading-[0.9] text-foreground text-balance">
          {title}
        </h1>
        {lead && (
          <p className="mt-8 max-w-2xl text-lg md:text-xl text-foreground/75 leading-relaxed">
            {lead}
          </p>
        )}
      </div>
    </section>
  );
}
