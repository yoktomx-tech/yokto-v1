import { cn } from "@/lib/utils";

type Props = {
  amount: number | null | undefined;
  currency?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  muted?: boolean;
  className?: string;
  showCurrency?: boolean;
};

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  xs: "text-[11px]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-lg",
  xl: "text-2xl",
};

export function MoneyDisplay({
  amount,
  currency = "MXN",
  size = "md",
  muted,
  className,
  showCurrency = true,
}: Props) {
  const n = Number.isFinite(amount) ? Number(amount) : 0;
  const formatted = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  // Split symbol / body: Intl adds "MX$1,234.56"
  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        SIZE[size],
        muted ? "text-yo-txt-2" : "text-yo-txt",
        className,
      )}
    >
      {formatted}
      {showCurrency && (
        <span className="ml-1 text-[0.75em] text-yo-txt-3 font-medium">{currency}</span>
      )}
    </span>
  );
}
