// Cliente Supabase para el navegador — proyecto externo.
// Sustituye a src/integrations/supabase/client.ts (versión auto-generada por
// Lovable Cloud).
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  (typeof process !== 'undefined' ? process.env.SUPABASE_URL : undefined);

const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  (typeof process !== 'undefined' ? process.env.SUPABASE_ANON_KEY : undefined);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Supabase env vars missing: define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY',
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'yokto-auth',
    flowType: 'pkce',
  },
});
