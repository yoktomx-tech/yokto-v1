import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Clock, Sparkles, ArrowRight, X, TrendingUp, CornerDownLeft,
  FileText, Scale, LifeBuoy, BookOpen, Compass, Loader2,
} from "lucide-react";
import { useViewRole } from "@/hooks/use-view-role";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { cn } from "@/lib/utils";
import { NAV_INDEX, type NavEntry } from "@/lib/nav-index";
import { globalSearch, type SearchHit, type SearchKind } from "@/lib/global-search.functions";

const RECENT_KEY = "yokto.search.recent";
const MAX_RECENT = 6;

const HINTS_BUYER = [
  "Operaciones pendientes",
  "Fondos retenidos",
  "CFDI (PPD) por validar",
  "Contratos sin firmar",
];
const HINTS_SELLER = [
  "Cobros liberados",
  "Locks de cumplimiento",
  "Complementos de pago (REP)",
  "Score de cumplimiento",
];

type FilterKey = "all" | "nav" | SearchKind;

const FILTERS: { key: FilterKey; label: string; hotkey: string }[] = [
  { key: "all",         label: "Todo",       hotkey: "0" },
  { key: "nav",         label: "Pantallas",  hotkey: "1" },
  { key: "transaction", label: "Operaciones",hotkey: "2" },
  { key: "dispute",     label: "Disputas",   hotkey: "3" },
  { key: "ticket",      label: "Tickets",    hotkey: "4" },
  { key: "article",     label: "Artículos",  hotkey: "5" },
];

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").slice(0, MAX_RECENT) : [];
  } catch { return []; }
}
function saveRecent(list: string[]) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT))); } catch {}
}

function useDebounced<T>(value: T, ms = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function scoreNav(q: string, e: NavEntry): number {
  const label = e.label.toLowerCase();
  const kw = e.keywords.toLowerCase();
  const grp = e.group.toLowerCase();
  if (label === q) return 100;
  if (label.startsWith(q)) return 80;
  // word-boundary in keywords / group
  if (new RegExp(`(^|[\\s./_-])${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(kw)) return 55;
  if (label.includes(q)) return 45;
  if (kw.includes(q)) return 25;
  if (grp.includes(q)) return 15;
  return 0;
}

const HIT_ICON: Record<SearchKind, typeof FileText> = {
  transaction: FileText,
  dispute: Scale,
  ticket: LifeBuoy,
  article: BookOpen,
};
const HIT_LABEL: Record<SearchKind, string> = {
  transaction: "Operación",
  dispute: "Disputa",
  ticket: "Ticket",
  article: "Artículo",
};

/** Highlight all case-insensitive occurrences of `q` in `text`. */
function Highlight({ text, q }: { text: string | null | undefined; q: string }) {
  if (!text) return null;
  if (!q) return <>{text}</>;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        re.test(p) && p.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="bg-yo-ac/25 text-yo-txt rounded-sm px-0.5">{p}</mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function GlobalSearchBar() {
  const navigate = useNavigate();
  const { role } = useViewRole();
  const { currentOrg } = useCurrentOrg();
  const orgId = currentOrg?.id ?? null;

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [filter, setFilter] = useState<FilterKey>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const q = query.trim();
  const qLower = q.toLowerCase();
  const debounced = useDebounced(qLower, 220);

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

  // Screens & options (in-memory, ranked)
  const navMatches = useMemo(() => {
    if (!qLower) return [];
    return NAV_INDEX
      .map((e) => ({ e, s: scoreNav(qLower, e) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 10)
      .map((x) => x.e);
  }, [qLower]);

  // Records (async, debounced, cached, tenant-scoped)
  const runSearch = useServerFn(globalSearch);
  const { data: hits = [], isFetching } = useQuery({
    queryKey: ["global-search", debounced, orgId],
    queryFn: () => runSearch({ data: { q: debounced, orgId } }),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: 0, nav: navMatches.length,
      transaction: 0, dispute: 0, ticket: 0, article: 0,
    };
    for (const h of hits) c[h.kind]++;
    c.all = navMatches.length + hits.length;
    return c;
  }, [navMatches, hits]);

  // Filtered combined list
  type Row =
    | { kind: "nav"; entry: NavEntry }
    | { kind: "hit"; hit: SearchHit };
  const rows: Row[] = useMemo(() => {
    const navRows: Row[] = (filter === "all" || filter === "nav")
      ? navMatches.map((entry) => ({ kind: "nav", entry }))
      : [];
    const hitRows: Row[] = (filter === "all")
      ? hits.map((hit) => ({ kind: "hit", hit }))
      : (filter === "nav")
        ? []
        : hits.filter((h) => h.kind === filter).map((hit) => ({ kind: "hit", hit }));
    return [...navRows, ...hitRows];
  }, [navMatches, hits, filter]);

  useEffect(() => { setActiveIdx(0); }, [qLower, open, filter]);

  // Keyboard: Alt/Ctrl+digit switches category
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.altKey || e.ctrlKey)) return;
      const f = FILTERS.find((x) => x.hotkey === e.key);
      if (f) { e.preventDefault(); setFilter(f.key); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function commitRecent(term: string) {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...recent.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENT);
    setRecent(next); saveRecent(next);
  }
  function goTo(to: string, term?: string) {
    if (term) commitRecent(term);
    setOpen(false); setQuery("");
    navigate({ to });
  }
  function searchInHelp(term: string) {
    const t = term.trim(); if (!t) return;
    commitRecent(t);
    setOpen(false); setQuery("");
    navigate({ to: "/help", search: { q: t } as never });
  }
  function useHint(term: string) { setQuery(term); inputRef.current?.focus(); }
  function removeRecent(term: string) {
    const next = recent.filter((r) => r !== term);
    setRecent(next); saveRecent(next);
  }
  function clearRecent() { setRecent([]); saveRecent([]); }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Tab" && qLower) {
      e.preventDefault();
      const enabled = FILTERS.filter((f) => counts[f.key] > 0 || f.key === "all");
      const i = enabled.findIndex((f) => f.key === filter);
      const next = enabled[(i + (e.shiftKey ? -1 + enabled.length : 1)) % enabled.length];
      if (next) setFilter(next.key);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(0, rows.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[activeIdx];
      if (row) {
        if (row.kind === "nav") goTo(row.entry.to, row.entry.label);
        else goTo(row.hit.to, row.hit.title);
      } else if (q) {
        searchInHelp(q);
      }
    }
  }

  const showEmptyState = qLower.length >= 2 && !isFetching && rows.length === 0;
  const hintsList = role === "buyer" ? HINTS_BUYER : HINTS_SELLER;

  const navRowsRender = rows.filter((r): r is { kind: "nav"; entry: NavEntry } => r.kind === "nav");
  const hitRowsRender = rows.filter((r): r is { kind: "hit"; hit: SearchHit } => r.kind === "hit");

  let cursor = 0;

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
        placeholder="Buscar pantallas, operaciones, disputas, tickets…"
        className="w-full h-9 pl-9 pr-14 rounded-md bg-yo-raised border border-yo-border text-sm text-yo-txt placeholder:text-yo-txt-2 focus:outline-none focus:ring-2 focus:ring-yo-ac/40 focus:border-yo-ac"
      />
      <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded border border-yo-border text-yo-txt-3 bg-yo-surface pointer-events-none">⌘K</kbd>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl border border-yo-border bg-yo-surface shadow-xl overflow-hidden">
          <div className="p-3 border-b border-yo-border bg-yo-ac-bg">
            <div className="flex items-center gap-2">
              <div className="size-8 grid place-items-center rounded-lg bg-yo-ac text-white">
                {isFetching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-yo-txt">Búsqueda global</p>
                <p className="text-[11px] text-yo-txt-3">
                  Pantallas, operaciones, disputas, tickets y ayuda · Tab cambia categoría · ⌥+número salta
                </p>
              </div>
            </div>
          </div>

          {/* Category chips (only with query) */}
          {qLower && (
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-yo-border overflow-x-auto">
              {FILTERS.map((f) => {
                const n = counts[f.key];
                const disabled = f.key !== "all" && n === 0;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    disabled={disabled}
                    className={cn(
                      "inline-flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-full text-[11px] font-medium border transition",
                      filter === f.key
                        ? "bg-yo-ac text-white border-yo-ac"
                        : disabled
                          ? "border-yo-border text-yo-txt-3 opacity-50 cursor-not-allowed"
                          : "border-yo-border text-yo-txt hover:border-yo-ac hover:text-yo-ac",
                    )}
                  >
                    <span>{f.label}</span>
                    <span className={cn(
                      "px-1 rounded text-[10px] font-mono",
                      filter === f.key ? "bg-white/20" : "bg-yo-raised text-yo-txt-3",
                    )}>{n}</span>
                    <kbd className={cn(
                      "text-[9px] font-mono opacity-60",
                      filter === f.key ? "text-white/80" : "text-yo-txt-3",
                    )}>⌥{f.hotkey}</kbd>
                  </button>
                );
              })}
            </div>
          )}

          <div className="max-h-[440px] overflow-y-auto">
            {/* Idle: recientes + sugerencias */}
            {!qLower && (
              <>
                {recent.length > 0 && (
                  <div className="p-2 border-b border-yo-border">
                    <div className="flex items-center justify-between px-2 py-1">
                      <p className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-semibold flex items-center gap-1.5">
                        <Clock className="size-3" /> Búsquedas recientes
                      </p>
                      <button onClick={clearRecent} className="text-[10px] text-yo-txt-3 hover:text-yo-txt transition">Limpiar</button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 px-2 pt-1 pb-2">
                      {recent.map((r) => (
                        <span key={r} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full bg-yo-raised border border-yo-border text-[12px] text-yo-txt">
                          <button onClick={() => { setQuery(r); inputRef.current?.focus(); }} className="hover:text-yo-ac transition">{r}</button>
                          <button
                            onClick={() => removeRecent(r)}
                            aria-label={`Quitar ${r}`}
                            className="size-4 grid place-items-center rounded-full text-yo-txt-3 hover:text-yo-err hover:bg-yo-bg transition"
                          ><X className="size-3" /></button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-2">
                  <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-yo-txt-3 font-semibold flex items-center gap-1.5">
                    <Sparkles className="size-3" /> Prueba buscar
                  </p>
                  {hintsList.map((hint) => (
                    <button
                      key={hint}
                      onClick={() => useHint(hint)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-yo-txt hover:bg-yo-raised transition text-left group"
                    >
                      <Search className="size-3.5 text-yo-txt-3 shrink-0" />
                      <span className="flex-1 truncate">{hint}</span>
                      <CornerDownLeft className="size-3.5 text-yo-txt-3 shrink-0 opacity-0 group-hover:opacity-100 transition" />
                    </button>
                  ))}
                </div>

                <div className="p-2 border-t border-yo-border">
                  <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-yo-txt-3 font-semibold flex items-center gap-1.5">
                    <TrendingUp className="size-3" /> Tendencias
                  </p>
                  <div className="flex flex-wrap gap-1.5 px-2 pt-1 pb-2">
                    {["cómo liberar fondos", "subir CFDI", "firmar contrato", "abrir disputa"].map((t) => (
                      <button
                        key={t}
                        onClick={() => useHint(t)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-yo-raised border border-yo-border text-[12px] text-yo-txt hover:border-yo-ac hover:text-yo-ac transition"
                      >
                        <TrendingUp className="size-3" />{t}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Con query: pantallas + registros */}
            {qLower && (
              <>
                {navRowsRender.length > 0 && (
                  <div className="p-2 border-b border-yo-border">
                    <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-yo-txt-3 font-semibold flex items-center gap-1.5">
                      <Compass className="size-3" /> Pantallas
                    </p>
                    {navRowsRender.map(({ entry }) => {
                      const idx = cursor++;
                      return (
                        <button
                          key={entry.to + entry.label}
                          onMouseEnter={() => setActiveIdx(idx)}
                          onClick={() => goTo(entry.to, entry.label)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-yo-txt transition text-left",
                            idx === activeIdx ? "bg-yo-raised" : "hover:bg-yo-raised",
                          )}
                        >
                          <Compass className="size-4 text-yo-txt-3 shrink-0" />
                          <span className="flex-1 truncate"><Highlight text={entry.label} q={qLower} /></span>
                          <span className="text-[10px] uppercase tracking-wider text-yo-ac bg-yo-ac-bg px-1.5 py-0.5 rounded shrink-0">Pantalla</span>
                          <span className="text-[10px] text-yo-txt-3 px-1.5 py-0.5 rounded border border-yo-border shrink-0">{entry.group}</span>
                          <ArrowRight className="size-3.5 text-yo-txt-3 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}

                {hitRowsRender.length > 0 && (
                  <div className="p-2">
                    <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-yo-txt-3 font-semibold flex items-center gap-1.5">
                      <FileText className="size-3" /> Registros
                    </p>
                    {hitRowsRender.map(({ hit }) => {
                      const Icon = HIT_ICON[hit.kind];
                      const idx = cursor++;
                      return (
                        <button
                          key={hit.kind + hit.id}
                          onMouseEnter={() => setActiveIdx(idx)}
                          onClick={() => goTo(hit.to, hit.title)}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-yo-txt transition text-left",
                            idx === activeIdx ? "bg-yo-raised" : "hover:bg-yo-raised",
                          )}
                        >
                          <Icon className="size-4 text-yo-txt-3 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium truncate"><Highlight text={hit.title} q={qLower} /></span>
                              <span className="text-[10px] uppercase tracking-wider text-yo-ac bg-yo-ac-bg px-1.5 py-0.5 rounded shrink-0">
                                {HIT_LABEL[hit.kind]}
                              </span>
                            </div>
                            {hit.subtitle && (
                              <p className="text-[11px] text-yo-txt-3 truncate">
                                <Highlight text={hit.subtitle} q={qLower} />
                              </p>
                            )}
                          </div>
                          {hit.meta && (
                            <span className="text-[10px] text-yo-txt-3 uppercase tracking-wider shrink-0">{hit.meta}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {qLower.length < 2 && (
                  <div className="px-3 py-4 text-center text-[12px] text-yo-txt-3">
                    Escribe al menos 2 caracteres para buscar registros…
                  </div>
                )}

                {showEmptyState && (
                  <div className="px-3 py-6 text-center">
                    <p className="text-[12px] text-yo-txt-3">Sin resultados para “{q}”.</p>
                    <button
                      onClick={() => searchInHelp(q)}
                      className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-yo-ac hover:underline"
                    >
                      Buscar “{q}” en Centro de ayuda <ArrowRight className="size-3" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
