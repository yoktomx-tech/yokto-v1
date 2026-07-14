import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/score")({
  head: () => ({ meta: [{ title: "Score de confianza — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: ScorePage,
});

function ScorePage() {
  const score = 500;
  const pct = Math.min(100, (score / 1000) * 100);
  const r = 60, c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Star}
        title="Score de confianza (SGY)"
        subtitle="Tu reputación en YOKTO basada en operaciones cumplidas."
      />
      <div className="rounded-lg border border-yo-border bg-yo-surface p-8 flex flex-col md:flex-row items-center gap-8">
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r={r} fill="none" stroke="var(--yo-border)" strokeWidth="8" />
          <circle cx="80" cy="80" r={r} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
            transform="rotate(-90 80 80)" className="text-yo-ac" />
          <text x="80" y="88" textAnchor="middle" className="fill-yo-txt text-3xl font-bold">{score}</text>
        </svg>
        <div>
          <p className="text-xs uppercase tracking-widest text-yo-txt-3">Nivel actual</p>
          <p className="text-2xl font-bold text-yo-txt">Confiable</p>
          <p className="text-sm text-yo-txt-2 mt-2 max-w-md">Completa más operaciones y verificaciones para subir de nivel a Premium (700+) y Élite (850+).</p>
        </div>
      </div>
    </div>
  );
}
