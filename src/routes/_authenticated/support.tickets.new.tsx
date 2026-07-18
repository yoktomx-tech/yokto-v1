import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { LifeBuoy } from "lucide-react";
import { createSupportTicket } from "@/lib/support.functions";
import { PageHeader } from "@/components/page-header";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useViewRole } from "@/hooks/use-view-role";

export const Route = createFileRoute("/_authenticated/support/tickets/new")({
  component: NewTicket,
});

const MODULES = [
  ["", "General"], ["transactions","Operaciones"], ["payments","Pagos"],
  ["cumplimiento","Cumplimiento"], ["approvals","Aprobaciones"], ["disputes","Disputas"],
  ["kyc","KYC / Identidad"], ["settings","Cuenta / organización"],
];

function NewTicket() {
  const nav = useNavigate();
  const { currentOrg } = useCurrentOrg();
  const { role } = useViewRole();
  const isAuditor = currentOrg?.org_role === "auditor";
  const fn = useServerFn(createSupportTicket);
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [module, setModule] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (isAuditor) {
    return <div className="rounded-xl border border-yo-border bg-yo-surface p-8 text-sm text-yo-txt-3">
      Los usuarios con rol Auditor no pueden crear tickets.
    </div>;
  }

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const res = await fn({ data: {
        subject: subject.trim(), description: description.trim(),
        module: module || null, orgId: currentOrg?.id ?? null, activeView: role,
      } });
      nav({ to: "/support/tickets/$id", params: { id: (res as { id: string }).id } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al crear el ticket.");
    } finally { setBusy(false); }
  }

  const valid = subject.trim().length >= 4 && description.trim().length >= 10;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader icon={LifeBuoy} title="Nuevo ticket" subtitle="Cuéntanos qué necesitas y te contactaremos." />

      <div className="rounded-xl border border-yo-border bg-yo-surface p-6 space-y-4">
        <div>
          <label className="text-[11px] uppercase tracking-wider font-semibold text-yo-txt-3">Asunto</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160}
            className="mt-1 w-full h-10 px-3 rounded-lg border border-yo-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30" />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider font-semibold text-yo-txt-3">Módulo relacionado</label>
          <select value={module} onChange={(e) => setModule(e.target.value)}
            className="mt-1 w-full h-10 px-3 rounded-lg border border-yo-border bg-white text-sm">
            {MODULES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider font-semibold text-yo-txt-3">Descripción</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={8} maxLength={4000}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-yo-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30" />
        </div>

        <div className="rounded-lg bg-[#F5F3FF] border border-[#7C3AED]/20 p-3 text-[11px] text-yo-txt-2">
          Se registrará contexto: <span className="font-mono">vista {role}</span>, organización <span className="font-mono">{currentOrg?.name ?? "—"}</span>, ruta <span className="font-mono">{pathname}</span>.
        </div>

        {err && <div className="rounded-lg bg-yo-err-bg border border-yo-err/30 p-3 text-[12px] text-yo-err">{err}</div>}

        <div className="flex justify-end gap-2">
          <button onClick={() => nav({ to: "/support/tickets" })} className="h-10 px-4 rounded-lg border border-yo-border text-sm hover:bg-yo-raised">Cancelar</button>
          <button onClick={submit} disabled={!valid || busy}
            className="h-10 px-5 rounded-lg bg-[#18181B] text-white text-sm font-semibold hover:bg-black disabled:opacity-40">
            {busy ? "Creando…" : "Crear ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}
