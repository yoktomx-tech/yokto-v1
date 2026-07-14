import { Info, AlertTriangle, XCircle } from "lucide-react";
import { LEGAL_COPY } from "@/lib/payments-catalog";
import { cn } from "@/lib/utils";

type Variant = "info" | "warn" | "err";

const STYLES: Record<Variant, { bg: string; text: string; icon: typeof Info; border: string }> = {
  info: { bg: "bg-yo-info-bg",  text: "text-yo-info",   icon: Info,           border: "border-[#BAE6FD]" },
  warn: { bg: "bg-yo-warn-bg",  text: "text-[#B45309]", icon: AlertTriangle,  border: "border-[#FDE68A]" },
  err:  { bg: "bg-yo-err-bg",   text: "text-yo-err",    icon: XCircle,        border: "border-[#FECACA]" },
};

type Props = {
  variant?: Variant;
  title?: string;
  message?: string;
  className?: string;
};

export function NoCustodyBanner({ variant = "info", title, message, className }: Props) {
  const s = STYLES[variant];
  const Icon = s.icon;
  const text = message ?? LEGAL_COPY.noCustody;
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4",
        s.bg, s.text, s.border,
        className,
      )}
    >
      <Icon className="size-5 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold text-sm mb-0.5">{title}</p>}
        <p className="text-[13px] leading-relaxed">{text}</p>
      </div>
    </div>
  );
}
