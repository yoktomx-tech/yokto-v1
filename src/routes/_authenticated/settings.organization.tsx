import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Copy, Mail, Plus, Trash2, User, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  createOrganization,
  inviteMember,
  listOrgInvitations,
  listOrgMembers,
  removeMember,
  updateMemberRole,
} from "@/lib/orgs.functions";
import { useCurrentOrg, type OrgRole } from "@/hooks/use-current-org";

export const Route = createFileRoute("/_authenticated/settings/organization")({
  component: OrgSettings,
});

const ROLE_OPTIONS: { value: OrgRole; label: string }[] = [
  { value: "owner", label: "Owner (control total)" },
  { value: "buyer_admin", label: "Comprador · Admin" },
  { value: "buyer_user", label: "Comprador · Usuario" },
  { value: "seller_admin", label: "Vendedor · Admin" },
  { value: "seller_user", label: "Vendedor · Usuario" },
  { value: "auditor", label: "Auditor (solo lectura)" },
];

function OrgSettings() {
  const { currentOrg, refetch, can } = useCurrentOrg();
  const qc = useQueryClient();
  const listMembers = useServerFn(listOrgMembers);
  const listInvs = useServerFn(listOrgInvitations);
  const invite = useServerFn(inviteMember);
  const remove = useServerFn(removeMember);
  const updateRole = useServerFn(updateMemberRole);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("buyer_user");

  const membersQ = useQuery({
    queryKey: ["org-members", currentOrg?.id],
    queryFn: () => listMembers({ data: { org_id: currentOrg!.id } }),
    enabled: !!currentOrg,
  });

  const invsQ = useQuery({
    queryKey: ["org-invs", currentOrg?.id],
    queryFn: () => listInvs({ data: { org_id: currentOrg!.id } }),
    enabled: !!currentOrg && can("member.manage"),
  });

  const inviteMut = useMutation({
    mutationFn: (input: { email: string; org_role: OrgRole }) =>
      invite({ data: { org_id: currentOrg!.id, ...input } }),
    onSuccess: (inv) => {
      const link = `${window.location.origin}/invitations/${inv.token}`;
      navigator.clipboard.writeText(link).catch(() => {});
      toast.success("Invitación creada", { description: "Link copiado al portapapeles" });
      setEmail("");
      qc.invalidateQueries({ queryKey: ["org-invs", currentOrg?.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo invitar"),
  });

  const removeMut = useMutation({
    mutationFn: (userId: string) => remove({ data: { org_id: currentOrg!.id, user_id: userId } }),
    onSuccess: () => {
      toast.success("Miembro removido");
      qc.invalidateQueries({ queryKey: ["org-members", currentOrg?.id] });
      refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo remover"),
  });

  const roleMut = useMutation({
    mutationFn: (input: { user_id: string; org_role: OrgRole }) =>
      updateRole({ data: { org_id: currentOrg!.id, ...input } }),
    onSuccess: () => {
      toast.success("Rol actualizado");
      qc.invalidateQueries({ queryKey: ["org-members", currentOrg?.id] });
    },
  });

  if (!currentOrg) {
    return <div className="p-6 text-sm text-yo-txt-3">Cargando organización…</div>;
  }

  const isOwner = can("member.manage");

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-yo-txt flex items-center gap-2">
            {currentOrg.type === "individual" ? <User className="size-5" /> : <Building2 className="size-5" />}
            {currentOrg.name}
          </h1>
          <p className="text-xs text-yo-txt-3 mt-1">
            {currentOrg.type === "individual" ? "Cuenta individual" : "Organización"}
            {currentOrg.rfc && ` · RFC ${currentOrg.rfc}`}
          </p>
        </div>
        <Link
          to="/settings/organization/new"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-yo-border bg-yo-surface hover:bg-yo-raised text-xs font-medium"
        >
          <Plus className="size-3.5" /> Nueva organización
        </Link>
      </header>

      {/* Invite */}
      {isOwner && (
        <section className="rounded-lg border border-yo-border bg-yo-surface p-4">
          <h2 className="text-sm font-semibold text-yo-txt flex items-center gap-2 mb-3">
            <UserPlus className="size-4" /> Invitar miembro
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!email) return;
              inviteMut.mutate({ email, org_role: role });
            }}
            className="flex flex-wrap gap-2"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@empresa.com"
              className="flex-1 min-w-[220px] px-3 py-2 rounded-md border border-yo-border bg-yo-bg text-sm focus:outline-none focus:border-yo-ac"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as OrgRole)}
              className="px-3 py-2 rounded-md border border-yo-border bg-yo-bg text-sm"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={inviteMut.isPending}
              className="px-4 py-2 rounded-md bg-yo-ac text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {inviteMut.isPending ? "Enviando…" : "Invitar"}
            </button>
          </form>
        </section>
      )}

      {/* Members */}
      <section className="rounded-lg border border-yo-border bg-yo-surface">
        <h2 className="text-sm font-semibold text-yo-txt px-4 py-3 border-b border-yo-border">
          Miembros ({membersQ.data?.length ?? 0})
        </h2>
        <div className="divide-y divide-yo-border">
          {membersQ.data?.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3 px-4 py-3">
              <div className="grid place-items-center size-8 rounded-full bg-yo-ac text-white text-xs font-bold shrink-0">
                {(m.first_name ?? m.email ?? "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-yo-txt truncate">
                  {[m.first_name, m.last_name].filter(Boolean).join(" ") || m.email}
                </p>
                <p className="text-xs text-yo-txt-3 truncate">{m.email}</p>
              </div>
              {isOwner ? (
                <select
                  value={m.org_role}
                  onChange={(e) => roleMut.mutate({ user_id: m.user_id, org_role: e.target.value as OrgRole })}
                  className="text-xs px-2 py-1 rounded border border-yo-border bg-yo-bg"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-yo-txt-3">{m.org_role}</span>
              )}
              {isOwner && m.org_role !== "owner" && (
                <button
                  onClick={() => {
                    if (confirm(`¿Remover a ${m.email}?`)) removeMut.mutate(m.user_id);
                  }}
                  className="p-1.5 rounded hover:bg-yo-raised text-yo-danger"
                  aria-label="Remover"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
          {!membersQ.data?.length && (
            <p className="px-4 py-6 text-xs text-yo-txt-3">Sin miembros aún.</p>
          )}
        </div>
      </section>

      {/* Invitations */}
      {isOwner && (
        <section className="rounded-lg border border-yo-border bg-yo-surface">
          <h2 className="text-sm font-semibold text-yo-txt px-4 py-3 border-b border-yo-border flex items-center gap-2">
            <Mail className="size-4" /> Invitaciones pendientes
          </h2>
          <div className="divide-y divide-yo-border">
            {invsQ.data?.filter((i: any) => !i.accepted_at).map((i: any) => (
              <div key={i.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-yo-txt truncate">{i.email}</p>
                  <p className="text-[11px] text-yo-txt-3">
                    {i.org_role} · expira {new Date(i.expires_at).toLocaleDateString("es-MX")}
                  </p>
                </div>
                <button
                  onClick={() => {
                    // Link is derived from token but token is only returned on create; owners can regenerate by re-inviting.
                    toast.info("Comparte el link que se copió al crear la invitación, o crea una nueva.");
                  }}
                  className="p-1.5 rounded hover:bg-yo-raised"
                  aria-label="Copiar link"
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
            ))}
            {!invsQ.data?.filter((i: any) => !i.accepted_at).length && (
              <p className="px-4 py-6 text-xs text-yo-txt-3">Sin invitaciones pendientes.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
