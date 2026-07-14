import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { createOrganization } from "@/lib/orgs.functions";
import { useCurrentOrg } from "@/hooks/use-current-org";

export const Route = createFileRoute("/_authenticated/settings/organization/new")({
  component: NewOrg,
});

function NewOrg() {
  const create = useServerFn(createOrganization);
  const { refetch, setCurrentOrgId } = useCurrentOrg();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [rfc, setRfc] = useState("");
  const [razon, setRazon] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const org = await create({ data: { name, rfc: rfc || null, razon_social: razon || null } });
      toast.success("Organización creada");
      await refetch();
      setCurrentOrgId(org.id);
      navigate({ to: "/settings/organization" });
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-xl font-bold text-yo-txt flex items-center gap-2 mb-1">
        <Building2 className="size-5" /> Nueva organización
      </h1>
      <p className="text-xs text-yo-txt-3 mb-5">
        Crea una organización para invitar a tu equipo y separar tus operaciones.
      </p>

      <form onSubmit={submit} className="space-y-4 rounded-lg border border-yo-border bg-yo-surface p-4">
        <div>
          <label className="text-xs font-medium text-yo-txt-2">Nombre de la organización *</label>
          <input
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-md border border-yo-border bg-yo-bg text-sm focus:outline-none focus:border-yo-ac"
            placeholder="Mi empresa SA de CV"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-yo-txt-2">RFC (opcional)</label>
          <input
            value={rfc}
            onChange={(e) => setRfc(e.target.value.toUpperCase())}
            maxLength={13}
            className="mt-1 w-full px-3 py-2 rounded-md border border-yo-border bg-yo-bg text-sm uppercase focus:outline-none focus:border-yo-ac"
            placeholder="XAXX010101000"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-yo-txt-2">Razón social (opcional)</label>
          <input
            value={razon}
            onChange={(e) => setRazon(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-md border border-yo-border bg-yo-bg text-sm focus:outline-none focus:border-yo-ac"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 rounded-md bg-yo-ac text-white font-medium text-sm hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Creando…" : "Crear organización"}
        </button>
      </form>
    </div>
  );
}
