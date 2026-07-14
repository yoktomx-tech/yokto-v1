import { getSectorUi } from "@/lib/tx-catalog";
import { cn } from "@/lib/utils";

type Props = {
  sector: string | null | undefined;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
};

export function SectorBadge({ sector, size = "md", showLabel = true, className }: Props) {
  const cfg = getSectorUi(sector);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md font-medium",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
        className,
      )}
      style={{ backgroundColor: cfg.bg, color: cfg.txt }}
    >
      <span aria-hidden>{cfg.emoji}</span>
      {showLabel && <span>{cfg.label}</span>}
    </span>
  );
}
