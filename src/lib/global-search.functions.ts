import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SearchKind = "transaction" | "dispute" | "ticket" | "article";

export type SearchHit = {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle?: string | null;
  to: string;
  meta?: string | null;
  score: number;
};

const PER_KIND_LIMIT = 8;
const TOTAL_LIMIT = 24;

function rank(q: string, ...fields: (string | null | undefined)[]): number {
  const needle = q.toLowerCase();
  let best = 0;
  for (const f of fields) {
    if (!f) continue;
    const hay = f.toLowerCase();
    if (hay === needle) best = Math.max(best, 100);
    else if (hay.startsWith(needle)) best = Math.max(best, 70);
    else {
      const i = hay.indexOf(needle);
      if (i === 0) best = Math.max(best, 60);
      else if (i > 0) {
        // word-boundary match ranks higher than mid-word
        const prev = hay[i - 1];
        best = Math.max(best, /\s|[-_./]/.test(prev) ? 45 : 30);
      }
    }
  }
  return best;
}

export const globalSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        q: z.string().min(1).max(100),
        orgId: z.string().uuid().optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<SearchHit[]> => {
    const q = data.q.trim();
    if (!q) return [];
    const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
    const { supabase, userId } = context;
    const orgId = data.orgId ?? null;

    // Tenant scoping: rely on RLS for authorization, plus explicit org filter
    // to keep result sets focused on the active workspace.
    let txQ = supabase
      .from("transactions")
      .select("id,numero,description,beneficiario_nombre,counterparty_email,status,buyer_id,seller_id")
      .or(
        `numero.ilike.${like},description.ilike.${like},beneficiario_nombre.ilike.${like},counterparty_email.ilike.${like}`,
      )
      .limit(PER_KIND_LIMIT * 2);
    if (orgId) txQ = txQ.or(`buyer_id.eq.${orgId},seller_id.eq.${orgId}`);

    let tksQ = supabase
      .from("support_tickets")
      .select("id,numero,subject,status,priority,org_id,user_id")
      .or(`numero.ilike.${like},subject.ilike.${like},description.ilike.${like}`)
      .limit(PER_KIND_LIMIT * 2);
    if (orgId) tksQ = tksQ.or(`org_id.eq.${orgId},user_id.eq.${userId}`);
    else tksQ = tksQ.eq("user_id", userId);

    const [txsRes, dispRes, tksRes, artsRes] = await Promise.all([
      txQ,
      supabase
        .from("disputes")
        .select("id,numero,reason_code,reason_description,status")
        .or(`numero.ilike.${like},reason_code.ilike.${like},reason_description.ilike.${like}`)
        .limit(PER_KIND_LIMIT * 2),
      tksQ,
      supabase
        .from("help_articles")
        .select("id,slug,title,summary")
        .eq("is_published", true)
        .or(`title.ilike.${like},summary.ilike.${like},tags.cs.{${q.toLowerCase()}}`)
        .limit(PER_KIND_LIMIT),
    ]);

    const bucket: Record<SearchKind, SearchHit[]> = {
      transaction: [], dispute: [], ticket: [], article: [],
    };

    for (const t of txsRes.data ?? []) {
      bucket.transaction.push({
        kind: "transaction",
        id: t.id,
        title: t.numero ?? "Operación",
        subtitle: t.description ?? t.beneficiario_nombre ?? t.counterparty_email ?? null,
        to: `/transactions/${t.id}`,
        meta: t.status ?? null,
        score: rank(q, t.numero, t.description, t.beneficiario_nombre, t.counterparty_email) + 5,
      });
    }
    for (const d of dispRes.data ?? []) {
      bucket.dispute.push({
        kind: "dispute",
        id: d.id,
        title: d.numero ?? "Disputa",
        subtitle: d.reason_description ?? d.reason_code ?? null,
        to: `/disputes/${d.id}`,
        meta: d.status ?? null,
        score: rank(q, d.numero, d.reason_code, d.reason_description) + 3,
      });
    }
    for (const t of tksRes.data ?? []) {
      bucket.ticket.push({
        kind: "ticket",
        id: t.id,
        title: t.numero ?? "Ticket",
        subtitle: t.subject ?? null,
        to: `/support/tickets/${t.id}`,
        meta: t.status ?? null,
        score: rank(q, t.numero, t.subject),
      });
    }
    for (const a of artsRes.data ?? []) {
      bucket.article.push({
        kind: "article",
        id: a.id,
        title: a.title,
        subtitle: a.summary ?? null,
        to: `/help/${a.slug}`,
        meta: null,
        score: rank(q, a.title, a.summary),
      });
    }

    const trim = (arr: SearchHit[]) =>
      arr.sort((a, b) => b.score - a.score).slice(0, PER_KIND_LIMIT);

    const merged = [
      ...trim(bucket.transaction),
      ...trim(bucket.dispute),
      ...trim(bucket.ticket),
      ...trim(bucket.article),
    ];
    merged.sort((a, b) => b.score - a.score);
    return merged.slice(0, TOTAL_LIMIT);
  });
