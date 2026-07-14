import { tabsForRole, type PaymentRow, type TabId, matchesTab } from "@/lib/payments-catalog";
import type { ViewRole } from "@/hooks/use-view-role";
import { cn } from "@/lib/utils";

type Props = {
  role: ViewRole;
  rows: PaymentRow[];
  active: TabId;
  onChange: (t: TabId) => void;
};

export function PaymentsTabs({ role, rows, active, onChange }: Props) {
  const tabs = tabsForRole(role);
  return (
    <div className="flex flex-wrap gap-1 border-b border-yo-border">
      {tabs.map((t) => {
        const count = rows.filter((r) => matchesTab(r, t.id)).length;
        const on = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative px-3 py-2 text-sm font-medium transition-colors",
              on ? "text-yo-ac" : "text-yo-t2 hover:text-yo-t1",
            )}
          >
            {t.label}
            <span className={cn(
              "ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              on ? "bg-yo-ac-bg text-yo-ac-txt" : "bg-yo-bg2 text-yo-t2",
            )}>{count}</span>
            {on && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-yo-ac rounded-full" />}
          </button>
        );
      })}
    </div>
  );
}
