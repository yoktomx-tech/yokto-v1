import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type Deadline = {
  id: string;
  title: string;
  counterparty: string;
  delivery_deadline: string;
  status: string;
};

function daysLeft(iso: string) {
  const now = Date.now();
  const then = new Date(iso).getTime();
  return Math.ceil((then - now) / (1000 * 60 * 60 * 24));
}

function urgencyClass(days: number) {
  if (days <= 1) return "bg-yo-err-bg text-yo-err border-yo-err/20";
  if (days <= 3) return "bg-yo-warn-bg text-yo-warn border-yo-warn/20";
  return "bg-yo-info-bg text-yo-info border-yo-info/20";
}

export function UpcomingDeadlines({ items }: { items: Deadline[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-10">
        <Clock className="mx-auto size-8 text-yo-txt-4" />
        <p className="mt-2 text-sm text-yo-txt-3">Sin vencimientos próximos.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((it) => {
        const d = daysLeft(it.delivery_deadline);
        const label = d < 0 ? `Vencido hace ${Math.abs(d)}d` : d === 0 ? "Hoy" : d === 1 ? "Mañana" : `En ${d} días`;
        return (
          <li key={it.id}>
            <Link
              to="/transactions/$id"
              params={{ id: it.id }}
              className="block p-3 rounded-lg border border-yo-border hover:border-yo-border-s hover:bg-yo-raised/40 transition group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-yo-txt truncate group-hover:text-yo-ac">{it.title}</p>
                  <p className="mt-0.5 text-xs text-yo-txt-3 truncate">{it.counterparty}</p>
                </div>
                <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", urgencyClass(d))}>
                  {label}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
