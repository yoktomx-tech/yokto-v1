import { getSectorUi } from "@/lib/tx-catalog";
import { getSectorIcon } from "@/lib/sector-icons";
import { cn } from "@/lib/utils";

type Props = {
  sector: string | null | undefined;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
};

export function SectorBadge({ sector, size = "md", showLabel = true, className }: Props) {
  const cfg = getSectorUi(sector);
  const Icon = getSectorIcon(sector);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md font-medium",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
        className,
      )}
      style={{ backgroundColor: cfg.bg, color: cfg.txt }}
    >
      <Icon aria-hidden className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {showLabel && <span>{cfg.label}</span>}
    </span>
  );
}
