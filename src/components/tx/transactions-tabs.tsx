import { cn } from "@/lib/utils";
import type { ViewRole } from "@/hooks/use-view-role";
import type { UiStatus } from "@/lib/tx-catalog";
import { toUiStatus } from "@/lib/tx-catalog";

// Grupos lógicos de estados por tab
export type TabId =
  | "ALL"
  | "ACTIVE"
  | "PENDING_FUNDING"
  | "IN_VERIFICATION"
  | "READY_FOR_APPROVAL"
  | "READY_TO_RELEASE"
  | "PENDING_DELIVERY"
  | "CHANGES_REQUESTED"
  | "DISPUTED"
  | "CLOSED"
  | "DRAFT"
  | "INVITED";

type TabDef = { id: TabId; label: string; match: (s: UiStatus) => boolean };

const ACTIVE_STATES: UiStatus[] = [
  "ACCEPTED", "PENDING_FUNDING", "FUNDED", "IN_PROGRESS", "IN_VERIFICATION", "READY_FOR_APPROVAL", "READY_TO_RELEASE", "PARTIALLY_RELEASED",
];
const CLOSED_STATES: UiStatus[] = ["RELEASED", "CLOSED", "REFUNDED", "CANCELLED"];

export const BUYER_TABS: TabDef[] = [
  { id: "ALL", label: "Todas", match: () => true },
  { id: "ACTIVE", label: "Activas", match: (s) => ACTIVE_STATES.includes(s) },
  { id: "PENDING_FUNDING", label: "Por fondear", match: (s) => s === "PENDING_FUNDING" },
  { id: "READY_FOR_APPROVAL", label: "Por aprobar", match: (s) => s === "READY_FOR_APPROVAL" },
  { id: "READY_TO_RELEASE", label: "Por liberar", match: (s) => s === "READY_TO_RELEASE" || s === "PARTIALLY_RELEASED" },
  { id: "DISPUTED", label: "En disputa", match: (s) => s === "DISPUTED" },
  { id: "CLOSED", label: "Cerradas", match: (s) => CLOSED_STATES.includes(s) },
  { id: "DRAFT", label: "Borradores", match: (s) => s === "DRAFT" },
];

export const SELLER_TABS: TabDef[] = [
  { id: "ALL", label: "Todas", match: () => true },
  { id: "INVITED", label: "Invitaciones", match: (s) => s === "INVITED" },
  { id: "ACTIVE", label: "Activas", match: (s) => ACTIVE_STATES.includes(s) },
  { id: "PENDING_DELIVERY", label: "Pendientes de entrega", match: (s) => s === "FUNDED" || s === "IN_PROGRESS" },
  { id: "IN_VERIFICATION", label: "En revisión", match: (s) => s === "IN_VERIFICATION" || s === "READY_FOR_APPROVAL" },
  { id: "CHANGES_REQUESTED", label: "Por corregir", match: (s) => s === "IN_VERIFICATION" },
  { id: "READY_TO_RELEASE", label: "Pagos por liberar", match: (s) => s === "READY_TO_RELEASE" || s === "PARTIALLY_RELEASED" },
  { id: "DISPUTED", label: "En disputa", match: (s) => s === "DISPUTED" },
  { id: "CLOSED", label: "Cerradas", match: (s) => CLOSED_STATES.includes(s) },
];

export function getTabs(role: ViewRole): TabDef[] {
  return role === "buyer" ? BUYER_TABS : SELLER_TABS;
}

export function countByTab(rows: { status: string }[], tabs: TabDef[]): Record<TabId, number> {
  const out = {} as Record<TabId, number>;
  for (const t of tabs) out[t.id] = 0;
  for (const r of rows) {
    const ui = toUiStatus(r.status);
    for (const t of tabs) if (t.match(ui)) out[t.id]++;
  }
  return out;
}

type TabsProps = {
  active: TabId;
  onChange: (id: TabId) => void;
  role: ViewRole;
  counts: Record<TabId, number>;
};

export function TransactionsTabs({ active, onChange, role, counts }: TabsProps) {
  const tabs = getTabs(role);
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
      {tabs.map((t) => {
        const isActive = active === t.id;
        const c = counts[t.id] ?? 0;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
              isActive
                ? "bg-yo-ac-bg text-yo-ac-txt border-yo-ac/20"
                : "bg-yo-surface text-yo-txt-2 border-yo-border hover:bg-yo-raised hover:text-yo-txt",
            )}
          >
            {t.label}
            {c > 0 && (
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[10px] font-semibold tabular-nums",
                  isActive ? "bg-yo-ac text-white" : "bg-yo-raised text-yo-txt-2",
                )}
              >
                {c}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
