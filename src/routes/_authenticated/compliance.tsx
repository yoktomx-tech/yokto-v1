import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { AppHeader } from "@/components/app-header";

export const Route = createFileRoute("/_authenticated/compliance")({
  head: () => ({ meta: [{ title: "Cumplimiento — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: CompliancePage,
});

function CompliancePage() {
  const { user } = Route.useRouteContext();
  return (
    <>
      <AppHeader email={user.email} userId={user.id} />
      <main className="p-6 md:p-8 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 rounded-md bg-yo-ac-bg grid place-items-center">
            <ShieldCheck className="size-5 text-yo-ac" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-yo-txt">Cumplimiento</h1>
            <p className="text-sm text-yo-txt-3">Documentos, evidencias y verificaciones asociadas a tus operaciones.</p>
          </div>
        </div>
        <div className="rounded-lg border border-dashed border-yo-border p-10 text-center bg-yo-surface">
          <p className="text-yo-txt-2 text-sm">Módulo en construcción. Consulta cumplimiento por operación desde “Mis Operaciones”.</p>
        </div>
      </main>
    </>
  );
}
