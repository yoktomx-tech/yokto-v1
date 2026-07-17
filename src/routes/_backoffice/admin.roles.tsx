import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminCard, AdminPageHeader } from "@/components/admin/admin-shell";
import {
  adminListStaff, adminSearchUsers, adminAssignRole, adminRevokeRole, getMyInternalRole,
} from "@/lib/admin/admin.functions";
import {
  INTERNAL_ROLES, INTERNAL_ROLE_LABEL, RESOURCE_LABEL, describePermissions,
  type InternalRole,
} from "@/lib/admin/permissions";
import { toast } from "sonner";
import { Shield, X } from "lucide-react";

export const Route = createFileRoute("/_backoffice/admin/roles")({
  component: AdminRoles,
});

function AdminRoles() {
  const who = useServerFn(getMyInternalRole);
  const { data: me } = useQuery({ queryKey: ["internal-role"], queryFn: () => who() });
  const listFn = useServerFn(adminListStaff);
  const { data: staff } = useQuery({ queryKey: ["admin-staff"], queryFn: () => listFn() });
  const [showAssign, setShowAssign] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  if (me?.role !== "YOKTO_SUPER_ADMIN") {
    return (
      <>
        <AdminPageHeader title="Roles internos" />
        <AdminCard>
          <p className="text-sm text-gray-400">Solo el Super Administrador puede gestionar roles internos.</p>
        </AdminCard>
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        title="Roles internos"
        description="Delegación de permisos del staff YOKTO — requiere motivo y MFA"
        actions={
          <button onClick={() => setShowAssign(true)}
            className="px-4 py-2 bg-[#7C3AED] hover:bg-[#8B5CF6] rounded-lg text-xs font-semibold text-white">
            + Asignar rol
          </button>
        }
      />

      <AdminCard>
        <h3 className="text-sm font-semibold text-white mb-3">Staff con rol asignado</h3>
        {(staff ?? []).length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Sin asignaciones registradas.</p>
        ) : (
          <div className="space-y-2">
            {(staff ?? []).map((s) => (
              <div key={s.id} className="p-3 border border-white/5 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">
                    {s.profile?.first_name ?? "—"} {s.profile?.last_name ?? ""}{" "}
                    <span className="text-gray-500 text-xs">· {s.profile?.email}</span>
                  </p>
                  <p className="text-xs text-[#A78BFA] mt-0.5">{INTERNAL_ROLE_LABEL[s.rol as InternalRole]}</p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {s.activo ? "Activo" : "Revocado"} · {new Date(s.created_at).toLocaleDateString("es-MX")}
                    {" · "}{s.motivo}
                  </p>
                </div>
                {s.activo && (
                  <button onClick={() => setRevokeId(s.id)}
                    className="text-[11px] text-red-400 hover:text-red-300">Revocar</button>
                )}
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      {showAssign && <AssignRoleModal onClose={() => setShowAssign(false)} />}
      {revokeId && <RevokeRoleModal id={revokeId} onClose={() => setRevokeId(null)} />}
    </>
  );
}

function AssignRoleModal({ onClose }: { onClose: () => void }) {
  const search = useServerFn(adminSearchUsers);
  const assign = useServerFn(adminAssignRole);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<{ id: string; email: string | null; first_name: string | null; last_name: string | null } | null>(null);
  const [role, setRole] = useState<InternalRole>("ANALISTA_KYC");
  const [reason, setReason] = useState("");
  const [mfa, setMfa] = useState(false);

  const { data: results } = useQuery({
    queryKey: ["user-search", q],
    queryFn: () => search({ data: { q } }),
    enabled: q.length >= 2,
  });

  const m = useMutation({
    mutationFn: () => assign({ data: { userId: selected!.id, role, reason, mfaConfirmed: mfa } }),
    onSuccess: () => { toast.success("Rol asignado"); qc.invalidateQueries({ queryKey: ["admin-staff"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const perms = describePermissions(role).filter((p) => p.level !== "NONE");

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <AdminCard className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Asignar rol interno</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        {!selected ? (
          <>
            <label className="text-[11px] text-gray-400 uppercase">Buscar usuario</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Email, nombre o RFC"
              className="w-full bg-[#0A0A0B] border border-white/10 rounded p-2 text-sm text-white mb-2" />
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {(results ?? []).map((u) => (
                <button key={u.id} onClick={() => setSelected(u)}
                  className="w-full text-left p-2 hover:bg-white/5 rounded text-sm text-gray-200">
                  {u.first_name} {u.last_name} <span className="text-gray-500 text-xs">· {u.email}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="p-3 bg-[#0A0A0B] border border-white/5 rounded mb-3">
              <p className="text-sm text-white">{selected.first_name} {selected.last_name}</p>
              <p className="text-xs text-gray-500">{selected.email}</p>
              <button onClick={() => setSelected(null)} className="text-[10px] text-[#A78BFA] mt-1">Cambiar</button>
            </div>

            <label className="text-[11px] text-gray-400 uppercase">Rol interno</label>
            <select value={role} onChange={(e) => setRole(e.target.value as InternalRole)}
              className="w-full bg-[#0A0A0B] border border-white/10 rounded p-2 text-sm text-white mb-3">
              {INTERNAL_ROLES.map((r) => <option key={r} value={r}>{INTERNAL_ROLE_LABEL[r]}</option>)}
            </select>

            <div className="mb-3 p-3 bg-[#0A0A0B] border border-white/5 rounded">
              <p className="text-[11px] text-gray-400 uppercase mb-2 flex items-center gap-1"><Shield className="w-3 h-3" /> Este rol podrá:</p>
              <ul className="text-xs space-y-0.5">
                {perms.map((p) => (
                  <li key={p.resource}>
                    <span className={p.level === "ACT" ? "text-green-400" : "text-yellow-400"}>
                      {p.level === "ACT" ? "✅" : "👁"}
                    </span>{" "}
                    <span className="text-gray-300">{RESOURCE_LABEL[p.resource]}</span>
                    <span className="text-gray-500 ml-1">({p.level === "ACT" ? "actuar" : "solo lectura"})</span>
                  </li>
                ))}
              </ul>
            </div>

            <label className="text-[11px] text-gray-400 uppercase">Motivo (obligatorio)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)}
              className="w-full bg-[#0A0A0B] border border-white/10 rounded p-2 text-sm text-white h-20 mb-3" />

            <label className="flex items-center gap-2 text-xs text-gray-300 mb-3">
              <input type="checkbox" checked={mfa} onChange={(e) => setMfa(e.target.checked)} />
              Confirmo con MFA / reautenticación
            </label>

            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-400">Cancelar</button>
              <button disabled={!mfa || reason.length < 5 || m.isPending}
                onClick={() => m.mutate()}
                className="px-3 py-1.5 text-xs bg-[#7C3AED] hover:bg-[#8B5CF6] disabled:opacity-40 rounded text-white">
                Asignar rol
              </button>
            </div>
          </>
        )}
      </AdminCard>
    </div>
  );
}

function RevokeRoleModal({ id, onClose }: { id: string; onClose: () => void }) {
  const revoke = useServerFn(adminRevokeRole);
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [mfa, setMfa] = useState(false);
  const m = useMutation({
    mutationFn: () => revoke({ data: { assignmentId: id, reason, mfaConfirmed: mfa } }),
    onSuccess: () => { toast.success("Rol revocado"); qc.invalidateQueries({ queryKey: ["admin-staff"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <AdminCard className="max-w-md w-full">
        <h3 className="text-white font-semibold mb-3">Revocar rol interno</h3>
        <p className="text-xs text-gray-400 mb-3">
          El historial conservará el rol usado en cada acción previa. La revocación queda auditada.
        </p>
        <label className="text-[11px] text-gray-400 uppercase">Motivo</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)}
          className="w-full bg-[#0A0A0B] border border-white/10 rounded p-2 text-sm text-white h-20 mb-3" />
        <label className="flex items-center gap-2 text-xs text-gray-300 mb-3">
          <input type="checkbox" checked={mfa} onChange={(e) => setMfa(e.target.checked)} />
          Confirmo con MFA / reautenticación
        </label>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-400">Cancelar</button>
          <button disabled={!mfa || reason.length < 5 || m.isPending}
            onClick={() => m.mutate()}
            className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 disabled:opacity-40 rounded text-white">
            Revocar
          </button>
        </div>
      </AdminCard>
    </div>
  );
}
