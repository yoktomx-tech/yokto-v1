
-- 1) Plan comercial por organización
DO $$ BEGIN
  CREATE TYPE public.org_plan AS ENUM ('free','pro','enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS plan public.org_plan NOT NULL DEFAULT 'free';

-- 2) Live chat flag en tickets
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS is_live_chat boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_support_tickets_live_chat
  ON public.support_tickets (user_id, is_live_chat, status)
  WHERE is_live_chat = true;

-- 3) Realtime para mensajes de soporte (chat en vivo)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;

-- 4) Auditoría de descargas de adjuntos
CREATE TABLE IF NOT EXISTS public.support_attachment_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id uuid NOT NULL REFERENCES public.support_attachments(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_kind text NOT NULL CHECK (user_kind IN ('user','internal')),
  internal_role text,
  ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.support_attachment_downloads TO authenticated;
GRANT ALL ON public.support_attachment_downloads TO service_role;

ALTER TABLE public.support_attachment_downloads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners see own attachment download log" ON public.support_attachment_downloads;
CREATE POLICY "Owners see own attachment download log"
  ON public.support_attachment_downloads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "No client writes on attachment download log" ON public.support_attachment_downloads;
CREATE POLICY "No client writes on attachment download log"
  ON public.support_attachment_downloads
  AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_sad_ticket ON public.support_attachment_downloads (ticket_id, created_at DESC);

-- 5) Storage policies para bucket 'support-attachments'
--    Estructura de path: <ticket_id>/<uuid>-<filename>
DROP POLICY IF EXISTS "Support attachments — owner read" ON storage.objects;
CREATE POLICY "Support attachments — owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id::text = (storage.foldername(name))[1]
        AND (t.user_id = auth.uid() OR public.is_org_member(t.org_id, auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Support attachments — owner upload" ON storage.objects;
CREATE POLICY "Support attachments — owner upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND owner = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id::text = (storage.foldername(name))[1]
        AND (t.user_id = auth.uid() OR public.is_org_member(t.org_id, auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Support attachments — owner delete own" ON storage.objects;
CREATE POLICY "Support attachments — owner delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND owner = auth.uid()
  );

-- Internal roles pasan por supabaseAdmin (service_role), que ignora RLS.
