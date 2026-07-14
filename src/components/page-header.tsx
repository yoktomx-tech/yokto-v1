import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
};

/**
 * Encabezado estándar para pantallas principales de módulos.
 * Tile con icono + título en negrita + subtítulo mudo, opcionalmente
 * con acciones a la derecha.
 */
export function PageHeader({ icon: Icon, title, subtitle, actions, className }: Props) {
  return (
    <header className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex items-start gap-4 min-w-0">
        <div className="shrink-0 size-12 rounded-xl bg-yo-ac-bg grid place-items-center">
          <Icon className="size-6 text-yo-ac" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <h1 className="text-[26px] md:text-[28px] font-bold leading-tight text-yo-txt tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-[13.5px] text-yo-txt-2 leading-relaxed">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
