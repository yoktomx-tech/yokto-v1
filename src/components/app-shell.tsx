import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard, ArrowLeftRight, Banknote, AlertTriangle, FileText,
  Users, User, Settings, Menu, X, ShieldCheck, Star,
} from "lucide-react";
import { YoktoLogo } from "@/components/logo";
import { OrgSwitcher } from "@/components/org-switcher";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard",    icon: LayoutDashboard, label: "Panel" },
  { to: "/transactions", icon: ArrowLeftRight,  label: "Transacciones" },
  { to: "/payments",     icon: Banknote,        label: "Pagos" },
  { to: "/disputes",     icon: AlertTriangle,   label: "Disputas" },
  { to: "/reports",      icon: FileText,        label: "Fiscal" },
  { to: "/api-clients",  icon: Users,           label: "API" },
  { to: "/kyc",          icon: ShieldCheck,     label: "KYC" },
  { to: "/settings/organization", icon: Settings, label: "Organización" },
  { to: "/admin",        icon: Users,           label: "Admin" },
] as const;

export function AppShell({
  children,
  sgyScore = 500,
  displayName,
}: {
  children: React.ReactNode;
  sgyScore?: number;
  displayName?: string;
}) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-dvh flex bg-yo-bg">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-r border-yo-border bg-yo-surface sticky top-0 h-dvh">
        <SidebarContent pathname={pathname} sgyScore={sgyScore} displayName={displayName} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-yo-surface border-r border-yo-border flex flex-col md:hidden">
            <div className="flex justify-end p-2">
              <button
                onClick={() => setMobileOpen(false)}
                className="size-8 grid place-items-center rounded-md hover:bg-yo-raised"
                aria-label="Cerrar menú"
              >
                <X className="size-4" />
              </button>
            </div>
            <SidebarContent
              pathname={pathname}
              sgyScore={sgyScore}
              displayName={displayName}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile menu button */}
        <button
          className="md:hidden fixed top-3 left-3 z-30 size-9 grid place-items-center rounded-md border border-yo-border bg-yo-surface shadow-sm"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
        >
          <Menu className="size-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

function SidebarContent({
  pathname, sgyScore, displayName, onNavigate,
}: {
  pathname: string;
  sgyScore: number;
  displayName?: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="px-5 py-5 border-b border-yo-border space-y-3">
        <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-2">
          <YoktoLogo variant="dark" className="h-6 w-auto" />
        </Link>
        <OrgSwitcher />
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {NAV.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition",
                active
                  ? "bg-yo-ac-bg text-yo-ac-txt"
                  : "text-yo-txt-2 hover:text-yo-txt hover:bg-yo-raised"
              )}
            >
              <Icon className={cn("size-4 shrink-0", active ? "text-yo-ac" : "text-yo-txt-3")} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-yo-border p-4 space-y-3">
        {/* SGY score mini */}
        <SgyMini score={sgyScore} />
        {/* User */}
        <Link
          to="/onboarding/pendiente"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-md p-2 hover:bg-yo-raised transition"
        >
          <div className="grid place-items-center size-8 rounded-full bg-yo-ac text-white text-xs font-bold shrink-0">
            {(displayName ?? "U").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-yo-txt truncate">{displayName ?? "Usuario"}</p>
            <p className="text-[10px] text-yo-txt-3">Ver perfil</p>
          </div>
          <User className="size-3.5 text-yo-txt-3" />
        </Link>
      </div>
    </>
  );
}

function SgyMini({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, (score / 1000) * 100));
  const category =
    score >= 850 ? "Élite" :
    score >= 700 ? "Premium" :
    score >= 500 ? "Confiable" :
    score >= 300 ? "Básico" : "Nuevo";
  const color =
    score >= 850 ? "text-yo-ac" :
    score >= 700 ? "text-yo-ok" :
    score >= 500 ? "text-yo-info" :
    score >= 300 ? "text-yo-warn" : "text-yo-txt-3";

  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="flex items-center gap-3 px-1">
      <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--yo-border)" strokeWidth="3" />
        <circle
          cx="22" cy="22" r={r} fill="none"
          stroke="currentColor" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          transform="rotate(-90 22 22)"
          className={color}
        />
      </svg>
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <Star className={cn("size-3", color)} />
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-yo-txt-3">SGY Score</p>
        </div>
        <p className="text-sm font-bold text-yo-txt">{score} <span className="text-[10px] text-yo-txt-3 font-normal">/ 1000</span></p>
        <p className={cn("text-[10px] font-semibold", color)}>{category}</p>
      </div>
    </div>
  );
}
