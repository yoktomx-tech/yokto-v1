import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, Check, ChevronDown, Plus, User } from "lucide-react";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  owner: "Propietario",
  buyer_admin: "Comprador · Admin",
  buyer_user: "Comprador",
  seller_admin: "Vendedor · Admin",
  seller_user: "Vendedor",
  auditor: "Auditor",
};

export function OrgSwitcher() {
  const { orgs, currentOrg, setCurrentOrgId } = useCurrentOrg();
  const [open, setOpen] = useState(false);

  if (!currentOrg) {
    return (
      <div className="text-xs text-yo-txt-3 px-2 py-1.5">Sin organización…</div>
    );
  }

  const Icon = currentOrg.type === "individual" ? User : Building2;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-yo-border bg-yo-surface hover:bg-yo-raised transition text-left w-full max-w-[240px]"
      >
        <Icon className="size-3.5 text-yo-txt-3 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-yo-txt truncate leading-tight">{currentOrg.name}</p>
          <p className="text-[10px] text-yo-txt-3 truncate leading-tight">
            {currentOrg.type === "individual" ? "Individual" : "Organización"} · {ROLE_LABEL[currentOrg.org_role] ?? currentOrg.org_role}
          </p>
        </div>
        <ChevronDown className={cn("size-3.5 text-yo-txt-3 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-0 right-0 bottom-full mb-1 z-50 w-72 rounded-lg border border-yo-border bg-yo-surface shadow-lg overflow-hidden">
            <div className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-yo-txt-3 border-b border-yo-border">
              Tus organizaciones
            </div>
            <div className="max-h-80 overflow-y-auto py-1">
              {orgs.map((o) => {
                const OIcon = o.type === "individual" ? User : Building2;
                const active = o.id === currentOrg.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => {
                      setCurrentOrgId(o.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 hover:bg-yo-raised text-left",
                      active && "bg-yo-ac-bg/40"
                    )}
                  >
                    <OIcon className="size-3.5 text-yo-txt-3 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-yo-txt truncate">{o.name}</p>
                      <p className="text-[10.5px] text-yo-txt-3 truncate">
                        {o.type === "individual" ? "Individual" : "Organización"} · {ROLE_LABEL[o.org_role] ?? o.org_role}
                      </p>
                    </div>
                    {active && <Check className="size-3.5 text-yo-ac shrink-0" />}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-yo-border p-1">
              <Link
                to="/settings/organization/new"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-yo-raised text-[13px] font-medium text-yo-txt"
              >
                <Plus className="size-3.5" /> Crear organización
              </Link>
              <Link
                to="/settings/organization"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-yo-raised text-[13px] text-yo-txt-2"
              >
                Administrar equipo
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
