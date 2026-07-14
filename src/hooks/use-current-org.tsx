import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMyOrganizations } from "@/lib/orgs.functions";

export type OrgRole = "owner" | "buyer_admin" | "buyer_user" | "seller_admin" | "seller_user" | "auditor";

export interface OrgSummary {
  id: string;
  name: string;
  slug: string | null;
  type: "individual" | "business";
  rfc: string | null;
  kyb_status: string;
  org_role: OrgRole;
}

interface OrgContextValue {
  orgs: OrgSummary[];
  currentOrg: OrgSummary | null;
  setCurrentOrgId: (id: string) => void;
  isLoading: boolean;
  refetch: () => void;
  can: (action: OrgAction) => boolean;
}

const LS_KEY = "yokto.currentOrgId";

const OrgContext = createContext<OrgContextValue | null>(null);

export type OrgAction =
  | "transaction.create"
  | "transaction.write"
  | "dispute.open"
  | "member.manage"
  | "org.edit"
  | "fiscal.upload"
  | "read";

const ROLE_ACTIONS: Record<OrgRole, OrgAction[]> = {
  owner: ["transaction.create", "transaction.write", "dispute.open", "member.manage", "org.edit", "fiscal.upload", "read"],
  buyer_admin: ["transaction.create", "transaction.write", "dispute.open", "fiscal.upload", "read"],
  buyer_user: ["transaction.create", "dispute.open", "fiscal.upload", "read"],
  seller_admin: ["transaction.write", "dispute.open", "fiscal.upload", "read"],
  seller_user: ["fiscal.upload", "read"],
  auditor: ["read"],
};

export function OrgProvider({ children }: { children: ReactNode }) {
  const list = useServerFn(listMyOrganizations);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-orgs"],
    queryFn: () => list(),
    staleTime: 30_000,
  });
  const orgs = (data ?? []) as OrgSummary[];

  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(LS_KEY);
  });

  useEffect(() => {
    if (!orgs.length) return;
    if (!currentOrgId || !orgs.find((o) => o.id === currentOrgId)) {
      const first = orgs[0].id;
      setCurrentOrgIdState(first);
      if (typeof window !== "undefined") window.localStorage.setItem(LS_KEY, first);
    }
  }, [orgs, currentOrgId]);

  const setCurrentOrgId = (id: string) => {
    setCurrentOrgIdState(id);
    if (typeof window !== "undefined") window.localStorage.setItem(LS_KEY, id);
  };

  const currentOrg = useMemo(
    () => orgs.find((o) => o.id === currentOrgId) ?? null,
    [orgs, currentOrgId]
  );

  const can = (action: OrgAction) => {
    if (!currentOrg) return false;
    return ROLE_ACTIONS[currentOrg.org_role]?.includes(action) ?? false;
  };

  return (
    <OrgContext.Provider value={{ orgs, currentOrg, setCurrentOrgId, isLoading, refetch, can }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useCurrentOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useCurrentOrg must be used inside <OrgProvider>");
  return ctx;
}
