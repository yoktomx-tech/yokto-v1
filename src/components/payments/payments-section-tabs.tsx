import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Banknote, Lock, Send, RotateCcw,
  Landmark, Percent, BookOpen, Scale, Webhook,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SectionId =
  | "resumen"
  | "depositos"
  | "retenciones"
  | "liberaciones"
  | "devoluciones"
  | "payouts"
  | "comisiones"
  | "ledger"
  | "conciliacion"
  | "webhooks";

type Section = { id: SectionId; label: string; icon: LucideIcon; adminOnly?: boolean };

const SECTIONS: Section[] = [
  { id: "resumen",       label: "Resumen",         icon: LayoutDashboard },
  { id: "depositos",     label: "Depósitos SPEI",  icon: Banknote },
  { id: "retenciones",   label: "Retenciones",     icon: Lock },
  { id: "liberaciones",  label: "Liberaciones",    icon: Send },
  { id: "devoluciones",  label: "Devoluciones",    icon: RotateCcw },
  { id: "payouts",       label: "Payouts",         icon: Landmark },
  { id: "comisiones",    label: "Comisiones",      icon: Percent },
  { id: "ledger",        label: "Movimientos",     icon: BookOpen },
  { id: "conciliacion",  label: "Conciliación",    icon: Scale },
  { id: "webhooks",      label: "Webhooks",        icon: Webhook, adminOnly: true },
];

interface Props {
  active: SectionId;
  onChange: (id: SectionId) => void;
  isAdmin?: boolean;
  counts?: Partial<Record<SectionId, number>>;
}

export function PaymentsSectionTabs({ active, onChange, isAdmin, counts }: Props) {
  const items = SECTIONS.filter((s) => !s.adminOnly || isAdmin);
  return (
    <div className="border-b border-yo-border overflow-x-auto">
      <div className="flex items-center gap-1 min-w-max">
        {items.map((s) => {
          const on = active === s.id;
          const count = counts?.[s.id];
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => onChange(s.id)}
              className={cn(
                "relative inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
                on ? "text-yo-ac" : "text-yo-t2 hover:text-yo-t1",
              )}
            >
              <Icon className="size-4" />
              {s.label}
              {typeof count === "number" && count > 0 && (
                <span className={cn(
                  "ml-0.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  on ? "bg-yo-ac-bg text-yo-ac-txt" : "bg-yo-bg2 text-yo-t2",
                )}>{count}</span>
              )}
              {on && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-yo-ac rounded-full" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
