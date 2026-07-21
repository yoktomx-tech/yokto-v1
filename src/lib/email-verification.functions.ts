import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendTemplateEmail } from "./email-templates/send-email";

const OTP_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 5;
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

    // Último OTP activo (para mostrar cooldown de reenvío)
    const { data: last } = await supabase
      .from("email_verification_otps")
      .select("created_at, expires_at, consumed_at, attempts")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      email,
      verified,
      lastOtp: last
        ? {
            created_at: last.created_at,
            expires_at: last.expires_at,
            consumed: !!last.consumed_at,
            attempts: last.attempts,
          }
        : null,
    };
  });

/**
 * Genera un OTP de 6 dígitos (5 min) y lo envía por correo.
 * Invalida OTPs previos activos.
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

    // Cooldown: bloquear reenvío antes de 60s
    const { data: recent } = await supabaseAdmin
      .from("email_verification_otps")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent?.created_at) {
      const ageSec = (Date.now() - new Date(recent.created_at).getTime()) / 1000;
      if (ageSec < RESEND_COOLDOWN_SECONDS) {
        const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - ageSec);
        throw new Error(`Espera ${wait}s antes de solicitar otro código`);
      }
    }

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

    const result = await sendTemplateEmail("email-verification-otp", prof.email, {
      templateData: {
        userName: prof.first_name ?? prof.email.split("@")[0],
        code,
        minutesValid: OTP_TTL_MINUTES,
      },
      idempotencyKey: `otp-${userId}-${Date.now()}`,
    });

    await supabaseAdmin.from("email_verification_log").insert({
      user_id: userId,
      email: prof.email,
      event: result.sent ? "otp_sent" : "otp_failed",
      detail: { reason: result.reason ?? null, expires_at },
    });

    if (!result.sent) throw new Error(`No se pudo enviar el correo: ${result.reason ?? "desconocido"}`);

    return { sent: true, expires_at };
  });

/**
 * Verifica el OTP. Si es correcto, marca el correo como verificado.
 */
export const verifyEmailOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ code: z.string().trim().regex(/^\d{6}$/, "El código debe tener 6 dígitos") }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const code_hash = await sha256Hex(data.code);

    const { data: otp } = await supabaseAdmin
      .from("email_verification_otps")
      .select("id, code_hash, expires_at, consumed_at, attempts, email")
      .eq("user_id", userId)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otp) {
      await supabaseAdmin.from("email_verification_log").insert({
        user_id: userId, email: "", event: "otp_failed", detail: { reason: "no_active_otp" },
      });
      throw new Error("No hay un código activo. Solicita uno nuevo.");
    }

    if (new Date(otp.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("email_verification_otps").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);
      await supabaseAdmin.from("email_verification_log").insert({
        user_id: userId, email: otp.email, event: "otp_expired", detail: {},
      });
      throw new Error("El código expiró. Solicita uno nuevo.");
    }

    if (otp.attempts >= MAX_ATTEMPTS) {
      await supabaseAdmin.from("email_verification_otps").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);
      await supabaseAdmin.from("email_verification_log").insert({
        user_id: userId, email: otp.email, event: "otp_failed", detail: { reason: "max_attempts" },
      });
      throw new Error("Demasiados intentos. Solicita un nuevo código.");
    }

    if (otp.code_hash !== code_hash) {
      await supabaseAdmin
        .from("email_verification_otps")
        .update({ attempts: otp.attempts + 1 })
        .eq("id", otp.id);
      await supabaseAdmin.from("email_verification_log").insert({
        user_id: userId, email: otp.email, event: "otp_failed", detail: { reason: "invalid_code" },
      });
      throw new Error("Código incorrecto. Verifica los 6 dígitos.");
    }

    // OK: consumir OTP y marcar perfil como verificado
    const now = new Date().toISOString();
    await supabaseAdmin.from("email_verification_otps").update({ consumed_at: now }).eq("id", otp.id);
    await supabaseAdmin.from("profiles").update({ email_verified_at: now }).eq("id", userId);
    await supabaseAdmin.from("email_verification_log").insert({
      user_id: userId, email: otp.email, event: "otp_verified", detail: {},
    });

    return { verified: true, verified_at: now };
  });
