import { Shield, Crown, Wallet, Wrench, Eye, ClipboardCheck, User } from "lucide-react";
import { useCurrentOrg, type OrgRole } from "@/hooks/use-current-org";

const ROLE_META: Record<OrgRole, { label: string; desc: string; Icon: typeof Shield }> = {
  owner:        { label: "Propietario",     desc: "Control total de la organización",         Icon: Crown },
  buyer_admin:  { label: "Admin comprador", desc: "Administra operaciones de compra",         Icon: Shield },
  buyer_user:   { label: "Comprador",       desc: "Crea y fondea operaciones",                Icon: User },
  seller_admin: { label: "Admin vendedor",  desc: "Administra operaciones de venta",          Icon: Wrench },
  seller_user:  { label: "Vendedor",        desc: "Envía hitos y evidencia",                  Icon: Wallet },
  auditor:      { label: "Auditor",         desc: "Solo lectura para revisión",               Icon: Eye },
};

/**
 * Muestra el org_role real del usuario en la organización activa.
 * Solo lectura: el rol se define por membresía, no se elige desde la UI.
 */
export function OrgRoleBadge() {
  const { currentOrg } = useCurrentOrg();
  if (!currentOrg) return null;

  const meta = ROLE_META[currentOrg.org_role] ?? {
    label: currentOrg.org_role,
    desc: "Rol en la organización",
    Icon: ClipboardCheck,
  };
  const Icon = meta.Icon;

  return (
    <div
      className="flex items-center gap-2 h-9 px-2.5 rounded-md border border-yo-border bg-yo-bg"
      title={`${meta.label} · ${meta.desc}`}
      aria-label={`Rol actual: ${meta.label}`}
    >
      <Icon className="size-3.5 text-yo-ac shrink-0" />
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-yo-txt-3">
          Rol
        </span>
        <span className="text-[12.5px] font-semibold text-yo-txt">{meta.label}</span>
      </div>
    </div>
  );
}
