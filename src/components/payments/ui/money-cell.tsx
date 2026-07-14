import { formatMoney } from "@/lib/payments-catalog";
import { cn } from "@/lib/utils";

type Props = {
  amountCents: number;
  currency?: string;
  sublabel?: string;
  negative?: boolean;
  estimated?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
};

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-2xl font-bold",
};

export function MoneyCell({ amountCents, currency = "MXN", sublabel, negative, estimated, className, size = "md" }: Props) {
  const value = formatMoney(Math.abs(amountCents), currency);
  return (
    <div className={cn("flex flex-col", className)}>
      <span
        className={cn(
          "font-mono tabular-nums leading-none",
          SIZE[size],
          negative ? "text-yo-err" : "text-yo-txt",
        )}
      >
        {negative ? "-" : ""}{value}
        <span className="ml-1 text-[10px] uppercase tracking-wider text-yo-txt-3 font-sans">{currency}</span>
      </span>
      {sublabel && (
        <span className="mt-1 text-[11px] text-yo-txt-3 leading-tight">
          {estimated && <span className="mr-1 inline-flex items-center rounded-full bg-yo-info-bg px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-yo-info">Est.</span>}
          {sublabel}
        </span>
      )}
    </div>
  );
}
