// Cliente Supabase para el navegador — proyecto externo.
// Sustituye a src/integrations/supabase/client.ts (versión auto-generada por
// Lovable Cloud).
//
// Contrato de configuración (post-migración):
//   - VITE_SUPABASE_URL              (principal)
//   - VITE_SUPABASE_PUBLISHABLE_KEY  (principal)
//   - VITE_SUPABASE_ANON_KEY         (fallback legacy — retirar en Fase 1)
//
// Prohibido en este archivo: service_role, sb_secret_*, LOVABLE_API_KEY,
// contraseñas PostgreSQL, PATs o claves de proveedores externos.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  // Fallback legacy únicamente. Preferir VITE_SUPABASE_PUBLISHABLE_KEY.
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    'Supabase env vars missing: define VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY',
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'yokto-auth',
    flowType: 'pkce',
  },
});
