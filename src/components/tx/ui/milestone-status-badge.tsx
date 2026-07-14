import { MILESTONE_STATUS_CFG, TONE_CLASSES, type MilestoneStatus } from "@/lib/tx-catalog";
import { cn } from "@/lib/utils";

type Props = {
  status: MilestoneStatus | string | null | undefined;
  size?: "sm" | "md";
  className?: string;
};

export function MilestoneStatusBadge({ status, size = "md", className }: Props) {
  const key = (status ?? "PENDING") as MilestoneStatus;
  const cfg = MILESTONE_STATUS_CFG[key] ?? MILESTONE_STATUS_CFG.PENDING;
  const tone = TONE_CLASSES[cfg.tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        tone.pill,
        className,
      )}
      title={cfg.description}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
      {cfg.label}
    </span>
  );
}
