import { cn } from "@/lib/utils";
import type { ViewRole } from "@/hooks/use-view-role";
import type { UiStatus } from "@/lib/tx-catalog";
import { toUiStatus } from "@/lib/tx-catalog";

// Grupos lógicos de estados por tab
export type TabId =
  | "ALL"
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "CHANGES_REQUESTED"
  | "PENDING_SIGNATURE"
  | "PARTIALLY_SIGNED"
  | "PENDING_FUNDING"
  | "FUNDED"
  | "ACTIVE"
  | "IN_VERIFICATION"
  | "READY_TO_RELEASE"
  | "DISPUTED"
  | "CLOSED";

type TabDef = { id: TabId; label: string; match: (s: UiStatus) => boolean; principal?: boolean };

const ACTIVE_STATES: UiStatus[] = [
  "ACCEPTED", "FULLY_SIGNED", "FUNDED", "IN_PROGRESS", "IN_VERIFICATION", "READY_FOR_APPROVAL", "READY_TO_RELEASE", "PARTIALLY_RELEASED",
];
const CLOSED_STATES: UiStatus[] = ["RELEASED", "CLOSED", "REFUNDED", "CANCELLED"];

// Tabs comunes: los `principal:true` se muestran siempre; el resto sólo si count>0.
const COMMON_TABS: TabDef[] = [
  { id: "ALL",                label: "Todas",                    match: () => true, principal: true },
  { id: "DRAFT",              label: "Borradores",               match: (s) => s === "DRAFT", principal: true },
  { id: "PENDING_APPROVAL",   label: "Pendiente aprobación",     match: (s) => s === "PENDING_APPROVAL" },
  { id: "CHANGES_REQUESTED",  label: "Cambios solicitados",      match: (s) => s === "CHANGES_REQUESTED" },
  { id: "PENDING_SIGNATURE",  label: "Pendiente firma",          match: (s) => s === "PENDING_SIGNATURE" },
  { id: "PARTIALLY_SIGNED",   label: "Firma parcial",            match: (s) => s === "PARTIALLY_SIGNED" },
  { id: "PENDING_FUNDING",    label: "Esperando fondeo",         match: (s) => s === "PENDING_FUNDING", principal: true },
  { id: "FUNDED",             label: "Fondos retenidos",         match: (s) => s === "FUNDED" },
  { id: "ACTIVE",             label: "En cumplimiento",          match: (s) => ACTIVE_STATES.includes(s), principal: true },
  { id: "IN_VERIFICATION",    label: "En verificación",          match: (s) => s === "IN_VERIFICATION" || s === "READY_FOR_APPROVAL", principal: true },
  { id: "READY_TO_RELEASE",   label: "Lista para liberar",       match: (s) => s === "READY_TO_RELEASE" || s === "PARTIALLY_RELEASED", principal: true },
  { id: "DISPUTED",           label: "En disputa",               match: (s) => s === "DISPUTED", principal: true },
  { id: "CLOSED",             label: "Completadas",              match: (s) => CLOSED_STATES.includes(s), principal: true },
];

export const BUYER_TABS: TabDef[] = COMMON_TABS;
export const SELLER_TABS: TabDef[] = COMMON_TABS;

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
