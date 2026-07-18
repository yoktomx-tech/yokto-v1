import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Search, HelpCircle, FileText, ArrowRight } from "lucide-react";
import { listHelpCategories, listHelpArticles } from "@/lib/support.functions";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/help")({
  component: HelpIndex,
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === "string" ? s.q : "" }),
});

function HelpIndex() {
  const { q: q0 } = Route.useSearch();
  const [q, setQ] = useState(q0 ?? "");
  const catsFn = useServerFn(listHelpCategories);
  const artsFn = useServerFn(listHelpArticles);
  const { data: cats } = useQuery({ queryKey: ["help-cats"], queryFn: () => catsFn(), staleTime: 60_000 });
  const { data: arts } = useQuery({
    queryKey: ["help-arts", q],
    queryFn: () => artsFn({ data: q ? { q } : {} }),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <PageHeader icon={HelpCircle} title="Centro de Ayuda" subtitle="Guías, artículos y respuestas rápidas." />

      <div className="rounded-xl border border-yo-border bg-[#F5F3FF] p-6">
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-yo-txt-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Busca por tema, módulo o palabra clave…"
              className="w-full h-11 pl-10 pr-3 rounded-lg bg-white border border-yo-border text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30"
            />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-yo-txt mb-3">Categorías</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(cats ?? []).map((c) => (
            <Link key={c.id} to="/help" search={{ q: c.name }}
              className="rounded-xl border border-yo-border bg-yo-surface p-4 hover:border-[#7C3AED]/40 transition">
              <p className="text-[13px] font-semibold text-yo-txt">{c.name}</p>
              {c.description && <p className="text-xs text-yo-txt-3 mt-1">{c.description}</p>}
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-yo-txt mb-3">Artículos {q && <span className="text-yo-txt-3 font-normal">· resultados para "{q}"</span>}</h2>
        <div className="space-y-2">
          {(arts ?? []).map((a) => (
            <Link key={a.id} to="/help/$slug" params={{ slug: a.slug }}
              className="flex items-start gap-3 p-3 rounded-xl border border-yo-border bg-yo-surface hover:border-[#7C3AED]/40 transition">
              <FileText className="size-4 text-yo-txt-3 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-yo-txt">{a.title}</p>
                {a.summary && <p className="text-xs text-yo-txt-3 mt-0.5 line-clamp-2">{a.summary}</p>}
              </div>
              <ArrowRight className="size-4 text-yo-txt-3" />
            </Link>
          ))}
          {!arts?.length && <p className="text-sm text-yo-txt-3">Sin artículos.</p>}
        </div>
      </div>
    </div>
  );
}
