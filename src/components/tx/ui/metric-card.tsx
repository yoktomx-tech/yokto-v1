import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Trend = { value: number; label?: string; direction?: "up" | "down" | "flat" };

type Props = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  trend?: Trend;
  tone?: "neutral" | "accent" | "ok" | "warn" | "err" | "info";
  /** Color hex para la línea superior de acento (2px). */
  topAccent?: string;
  className?: string;
};

const TONE_ACCENT: Record<NonNullable<Props["tone"]>, string> = {
  neutral: "text-yo-txt",
  accent:  "text-yo-ac",
  ok:      "text-[color:var(--yo-ok)]",
  warn:    "text-[color:var(--yo-warn)]",
  err:     "text-[color:var(--yo-err)]",
  info:    "text-[color:var(--yo-info)]",
};

export function MetricCard({ label, value, hint, icon, trend, tone = "neutral", className }: Props) {
  const dir = trend?.direction ?? (trend && trend.value > 0 ? "up" : trend && trend.value < 0 ? "down" : "flat");
  return (
    <div
      className={cn(
        "surface-card p-4 flex flex-col gap-2 transition-shadow hover:shadow-[var(--shadow-card-hover)]",
        className,
      )}
    >
      <div className="flex items-center justify-between text-yo-txt-2">
        <span className="text-[11px] uppercase tracking-wider font-medium">{label}</span>
        {icon && <span className="text-yo-txt-3">{icon}</span>}
      </div>
      <div className={cn("font-mono tabular-nums text-2xl font-semibold leading-none", TONE_ACCENT[tone])}>
        {value}
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-yo-txt-3">{hint}</span>
        {trend && (
          <span
            className={cn(
              "font-mono tabular-nums font-medium",
              dir === "up" && "text-[color:var(--yo-ok)]",
              dir === "down" && "text-[color:var(--yo-err)]",
              dir === "flat" && "text-yo-txt-3",
            )}
          >
            {dir === "up" && "▲ "}
            {dir === "down" && "▼ "}
            {Math.abs(trend.value)}%
            {trend.label && <span className="ml-1 text-yo-txt-3 font-normal">{trend.label}</span>}
          </span>
        )}
      </div>
    </div>
  );
}
