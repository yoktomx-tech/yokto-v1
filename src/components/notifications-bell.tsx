import { useEffect, useState } from "react";
// no Link import — notifications carry arbitrary internal paths, use <a>
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { markNotificationRead } from "@/lib/disputes.functions";

type N = { id: string; type: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };

export function NotificationsBell({ userId }: { userId: string }) {
  const [items, setItems] = useState<N[]>([]);
  const [open, setOpen] = useState(false);
  const markFn = useServerFn(markNotificationRead);

  async function load() {
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(15);
    setItems((data ?? []) as N[]);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`notif-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  const unread = items.filter((i) => !i.read_at).length;

  async function markAll() {
    await markFn({ data: { all: true } });
    await load();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notificaciones"
        title="Notificaciones"
        className="relative size-8 grid place-items-center rounded-md text-yo-txt-2 hover:text-yo-txt hover:bg-yo-raised transition"
      >
        <Bell className="size-4" aria-hidden />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-yo-err text-white text-[9px] font-bold grid place-items-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[340px] max-h-[70vh] overflow-auto border border-yo-border bg-yo-surface rounded-xl shadow-xl z-50">
          <div className="p-3 border-b border-yo-border bg-yo-ac-bg">
            <div className="flex items-center gap-2">
              <div className="size-8 grid place-items-center rounded-lg bg-yo-ac text-white">
                <Bell className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-yo-txt">Notificaciones</p>
                <p className="text-[11px] text-yo-txt-3">
                  {unread > 0 ? `${unread} sin leer` : "Todo al día"}
                </p>
              </div>
              {unread > 0 && (
                <button onClick={markAll} className="text-[11px] font-medium text-yo-ac hover:underline">
                  Marcar leídas
                </button>
              )}
            </div>
          </div>
          {items.length === 0 && <p className="p-4 text-sm text-yo-txt-3">Sin notificaciones.</p>}
          <ul className="divide-y divide-yo-border">
            {items.map((n) => (
              <li key={n.id} className={n.read_at ? "opacity-60" : ""}>
                {n.link ? (
                  <a href={n.link} onClick={() => setOpen(false)} className="block p-3 hover:bg-yo-bg/40">
                    <p className="text-sm font-semibold">{n.title}</p>
                    {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString("es-MX")}</p>
                  </a>
                ) : (
                  <div className="p-3">
                    <p className="text-sm font-semibold">{n.title}</p>
                    {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <a href="/notifications" onClick={() => setOpen(false)} className="block p-3 text-center text-[12px] font-semibold text-yo-ac hover:bg-yo-raised border-t border-yo-border">
            Ver todas las notificaciones
          </a>
        </div>

      )}
    </div>
  );
}
