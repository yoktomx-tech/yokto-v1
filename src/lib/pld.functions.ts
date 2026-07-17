// Módulo PLD/FT — funciones de servidor
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { evaluatePldRisk, stubScreening, type PldQuestionnaireInput } from "@/lib/pld-engine";

const questionnaireSchema = z.object({
  org_id: z.string().uuid(),
  actividad_economica: z.string().min(3).max(200),
  actividad_scian: z.string().max(10).optional().nullable(),
  sector: z.string().max(120).optional().nullable(),
  origen_recursos: z.string().min(10).max(1000),
  destino_recursos: z.string().max(1000).optional().nullable(),
  volumen_mensual_estimado: z.number().nonnegative(),
  operaciones_mensuales_estimadas: z.number().int().nonnegative(),
  ticket_promedio_estimado: z.number().nonnegative().optional().nullable(),
  paises_operacion: z.array(z.string().length(2)).default(["MX"]),
  estados_operacion: z.array(z.string()).default([]),
  usa_efectivo: z.boolean(),
  efectivo_mensual_estimado: z.number().nonnegative().optional().nullable(),
  es_pep: z.boolean(),
  pep_detalle: z.record(z.unknown()).optional().nullable(),
  familiar_pep: z.boolean(),
  proposito_cuenta: z.string().min(10).max(500),
  beneficiario_final: z.record(z.unknown()).optional().nullable(),
});

// Guarda el cuestionario, ejecuta screening stub y calcula el perfil de riesgo.
export const submitPldQuestionnaire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => questionnaireSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verificar membresía activa como owner o auditor
    const { data: mem } = await supabase
      .from("memberships")
      .select("org_role")
      .eq("org_id", data.org_id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!mem || !["owner", "auditor"].includes(mem.org_role)) {
      throw new Error("No tienes permisos para completar el cuestionario PLD/FT de esta organización.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Versión incremental
    const { data: prev } = await supabaseAdmin
      .from("pld_questionnaires")
      .select("version")
      .eq("org_id", data.org_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (prev?.version ?? 0) + 1;

    // Perfil del titular (para screening)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name, curp, rfc")
      .eq("id", userId)
      .maybeSingle();
    const nombre = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Titular";

    // 1) Guardar cuestionario
    const { data: quest, error: qErr } = await supabaseAdmin
      .from("pld_questionnaires")
      .insert({
        org_id: data.org_id,
        user_id: userId,
        actividad_economica: data.actividad_economica,
        actividad_scian: data.actividad_scian,
        sector: data.sector,
        origen_recursos: data.origen_recursos,
        destino_recursos: data.destino_recursos,
        volumen_mensual_estimado: data.volumen_mensual_estimado,
        operaciones_mensuales_estimadas: data.operaciones_mensuales_estimadas,
        ticket_promedio_estimado: data.ticket_promedio_estimado,
        paises_operacion: data.paises_operacion,
        estados_operacion: data.estados_operacion,
        usa_efectivo: data.usa_efectivo,
        efectivo_mensual_estimado: data.efectivo_mensual_estimado,
        es_pep: data.es_pep,
        pep_detalle: data.pep_detalle,
        familiar_pep: data.familiar_pep,
        proposito_cuenta: data.proposito_cuenta,
        beneficiario_final: data.beneficiario_final,
        completado: true,
        version: nextVersion,
        respuestas_raw: data,
      })
      .select("id")
      .single();
    if (qErr) throw new Error(`No se pudo guardar el cuestionario: ${qErr.message}`);

    // 2) Screening stub del titular
    const screeningResults = stubScreening(nombre, profile?.curp);
    await supabaseAdmin.from("pld_screening_results").insert(
      screeningResults.map(r => ({
        org_id: data.org_id,
        subject_type: "titular",
        subject_name: nombre,
        subject_curp: profile?.curp ?? null,
        subject_rfc: profile?.rfc ?? null,
        lista: r.lista,
        status: r.status,
        match_score: r.status === "coincidencia_fuerte" ? 92 : r.status === "coincidencia_debil" ? 58 : 5,
        provider: "internal_stub",
      })),
    );

    // 3) Evaluar riesgo
    const questionInput: PldQuestionnaireInput = data;
    const result = evaluatePldRisk(questionInput, screeningResults);

    // 4) Upsert perfil de riesgo
    const nextReview = new Date();
    nextReview.setMonth(nextReview.getMonth() + result.nextReviewMonths);

    const { data: profileRow } = await supabaseAdmin
      .from("pld_risk_profiles")
      .upsert({
        org_id: data.org_id,
        score: result.score,
        level: result.level,
        status: result.level === "inaceptable" ? "bloqueado" : "vigente",
        last_evaluated_at: new Date().toISOString(),
        next_review_at: nextReview.toISOString(),
        evaluated_by: userId,
        factors_summary: { factors: result.factors, screening_count: screeningResults.length },
      }, { onConflict: "org_id" })
      .select("id")
      .single();

    // 5) Persistir factores (reemplazando anteriores)
    if (profileRow) {
      await supabaseAdmin.from("pld_risk_factors").delete().eq("profile_id", profileRow.id);
      if (result.factors.length > 0) {
        await supabaseAdmin.from("pld_risk_factors").insert(
          result.factors.map(f => ({
            org_id: data.org_id,
            profile_id: profileRow.id,
            category: f.category,
            code: f.code,
            label: f.label,
            weight: f.weight,
            value: f.value,
            contribution: f.contribution,
            detail: f.detail ?? null,
          })),
        );
      }
    }

    // 6) Alertas críticas
    if (result.level === "inaceptable" || result.level === "alto") {
      await supabaseAdmin.from("pld_alerts").insert({
        org_id: data.org_id,
        code: `RISK_${result.level.toUpperCase()}`,
        title: result.level === "inaceptable"
          ? "Perfil PLD/FT clasificado como inaceptable"
          : "Perfil PLD/FT clasificado como alto riesgo",
        description: `El motor calculó un puntaje de ${result.score}/100. Requiere revisión de cumplimiento.`,
        severity: result.level === "inaceptable" ? "critica" : "alta",
        payload: { score: result.score, factors: result.factors },
      });
    }

    return {
      questionnaire_id: quest.id,
      score: result.score,
      level: result.level,
      factors: result.factors,
      next_review_at: nextReview.toISOString(),
    };
  });

// Perfil actual + factores + últimas alertas.
export const getPldOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ org_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: profile }, { data: questionnaire }, { data: factors }, { data: alerts }, { data: screening }] =
      await Promise.all([
        supabase.from("pld_risk_profiles").select("*").eq("org_id", data.org_id).maybeSingle(),
        supabase.from("pld_questionnaires").select("*").eq("org_id", data.org_id)
          .order("version", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("pld_risk_factors").select("*").eq("org_id", data.org_id)
          .order("evaluated_at", { ascending: false }).limit(50),
        supabase.from("pld_alerts").select("*").eq("org_id", data.org_id)
          .order("detected_at", { ascending: false }).limit(20),
        supabase.from("pld_screening_results").select("*").eq("org_id", data.org_id)
          .order("evaluated_at", { ascending: false }).limit(50),
      ]);
    return { profile, questionnaire, factors: factors ?? [], alerts: alerts ?? [], screening: screening ?? [] };
  });
