import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText } from "lucide-react";
import { getHelpArticle } from "@/lib/support.functions";

export const Route = createFileRoute("/_authenticated/help/$slug")({
  component: HelpArticle,
});

function HelpArticle() {
  const { slug } = Route.useParams();
  const fn = useServerFn(getHelpArticle);
  const { data, isLoading } = useQuery({ queryKey: ["help-article", slug], queryFn: () => fn({ data: { slug } }) });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link to="/help" className="inline-flex items-center gap-1.5 text-xs text-yo-txt-3 hover:text-yo-txt">
        <ArrowLeft className="size-3.5" /> Centro de Ayuda
      </Link>
      {isLoading && <p className="text-sm text-yo-txt-3">Cargando…</p>}
      {!isLoading && !data && (
        <div className="rounded-xl border border-yo-border p-8 text-center">
          <p className="text-sm text-yo-txt-3">Artículo no encontrado.</p>
        </div>
      )}
      {data && (
        <article className="rounded-xl border border-yo-border bg-yo-surface p-6 md:p-8">
          <div className="flex items-center gap-2 text-yo-txt-3">
            <FileText className="size-4" />
            {data.module && <span className="text-[11px] uppercase tracking-wider font-semibold">{data.module}</span>}
          </div>
          <h1 className="mt-3 text-2xl md:text-3xl font-semibold text-yo-txt">{data.title}</h1>
          {data.summary && <p className="mt-3 text-sm text-yo-txt-2">{data.summary}</p>}
          <div className="prose prose-sm max-w-none mt-6 whitespace-pre-wrap text-yo-txt">
            {data.body_md}
          </div>
        </article>
      )}
    </div>
  );
}
