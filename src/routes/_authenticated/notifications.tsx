import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Check, CheckCheck, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { markNotificationRead } from "@/lib/disputes.functions";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notificaciones — Cumplex" }, { name: "robots", content: "noindex" }] }),
  component: NotificationsPage,
});

type N = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

type Filter = "all" | "unread" | "read";

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "hace instantes";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function NotificationsPage() {
  const { user } = Route.useRouteContext();
  const [items, setItems] = useState<N[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const markFn = useServerFn(markNotificationRead);

  async function load() {
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    setItems((data ?? []) as N[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`notif-page-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const unread = items.filter((i) => !i.read_at).length;
  const filtered = items.filter((i) =>
    filter === "unread" ? !i.read_at : filter === "read" ? !!i.read_at : true,
  );

  async function markOne(id: string) {
    await markFn({ data: { id } });
    await load();
  }
  async function markAll() {
    await markFn({ data: { all: true } });
    await load();
  }

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "Todas", count: items.length },
    { key: "unread", label: "No leídas", count: unread },
    { key: "read", label: "Leídas", count: items.length - unread },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Bell}
        title="Notificaciones"
        subtitle={unread > 0 ? `Tienes ${unread} sin leer` : "Estás al día"}
        actions={
          unread > 0 ? (
            <button
              onClick={markAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-yo-border bg-yo-surface hover:bg-yo-raised text-[13px] font-semibold text-yo-txt transition"
            >
              <CheckCheck className="size-4 text-yo-ac" />
              Marcar todas como leídas
            </button>
          ) : undefined
        }
      />

      <div>
        <div className="flex items-center gap-1 mb-4 border-b border-yo-border">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition",
                filter === f.key
                  ? "border-yo-ac text-yo-txt"
                  : "border-transparent text-yo-txt-3 hover:text-yo-txt",
              )}
            >
              {f.label}
              <span className="ml-1.5 text-[11px] text-yo-txt-3">({f.count})</span>
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-yo-border bg-yo-surface overflow-hidden">
          {loading ? (
            <p className="p-8 text-center text-sm text-yo-txt-3">Cargando…</p>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center">
              <Inbox className="size-8 mx-auto text-yo-txt-3 mb-2" />
              <p className="text-sm text-yo-txt-2">
                {filter === "unread" ? "No tienes notificaciones sin leer." : "Sin notificaciones."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-yo-border">
              {filtered.map((n) => {
                const isUnread = !n.read_at;
                const Body = (
                  <div className="flex items-start gap-3 p-4">
                    <div
                      className={cn(
                        "mt-1 size-2 rounded-full shrink-0",
                        isUnread ? "bg-yo-ac" : "bg-transparent",
                      )}
                      aria-hidden
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <p className={cn("text-sm", isUnread ? "font-semibold text-yo-txt" : "font-medium text-yo-txt-2")}>
                          {n.title}
                        </p>
                        <span className="text-[11px] text-yo-txt-3 shrink-0">{relativeTime(n.created_at)}</span>
                      </div>
                      {n.body && <p className="mt-1 text-[13px] text-yo-txt-2">{n.body}</p>}
                      <p className="mt-1 text-[10px] uppercase tracking-widest text-yo-txt-3">{n.type}</p>
                    </div>
                    {isUnread && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          markOne(n.id);
                        }}
                        className="shrink-0 size-7 grid place-items-center rounded-md text-yo-txt-3 hover:text-yo-txt hover:bg-yo-raised transition"
                        aria-label="Marcar como leída"
                        title="Marcar como leída"
                      >
                        <Check className="size-4" />
                      </button>
                    )}
                  </div>
                );
                return (
                  <li key={n.id} className={cn("transition", isUnread ? "bg-yo-ac-bg/20" : "hover:bg-yo-raised/40")}>
                    {n.link ? (
                      <a
                        href={n.link}
                        onClick={() => {
                          if (isUnread) markOne(n.id);
                        }}
                        className="block hover:bg-yo-raised/60"
                      >
                        {Body}
                      </a>
                    ) : (
                      Body
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
