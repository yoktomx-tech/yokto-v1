// Módulo Identidad — Enrolamiento biométrico vía QR + móvil (Nubarium).
// Todas las funciones "mobile" usan token del QR (no requieren sesión Supabase).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─── Config ──────────────────────────────────────────────────────────────────
export const ENROLLMENT_TTL_MIN = 15;
// Similitud mínima de match facial requerida (0-100).
// Spec: 99.9000. Nubarium típicamente devuelve 0-100 (o 0-1 en algunos endpoints, normalizamos).
export const FACE_MATCH_MIN = 99.9;
export const ADDRESS_DOC_MAX_MONTHS = 3;

function nubariumAuth() {
  const user = process.env.NUBARIUM_USER;
  const pass = process.env.NUBARIUM_PASSWORD;
  if (!user || !pass) throw new Error("Credenciales Nubarium no configuradas");
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

async function logApi(
  admin: Awaited<ReturnType<typeof getAdmin>>,
  enrollmentId: string | null,
  userId: string | null,
  endpoint: string,
  httpStatus: number | null,
  ok: boolean,
  requestSummary: unknown,
  responseSummary: unknown,
  errorMessage?: string,
) {
  await admin.from("biometric_api_logs").insert({
    enrollment_id: enrollmentId,
    user_id: userId,
    endpoint,
    http_status: httpStatus,
    ok,
    request_summary: requestSummary as never,
    response_summary: responseSummary as never,
    error_message: errorMessage ?? null,
  });
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// Devuelve enrolamiento activo por token (o error).
async function loadByToken(token: string) {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("biometric_enrollments")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error || !data) throw new Error("Enrolamiento no encontrado");
  if (new Date(data.expires_at) < new Date() && data.status !== "completed") {
    throw new Error("La sesión ha expirado. Vuelve al ordenador y genera un nuevo QR.");
  }
  if (data.status === "failed") throw new Error("Esta sesión fue cancelada.");
  return { admin, enrollment: data };
}

// Sube base64 al bucket privado y devuelve path.
async function saveCapture(
  admin: Awaited<ReturnType<typeof getAdmin>>,
  userId: string,
  enrollmentId: string,
  kind: string,
  base64: string,
  mime: string,
): Promise<string> {
  const ext = mime.includes("png") ? "png"
    : mime.includes("pdf") ? "pdf"
    : mime.includes("webm") ? "webm"
    : mime.includes("mp4") ? "mp4"
    : "jpg";
  const bytes = Buffer.from(base64, "base64");
  const path = `${userId}/${enrollmentId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await admin.storage.from("biometric-captures").upload(path, bytes, {
    contentType: mime,
    upsert: true,
  });
  if (error) throw new Error("No se pudo guardar la captura: " + error.message);
  return path;
}

// ─── 1. Iniciar / re-iniciar enrolamiento (usuario logueado en desktop) ──────
export const startBiometricEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    // Reutilizar enrolamiento pending/en curso no expirado, si existe.
    const { data: existing } = await admin
      .from("biometric_enrollments")
      .select("id, token, expires_at, status")
      .eq("user_id", context.userId)
      .in("status", ["pending", "id_captured", "id_verified", "face_verified", "address_verified"])
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      return {
        id: existing.id,
        token: existing.token,
        expires_at: existing.expires_at,
        status: existing.status,
      };
    }
    const token = randomBytes(24).toString("base64url");
    const expires = new Date(Date.now() + ENROLLMENT_TTL_MIN * 60_000).toISOString();
    const { data, error } = await admin
      .from("biometric_enrollments")
      .insert({ user_id: context.userId, token, expires_at: expires, status: "pending" })
      .select("id, token, expires_at, status")
      .single();
    if (error || !data) throw new Error(error?.message ?? "No se pudo iniciar el enrolamiento");
    return data;
  });

// ─── 2. Polling desde desktop ────────────────────────────────────────────────
export const getMyBiometricEnrollment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    const { data } = await admin
      .from("biometric_enrollments")
      .select("id, token, status, expires_at, id_type, ocr_data, curp_match, face_score, face_match_ok, address_doc_ok, address_doc_type, lista_nominal_ok, completed_at, last_error")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  });

// ─── 3. Móvil: leer enrolamiento por token (sin sesión) ──────────────────────
export const getEnrollmentByToken = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { enrollment } = await loadByToken(data.token);
    // Recuperar CURP registrada en perfil para mostrar contexto y comparar.
    const admin = await getAdmin();
    const { data: profile } = await admin
      .from("profiles")
      .select("first_name, last_name, curp, rfc, account_type")
      .eq("id", enrollment.user_id)
      .maybeSingle();
    return {
      id: enrollment.id,
      status: enrollment.status,
      expires_at: enrollment.expires_at,
      id_type: enrollment.id_type,
      ocr_data: enrollment.ocr_data,
      curp_match: enrollment.curp_match,
      face_score: enrollment.face_score,
      face_match_ok: enrollment.face_match_ok,
      address_doc_ok: enrollment.address_doc_ok,
      lista_nominal_ok: enrollment.lista_nominal_ok,
      profile: profile ?? null,
    };
  });

// ─── 4. Móvil: OCR de identificación ─────────────────────────────────────────
const IdSubmitSchema = z.object({
  token: z.string().min(10),
  id_type: z.enum(["ine", "passport"]),
  front_base64: z.string().min(100),
  front_mime: z.string().default("image/jpeg"),
  back_base64: z.string().min(100).optional(),
  back_mime: z.string().default("image/jpeg"),
});

export const submitBiometricId = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => IdSubmitSchema.parse(i))
  .handler(async ({ data }) => {
    const { admin, enrollment } = await loadByToken(data.token);
    if (data.id_type === "ine" && !data.back_base64) {
      throw new Error("La INE requiere anverso y reverso");
    }

    // Guardar imágenes
    const frontPath = await saveCapture(admin, enrollment.user_id, enrollment.id, "id-front", data.front_base64, data.front_mime);
    const backPath = data.back_base64
      ? await saveCapture(admin, enrollment.user_id, enrollment.id, "id-back", data.back_base64, data.back_mime)
      : null;

    // OCR Nubarium
    const body: Record<string, string> = { id: data.front_base64 };
    if (data.back_base64) body.idReverso = data.back_base64;

    let httpStatus: number | null = null;
    let payload: Record<string, unknown> = {};
    try {
      const res = await fetch("https://ocr.nubarium.com/ocr/v1/obtener_datos_id", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: nubariumAuth() },
        body: JSON.stringify(body),
      });
      httpStatus = res.status;
      try { payload = (await res.json()) as Record<string, unknown>; } catch { /* ignore */ }
    } catch (e) {
      await logApi(admin, enrollment.id, enrollment.user_id, "ocr/obtener_datos_id", null, false, { id_type: data.id_type }, null, (e as Error).message);
      throw new Error("No se pudo contactar al servicio OCR");
    }

    const ok = String(payload.estatus ?? "") === "OK";
    await logApi(admin, enrollment.id, enrollment.user_id, "ocr/obtener_datos_id", httpStatus, ok, { id_type: data.id_type }, payload);
    if (!ok) {
      const mensaje = String(payload.mensaje ?? payload.message ?? "").trim();
      const codigo = String(payload.codigo ?? payload.code ?? "").trim();
      const base = mensaje || "No se pudieron leer los datos del documento. Repite la captura asegurando buena luz y enfoque.";
      const suffix = [codigo && `código ${codigo}`, httpStatus && `HTTP ${httpStatus}`].filter(Boolean).join(" · ");
      const msg = suffix ? `${base} (${suffix})` : base;
      await admin.from("biometric_enrollments").update({ last_error: msg, status: "pending" }).eq("id", enrollment.id);
      throw new Error(msg);
    }

    // Extraer CURP (puede venir en distintos campos según INE/pasaporte)
    const dr = payload as Record<string, unknown>;
    const curp = String(dr.curp ?? dr.CURP ?? "").toUpperCase().trim() || null;

    await admin.from("biometric_enrollments").update({
      id_type: data.id_type,
      id_front_path: frontPath,
      id_back_path: backPath,
      ocr_data: payload as never,
      ocr_curp: curp,
      status: "id_captured",
      last_error: null,
    }).eq("id", enrollment.id);

    // Comparar CURP con la del perfil + validar en RENAPO
    const { data: profile } = await admin.from("profiles").select("curp").eq("id", enrollment.user_id).maybeSingle();
    const profileCurp = String(profile?.curp ?? "").toUpperCase().trim();
    let curpMatch: boolean | null = null;
    let renapoPayload: Record<string, unknown> | null = null;

    if (curp && profileCurp) {
      curpMatch = curp === profileCurp;
      // Validar en RENAPO (aunque no coincida, para tener el registro)
      try {
        const res = await fetch("https://curp.nubarium.com/renapo/v3/valida_curp", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: nubariumAuth() },
          body: JSON.stringify({ curp }),
        });
        try { renapoPayload = (await res.json()) as Record<string, unknown>; } catch { /* ignore */ }
        await logApi(admin, enrollment.id, enrollment.user_id, "renapo/valida_curp", res.status, String(renapoPayload?.estatus ?? "") === "OK", { curp }, renapoPayload);
      } catch (e) {
        await logApi(admin, enrollment.id, enrollment.user_id, "renapo/valida_curp", null, false, { curp }, null, (e as Error).message);
      }
    }

    const nextStatus = curpMatch ? "id_verified" : "id_captured";
    const lastErr = curpMatch === false
      ? "La CURP del documento no coincide con la registrada. Repite la captura o cancela el biométrico."
      : null;
    await admin.from("biometric_enrollments").update({
      curp_match: curpMatch,
      curp_renapo_data: renapoPayload as never,
      status: nextStatus,
      last_error: lastErr,
    }).eq("id", enrollment.id);

    return {
      ocr_curp: curp,
      profile_curp: profileCurp || null,
      curp_match: curpMatch,
      renapo_ok: renapoPayload ? String(renapoPayload.estatus ?? "") === "OK" : null,
      status: nextStatus,
    };
  });

// ─── 5. Móvil: Selfie + video + match facial ─────────────────────────────────
const SelfieSchema = z.object({
  token: z.string().min(10),
  selfie_base64: z.string().min(100),
  selfie_mime: z.string().default("image/jpeg"),
  video_base64: z.string().min(100).optional(),
  video_mime: z.string().default("video/webm"),
});

export const submitBiometricSelfie = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => SelfieSchema.parse(i))
  .handler(async ({ data }) => {
    const { admin, enrollment } = await loadByToken(data.token);
    if (!enrollment.id_front_path) throw new Error("Primero debes capturar tu identificación");
    if (enrollment.curp_match === false) throw new Error("La CURP no coincide, no puedes continuar");

    const selfiePath = await saveCapture(admin, enrollment.user_id, enrollment.id, "selfie", data.selfie_base64, data.selfie_mime);
    const videoPath = data.video_base64
      ? await saveCapture(admin, enrollment.user_id, enrollment.id, "liveness", data.video_base64, data.video_mime)
      : null;

    // Recuperar foto de INE/pasaporte para comparar
    // Nubarium acepta base64 en `id` (foto de ID) e `imagen` (selfie).
    const { data: front } = await admin.storage.from("biometric-captures").download(enrollment.id_front_path);
    if (!front) throw new Error("No se pudo cargar la foto de identificación");
    const frontB64 = Buffer.from(await front.arrayBuffer()).toString("base64");

    let httpStatus: number | null = null;
    let payload: Record<string, unknown> = {};
    try {
      const res = await fetch("https://facial.nubarium.com/facial/v3/comparacion", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: nubariumAuth() },
        body: JSON.stringify({ id: frontB64, imagen: data.selfie_base64 }),
      });
      httpStatus = res.status;
      try { payload = (await res.json()) as Record<string, unknown>; } catch { /* ignore */ }
    } catch (e) {
      await logApi(admin, enrollment.id, enrollment.user_id, "facial/comparacion", null, false, {}, null, (e as Error).message);
      throw new Error("No se pudo contactar al servicio facial");
    }

    // Score puede venir como 0-1 o 0-100 según endpoint. Normalizamos a 0-100.
    let scoreRaw = Number(payload.similitud ?? payload.score ?? payload.confidence ?? 0);
    if (!Number.isFinite(scoreRaw)) scoreRaw = 0;
    const score = scoreRaw <= 1 ? scoreRaw * 100 : scoreRaw;
    const estatus = String(payload.estatus ?? "");
    const ok = estatus === "OK";
    const match = ok && score >= FACE_MATCH_MIN;

    await logApi(admin, enrollment.id, enrollment.user_id, "facial/comparacion", httpStatus, ok, { min: FACE_MATCH_MIN }, payload);
    await admin.from("biometric_enrollments").update({
      selfie_path: selfiePath,
      video_path: videoPath,
      face_score: score,
      face_match_ok: match,
      status: match ? "face_verified" : "id_verified",
      last_error: match ? null : `El rostro no coincide con la identificación (similitud ${score.toFixed(2)}%, se requiere ≥ ${FACE_MATCH_MIN}%). Repite la captura.`,
    }).eq("id", enrollment.id);

    return { score, match, min: FACE_MATCH_MIN };
  });

// ─── 6. Móvil: Comprobante de domicilio ──────────────────────────────────────
const ADDRESS_DOC_TYPES = ["cfe", "telmex", "izzi", "totalplay", "megacable", "agua", "gas", "predial", "banco", "izzi_telefonica", "otro"] as const;
const AddressSchema = z.object({
  token: z.string().min(10),
  doc_type: z.enum(ADDRESS_DOC_TYPES),
  file_base64: z.string().min(100),
  file_mime: z.string().default("image/jpeg"),
});

function parseIssueDate(payload: Record<string, unknown>): Date | null {
  const candidates = [payload.fechaEmision, payload.fecha, payload.fecha_emision, payload.periodo, payload.fechaCorte];
  for (const c of candidates) {
    if (typeof c !== "string") continue;
    const m = c.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/) || c.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) continue;
    if (m[0].length === 10 && m[0][4] === "-") return new Date(c);
    const d = new Date(`${m[3]}-${m[2]}-${m[1]}`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export const submitBiometricAddressDoc = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => AddressSchema.parse(i))
  .handler(async ({ data }) => {
    const { admin, enrollment } = await loadByToken(data.token);
    if (enrollment.face_match_ok !== true) throw new Error("Primero debes completar la verificación facial");

    const path = await saveCapture(admin, enrollment.user_id, enrollment.id, "address-doc", data.file_base64, data.file_mime);

    let httpStatus: number | null = null;
    let payload: Record<string, unknown> = {};
    try {
      const res = await fetch("https://ocr.nubarium.com/ocr/v1/obtener_datos_comprobante", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: nubariumAuth() },
        body: JSON.stringify({ documento: data.file_base64, tipo: data.doc_type }),
      });
      httpStatus = res.status;
      try { payload = (await res.json()) as Record<string, unknown>; } catch { /* ignore */ }
    } catch (e) {
      await logApi(admin, enrollment.id, enrollment.user_id, "ocr/obtener_datos_comprobante", null, false, { doc_type: data.doc_type }, null, (e as Error).message);
      throw new Error("No se pudo contactar al servicio de comprobantes");
    }

    const ok = String(payload.estatus ?? "") === "OK";
    await logApi(admin, enrollment.id, enrollment.user_id, "ocr/obtener_datos_comprobante", httpStatus, ok, { doc_type: data.doc_type }, payload);
    if (!ok) {
      const msg = String(payload.mensaje ?? "No se pudo validar el comprobante");
      await admin.from("biometric_enrollments").update({ last_error: msg }).eq("id", enrollment.id);
      throw new Error(msg);
    }

    // Vigencia: no mayor a 3 meses
    const issued = parseIssueDate(payload);
    let valid = true;
    let reason: string | null = null;
    if (issued) {
      const monthsAgo = (Date.now() - issued.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
      if (monthsAgo > ADDRESS_DOC_MAX_MONTHS) {
        valid = false;
        reason = `El comprobante tiene más de ${ADDRESS_DOC_MAX_MONTHS} meses (fecha: ${issued.toLocaleDateString("es-MX")}).`;
      }
    }

    await admin.from("biometric_enrollments").update({
      address_doc_path: path,
      address_doc_type: data.doc_type,
      address_doc_data: payload as never,
      address_doc_ok: valid,
      address_doc_issued_at: issued ? issued.toISOString().slice(0, 10) : null,
      status: valid ? "address_verified" : "face_verified",
      last_error: reason,
    }).eq("id", enrollment.id);

    if (!valid) throw new Error(reason ?? "Comprobante fuera de vigencia");
    return { ok: true, issued_at: issued?.toISOString().slice(0, 10) ?? null };
  });

// ─── 7. Móvil: confirmación final + lista nominal ────────────────────────────
export const confirmBiometricEnrollment = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const { admin, enrollment } = await loadByToken(data.token);
    if (enrollment.status !== "address_verified") {
      throw new Error("Faltan pasos por completar");
    }

    // Lista nominal (solo INE)
    let listaOk: boolean | null = null;
    let listaPayload: Record<string, unknown> | null = null;
    if (enrollment.id_type === "ine" && enrollment.ocr_data) {
      const ocr = enrollment.ocr_data as Record<string, unknown>;
      const cic = String(ocr.cic ?? ocr.CIC ?? "").trim();
      const claveElector = String(ocr.claveElector ?? ocr.clave_elector ?? "").trim();
      const ocrCode = String(ocr.ocr ?? ocr.identificadorCiudadano ?? "").trim();
      const numeroEmision = String(ocr.numeroEmision ?? ocr.emision ?? "").trim();
      const body: Record<string, string> = {};
      if (cic) body.cic = cic;
      if (claveElector) body.claveElector = claveElector;
      if (ocrCode) body.ocr = ocrCode;
      if (numeroEmision) body.numeroEmision = numeroEmision;
      if (Object.keys(body).length >= 2) {
        try {
          const res = await fetch("https://ine.nubarium.com/ine/v1/valida_lista_nominal", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: nubariumAuth() },
            body: JSON.stringify(body),
          });
          try { listaPayload = (await res.json()) as Record<string, unknown>; } catch { /* ignore */ }
          const estatus = String(listaPayload?.estatus ?? "");
          const vigente = String(listaPayload?.vigencia ?? listaPayload?.estado ?? "").toUpperCase();
          listaOk = estatus === "OK" && (vigente === "" || vigente.includes("VIGENTE") || vigente === "1");
          await logApi(admin, enrollment.id, enrollment.user_id, "ine/valida_lista_nominal", res.status, estatus === "OK", body, listaPayload);
        } catch (e) {
          await logApi(admin, enrollment.id, enrollment.user_id, "ine/valida_lista_nominal", null, false, body, null, (e as Error).message);
        }
      }
    }

    await admin.from("biometric_enrollments").update({
      lista_nominal_ok: listaOk,
      lista_nominal_data: listaPayload as never,
      status: "completed",
      completed_at: new Date().toISOString(),
      last_error: null,
    }).eq("id", enrollment.id);

    // Marcar KYC en revisión (a menos que ya esté aprobado)
    await admin.from("profiles").update({
      kyc_status: "in_review",
    }).eq("id", enrollment.user_id).neq("kyc_status", "approved");

    return { ok: true, lista_nominal_ok: listaOk };
  });

// ─── 8. Cancelar enrolamiento ────────────────────────────────────────────────
export const cancelBiometricEnrollment = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: z.string().min(10) }).parse(i))
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    await admin.from("biometric_enrollments").update({ status: "failed", last_error: "Cancelado por el usuario" }).eq("token", data.token);
    return { ok: true };
  });
