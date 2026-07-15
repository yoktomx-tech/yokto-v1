import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PersonType } from "@/lib/score-mock";

/**
 * Derives the compliance PersonType (PF | PFAE | PM) from the current user's
 * profile. Reads `profiles.account_type` and `profiles.regimen_fiscal` to
 * distinguish PFAE (Persona Física con Actividad Empresarial, régimen 612)
 * from PF (asalariados / sin actividad empresarial).
 */
export function usePersonType(): { personType: PersonType; loading: boolean } {
  const [personType, setPersonType] = useState<PersonType>("PM");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) return;
        const { data } = await supabase
          .from("profiles")
          .select("account_type, regimen_fiscal")
          .eq("id", uid)
          .maybeSingle();
        if (cancelled || !data) return;
        if (data.account_type === "persona_moral") {
          setPersonType("PM");
        } else if (data.account_type === "persona_fisica") {
          const isPFAE = String(data.regimen_fiscal ?? "").startsWith("612");
          setPersonType(isPFAE ? "PFAE" : "PF");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { personType, loading };
}
