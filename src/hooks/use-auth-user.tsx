import { createContext, useContext, type ReactNode } from "react";

type Ctx = { userId: string; email: string | null; displayName?: string };

const AuthUserContext = createContext<Ctx | null>(null);

export function AuthUserProvider({ value, children }: { value: Ctx; children: ReactNode }) {
  return <AuthUserContext.Provider value={value}>{children}</AuthUserContext.Provider>;
}

export function useAuthUser(): Ctx {
  return useContext(AuthUserContext) ?? { userId: "", email: null };
}
