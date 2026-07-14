import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  role?: "PAGADOR" | "BENEFICIARIO" | "COMPRADOR" | "VENDEDOR" | string;
  subtitle?: ReactNode;
  rfc?: string;
  avatar?: string;
  right?: ReactNode;
  className?: string;
};

export function EntityCard({ title, role, subtitle, rfc, avatar, right, className }: Props) {
  const initials = title
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  return (
    <div className={cn("surface-card p-3 flex items-start gap-3", className)}>
      <div className="h-9 w-9 shrink-0 rounded-full bg-yo-ac-bg text-yo-ac-txt flex items-center justify-center font-semibold text-xs overflow-hidden">
        {avatar ? (
          <img src={avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          initials || "—"
        )}
      </div>
      <div className="min-w-0 flex-1">
        {role && (
          <div className="text-[10px] uppercase tracking-wider text-yo-txt-3 font-medium">{role}</div>
        )}
        <div className="truncate text-sm font-semibold text-yo-txt">{title}</div>
        {rfc && <div className="font-mono text-[11px] text-yo-txt-2 rfc">{rfc}</div>}
        {subtitle && <div className="text-[11px] text-yo-txt-2 mt-0.5">{subtitle}</div>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
