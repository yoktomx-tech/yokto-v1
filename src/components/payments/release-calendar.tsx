import { useMemo } from "react";
import { CalendarClock, ChevronRight } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import type { PaymentRow } from "@/lib/payments-catalog";

type Bucket = "today" | "week" | "later" | "overdue";

function bucketOf(iso: string): Bucket {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diff = t - now;
  if (diff < 0) return "overdue";
  const day = 86400_000;
  if (diff < day) return "today";
  if (diff < 7 * day) return "week";
  return "later";
}

const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: "Vencidos",
  today: "Hoy",
  week: "Próximos 7 días",
  later: "Más adelante",
};

const BUCKET_TONE: Record<Bucket, string> = {
  overdue: "text-yo-err bg-yo-err/10",
  today: "text-yo-ac bg-yo-ac/10",
  week: "text-yo-info bg-yo-info/10",
  later: "text-yo-t2 bg-yo-hover",
};

export function ReleaseCalendar({ rows }: { rows: PaymentRow[] }) {
  const navigate = useNavigate();
  const upcoming = useMemo(() => {
    const list = rows.filter(
      (r) => r.status === "READY_TO_RELEASE" || r.status === "HELD_BY_PROCESSOR",
    );
    // Ordenar por updatedAt (proxy de próxima liberación)
    return list
      .map((r) => ({ row: r, bucket: bucketOf(r.updatedAt) }))
      .sort((a, b) => new Date(a.row.updatedAt).getTime() - new Date(b.row.updatedAt).getTime());
  }, [rows]);

  const grouped = useMemo(() => {
    const g: Record<Bucket, typeof upcoming> = { overdue: [], today: [], week: [], later: [] };
    for (const item of upcoming) g[item.bucket].push(item);
    return g;
  }, [upcoming]);

  const totalCents = upcoming.reduce((acc, i) => acc + (i.row.amountCents - i.row.releasedCents), 0);

  return (
    <div className="rounded-xl border border-yo-border bg-yo-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-yo-ac/10 text-yo-ac">
            <CalendarClock className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-yo-t1">Calendario de liberaciones</h3>
            <p className="text-xs text-yo-t2">
              {upcoming.length} operación(es) — ${(totalCents / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN pendientes
            </p>
          </div>
        </div>
      </div>

      {upcoming.length === 0 ? (
        <div className="text-sm text-yo-t2 py-6 text-center border border-dashed border-yo-border rounded-lg">
          Sin liberaciones programadas.
        </div>
      ) : (
        <div className="space-y-4">
          {(["overdue", "today", "week", "later"] as Bucket[]).map((b) =>
            grouped[b].length === 0 ? null : (
              <div key={b}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${BUCKET_TONE[b]}`}>
                    {BUCKET_LABEL[b]}
                  </span>
                  <span className="text-xs text-yo-t2">{grouped[b].length}</span>
                </div>
                <ul className="divide-y divide-yo-border rounded-lg border border-yo-border overflow-hidden">
                  {grouped[b].slice(0, 5).map(({ row }) => (
                    <li key={row.id}>
                      <button
                        onClick={() => navigate({ to: "/payments/$id", params: { id: row.id } })}
                        className="w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-yo-hover transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-yo-t1 truncate">
                            {row.numero ?? row.id.slice(0, 8)} · {row.title ?? "Sin título"}
                          </p>
                          <p className="text-xs text-yo-t2 truncate">
                            {row.hitoLabel ?? "Contrato completo"} · {row.sellerName ?? "—"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-sm text-yo-t1">
                            ${((row.amountCents - row.releasedCents) / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                          </span>
                          <ChevronRight className="size-4 text-yo-t2" />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
