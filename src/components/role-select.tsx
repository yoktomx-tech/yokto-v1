import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, Store, ShoppingCart } from "lucide-react";
import { useViewRole, type ViewRole } from "@/hooks/use-view-role";
import { cn } from "@/lib/utils";

const ROLE_DESC: Record<ViewRole, string> = {
  seller: "Envías hitos y evidencia para liberar pagos.",
  buyer: "Fondeas operaciones y apruebas hitos entregados.",
};

const OPTS: { key: ViewRole; icon: typeof Store; label: string }[] = [
  { key: "seller", icon: Store, label: "Vendedor" },
  { key: "buyer", icon: ShoppingCart, label: "Comprador" },
];

/** Compact selector for the top header. */
export function RoleSelectHeader() {
  const { role, setRole } = useViewRole();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const current = OPTS.find((o) => o.key === role)!;
  const CurrentIcon = current.icon;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 h-9 px-2.5 rounded-md border border-yo-border bg-yo-bg hover:bg-yo-raised transition"
        aria-label="Cambiar vista"
        title={ROLE_DESC[role]}
      >
        <CurrentIcon className="size-3.5 text-yo-ac shrink-0" />
        <div className="flex flex-col leading-tight text-left">
          <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-yo-txt-3">
            Vista
          </span>
          <span className="text-[12.5px] font-semibold text-yo-txt">{current.label}</span>
        </div>
        <ChevronDown className={cn("size-3.5 text-yo-txt-3 transition-transform ml-0.5", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 z-50 w-64 rounded-md border border-yo-border bg-yo-surface shadow-lg overflow-hidden">
          <div className="px-2.5 pt-2 pb-1 text-[10px] uppercase tracking-[0.14em] font-semibold text-yo-txt-3">
            Vista actual
          </div>
          {OPTS.map((opt) => {
            const Icon = opt.icon;
            const active = role === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => { setRole(opt.key); setOpen(false); }}
                className={cn(
                  "w-full flex items-start gap-2 px-2.5 py-2 text-left hover:bg-yo-raised",
                  active && "bg-yo-ac-bg/40"
                )}
              >
                <Icon className="size-3.5 text-yo-txt-3 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12.5px] font-medium text-yo-txt">{opt.label}</span>
                    {active && <Check className="size-3 text-yo-ac" />}
                  </div>
                  <p className="text-[10.5px] leading-tight text-yo-txt-3 mt-0.5">{ROLE_DESC[opt.key]}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
