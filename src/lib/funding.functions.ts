import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Lista transacciones del usuario actual (como comprador) que están
 * en estado `awaiting_funding` y pueden fondearse desde el wizard.
 */
export const listFundableTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("transactions")
      .select("id, numero, title, amount_cents, currency, beneficiario_nombre, counterparty_email, created_at, status")
      .eq("buyer_id", userId)
      .eq("status", "awaiting_funding")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
