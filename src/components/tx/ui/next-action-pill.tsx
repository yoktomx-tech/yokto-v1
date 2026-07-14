import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

type Tone = "info" | "warn" | "accent" | "ok" | "err" | "neutral";

const CLASSES: Record<Tone, string> = {
  neutral: "bg-yo-raised text-yo-txt-2",
  info:    "bg-yo-info-bg text-[color:var(--yo-info)]",
  warn:    "bg-yo-warn-bg text-[color:var(--yo-warn)]",
  accent:  "bg-yo-ac-bg text-yo-ac-txt",
  ok:      "bg-yo-ok-bg text-[color:var(--yo-ok)]",
  err:     "bg-yo-err-bg text-[color:var(--yo-err)]",
};

type Props = {
  tone?: Tone;
  children: ReactNode;
  className?: string;
};

/** Pill compacta para "Próxima acción" en tabla y detalle. */
export function NextActionPill({ tone = "warn", children, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium max-w-[220px]",
        CLASSES[tone],
        className,
      )}
    >
      <ArrowRight className="h-3 w-3 shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  );
}
