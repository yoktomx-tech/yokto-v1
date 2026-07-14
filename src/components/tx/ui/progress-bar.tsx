import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: number; // 0..1 or 0..max
  max?: number;
  label?: ReactNode;
  right?: ReactNode;
  tone?: "accent" | "ok" | "warn" | "err";
  height?: "sm" | "md";
  className?: string;
};

const BAR: Record<NonNullable<Props["tone"]>, string> = {
  accent: "bg-yo-ac",
  ok:     "bg-[color:var(--yo-ok)]",
  warn:   "bg-[color:var(--yo-warn)]",
  err:    "bg-[color:var(--yo-err)]",
};

export function ProgressBar({
  value,
  max = 1,
  label,
  right,
  tone = "accent",
  height = "sm",
  className,
}: Props) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className={cn("w-full flex flex-col gap-1", className)}>
      {(label || right) && (
        <div className="flex items-center justify-between text-[11px] text-yo-txt-2">
          <span>{label}</span>
          <span className="font-mono tabular-nums">{right}</span>
        </div>
      )}
      <div className={cn("w-full overflow-hidden rounded-full bg-yo-raised", height === "sm" ? "h-1.5" : "h-2.5")}>
        <div
          className={cn("h-full rounded-full transition-[width] duration-500 ease-out", BAR[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
