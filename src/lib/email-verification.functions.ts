import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendTemplateEmail } from "./email-templates/send-email";

const OTP_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const RESEND_COOLDOWN_SECONDS = 60;

async function sha256Hex(input: string) {
  const bytes = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateCode(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1_000_000).padStart(6, "0");
}

/**
 * Estado de verificación de correo del usuario actual.
 */
export const getEmailVerificationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles")
      .select("email, email_verified_at")
      .eq("id", userId)
      .maybeSingle();

    const email = prof?.email ?? null;
    const verified = !!prof?.email_verified_at;

    const { data: last } = await supabase
      .from("email_verification_otps")
      .select("created_at, expires_at, consumed_at, attempts, locked_until")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const now = Date.now();
    const resendAvailableAt = last?.created_at
      ? new Date(new Date(last.created_at).getTime() + RESEND_COOLDOWN_SECONDS * 1000).toISOString()
      : null;
    const lockedUntil =
      last?.locked_until && new Date(last.locked_until).getTime() > now ? last.locked_until : null;

    return {
      email,
      verified,
      maxAttempts: MAX_ATTEMPTS,
      lockedUntil,
      resendAvailableAt,
      lastOtp: last
        ? {
            created_at: last.created_at,
            expires_at: last.expires_at,
            consumed: !!last.consumed_at,
            attempts: last.attempts,
            attemptsRemaining: Math.max(0, MAX_ATTEMPTS - (last.attempts ?? 0)),
          }
        : null,
    };
  });

/**
 * Genera un OTP de 6 dígitos (5 min) y lo envía por correo.
 * Invalida OTPs previos activos. Registra evento otp_sent u otp_resent.
 */
export const requestEmailOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("email, first_name, email_verified_at")
      .eq("id", userId)
      .maybeSingle();

    if (!prof?.email) throw new Error("El usuario no tiene correo registrado");
    if (prof.email_verified_at) return { sent: false, alreadyVerified: true };

    const { data: recent } = await supabaseAdmin
      .from("email_verification_otps")
      .select("id, created_at, locked_until")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Si hay bloqueo activo, impedir envío
    if (recent?.locked_until && new Date(recent.locked_until).getTime() > Date.now()) {
      const waitMin = Math.ceil((new Date(recent.locked_until).getTime() - Date.now()) / 60000);
      throw new Error(`Cuenta bloqueada temporalmente. Intenta en ${waitMin} min.`);
    }

    if (recent?.created_at) {
      const ageSec = (Date.now() - new Date(recent.created_at).getTime()) / 1000;
      if (ageSec < RESEND_COOLDOWN_SECONDS) {
        const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - ageSec);
        throw new Error(`Espera ${wait}s antes de solicitar otro código`);
      }
    }

    const isResend = !!recent;

    // Invalidar OTPs activos previos
    await supabaseAdmin
      .from("email_verification_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("consumed_at", null);

    const code = generateCode();
    const code_hash = await sha256Hex(code);
    const expires_at = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();

    const { error: insErr } = await supabaseAdmin.from("email_verification_otps").insert({
      user_id: userId,
      email: prof.email,
      code_hash,
      expires_at,
      purpose: "email_verification",
    });
    if (insErr) throw insErr;

    const userName = prof.first_name ?? prof.email.split("@")[0];

    // 1) Correo con el nuevo código OTP
    const result = await sendTemplateEmail("email-verification-otp", prof.email, {
      templateData: { userName, code, minutesValid: OTP_TTL_MINUTES },
      idempotencyKey: `otp-${userId}-${Date.now()}`,
    });

    await supabaseAdmin.from("email_verification_log").insert({
      user_id: userId,
      email: prof.email,
      event: result.sent ? (isResend ? "otp_resent" : "otp_sent") : "otp_failed",
      detail: { reason: result.reason ?? null, expires_at, resend: isResend, at: new Date().toISOString() },
    });

    // 2) En reenvío, correo adicional de confirmación de reenvío
    if (isResend && result.sent) {
      const confirm = await sendTemplateEmail("email-verification-otp", prof.email, {
        templateData: {
          userName,
          code, // mismo código, es un aviso adicional
          minutesValid: OTP_TTL_MINUTES,
        },
        idempotencyKey: `otp-resend-confirm-${userId}-${Date.now()}`,
      });
      await supabaseAdmin.from("email_verification_log").insert({
        user_id: userId,
        email: prof.email,
        event: confirm.sent ? "otp_resend_confirmed" : "otp_resend_confirm_failed",
        detail: { reason: confirm.reason ?? null, at: new Date().toISOString() },
      });
    }

    if (!result.sent) throw new Error(`No se pudo enviar el correo: ${result.reason ?? "desconocido"}`);

    return { sent: true, expires_at, resend: isResend };
  });

/**
 * Verifica el OTP. Aplica límite de intentos y bloqueo temporal.
 */
export const verifyEmailOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ code: z.string().trim().regex(/^\d{6}$/, "El código debe tener 6 dígitos") }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const code_hash = await sha256Hex(data.code);

    const { data: otp } = await supabaseAdmin
      .from("email_verification_otps")
      .select("id, code_hash, expires_at, consumed_at, attempts, email, locked_until")
      .eq("user_id", userId)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otp) {
      await supabaseAdmin.from("email_verification_log").insert({
        user_id: userId, email: "", event: "otp_failed",
        detail: { reason: "no_active_otp", at: new Date().toISOString() },
      });
      throw new Error("No hay un código activo. Solicita uno nuevo.");
    }

    if (otp.locked_until && new Date(otp.locked_until).getTime() > Date.now()) {
      const waitMin = Math.ceil((new Date(otp.locked_until).getTime() - Date.now()) / 60000);
      throw new Error(`Cuenta bloqueada temporalmente. Intenta en ${waitMin} min.`);
    }

    if (new Date(otp.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("email_verification_otps").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);
      await supabaseAdmin.from("email_verification_log").insert({
        user_id: userId, email: otp.email, event: "otp_expired",
        detail: { at: new Date().toISOString() },
      });
      throw new Error("El código expiró. Solicita uno nuevo.");
    }

    if (otp.code_hash !== code_hash) {
      const newAttempts = (otp.attempts ?? 0) + 1;
      const remaining = Math.max(0, MAX_ATTEMPTS - newAttempts);
      const shouldLock = newAttempts >= MAX_ATTEMPTS;
      const locked_until = shouldLock
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
        : null;

      await supabaseAdmin
        .from("email_verification_otps")
        .update({
          attempts: newAttempts,
          ...(shouldLock ? { consumed_at: new Date().toISOString(), locked_until } : {}),
        })
        .eq("id", otp.id);

      await supabaseAdmin.from("email_verification_log").insert({
        user_id: userId,
        email: otp.email,
        event: shouldLock ? "otp_locked" : "otp_failed",
        detail: {
          reason: "invalid_code",
          attempts: newAttempts,
          remaining,
          locked_until,
          at: new Date().toISOString(),
        },
      });

      if (shouldLock) {
        throw new Error(`Demasiados intentos. Bloqueado ${LOCKOUT_MINUTES} min.`);
      }
      throw new Error(`Código incorrecto. Te quedan ${remaining} intento(s).`);
    }

    const now = new Date().toISOString();
    await supabaseAdmin.from("email_verification_otps").update({ consumed_at: now }).eq("id", otp.id);
    await supabaseAdmin.from("profiles").update({ email_verified_at: now }).eq("id", userId);
    await supabaseAdmin.from("email_verification_log").insert({
      user_id: userId, email: otp.email, event: "otp_verified",
      detail: { at: now },
    });

    return { verified: true, verified_at: now };
  });
