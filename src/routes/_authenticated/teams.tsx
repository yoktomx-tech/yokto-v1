import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Users2, Plus, Download, Settings, LayoutDashboard, UserPlus, ClipboardCheck, Workflow, FileBarChart2, KeyRound, Puzzle, History } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { TEAM, PLAN_TONE } from "@/lib/teams-mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/teams")({
  head: () => ({ meta: [{ title: "Equipo — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: TeamsLayout,
});

const TABS = [
  { to: "/teams",              label: "Panel",              icon: LayoutDashboard, exact: true },
  { to: "/teams/members",      label: "Miembros",           icon: UserPlus },
  { to: "/teams/approvals",    label: "Aprobaciones",       icon: ClipboardCheck },
  { to: "/teams/workflows",    label: "Workflows",          icon: Workflow },
  { to: "/teams/reports",      label: "Reportes",           icon: FileBarChart2 },
  { to: "/teams/api-keys",     label: "API Keys",           icon: KeyRound },
  { to: "/teams/integrations", label: "Integraciones",      icon: Puzzle },
  { to: "/teams/audit",        label: "Auditoría",          icon: History },
  { to: "/teams/settings",     label: "Configuración",      icon: Settings },
];

function TeamsLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const plan = PLAN_TONE[TEAM.plan];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Users2}
        title="Equipo"
        subtitle={`${TEAM.razon_social} · RFC ${TEAM.rfc} · 8 miembros · Score empresa ${TEAM.score_empresa}`}
        actions={
          <>
            <span className={cn("hidden md:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold", plan.bg, plan.text)}>
              Plan {plan.label}
            </span>
            <Link to="/teams/members" className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 text-[13px] font-medium rounded-md border border-yo-border bg-yo-surface hover:bg-yo-raised">
              <Plus className="size-3.5" /> Invitar miembro
            </Link>
            <Link to="/teams/reports" className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 text-[13px] font-medium rounded-md border border-yo-border bg-yo-surface hover:bg-yo-raised">
              <Download className="size-3.5" /> Exportar
            </Link>
            <Link to="/teams/settings" className="inline-flex items-center gap-1.5 h-9 px-3 text-[13px] font-medium rounded-md bg-yo-ac text-white hover:bg-yo-ac-h">
              <Settings className="size-3.5" /> Configuración
            </Link>
          </>
        }
      />

      {/* Tabs */}
      <div className="border-b border-yo-border overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
        <nav className="flex gap-1 min-w-max">
          {TABS.map((t) => {
            const active = t.exact ? pathname === t.to : pathname === t.to || pathname.startsWith(t.to + "/");
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 h-9 text-[13px] font-medium border-b-2 -mb-px transition",
                  active
                    ? "border-yo-ac text-yo-ac"
                    : "border-transparent text-yo-txt-2 hover:text-yo-txt hover:border-yo-border-s"
                )}
              >
                <Icon className="size-3.5" />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <Outlet />
    </div>
  );
}
