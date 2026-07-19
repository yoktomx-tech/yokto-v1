// Cliente Supabase con service_role para operaciones privilegiadas server-only.
// Sustituye a src/integrations/supabase/client.server.ts.
// NUNCA importar en código client-reachable a nivel de módulo — importar dentro
// del handler con `await import('@/integrations/supabase/client.server')`.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Supabase admin env vars missing: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
  );
}

export const supabaseAdmin = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);
