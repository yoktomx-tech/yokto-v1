import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SearchHit = {
  kind: "transaction" | "dispute" | "ticket" | "article";
  id: string;
  title: string;
  subtitle?: string | null;
  to: string;
  meta?: string | null;
};

export const globalSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ q: z.string().min(1).max(100) }).parse(i))
  .handler(async ({ data, context }): Promise<SearchHit[]> => {
    const q = data.q.trim();
    if (!q) return [];
    const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
    const { supabase, userId } = context;

    const [txsRes, dispRes, tksRes, artsRes] = await Promise.all([
      supabase
        .from("transactions")
        .select("id,numero,description,beneficiario_nombre,counterparty_email,status,amount_cents,currency")
        .or(
          `numero.ilike.${like},description.ilike.${like},beneficiario_nombre.ilike.${like},counterparty_email.ilike.${like}`,
        )
        .limit(6),
      supabase
        .from("disputes")
        .select("id,numero,reason_code,reason_description,status")
        .or(`numero.ilike.${like},reason_code.ilike.${like},reason_description.ilike.${like}`)
        .limit(4),
      supabase
        .from("support_tickets")
        .select("id,numero,subject,status,priority")
        .eq("user_id", userId)
        .or(`numero.ilike.${like},subject.ilike.${like},description.ilike.${like}`)
        .limit(4),
      supabase
        .from("help_articles")
        .select("id,slug,title,summary")
        .eq("is_published", true)
        .or(`title.ilike.${like},summary.ilike.${like},tags.cs.{${q.toLowerCase()}}`)
        .limit(4),
    ]);

    const hits: SearchHit[] = [];

    for (const t of txsRes.data ?? []) {
      hits.push({
        kind: "transaction",
        id: t.id,
        title: t.numero ?? "Operación",
        subtitle: t.description ?? t.beneficiario_nombre ?? t.counterparty_email ?? null,
        to: `/transactions/${t.id}`,
        meta: t.status ?? null,
      });
    }
    for (const d of dispRes.data ?? []) {
      hits.push({
        kind: "dispute",
        id: d.id,
        title: d.numero ?? "Disputa",
        subtitle: d.reason_description ?? d.reason_code ?? null,
        to: `/disputes/${d.id}`,
        meta: d.status ?? null,
      });
    }
    for (const t of tksRes.data ?? []) {
      hits.push({
        kind: "ticket",
        id: t.id,
        title: t.numero ?? "Ticket",
        subtitle: t.subject ?? null,
        to: `/support/tickets/${t.id}`,
        meta: t.status ?? null,
      });
    }
    for (const a of artsRes.data ?? []) {
      hits.push({
        kind: "article",
        id: a.id,
        title: a.title,
        subtitle: a.summary ?? null,
        to: `/help/${a.slug}`,
      });
    }

    return hits;
  });
