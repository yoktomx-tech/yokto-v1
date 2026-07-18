import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Building2, LifeBuoy, LogOut, Settings, User, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg, type OrgRole } from "@/hooks/use-current-org";
import { usePersonType } from "@/hooks/use-person-type";

interface ProfileInfo {
  first_name: string | null;
  last_name: string | null;
  second_last_name: string | null;
  account_type: string | null;
}

const ORG_ROLE_LABEL: Record<OrgRole, string> = {
  owner: "Propietario",
  buyer_admin: "Admin Comprador",
  buyer_user: "Comprador",
  seller_admin: "Admin Vendedor",
  seller_user: "Vendedor",
  auditor: "Auditor",
};

const PERSON_TYPE_LABEL: Record<string, string> = {
  PF: "Persona Física",
  PFAE: "Persona Física c/ Actividad Empresarial",
  PM: "Persona Moral",
};

export function UserMenu({ email }: { email?: string | null }) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const { currentOrg } = useCurrentOrg();
  const { personType } = usePersonType();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, second_last_name, account_type")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (!cancelled) setProfile(data ?? null);
    })();
    return () => { cancelled = true; };
  }, [email]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const fullName = [profile?.first_name, profile?.last_name, profile?.second_last_name]
    .filter(Boolean).join(" ").trim() || (email ? email.split("@")[0] : "Mi cuenta");

  const initials = (() => {
    const parts = [profile?.first_name, profile?.last_name, profile?.second_last_name]
      .filter(Boolean) as string[];
    if (parts.length) return parts.map((p) => p.charAt(0).toUpperCase()).join("").slice(0, 3);
    return (email ?? "U").slice(0, 1).toUpperCase();
  })();

  const roleLabel = currentOrg ? ORG_ROLE_LABEL[currentOrg.org_role] : null;
  const accountLabel = currentOrg?.type === "business" ? "Empresarial" : "Individual";
  const personLabel = personType ? PERSON_TYPE_LABEL[personType] : null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="grid place-items-center size-8 rounded-full bg-yo-ac text-white text-[10px] font-bold ring-1 ring-yo-border hover:ring-yo-ac transition"
        aria-label="Menú de usuario"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[320px] rounded-xl border border-yo-border bg-yo-surface shadow-xl overflow-hidden z-50">
          <div className="p-3 border-b border-yo-border bg-yo-ac-bg">
            <div className="flex items-start gap-3">
              <div className="size-11 shrink-0 grid place-items-center rounded-lg bg-yo-ac text-white text-[13px] font-bold tracking-wider">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-yo-txt truncate">{fullName}</p>
                <p className="text-[11px] text-yo-txt-3 truncate">{email ?? "Sesión activa"}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {roleLabel && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-yo-ac/30 bg-yo-surface text-[10px] font-medium text-yo-ac">
                      <UserRound className="size-2.5" /> {roleLabel}
                    </span>
                  )}
                  {personLabel && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-yo-border bg-yo-surface text-[10px] text-yo-txt-2">
                      {personLabel}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-yo-border bg-yo-surface text-[10px] text-yo-txt-2">
                    <Building2 className="size-2.5" /> {accountLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="p-2">
            <Link to="/profile" onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-yo-txt hover:bg-yo-raised transition">
              <User className="size-4 text-yo-txt-3" /> Mi perfil
            </Link>
            <Link to="/help" onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-yo-txt hover:bg-yo-raised transition">
              <LifeBuoy className="size-4 text-yo-txt-3" /> Centro de ayuda y soporte
            </Link>
            <Link to="/settings" onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-yo-txt hover:bg-yo-raised transition">
              <Settings className="size-4 text-yo-txt-3" /> Configuración
            </Link>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-yo-txt hover:bg-yo-raised border-t border-yo-border transition"
          >
            <LogOut className="size-4 text-yo-txt-3" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
