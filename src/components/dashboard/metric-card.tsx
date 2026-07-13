import { Link } from "@tanstack/react-router";
import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Format = "MONEDA_MXN" | "NUMERO" | "PORCENTAJE" | "DIAS";

export type MetricCardProps = {
  titulo: string;
  valor: string | number;
  formato: Format;
  delta?: { valor: number; periodo: string; positivo_es_bueno: boolean };
  icon: LucideIcon;
  accion?: { label: string; href: string };
  variant?: "default" | "custody" | "urgent" | "score";
  loading?: boolean;
  scoreCategory?: string;
};

function formatValue(v: string | number, f: Format) {
  if (typeof v === "string") return v;
  switch (f) {
    case "MONEDA_MXN":
      return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(v);
    case "PORCENTAJE":
      return `${v.toFixed(1)}%`;
    case "DIAS":
      return `${v} días`;
    default:
      return new Intl.NumberFormat("es-MX").format(v);
  }
}

export function MetricCard({
  titulo, valor, formato, delta, icon: Icon, accion, variant = "default", loading, scoreCategory,
}: MetricCardProps) {
  if (loading) {
    return <div className="h-32 rounded-xl bg-yo-surface border border-yo-border animate-pulse" />;
  }

  const isUrgent = variant === "urgent" && Number(valor) > 0;
  const isCustody = variant === "custody";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-yo-surface p-5 transition-shadow hover:shadow-md",
        isUrgent ? "border-yo-err/30" : "border-yo-border",
        isCustody && "border-l-[4px] border-l-yo-ac",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-yo-txt-3">{titulo}</p>
        <div
          className={cn(
            "grid place-items-center size-8 rounded-lg",
            isUrgent ? "bg-yo-err-bg text-yo-err" :
            isCustody ? "bg-yo-ac-bg text-yo-ac" :
            variant === "score" ? "bg-yo-warn-bg text-yo-warn" :
            "bg-yo-raised text-yo-txt-2"
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <p className={cn(
          "font-bold tracking-tight tabular-nums",
          isUrgent ? "text-yo-err text-3xl" : "text-yo-txt text-3xl"
        )}>
          {formatValue(valor, formato)}
        </p>
        {variant === "score" && (
          <span className="text-xs font-medium text-yo-txt-3">/ 1000</span>
        )}
      </div>

      {scoreCategory && (
        <p className="mt-1 text-[11px] font-semibold text-yo-warn uppercase tracking-wider">{scoreCategory}</p>
      )}

      {delta && (
        <div className="mt-2 flex items-center gap-1.5">
          {(() => {
            const good = (delta.valor >= 0) === delta.positivo_es_bueno;
            const Arrow = delta.valor >= 0 ? TrendingUp : TrendingDown;
            return (
              <>
                <Arrow className={cn("size-3", good ? "text-yo-ok" : "text-yo-err")} />
                <span className={cn("text-xs font-semibold tabular-nums", good ? "text-yo-ok" : "text-yo-err")}>
                  {delta.valor >= 0 ? "+" : ""}{delta.valor}%
                </span>
                <span className="text-xs text-yo-txt-3">{delta.periodo}</span>
              </>
            );
          })()}
        </div>
      )}

      {accion && (
        <Link
          to={accion.href}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-yo-ac hover:text-yo-ac-h"
        >
          {accion.label} <ArrowUpRight className="size-3" />
        </Link>
      )}
    </div>
  );
}
