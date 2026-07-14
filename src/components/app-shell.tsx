import { Link, useRouterState } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import {
  LayoutDashboard, Briefcase, PackageCheck, AlertTriangle, Banknote,
  Users, Star, Menu, X, ClipboardCheck, ShoppingCart, Store, ChevronDown, Check,
} from "lucide-react";
import { YoktoLogo } from "@/components/logo";
import { useViewRole, type ViewRole } from "@/hooks/use-view-role";
import { useAuthUser } from "@/hooks/use-auth-user";
import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils";

type NavItem = { to: string; icon: typeof LayoutDashboard; label: string };

const SELLER_NAV: NavItem[] = [
  { to: "/dashboard",    icon: LayoutDashboard, label: "Dashboard" },
  { to: "/transactions", icon: Briefcase,       label: "Mis Operaciones" },
  { to: "/compliance",   icon: ShieldCheck,     label: "Cumplimiento" },
  { to: "/disputes",     icon: AlertTriangle,   label: "Disputas" },
  { to: "/payments",     icon: Banknote,        label: "Pagos y retenciones" },
  { to: "/crm",          icon: Users,           label: "CRM" },
  { to: "/score",        icon: Star,            label: "Score de confianza" },
];

const BUYER_NAV: NavItem[] = [
  { to: "/dashboard",    icon: LayoutDashboard, label: "Dashboard" },
  { to: "/transactions", icon: Briefcase,       label: "Mis Operaciones" },
  { to: "/approvals",    icon: ClipboardCheck,  label: "Aprobaciones" },
  { to: "/disputes",     icon: AlertTriangle,   label: "Disputas" },
  { to: "/payments",     icon: Banknote,        label: "Pagos y retenciones" },
  { to: "/crm",          icon: Users,           label: "CRM" },
  { to: "/score",        icon: Star,            label: "Score de confianza" },
];

export function AppShell({ children, sgyScore = 500 }: { children: React.ReactNode; sgyScore?: number; displayName?: string }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { role, setRole } = useViewRole();
  const { userId, email } = useAuthUser();

  const nav = role === "seller" ? SELLER_NAV : BUYER_NAV;

  return (
    <div className="min-h-dvh flex bg-yo-bg">
      <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-r border-yo-border bg-yo-surface sticky top-0 h-dvh">
        <SidebarContent pathname={pathname} nav={nav} role={role} setRole={setRole} sgyScore={sgyScore} />
      </aside>

      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
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
              nav={nav}
              role={role}
              setRole={(r) => { setRole(r); }}
              sgyScore={sgyScore}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <button
          className="md:hidden fixed top-3 left-3 z-30 size-9 grid place-items-center rounded-md border border-yo-border bg-yo-surface shadow-sm"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
        >
          <Menu className="size-4" />
        </button>
        <AppHeader email={email} userId={userId} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

function scoreLevel(score: number): { label: string; color: string } {
  if (score >= 850) return { label: "Élite", color: "text-emerald-500" };
  if (score >= 700) return { label: "Premium", color: "text-yo-ac" };
  if (score >= 500) return { label: "Confiable", color: "text-yo-ac" };
  if (score >= 300) return { label: "Básico", color: "text-amber-500" };
  return { label: "Nuevo", color: "text-yo-txt-3" };
}

function RoleSelect({ role, setRole }: { role: ViewRole; setRole: (r: ViewRole) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const current = role === "seller"
    ? { icon: Store, label: "Vendedor" }
    : { icon: ShoppingCart, label: "Comprador" };
  const CurrentIcon = current.icon;

  return (
    <div className="relative" ref={ref}>
      <p className="px-1 text-[10px] uppercase tracking-[0.14em] font-semibold text-yo-txt-3 mb-1.5">Vista actual</p>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md border border-yo-border bg-yo-bg hover:bg-yo-raised transition text-left"
      >
        <CurrentIcon className="size-3.5 text-yo-ac shrink-0" />
        <span className="flex-1 text-[12.5px] font-semibold text-yo-txt truncate">{current.label}</span>
        <ChevronDown className={cn("size-3.5 text-yo-txt-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 left-0 right-0 z-50 rounded-md border border-yo-border bg-yo-surface shadow-lg overflow-hidden">
          {([
            { key: "seller" as ViewRole, icon: Store, label: "Vendedor" },
            { key: "buyer" as ViewRole, icon: ShoppingCart, label: "Comprador" },
          ]).map((opt) => {
            const Icon = opt.icon;
            const active = role === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => { setRole(opt.key); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-yo-raised",
                  active && "bg-yo-ac-bg/40"
                )}
              >
                <Icon className="size-3.5 text-yo-txt-3 shrink-0" />
                <span className="flex-1 text-[12.5px] font-medium text-yo-txt">{opt.label}</span>
                {active && <Check className="size-3.5 text-yo-ac" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SidebarContent({
  pathname, nav, role, setRole, sgyScore, onNavigate,
}: {
  pathname: string;
  nav: NavItem[];
  role: ViewRole;
  setRole: (r: ViewRole) => void;
  sgyScore: number;
  onNavigate?: () => void;
}) {
  const level = scoreLevel(sgyScore);
  const pct = Math.min(100, (sgyScore / 1000) * 100);

  return (
    <>
      <div className="px-5 py-5 border-b border-yo-border flex justify-center">
        <Link to="/dashboard" onClick={onNavigate} className="inline-flex items-center justify-center">
          <YoktoLogo variant="dark" className="h-6 w-auto" />
        </Link>
      </div>


      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {nav.map((item) => {
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

      <div className="border-t border-yo-border p-3 space-y-3">
        <Link
          to="/score"
          onClick={onNavigate}
          className="block rounded-md border border-yo-border bg-yo-bg p-3 hover:bg-yo-raised transition"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Star className="size-3.5 text-yo-ac" />
              <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-yo-txt-3">Score SGY</span>
            </div>
            <span className={cn("text-[11px] font-semibold", level.color)}>{level.label}</span>
          </div>
          <div className="flex items-baseline gap-1 mb-1.5">
            <span className="text-lg font-bold text-yo-txt tabular-nums">{sgyScore}</span>
            <span className="text-[10px] text-yo-txt-3">/ 1000</span>
          </div>
          <div className="h-1 w-full rounded-full bg-yo-border overflow-hidden">
            <div className="h-full bg-yo-ac rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </Link>

        <RoleSelect role={role} setRole={setRole} />
      </div>
    </>
  );
}
