/**
 * YOKTO — Staging environment guard
 * =============================================================================
 * Se importa en `src/main.tsx` (o `src/router.tsx`) SOLO en la rama
 * chore/staging-cutover-dryrun. En producción no debe existir.
 *
 * Falla el bootstrap del frontend si:
 * - VITE_APP_ENV != "staging"
 * - VITE_SUPABASE_URL apunta al proyecto productivo (diqdpygummlrajsugotv)
 * - VITE_SUPABASE_URL está vacío
 * =============================================================================
 */

const PROD_PROJECT_REF = "diqdpygummlrajsugotv";

export function assertStagingEnv(): void {
  const env = import.meta.env.VITE_APP_ENV;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;

  if (env !== "staging") {
    throw new Error(
      `[STAGING GUARD] VITE_APP_ENV must be "staging" (got "${env}"). ` +
        "This branch is not deployable to production.",
    );
  }

  if (!url) {
    throw new Error("[STAGING GUARD] VITE_SUPABASE_URL is empty.");
  }

  if (url.includes(PROD_PROJECT_REF)) {
    throw new Error(
      `[STAGING GUARD] VITE_SUPABASE_URL points to production project ` +
        `(${PROD_PROJECT_REF}). Refusing to start.`,
    );
  }

  // Banner en consola
  console.warn(
    "%c⚠ YOKTO STAGING — NO USAR PARA OPERACIONES REALES ⚠",
    "background:#f43f5e;color:white;padding:4px 8px;font-weight:bold;",
  );
}

/**
 * Renderiza un banner sticky en la parte superior.
 */
export function StagingBanner() {
  const label = import.meta.env.VITE_STAGING_BANNER
    ?? "YOKTO STAGING — NO USAR PARA OPERACIONES REALES";
  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#f43f5e",
        color: "white",
        textAlign: "center",
        padding: "6px 12px",
        fontWeight: 700,
        fontSize: 13,
        letterSpacing: 0.5,
      }}
    >
      {label}
    </div>
  );
}
