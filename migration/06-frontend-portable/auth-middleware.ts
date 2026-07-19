// Middleware requireSupabaseAuth para createServerFn.
// Sustituye a src/integrations/supabase/auth-middleware.ts.
// Valida el bearer token del usuario y expone `supabase` (con RLS del usuario),
// `userId` y `claims` en el contexto de la server function.
import { createMiddleware } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { getRequestHeaders } from '@tanstack/react-start/server';
import type { Database } from './types';

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const url = process.env.SUPABASE_URL;
    const anon = process.env.SUPABASE_ANON_KEY;
    if (!url || !anon) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required on the server');
    }

    const headers = getRequestHeaders();
    const auth = headers['authorization'] ?? headers['Authorization'];
    if (!auth || !auth.startsWith('Bearer ')) {
      throw new Response('Unauthorized: No authorization header provided', { status: 401 });
    }
    const token = auth.slice('Bearer '.length);

    const supabase = createClient<Database>(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new Response('Unauthorized: invalid session', { status: 401 });
    }

    return next({
      context: {
        supabase,
        userId: data.user.id,
        claims: data.user,
      },
    });
  },
);
