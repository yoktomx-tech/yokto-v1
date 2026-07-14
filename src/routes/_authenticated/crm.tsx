import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [{ title: "CRM — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: CrmPage,
});

function CrmPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Users}
        title="CRM"
        subtitle="Gestión de contactos, contrapartes y relaciones comerciales."
      />
      <div className="rounded-lg border border-dashed border-yo-border p-10 text-center bg-yo-surface">
        <p className="text-yo-txt-2 text-sm">El módulo de CRM estará disponible próximamente.</p>
      </div>
    </div>
  );
}
