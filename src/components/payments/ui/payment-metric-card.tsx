import type { LucideIcon } from "lucide-react";
import { formatMoney, TONE_ACCENT_LINE, type StatusTone } from "@/lib/payments-catalog";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  amountCents?: number;
  count?: number;
  currency?: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: StatusTone;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
};

export function PaymentMetricCard({
  title, amountCents, count, currency = "MXN", hint, icon: Icon, tone = "neutral", loading, actionLabel, onAction,
}: Props) {
  return (
    <div className="surface-card relative overflow-hidden p-4 flex flex-col gap-2 rounded-xl">
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ backgroundColor: TONE_ACCENT_LINE[tone] }}
      />
      <div className="flex items-center justify-between text-yo-txt-2">
        <span className="text-[11px] uppercase tracking-wider font-medium">{title}</span>
        {Icon && <Icon className="size-4 text-yo-txt-3" />}
      </div>

      {loading ? (
        <div className="h-7 w-32 rounded bg-yo-raised animate-pulse" />
      ) : amountCents != null ? (
        <div className={cn("font-mono tabular-nums text-2xl font-semibold leading-none text-yo-txt")}>
          {formatMoney(amountCents, currency)}
          <span className="ml-1 text-[10px] uppercase tracking-wider text-yo-txt-3 font-sans">{currency}</span>
        </div>
      ) : (
        <div className="font-mono tabular-nums text-2xl font-semibold leading-none text-yo-txt">
          {count ?? 0}
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] mt-1">
        <span className="text-yo-txt-3">{hint}</span>
        {actionLabel && (
          <button
            onClick={onAction}
            className="text-yo-ac hover:text-yo-ac-h font-medium transition"
          >
            {actionLabel} →
          </button>
        )}
      </div>
    </div>
  );
}
