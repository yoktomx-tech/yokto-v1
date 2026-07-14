import { RISK_CFG, TONE_CLASSES, type RiskLevel } from "@/lib/tx-catalog";
import { cn } from "@/lib/utils";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

const ICONS: Record<RiskLevel, React.ReactNode> = {
  LOW:    <ShieldCheck className="h-3.5 w-3.5" />,
  MEDIUM: <ShieldAlert className="h-3.5 w-3.5" />,
  HIGH:   <ShieldX className="h-3.5 w-3.5" />,
};

type Props = {
  level: RiskLevel | string | null | undefined;
  size?: "sm" | "md";
  className?: string;
};

export function RiskIndicator({ level, size = "md", className }: Props) {
  const key = (level ?? "LOW") as RiskLevel;
  const cfg = RISK_CFG[key] ?? RISK_CFG.LOW;
  const tone = TONE_CLASSES[cfg.tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        tone.pill,
        className,
      )}
      title={cfg.description}
    >
      {ICONS[key] ?? ICONS.LOW}
      {cfg.label}
    </span>
  );
}
