// functionMiddleware que adjunta el bearer del usuario a toda llamada a createServerFn.
// Sustituye a src/integrations/supabase/auth-attacher.ts.
// Se registra en src/start.ts:
//   export const startInstance = createStart(() => ({
//     requestMiddleware: [errorMiddleware],
//     functionMiddleware: [attachSupabaseAuth],
//   }));
import { createMiddleware } from '@tanstack/react-start';
import { supabase } from './client';

export const attachSupabaseAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({
      sendContext: {},
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
