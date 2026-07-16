import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { History, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { SettingsCard } from "@/components/settings/settings-shell";

export const Route = createFileRoute("/_authenticated/settings/audit")({
  component: AuditPage,
});

type Event = {
  id: string; ts: string; actor: string; action: string; target: string; ip: string; ua: string;
};

const MOCK: Event[] = [
  { id: "e1", ts: "2026-07-16 09:32:11", actor: "luis@empresa.com", action: "password.updated", target: "self", ip: "189.***.***.42", ua: "Chrome 131 · macOS" },
  { id: "e2", ts: "2026-07-15 22:04:03", actor: "luis@empresa.com", action: "mfa.enabled", target: "self", ip: "189.***.***.42", ua: "Chrome 131 · macOS" },
  { id: "e3", ts: "2026-07-15 18:11:00", actor: "ana@empresa.com", action: "apikey.created", target: "yk_a1b2c3d4", ip: "200.***.***.11", ua: "Edge · Windows" },
  { id: "e4", ts: "2026-07-14 11:22:45", actor: "ana@empresa.com", action: "webhook.rotated", target: "wh_1", ip: "200.***.***.11", ua: "Edge · Windows" },
  { id: "e5", ts: "2026-07-13 08:00:14", actor: "system", action: "session.expired", target: "self", ip: "-", ua: "-" },
  { id: "e6", ts: "2026-07-12 16:44:39", actor: "luis@empresa.com", action: "integration.connected", target: "slack", ip: "189.***.***.42", ua: "Chrome 131 · macOS" },
];

function AuditPage() {
  const [q, setQ] = useState("");
  const rows = useMemo(() => MOCK.filter((e) => !q || (e.action + e.actor + e.target).toLowerCase().includes(q.toLowerCase())), [q]);

  return (
    <SettingsCard
      icon={History}
      title="Auditoría de configuración"
      description="Todos los cambios a tu cuenta y a la organización quedan registrados con IP y user agent enmascarados."
      actions={
        <button onClick={() => toast.success("Exportando CSV…")} className="h-9 px-3 rounded-md border border-yo-border text-sm inline-flex items-center gap-1.5">
          <Download className="size-3.5" /> CSV
        </button>
      }
    >
      <div className="relative mb-3">
        <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-yo-txt-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar acción, actor u objeto…"
          className="pl-8 h-9 w-full max-w-sm text-sm rounded-md border border-yo-border bg-background" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[720px]">
          <thead className="text-left text-[10.5px] uppercase text-yo-txt-3">
            <tr>
              <th className="pb-2 font-medium">Fecha</th>
              <th className="pb-2 font-medium">Actor</th>
              <th className="pb-2 font-medium">Acción</th>
              <th className="pb-2 font-medium">Objeto</th>
              <th className="pb-2 font-medium">IP</th>
              <th className="pb-2 font-medium">User agent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-yo-border">
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="py-2.5 font-mono text-[11.5px] text-yo-txt-3 whitespace-nowrap">{e.ts}</td>
                <td className="py-2.5">{e.actor}</td>
                <td className="py-2.5"><code className="font-mono text-[12px]">{e.action}</code></td>
                <td className="py-2.5 font-mono text-[12px] text-yo-txt-2">{e.target}</td>
                <td className="py-2.5 font-mono text-[11.5px] text-yo-txt-3">{e.ip}</td>
                <td className="py-2.5 text-[11.5px] text-yo-txt-3">{e.ua}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsCard>
  );
}
