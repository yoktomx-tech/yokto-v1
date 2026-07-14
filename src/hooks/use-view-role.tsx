import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ViewRole = "seller" | "buyer";

const LS_KEY = "yokto.viewRole";

interface Ctx {
  role: ViewRole;
  setRole: (r: ViewRole) => void;
}

const ViewRoleContext = createContext<Ctx | null>(null);

export function ViewRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<ViewRole>("seller");

  useEffect(() => {
    const v = window.localStorage.getItem(LS_KEY);
    if (v === "seller" || v === "buyer") setRoleState(v);
  }, []);

  const setRole = (r: ViewRole) => {
    setRoleState(r);
    window.localStorage.setItem(LS_KEY, r);
  };

  return <ViewRoleContext.Provider value={{ role, setRole }}>{children}</ViewRoleContext.Provider>;
}

export function useViewRole() {
  const ctx = useContext(ViewRoleContext);
  if (!ctx) throw new Error("useViewRole must be used inside <ViewRoleProvider>");
  return ctx;
}
