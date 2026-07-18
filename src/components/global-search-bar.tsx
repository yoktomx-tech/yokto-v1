import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Search, Clock, Sparkles, ArrowRight, X, TrendingUp,
  FileText, Users, CreditCard, Scale, ShieldCheck, LifeBuoy,
  BarChart3, FileCheck,
} from "lucide-react";
import { useViewRole } from "@/hooks/use-view-role";
import { cn } from "@/lib/utils";

type Suggestion = {
  label: string;
  to: string;
  icon: typeof Search;
  hint?: string;
};

const RECENT_KEY = "yokto.search.recent";
const MAX_RECENT = 6;

const QUICK_LINKS: Suggestion[] = [
  { label: "Nueva operación", to: "/transactions/new", icon: CreditCard, hint: "Crear escrow" },
  { label: "Mis operaciones", to: "/transactions", icon: FileText },
  { label: "Aprobaciones pendientes", to: "/approvals", icon: FileCheck, hint: "Comprador" },
  { label: "Contrapartes (CRM)", to: "/crm", icon: Users },
  { label: "Centro de pagos", to: "/payments", icon: CreditCard },
  { label: "Disputas", to: "/disputes", icon: Scale },
  { label: "Cumplimiento", to: "/cumplimiento", icon: ShieldCheck, hint: "Vendedor" },
  { label: "Perfil de cumplimiento", to: "/score", icon: BarChart3 },
  { label: "Analytics", to: "/analytics", icon: BarChart3 },
  { label: "Centro de ayuda", to: "/help", icon: LifeBuoy },
  { label: "Mis tickets", to: "/support/tickets", icon: LifeBuoy },
  { label: "Estado de plataforma", to: "/support/status", icon: ShieldCheck },
];

const TRENDING: Suggestion[] = [
  { label: "Liberar fondos retenidos", to: "/payments", icon: TrendingUp },
  { label: "Firmar contrato pendiente", to: "/approvals", icon: TrendingUp },
  { label: "Cargar CFDI (PPD)", to: "/payments/fiscal", icon: TrendingUp },
];

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {}
}

export function GlobalSearchBar() {
  const navigate = useNavigate();
  const { role } = useViewRole();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setRecent(loadRecent()); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return QUICK_LINKS.slice(0, 8);
    return QUICK_LINKS.filter((s) => s.label.toLowerCase().includes(q)).slice(0, 8);
  }, [q]);

  useEffect(() => { setActiveIdx(0); }, [q, open]);

  function commitRecent(term: string) {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...recent.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENT);
    setRecent(next);
    saveRecent(next);
  }

  function goTo(to: string, label?: string) {
    if (label) commitRecent(label);
    setOpen(false);
    setQuery("");
    navigate({ to });
  }

  function submitFreeText(term: string) {
    const t = term.trim();
    if (!t) return;
    commitRecent(t);
    setOpen(false);
    setQuery("");
    navigate({ to: "/help", search: { q: t } as never });
  }

  function removeRecent(term: string) {
    const next = recent.filter((r) => r !== term);
    setRecent(next);
    saveRecent(next);
  }

  function clearRecent() {
    setRecent([]);
    saveRecent([]);
  }

  const showResultsList = filtered.length > 0;
  const totalNav = filtered.length;

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(0, totalNav - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (q && filtered[activeIdx]) {
        const item = filtered[activeIdx];
        goTo(item.to, item.label);
      } else if (q) {
        submitFreeText(q);
      }
    }
  }

  return (
    <div ref={rootRef} className="hidden md:flex flex-1 max-w-xl relative">
      <Search className="size-4 text-yo-txt-2 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Buscar operaciones, contrapartes, documentos…"
        className="w-full h-9 pl-9 pr-14 rounded-md bg-yo-raised border border-yo-border text-sm text-yo-txt placeholder:text-yo-txt-2 focus:outline-none focus:ring-2 focus:ring-yo-ac/40 focus:border-yo-ac"
      />
      <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded border border-yo-border text-yo-txt-3 bg-yo-surface pointer-events-none">⌘K</kbd>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl border border-yo-border bg-yo-surface shadow-xl overflow-hidden">
          <div className="p-3 border-b border-yo-border bg-yo-ac-bg">
            <div className="flex items-center gap-2">
              <div className="size-8 grid place-items-center rounded-lg bg-yo-ac text-white">
                <Search className="size-4" />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-yo-txt">Búsqueda global</p>
                <p className="text-[11px] text-yo-txt-3">
                  Vista {role === "buyer" ? "Comprador" : "Vendedor"} · Enter para ir · Esc para cerrar
                </p>
              </div>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {!q && recent.length > 0 && (
              <div className="p-2 border-b border-yo-border">
                <div className="flex items-center justify-between px-2 py-1">
                  <p className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-semibold flex items-center gap-1.5">
                    <Clock className="size-3" /> Búsquedas recientes
                  </p>
                  <button
                    onClick={clearRecent}
                    className="text-[10px] text-yo-txt-3 hover:text-yo-txt transition"
                  >
                    Limpiar
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 px-2 pt-1 pb-2">
                  {recent.map((r) => (
                    <span key={r} className="group inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full bg-yo-raised border border-yo-border text-[12px] text-yo-txt">
                      <button onClick={() => { setQuery(r); inputRef.current?.focus(); }} className="hover:text-yo-ac transition">
                        {r}
                      </button>
                      <button
                        onClick={() => removeRecent(r)}
                        aria-label={`Quitar ${r}`}
                        className="size-4 grid place-items-center rounded-full text-yo-txt-3 hover:text-yo-err hover:bg-yo-bg transition"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="p-2">
              <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-yo-txt-3 font-semibold flex items-center gap-1.5">
                <Sparkles className="size-3" />
                {q ? "Resultados" : "Sugerencias rápidas"}
              </p>
              {showResultsList ? (
                filtered.map((s, i) => (
                  <button
                    key={s.to + s.label}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => goTo(s.to, s.label)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-yo-txt transition text-left",
                      i === activeIdx ? "bg-yo-raised" : "hover:bg-yo-raised",
                    )}
                  >
                    <s.icon className="size-4 text-yo-txt-3 shrink-0" />
                    <span className="flex-1 truncate">{s.label}</span>
                    {s.hint && (
                      <span className="text-[10px] text-yo-txt-3 px-1.5 py-0.5 rounded border border-yo-border">{s.hint}</span>
                    )}
                    <ArrowRight className="size-3.5 text-yo-txt-3 shrink-0" />
                  </button>
                ))
              ) : (
                <div className="px-2.5 py-4 text-center">
                  <p className="text-[12px] text-yo-txt-3">Sin coincidencias directas.</p>
                  <button
                    onClick={() => submitFreeText(q)}
                    className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-yo-ac hover:underline"
                  >
                    Buscar “{q}” en Centro de ayuda <ArrowRight className="size-3" />
                  </button>
                </div>
              )}
            </div>

            {!q && (
              <div className="p-2 border-t border-yo-border">
                <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-yo-txt-3 font-semibold flex items-center gap-1.5">
                  <TrendingUp className="size-3" /> Tendencias
                </p>
                {TRENDING.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => goTo(t.to, t.label)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-yo-txt hover:bg-yo-raised transition text-left"
                  >
                    <t.icon className="size-4 text-yo-txt-3 shrink-0" />
                    <span className="flex-1 truncate">{t.label}</span>
                    <ArrowRight className="size-3.5 text-yo-txt-3 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
