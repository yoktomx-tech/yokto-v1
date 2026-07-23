import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Lock, Activity, AlertCircle, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MetricCard } from "@/components/dashboard/metric-card";
import { SectorChart, type SectorRow } from "@/components/dashboard/sector-chart";
import { UpcomingDeadlines, type Deadline } from "@/components/dashboard/upcoming-deadlines";
import { RecentTransactions, type TxRow } from "@/components/dashboard/recent-transactions";
import { ActivityFeed, type ActivityItem } from "@/components/dashboard/activity-feed";

import { EmptyStateDashboard } from "@/components/dashboard/empty-state";
import type { TxStatus } from "@/lib/tx";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Panel — CUMPLEX" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

type Profile = { first_name: string | null; email: string | null; kyc_status: string };

const CUSTODY_STATUSES: TxStatus[] = ["funded", "in_progress", "conditions_met", "disputed"];
const ACTIVE_STATUSES: TxStatus[] = ["awaiting_funding", "funded", "in_progress", "conditions_met", "disputed"];

function Dashboard() {
  const { user } = Route.useRouteContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [events, setEvents] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    const [{ data: p }, { data: t }, { data: e }] = await Promise.all([
      supabase.from("profiles").select("first_name,email,kyc_status").eq("id", user.id).maybeSingle(),
      supabase
        .from("transactions")
        .select("id,title,counterparty_email,seller_id,buyer_id,amount_cents,status,sector,created_at,delivery_deadline")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("transaction_events")
        .select("id,event_type,transaction_id,metadata,created_at,transactions(title,buyer_id,seller_id)")
        .order("created_at", { ascending: false })
        .limit(15),
    ]);
    setProfile((p as Profile) ?? null);
    setTxs((t ?? []) as TxRow[]);
    setEvents(
      ((e ?? []) as Array<ActivityItem & { transactions?: { title: string } | null }>)
        .map((row) => ({
          id: row.id,
          event_type: row.event_type,
          transaction_id: row.transaction_id,
          transaction_title: row.transactions?.title,
          metadata: row.metadata,
          created_at: row.created_at,
        }))
    );
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // Realtime: notifications toast + refetch on tx changes
    const chTx = supabase
      .channel(`tx-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `buyer_id=eq.${user.id}` }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `seller_id=eq.${user.id}` }, () => loadAll())
      .subscribe();
    const chNotif = supabase
      .channel(`dash-notif-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
        const n = payload.new as { title: string; body: string | null };
        toast(n.title, { description: n.body ?? undefined });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(chTx);
      supabase.removeChannel(chNotif);
    };
     
  }, [user.id]);

  const metrics = useMemo(() => {
    const custody = txs
      .filter((t) => CUSTODY_STATUSES.includes(t.status))
      .reduce((s, t) => s + t.amount_cents, 0);
    const active = txs.filter((t) => ACTIVE_STATUSES.includes(t.status)).length;
    const needsAction = txs.filter((t) =>
      (t.buyer_id === user.id && t.status === "awaiting_funding") ||
      (t.seller_id === user.id && t.status === "conditions_met") ||
      t.status === "disputed"
    ).length;
    const kycOk = profile?.kyc_status === "approved";
    // Simple derived SGY score: base 400 + KYC 300 + tx activity
    const score = Math.min(1000, 400 + (kycOk ? 300 : profile?.kyc_status === "in_review" ? 150 : 0) + active * 20 + Math.min(200, txs.filter((t) => t.status === "released").length * 40));
    return { custody, active, needsAction, score };
  }, [txs, profile, user.id]);

  const sectorData: SectorRow[] = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    txs.filter((t) => ACTIVE_STATUSES.includes(t.status)).forEach((t) => {
      const k = t.sector ?? "Otro";
      const cur = map.get(k) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += t.amount_cents;
      map.set(k, cur);
    });
    return Array.from(map.entries())
      .map(([sector, v]) => ({ sector, count: v.count, total_cents: v.total }))
      .sort((a, b) => b.count - a.count);
  }, [txs]);

  const deadlines: Deadline[] = useMemo(() => {
    const now = Date.now();
    const in7d = now + 7 * 86400_000;
    return txs
      .filter((t): t is TxRow & { delivery_deadline: string } => {
        const raw = (t as unknown as { delivery_deadline?: string | null }).delivery_deadline;
        if (!raw) return false;
        const ts = new Date(raw).getTime();
        return ACTIVE_STATUSES.includes(t.status) && ts <= in7d;
      })
      .sort((a, b) => new Date(a.delivery_deadline).getTime() - new Date(b.delivery_deadline).getTime())
      .slice(0, 6)
      .map((t) => ({
        id: t.id,
        title: t.title,
        counterparty: t.counterparty_email ?? "—",
        delivery_deadline: t.delivery_deadline,
        status: t.status,
      }));
  }, [txs]);

  const displayName = profile?.first_name || profile?.email?.split("@")[0] || "Operador";
  const isEmpty = !loading && txs.length === 0;

  return (
    <>
      <div className="flex flex-col gap-6">
        <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-yo-txt-3 font-semibold">Bienvenido</p>
            <h1 className="mt-1 text-2xl md:text-3xl font-bold text-yo-txt tracking-tight">
              Hola, {displayName}.
            </h1>
            <p className="mt-1 text-sm text-yo-txt-2">
              Este es tu centro de control CUMPLEX. Fondos custodiados, transacciones activas y alertas críticas.
            </p>
          </div>

          {isEmpty ? (
            <EmptyStateDashboard name={displayName} />
          ) : (
            <>
              {/* KPIs */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  loading={loading}
                  titulo="Fondos en retención"
                  valor={metrics.custody / 100 * 100}
                  formato="MONEDA_MXN"
                  icon={Lock}
                  variant="custody"
                />
                <MetricCard
                  loading={loading}
                  titulo="Transacciones activas"
                  valor={metrics.active}
                  formato="NUMERO"
                  icon={Activity}
                />
                <MetricCard
                  loading={loading}
                  titulo="Requieren atención"
                  valor={metrics.needsAction}
                  formato="NUMERO"
                  icon={AlertCircle}
                  variant="urgent"
                  accion={metrics.needsAction > 0 ? { label: "Ver pendientes", href: "/transactions" } : undefined}
                />
                <MetricCard
                  loading={loading}
                  titulo="Tu Score CUMPLEX"
                  valor={metrics.score}
                  formato="NUMERO"
                  icon={Star}
                  variant="score"
                  scoreCategory={
                    metrics.score >= 850 ? "Élite" :
                    metrics.score >= 700 ? "Premium" :
                    metrics.score >= 500 ? "Confiable" :
                    metrics.score >= 300 ? "Básico" : "Nuevo"
                  }
                />
              </div>

              {/* Fila 2: sectores + vencimientos */}
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Transacciones activas por sector">
                  {loading ? <Skeleton /> : <SectorChart data={sectorData} />}
                </Card>
                <Card title="Próximos vencimientos (7 días)">
                  {loading ? <Skeleton /> : <UpcomingDeadlines items={deadlines} />}
                </Card>
              </div>

              {/* Fila 3: tabla */}
              <div className="mt-6">
                <Card title="Transacciones recientes">
                  {loading ? <Skeleton /> : <RecentTransactions rows={txs} userId={user.id} />}
                </Card>
              </div>

              {/* Fila 4: actividad */}
              <div className="mt-6">
                <Card title="Actividad reciente">
                  {loading ? <Skeleton /> : <ActivityFeed items={events} />}
                </Card>
              </div>

            </>
          )}
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-yo-border bg-yo-surface p-5">
      <h2 className="text-sm font-bold text-yo-txt mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      <div className="h-6 rounded bg-yo-raised animate-pulse" />
      <div className="h-6 rounded bg-yo-raised animate-pulse w-4/5" />
      <div className="h-6 rounded bg-yo-raised animate-pulse w-3/5" />
    </div>
  );
}
