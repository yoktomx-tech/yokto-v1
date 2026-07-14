import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Suscripción realtime al Centro de Pagos.
 * Invalida el cache de `payments-center` cuando cambian payment_intents, payouts o disputes.
 */
export function usePaymentsRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("payments-center-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_intents" }, () => {
        qc.invalidateQueries({ queryKey: ["payments-center"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "payouts" }, () => {
        qc.invalidateQueries({ queryKey: ["payments-center"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "disputes" }, () => {
        qc.invalidateQueries({ queryKey: ["payments-center"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
