import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [{ title: "CRM — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: CrmPage,
});

function CrmPage() {
  const { user } = Route.useRouteContext();
  return (
    <>
      <main className="p-6 md:p-8 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 rounded-md bg-yo-ac-bg grid place-items-center">
            <Users className="size-5 text-yo-ac" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-yo-txt">CRM</h1>
            <p className="text-sm text-yo-txt-3">Gestión de contactos, contrapartes y relaciones comerciales.</p>
          </div>
        </div>
        <div className="rounded-lg border border-dashed border-yo-border p-10 text-center bg-yo-surface">
          <p className="text-yo-txt-2 text-sm">El módulo de CRM estará disponible próximamente.</p>
        </div>
      </main>
    </>
  );
}
