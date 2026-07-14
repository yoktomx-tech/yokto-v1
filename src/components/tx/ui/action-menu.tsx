import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ActionItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  tone?: "default" | "destructive";
  divider?: boolean; // insert separator BEFORE this item
};

type Props = {
  items: ActionItem[];
  label?: string;
  align?: "start" | "end";
  trigger?: ReactNode;
  className?: string;
};

export function ActionMenu({ items, label = "Acciones", align = "end", trigger, className }: Props) {
  const visible = items.filter(Boolean);
  if (visible.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 text-yo-txt-2 hover:text-yo-txt hover:bg-yo-raised", className)}
            aria-label={label}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-52">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-yo-txt-3">
          {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {visible.map((it) => (
          <div key={it.key}>
            {it.divider && <DropdownMenuSeparator />}
            <DropdownMenuItem
              disabled={it.disabled}
              onSelect={(e) => {
                e.preventDefault();
                it.onSelect?.();
              }}
              className={cn(
                "text-sm gap-2 cursor-pointer",
                it.tone === "destructive" && "text-[color:var(--yo-err)] focus:text-[color:var(--yo-err)]",
              )}
            >
              {it.icon}
              {it.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
