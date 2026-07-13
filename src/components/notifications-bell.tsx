import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
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
        className="relative inline-flex items-center justify-center size-9 rounded-md border border-white/[0.10] hover:border-white/[0.20] bg-yokto-card hover:bg-yokto-hover text-yokto-text-1"
      >
        <Bell className="size-4" aria-hidden />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF3B3B] text-white text-[10px] font-bold grid place-items-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-auto border border-yokto-black bg-background shadow-lg z-50">
          <div className="flex items-center justify-between p-3 border-b border-yokto-black/20">
            <span className="text-[11px] uppercase tracking-[0.14em] font-semibold">Notificaciones</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-[11px] uppercase tracking-[0.14em] underline underline-offset-4">Marcar leídas</button>
            )}
          </div>
          {items.length === 0 && <p className="p-4 text-sm text-muted-foreground">Sin notificaciones.</p>}
          <ul className="divide-y divide-yokto-black/20">
            {items.map((n) => (
              <li key={n.id} className={n.read_at ? "opacity-60" : ""}>
                {n.link ? (
                  <Link to={n.link} onClick={() => setOpen(false)} className="block p-3 hover:bg-yokto-cream/40">
                    <p className="text-sm font-semibold">{n.title}</p>
                    {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString("es-MX")}</p>
                  </Link>
                ) : (
                  <div className="p-3">
                    <p className="text-sm font-semibold">{n.title}</p>
                    {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
