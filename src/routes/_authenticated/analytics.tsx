import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AnalyticsShell } from "@/components/analytics/analytics-shell";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Cumplex" }, { name: "robots", content: "noindex" }] }),
  component: AnalyticsLayout,
});

function AnalyticsLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isRoot = pathname === "/analytics";
  return (
    <div className="space-y-6 max-w-[1440px] mx-auto">
      <PageHeader
        icon={BarChart3}
        title="Analytics y Reportes"
        subtitle="Inteligencia operativa, financiera, fiscal y de cumplimiento de tus operaciones."
      />
      <div className="flex items-center gap-2 -mt-2 text-[11px] text-yo-txt-3">
        <span>Última actualización: hace 8 min</span>
        <span>•</span>
        <span>Plan Profesional</span>
        {!isRoot && (
          <>
            <span>•</span>
            <span>Todas las cifras son ilustrativas mientras se conecta la fuente de datos.</span>
          </>
        )}
      </div>
      <AnalyticsShell>
        <Outlet />
      </AnalyticsShell>
    </div>
  );
}
