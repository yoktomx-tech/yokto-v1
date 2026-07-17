import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminCard, AdminPageHeader } from "@/components/admin/admin-shell";
import { adminKycQueue, adminKycDecide } from "@/lib/admin/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_backoffice/admin/kyc")({
  component: AdminKyc,
});

function AdminKyc() {
  const list = useServerFn(adminKycQueue);
  const decide = useServerFn(adminKycDecide);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-kyc"], queryFn: () => list() });
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const m = useMutation({
    mutationFn: (input: { userId: string; decision: "approved" | "rejected" | "in_review"; reason: string }) =>
      decide({ data: input }),
    onSuccess: () => { toast.success("Decisión registrada"); qc.invalidateQueries({ queryKey: ["admin-kyc"] }); setReason(""); setSelected(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <AdminPageHeader title="Cola KYC" description="Aprobación de identidad · Analista KYC" />
      <AdminCard>
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase">
            <tr className="text-left border-b border-white/10">
              <th className="py-2">Usuario</th><th>Email</th><th>CURP</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((p) => (
              <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-2 text-gray-200">{p.first_name} {p.last_name}</td>
                <td className="text-gray-400">{p.email}</td>
                <td className="text-gray-500 font-mono text-xs">{p.curp ?? "—"}</td>
                <td>
                  <span className={
                    p.kyc_status === "approved" ? "text-green-400" :
                    p.kyc_status === "rejected" ? "text-red-400" :
                    "text-yellow-400"
                  }>{p.kyc_status}</span>
                </td>
                <td>
                  <button onClick={() => setSelected(p.id)}
                    className="text-[11px] text-[#A78BFA] hover:underline">Revisar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminCard>

      {selected && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <AdminCard className="max-w-md w-full">
            <h3 className="text-white font-semibold mb-3">Decisión KYC</h3>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo (obligatorio, mínimo 3 caracteres)"
              className="w-full bg-[#0A0A0B] border border-white/10 rounded-lg p-2 text-sm text-white h-24 mb-3" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setSelected(null)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancelar</button>
              <button disabled={reason.length < 3 || m.isPending}
                onClick={() => m.mutate({ userId: selected, decision: "rejected", reason })}
                className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 rounded disabled:opacity-40">Rechazar</button>
              <button disabled={reason.length < 3 || m.isPending}
                onClick={() => m.mutate({ userId: selected, decision: "approved", reason })}
                className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-500 rounded disabled:opacity-40">Aprobar</button>
            </div>
          </AdminCard>
        </div>
      )}
    </>
  );
}
