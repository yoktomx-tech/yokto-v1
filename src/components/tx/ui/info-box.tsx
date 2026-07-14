import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Info, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

type Tone = "info" | "warn" | "ok" | "err";

const ICONS: Record<Tone, ReactNode> = {
  info: <Info className="h-4 w-4" />,
  warn: <AlertTriangle className="h-4 w-4" />,
  ok:   <CheckCircle2 className="h-4 w-4" />,
  err:  <XCircle className="h-4 w-4" />,
};

const CLASSES: Record<Tone, string> = {
  info: "bg-yo-info-bg text-[color:var(--yo-info)] border-[color:var(--yo-info)]/20",
  warn: "bg-yo-warn-bg text-[color:var(--yo-warn)] border-[color:var(--yo-warn)]/20",
  ok:   "bg-yo-ok-bg text-[color:var(--yo-ok)] border-[color:var(--yo-ok)]/20",
  err:  "bg-yo-err-bg text-[color:var(--yo-err)] border-[color:var(--yo-err)]/20",
};

type Props = {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function InfoBox({ tone = "info", title, children, className }: Props) {
  return (
    <div className={cn("rounded-lg border px-3 py-2.5 flex items-start gap-2.5 text-xs", CLASSES[tone], className)}>
      <span className="mt-0.5">{ICONS[tone]}</span>
      <div className="flex-1 min-w-0">
        {title && <div className="font-semibold mb-0.5">{title}</div>}
        {children && <div className="text-yo-txt-2 leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}
