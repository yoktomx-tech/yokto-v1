import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import {
  adminOverview, adminSetKycStatus, adminGrantRole,
  adminForceResolveDispute, isCurrentUserAdmin,
} from "@/lib/admin.functions";
import { formatMoney, STATUS_LABEL, type TxStatus } from "@/lib/tx";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — YOKTO" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async () => {
    try {
      const r = await isCurrentUserAdmin();
      if (!r.isAdmin) throw redirect({ to: "/dashboard" });
    } catch {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminPage,
});

type Overview = Awaited<ReturnType<typeof adminOverview>>;

function AdminPage() {
  const { user } = Route.useRouteContext();
  const overviewFn = useServerFn(adminOverview);
  const setKycFn = useServerFn(adminSetKycStatus);
  const grantFn = useServerFn(adminGrantRole);
  const resolveFn = useServerFn(adminForceResolveDispute);
  const [data, setData] = useState<Overview | null>(null);
  const [tab, setTab] = useState<"users" | "kyc" | "tx" | "disputes">("users");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() { setData(await overviewFn()); }
  useEffect(() => { void load(); }, []);

  async function doKyc(uid: string, status: "approved" | "rejected" | "in_review") {
    setBusy(uid);
    try { await setKycFn({ data: { userId: uid, status } }); await load(); }
    finally { setBusy(null); }
  }
  async function doGrant(uid: string, role: "admin" | "seller" | "buyer") {
    setBusy(uid);
    try { await grantFn({ data: { userId: uid, role } }); await load(); }
    finally { setBusy(null); }
  }
  async function doResolve(id: string, resolution: "release_to_seller" | "refund_buyer" | "partial") {
    setBusy(id);
    try { await resolveFn({ data: { disputeId: id, resolution } }); await load(); }
    finally { setBusy(null); }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Shield}
        title="Panel de administración"
        subtitle="Acceso reservado. Todas las acciones quedan en el log de eventos."
        actions={
          <Link to="/admin/disputes" className="h-9 px-4 rounded-md bg-yo-txt text-yo-surface text-sm font-medium hover:opacity-90 inline-flex items-center">
            Panel de disputas →
          </Link>
        }
      />

        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Usuarios (recientes)" value={data.counts.users} />
            <Kpi label="KYC pendiente" value={data.counts.pendingKyc} accent />
            <Kpi label="Transacciones activas" value={data.counts.activeTx} />
            <Kpi label="Disputas abiertas" value={data.counts.openDisputes} accent />
          </div>
        )}

        <div className="flex items-center gap-1 mt-8 border-b border-yo-border">
          {(["users","kyc","tx","disputes"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 h-9 text-sm font-medium border-b-2 -mb-px ${tab===t?"border-yo-ac text-yo-txt":"border-transparent text-yo-txt-3 hover:text-yo-txt"}`}>
              {t === "users" ? "Usuarios" : t === "kyc" ? "KYC" : t === "tx" ? "Transacciones" : "Disputas"}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {!data ? <p className="text-sm text-yo-txt-3">Cargando…</p> : (
            <>
              {tab === "users" && (
                <Table headers={["Usuario","Email","KYC","Acciones"]}>
                  {data.profiles.map((p) => (
                    <tr key={p.id} className="border-t border-yo-border">
                      <td className="p-2 text-sm">{p.first_name} {p.last_name}</td>
                      <td className="p-2 text-xs text-yo-txt-3">{p.email}</td>
                      <td className="p-2 text-xs uppercase">{p.kyc_status ?? "—"}</td>
                      <td className="p-2 text-xs flex gap-1 flex-wrap">
                        <MiniBtn onClick={() => doGrant(p.id, "admin")} busy={busy===p.id}>+admin</MiniBtn>
                        <MiniBtn onClick={() => doGrant(p.id, "seller")} busy={busy===p.id}>+seller</MiniBtn>
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
              {tab === "kyc" && (
                <Table headers={["Usuario","Email","Estado","Acciones"]}>
                  {data.profiles
                    .filter((p) => p.kyc_status && p.kyc_status !== "approved")
                    .map((p) => (
                    <tr key={p.id} className="border-t border-yo-border">
                      <td className="p-2 text-sm">{p.first_name} {p.last_name}</td>
                      <td className="p-2 text-xs text-yo-txt-3">{p.email}</td>
                      <td className="p-2 text-xs uppercase">{p.kyc_status}</td>
                      <td className="p-2 text-xs flex gap-1 flex-wrap">
                        <MiniBtn onClick={() => doKyc(p.id, "approved")} busy={busy===p.id} tone="ok">Aprobar</MiniBtn>
                        <MiniBtn onClick={() => doKyc(p.id, "in_review")} busy={busy===p.id}>Revisar</MiniBtn>
                        <MiniBtn onClick={() => doKyc(p.id, "rejected")} busy={busy===p.id} tone="bad">Rechazar</MiniBtn>
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
              {tab === "tx" && (
                <Table headers={["Título","Monto","Estado","Creada"]}>
                  {data.transactions.map((t) => (
                    <tr key={t.id} className="border-t border-yo-border">
                      <td className="p-2 text-sm">{t.title}</td>
                      <td className="p-2 text-xs">{formatMoney(t.amount_cents, t.currency)}</td>
                      <td className="p-2 text-xs uppercase">{STATUS_LABEL[t.status as TxStatus] ?? t.status}</td>
                      <td className="p-2 text-xs text-yo-txt-3">{new Date(t.created_at).toLocaleDateString("es-MX")}</td>
                    </tr>
                  ))}
                </Table>
              )}
              {tab === "disputes" && (
                <Table headers={["ID","Estado","Motivo","Acciones"]}>
                  {data.disputes.map((d) => (
                    <tr key={d.id} className="border-t border-yo-border">
                      <td className="p-2 text-xs font-mono">{d.id.slice(0,8)}</td>
                      <td className="p-2 text-xs uppercase">{d.status}</td>
                      <td className="p-2 text-xs">{d.reason_code}</td>
                      <td className="p-2 text-xs flex gap-1 flex-wrap">
                        <MiniBtn onClick={() => doResolve(d.id, "release_to_seller")} busy={busy===d.id} tone="ok">Liberar</MiniBtn>
                        <MiniBtn onClick={() => doResolve(d.id, "refund_buyer")} busy={busy===d.id} tone="bad">Reembolsar</MiniBtn>
                        <MiniBtn onClick={() => doResolve(d.id, "partial")} busy={busy===d.id}>Parcial</MiniBtn>
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${accent ? "border-yo-ac/40 bg-yo-ac-bg" : "border-yo-border bg-yo-surface"}`}>
      <div className="text-xs uppercase tracking-wider text-yo-txt-3">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-yo-border bg-yo-surface overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-background/50"><tr>{headers.map((h) => <th key={h} className="p-2 text-[11px] uppercase tracking-wider text-yo-txt-3 font-semibold">{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function MiniBtn({ children, onClick, busy, tone }: { children: React.ReactNode; onClick: () => void; busy?: boolean; tone?: "ok"|"bad" }) {
  const cls = tone === "ok" ? "border-emerald-300 bg-emerald-50 text-emerald-800"
    : tone === "bad" ? "border-red-300 bg-red-50 text-red-800"
    : "border-yo-border bg-background";
  return <button onClick={onClick} disabled={busy} className={`px-2 h-7 rounded border text-[11px] font-medium hover:opacity-90 disabled:opacity-40 ${cls}`}>{children}</button>;
}
