import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Clock, Sparkles, ArrowRight, X, TrendingUp, CornerDownLeft } from "lucide-react";
import { useViewRole } from "@/hooks/use-view-role";
import { cn } from "@/lib/utils";

const RECENT_KEY = "yokto.search.recent";
const MAX_RECENT = 6;

// Search-term hints: things a user might type. Clicking pre-fills the input,
// it does NOT navigate to a module.
const HINTS_BUYER = [
  "Operaciones pendientes de aprobación",
  "Fondos retenidos por liberar",
  "Contrapartes con score bajo",
  "CFDI (PPD) por validar",
  "Contratos sin firmar",
  "Disputas abiertas",
  "Historial de pagos SPEI",
  "Comisiones del mes",
];

const HINTS_SELLER = [
  "Cobros liberados este mes",
  "Locks de cumplimiento activos",
  "REP (complemento de pago) pendientes",
  "Constancia de Situación Fiscal",
  "Operaciones por vencer SLA",
  "Contrapartes recurrentes",
  "Score de cumplimiento",
  "Depósitos en garantía",
];

const TRENDING_TERMS = [
  "cómo liberar fondos",
  "subir CFDI",
  "firmar contrato con e.firma",
  "abrir disputa",
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

  const q = query.trim();
  const qLower = q.toLowerCase();

  const baseHints = role === "buyer" ? HINTS_BUYER : HINTS_SELLER;

  const filteredHints = useMemo(() => {
    if (!qLower) return baseHints.slice(0, 6);
    return baseHints.filter((h) => h.toLowerCase().includes(qLower)).slice(0, 6);
  }, [qLower, baseHints]);

  useEffect(() => { setActiveIdx(0); }, [qLower, open]);

  function commitRecent(term: string) {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...recent.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENT);
    setRecent(next);
    saveRecent(next);
  }

  function runSearch(term: string) {
    const t = term.trim();
    if (!t) return;
    commitRecent(t);
    setOpen(false);
    setQuery("");
    navigate({ to: "/help", search: { q: t } as never });
  }

  function useHint(term: string) {
    setQuery(term);
    inputRef.current?.focus();
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

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(0, filteredHints.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (qLower && filteredHints[activeIdx]) {
        runSearch(filteredHints[activeIdx]);
      } else if (q) {
        runSearch(q);
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
                  Vista {role === "buyer" ? "Comprador" : "Vendedor"} · Enter para buscar · Esc para cerrar
                </p>
              </div>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {!qLower && recent.length > 0 && (
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
                      <button onClick={() => runSearch(r)} className="hover:text-yo-ac transition">
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
                {qLower ? "Sugerencias" : "Prueba buscar"}
              </p>
              {filteredHints.length > 0 ? (
                filteredHints.map((hint, i) => (
                  <button
                    key={hint}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => useHint(hint)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-yo-txt transition text-left group",
                      i === activeIdx ? "bg-yo-raised" : "hover:bg-yo-raised",
                    )}
                    title="Usar como búsqueda"
                  >
                    <Search className="size-3.5 text-yo-txt-3 shrink-0" />
                    <span className="flex-1 truncate">{hint}</span>
                    <CornerDownLeft className="size-3.5 text-yo-txt-3 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                  </button>
                ))
              ) : (
                <div className="px-2.5 py-4 text-center">
                  <p className="text-[12px] text-yo-txt-3">Sin sugerencias para “{q}”.</p>
                  <button
                    onClick={() => runSearch(q)}
                    className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-yo-ac hover:underline"
                  >
                    Buscar “{q}” de todos modos <ArrowRight className="size-3" />
                  </button>
                </div>
              )}
            </div>

            {!qLower && (
              <div className="p-2 border-t border-yo-border">
                <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-yo-txt-3 font-semibold flex items-center gap-1.5">
                  <TrendingUp className="size-3" /> Tendencias
                </p>
                <div className="flex flex-wrap gap-1.5 px-2 pt-1 pb-2">
                  {TRENDING_TERMS.map((t) => (
                    <button
                      key={t}
                      onClick={() => useHint(t)}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-yo-raised border border-yo-border text-[12px] text-yo-txt hover:border-yo-ac hover:text-yo-ac transition"
                    >
                      <TrendingUp className="size-3" />
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
