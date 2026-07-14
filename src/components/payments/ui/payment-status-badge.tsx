import { UI_PAYMENT_STATUS, TONE_PILL, type UiPaymentStatus } from "@/lib/payments-catalog";
import { cn } from "@/lib/utils";

type Props = {
  status: UiPaymentStatus;
  size?: "sm" | "md";
  className?: string;
};

export function PaymentStatusBadge({ status, size = "md", className }: Props) {
  const cfg = UI_PAYMENT_STATUS[status];
  const tone = TONE_PILL[cfg.tone];
  return (
    <span
      title={cfg.description}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        tone.bg, tone.text, tone.border,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
      {cfg.label}
    </span>
  );
}
