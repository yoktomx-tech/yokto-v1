import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div
      className={cn(
        "surface-card flex flex-col items-center justify-center text-center px-6 py-14 gap-3",
        className,
      )}
    >
      {icon && (
        <div className="h-12 w-12 rounded-full bg-yo-raised text-yo-txt-3 flex items-center justify-center">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-yo-txt">{title}</h3>
        {description && <p className="text-sm text-yo-txt-2 max-w-md">{description}</p>}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
