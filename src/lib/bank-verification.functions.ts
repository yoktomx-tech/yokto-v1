// Server functions para el módulo "Verificación de cuenta bancaria".
// Integración con Verificamex Penny Test.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHmac } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateClabe } from "@/lib/validations/clabe";
import { decideBankAccountOwnership, mapProviderStatus, maskCLABE, maskCard } from "@/lib/bank-verification/decision";

const VERIFICAMEX_URL = "https://api.verificamex.com/identity/v1/penny-tests";

function hashQuery(query: string): string {
  const secret = process.env.BANK_ACCOUNT_HASH_SECRET ?? "";
  return createHmac("sha256", secret).update(query.replace(/\s+/g, "")).digest("hex");
}

async function loadExpectedHolder(supabase: ReturnType<typeof requireSupabaseAuth extends never ? never : any>, userId: string, orgId: string | null) {
  if (orgId) {
    const { data: org } = await supabase.from("organizations").select("name, rfc").eq("id", orgId).maybeSingle();
    return {
      name: org?.name ?? "",
      rfc: org?.rfc ?? null,
      curp: null as string | null,
    };
  }
  const { data: p } = await supabase
    .from("profiles")
    .select("first_name, last_name, second_last_name, legal_name, rfc, curp")
    .eq("id", userId)
    .maybeSingle();
  const name = p?.legal_name?.trim() || [p?.first_name, p?.last_name, p?.second_last_name].filter(Boolean).join(" ");
  return { name: name || "", rfc: p?.rfc ?? null, curp: p?.curp ?? null };
}

// ─── List ────────────────────────────────────────────────────────────────
export const listBankAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ orgId: z.string().uuid().nullable().optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase.from("bank_accounts").select("*").is("archived_at", null).order("created_at", { ascending: false });
    q = data.orgId ? q.eq("owner_org_id", data.orgId) : q.eq("owner_user_id", userId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ─── Create + start penny test in one call ───────────────────────────────
const CreateInput = z.object({
  orgId: z.string().uuid().nullable().optional(),
  accountType: z.enum(["CLABE", "DEBIT_CARD"]),
  query: z.string().min(16).max(19).transform((v) => v.replace(/\s+/g, "")),
  bankInstitutionClave: z.string().min(3).max(4).optional().nullable(),
  bankName: z.string().optional().nullable(),
});

export const createBankAccountAndStartPennyTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CreateInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Validación local
    if (data.accountType === "CLABE") {
      const check = validateClabe(data.query);
      if (!check.valid) throw new Error(check.error ?? "CLABE inválida");
    } else {
      if (!/^\d{15,19}$/.test(data.query)) throw new Error("Número de tarjeta inválido");
      if (!data.bankInstitutionClave) throw new Error("Selecciona la institución bancaria");
    }

    const expected = await loadExpectedHolder(supabase, userId, data.orgId ?? null);
    if (!expected.name) throw new Error("Completa tu Perfil de Cumplimiento antes de validar una cuenta");

    const query_hash = hashQuery(data.query);
    const query_last4 = data.query.slice(-4);
    const query_masked = data.accountType === "CLABE" ? maskCLABE(data.query) : maskCard(data.query);

    // Deduplicación
    const dup = await supabase
      .from("bank_accounts")
      .select("id, verification_status")
      .eq("query_hash", query_hash)
      .is("archived_at", null)
      .maybeSingle();
    if (dup.data) throw new Error("Esta cuenta ya está registrada en tu perfil.");

    // Insert cuenta bancaria (RLS aplica)
    const insert = await supabase
      .from("bank_accounts")
      .insert({
        owner_user_id: data.orgId ? null : userId,
        owner_org_id: data.orgId ?? null,
        account_type: data.accountType,
        query_hash,
        query_last4,
        query_masked,
        bank_institution_clave: data.bankInstitutionClave ?? null,
        bank_name: data.bankName ?? null,
        holder_expected_name: expected.name,
        holder_expected_rfc: expected.rfc,
        holder_expected_curp: expected.curp,
        verification_status: "LOCAL_VALIDATED",
        created_by: userId,
      })
      .select("*")
      .single();
    if (insert.error) throw new Error(insert.error.message);
    const bankAccount = insert.data;

    // Llamar a Verificamex
    const apiKey = process.env.VERIFICAMEX_API_KEY;
    if (!apiKey) throw new Error("Servicio de validación no configurado");

    const appUrl = (process.env.APP_URL ?? "https://secure-trust-mx.lovable.app").replace(/\/$/, "");
    const webhookToken = process.env.VERIFICAMEX_WEBHOOK_TOKEN ?? "";
    const webhook = `${appUrl}/api/public/hooks/verificamex-penny-test?token=${encodeURIComponent(webhookToken)}`;

    const body: Record<string, unknown> = { query: data.query, webhook };
    if (data.accountType === "DEBIT_CARD") body.bank_institution_clave = data.bankInstitutionClave;

    const res = await fetch(VERIFICAMEX_URL, {
      method: "POST",
      headers: { accept: "application/json", authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errTxt = await res.text().catch(() => "");
      const keyHint = `${apiKey.slice(0, 4)}…${apiKey.slice(-4)} (len ${apiKey.length})`;
      console.error("[verificamex] penny-test failed", { status: res.status, body: errTxt, keyHint, query: data.query });
      await supabase.from("bank_accounts").update({ verification_status: "ERROR" }).eq("id", bankAccount.id);
      const hint =
        res.status === 417
          ? " El proveedor rechazó el recurso. Suele indicar que la API key no corresponde al entorno (prueba vs producción) o que la CLABE/tarjeta no existe en el entorno de la key."
          : "";
      throw new Error(`No se pudo iniciar la validación bancaria (${res.status}).${hint} ${errTxt.slice(0, 200)}`);
    }

    const json = await res.json();
    const penny = json?.data ?? json;
    const providerUuid: string = penny?.uuid;
    if (!providerUuid) throw new Error("Verificamex no devolvió un UUID válido");

    const providerStatus: string = penny?.status ?? "SPEI_WAITING";
    const initialStatus = mapProviderStatus(providerStatus);

    // Persistir penny_test con service role (RLS solo SELECT para authenticated).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pennyIns = await supabaseAdmin
      .from("bank_account_penny_tests")
      .insert({
        bank_account_id: bankAccount.id,
        user_id: userId,
        provider: "VERIFICAMEX",
        provider_uuid: providerUuid,
        provider_status: providerStatus,
        type: data.accountType,
        query_masked,
        status: initialStatus === "WAITING_RESULT" ? "WAITING_RESULT" : "PENNY_CREATED",
        raw_response: json,
      })
      .select("*")
      .single();
    if (pennyIns.error) throw new Error(pennyIns.error.message);

    await supabase
      .from("bank_accounts")
      .update({ verification_status: initialStatus === "WAITING_RESULT" ? "WAITING_RESULT" : "PENNY_CREATED" })
      .eq("id", bankAccount.id);

    return {
      bankAccountId: bankAccount.id as string,
      pennyTestId: pennyIns.data.id as string,
      providerUuid,
      status: initialStatus as "WAITING_RESULT" | "PENNY_CREATED" | "ERROR",
    };
  });

// ─── Refresh estado del penny test (poll opcional) ───────────────────────
export const getBankAccountDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ bankAccountId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: acc, error: e1 }, { data: tests, error: e2 }] = await Promise.all([
      supabase.from("bank_accounts").select("*").eq("id", data.bankAccountId).maybeSingle(),
      supabase
        .from("bank_account_penny_tests")
        .select("*")
        .eq("bank_account_id", data.bankAccountId)
        .order("created_at", { ascending: false }),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    if (!acc) throw new Error("Cuenta bancaria no encontrada");
    return { account: acc, tests: tests ?? [] };
  });

// ─── Archivar cuenta ─────────────────────────────────────────────────────
export const archiveBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ bankAccountId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("bank_accounts")
      .update({ archived_at: new Date().toISOString(), is_primary: false, can_receive_payouts: false })
      .eq("id", data.bankAccountId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Marcar cuenta como principal ────────────────────────────────────────
export const setPrimaryBankAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ bankAccountId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: acc } = await supabase
      .from("bank_accounts")
      .select("id, owner_user_id, owner_org_id, verification_status")
      .eq("id", data.bankAccountId)
      .maybeSingle();
    if (!acc) throw new Error("Cuenta no encontrada");
    if (acc.verification_status !== "APPROVED") throw new Error("Solo cuentas validadas pueden ser principales");

    // Desmarcar otras
    if (acc.owner_org_id) {
      await supabase.from("bank_accounts").update({ is_primary: false }).eq("owner_org_id", acc.owner_org_id);
    } else {
      await supabase.from("bank_accounts").update({ is_primary: false }).eq("owner_user_id", userId);
    }
    const { error } = await supabase
      .from("bank_accounts")
      .update({ is_primary: true, can_receive_payouts: true })
      .eq("id", data.bankAccountId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Simular resultado (solo cuando VERIFICAMEX_API_KEY apunta a sandbox) ─
// Usada por la UI cuando el webhook aún no está disponible en el ambiente.
export const simulatePennyTestResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    pennyTestId: z.string().uuid(),
    receivedName: z.string().min(2),
    receivedRfcCurp: z.string().min(4).optional().nullable(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (process.env.NODE_ENV === "production" && process.env.VERIFICAMEX_ALLOW_SIMULATE !== "1") {
      throw new Error("Simulación deshabilitada en producción");
    }
    const { data: penny } = await supabase.from("bank_account_penny_tests").select("*, bank_accounts(*)").eq("id", data.pennyTestId).maybeSingle();
    if (!penny) throw new Error("Penny test no encontrado");
    const acc = (penny as unknown as { bank_accounts: { holder_expected_name: string; holder_expected_rfc: string | null; holder_expected_curp: string | null; id: string } }).bank_accounts;
    const decision = decideBankAccountOwnership({
      expectedName: acc.holder_expected_name,
      expectedRfc: acc.holder_expected_rfc,
      expectedCurp: acc.holder_expected_curp,
      receivedName: data.receivedName,
      receivedRfcCurp: data.receivedRfcCurp ?? null,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("bank_account_penny_tests").update({
      status: decision.decision,
      provider_status: "FINISHED",
      name_receiver: data.receivedName,
      rfc_curp_receiver: data.receivedRfcCurp ?? null,
      name_similarity: decision.name_similarity,
      rfc_curp_match: decision.rfc_curp_match,
      decision_reasons: decision.reasons,
      finished_at: new Date().toISOString(),
    }).eq("id", data.pennyTestId);

    await supabaseAdmin.from("bank_accounts").update({
      verification_status: decision.decision,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      can_receive_payouts: decision.decision === "APPROVED",
    }).eq("id", acc.id);

    return decision;
  });
