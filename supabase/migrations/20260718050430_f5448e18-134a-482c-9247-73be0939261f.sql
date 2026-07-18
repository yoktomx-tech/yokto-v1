
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.support_ticket_status AS ENUM ('open','pending_user','in_progress','escalated','resolved','closed','reopened');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.support_ticket_priority AS ENUM ('low','normal','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.support_escalation_type AS ENUM ('none','conflict','pld_ft','financial','technical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.incident_status AS ENUM ('investigating','identified','monitoring','resolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.incident_severity AS ENUM ('minor','major','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ HELP CATEGORIES ============
CREATE TABLE public.help_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  module TEXT,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.help_categories TO anon, authenticated;
GRANT ALL ON public.help_categories TO service_role;
ALTER TABLE public.help_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "help_categories public read" ON public.help_categories FOR SELECT TO anon, authenticated USING (true);

-- ============ HELP ARTICLES ============
CREATE TABLE public.help_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.help_categories(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  body_md TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  audience TEXT[] NOT NULL DEFAULT '{buyer,seller}',
  module TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  views INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.help_articles TO anon, authenticated;
GRANT ALL ON public.help_articles TO service_role;
ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "help_articles public read published" ON public.help_articles FOR SELECT TO anon, authenticated USING (is_published = true);
CREATE INDEX help_articles_search_idx ON public.help_articles USING gin (to_tsvector('spanish', coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(body_md,'')));

-- ============ PLATFORM INCIDENTS ============
CREATE TABLE public.platform_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  title TEXT NOT NULL,
  body_md TEXT,
  severity public.incident_severity NOT NULL DEFAULT 'minor',
  status public.incident_status NOT NULL DEFAULT 'investigating',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_incidents TO anon, authenticated;
GRANT ALL ON public.platform_incidents TO service_role;
ALTER TABLE public.platform_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incidents public read" ON public.platform_incidents FOR SELECT TO anon, authenticated USING (true);

-- ============ SUPPORT TICKETS ============
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  module TEXT,
  related_transaction_id UUID,
  related_dispute_id UUID,
  status public.support_ticket_status NOT NULL DEFAULT 'open',
  priority public.support_ticket_priority NOT NULL DEFAULT 'normal',
  escalation public.support_escalation_type NOT NULL DEFAULT 'none',
  escalated_at TIMESTAMPTZ,
  escalated_by UUID,
  escalation_reason TEXT,
  assigned_to UUID,
  contexto_rol_congelado JSONB NOT NULL DEFAULT '{}'::jsonb,
  plan TEXT,
  sla_first_response_at TIMESTAMPTZ,
  sla_resolution_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE SEQUENCE IF NOT EXISTS public.support_ticket_numero_seq;
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Users see their own tickets; org admins/owners see org tickets; auditors read.
CREATE POLICY "tickets select own or org admin" ON public.support_tickets FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR (org_id IS NOT NULL AND (
    public.has_org_role(org_id, auth.uid(), 'owner')
    OR public.has_org_role(org_id, auth.uid(), 'buyer_admin')
    OR public.has_org_role(org_id, auth.uid(), 'seller_admin')
    OR public.has_org_role(org_id, auth.uid(), 'auditor')
  ))
);
CREATE POLICY "tickets insert own" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
-- Users can update only their own ticket (limited fields enforced app-side); admins update via service_role.
CREATE POLICY "tickets update own" ON public.support_tickets FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.assign_support_numero()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero := 'SUP-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('public.support_ticket_numero_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_support_ticket_numero BEFORE INSERT ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.assign_support_numero();
CREATE TRIGGER trg_support_ticket_updated BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SUPPORT MESSAGES ============
CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_kind TEXT NOT NULL DEFAULT 'user', -- 'user' | 'internal'
  body TEXT NOT NULL,
  is_internal_note BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages select for ticket viewers" ON public.support_messages FOR SELECT TO authenticated USING (
  is_internal_note = false AND EXISTS (
    SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (
      t.user_id = auth.uid()
      OR (t.org_id IS NOT NULL AND (
        public.has_org_role(t.org_id, auth.uid(), 'owner')
        OR public.has_org_role(t.org_id, auth.uid(), 'buyer_admin')
        OR public.has_org_role(t.org_id, auth.uid(), 'seller_admin')
        OR public.has_org_role(t.org_id, auth.uid(), 'auditor')
      ))
    )
  )
);
CREATE POLICY "messages insert by ticket owner or org admin" ON public.support_messages FOR INSERT TO authenticated WITH CHECK (
  author_id = auth.uid()
  AND author_kind = 'user'
  AND is_internal_note = false
  AND EXISTS (
    SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (
      t.user_id = auth.uid()
      OR (t.org_id IS NOT NULL AND (
        public.has_org_role(t.org_id, auth.uid(), 'owner')
        OR public.has_org_role(t.org_id, auth.uid(), 'buyer_admin')
        OR public.has_org_role(t.org_id, auth.uid(), 'seller_admin')
      ))
    )
  )
);

-- ============ SUPPORT ATTACHMENTS ============
CREATE TABLE public.support_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.support_messages(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_attachments TO authenticated;
GRANT ALL ON public.support_attachments TO service_role;
ALTER TABLE public.support_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attachments select for ticket viewers" ON public.support_attachments FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (
      t.user_id = auth.uid()
      OR (t.org_id IS NOT NULL AND (
        public.has_org_role(t.org_id, auth.uid(), 'owner')
        OR public.has_org_role(t.org_id, auth.uid(), 'buyer_admin')
        OR public.has_org_role(t.org_id, auth.uid(), 'seller_admin')
        OR public.has_org_role(t.org_id, auth.uid(), 'auditor')
      ))
    )
  )
);
CREATE POLICY "attachments insert by uploader" ON public.support_attachments FOR INSERT TO authenticated WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (
      t.user_id = auth.uid()
      OR (t.org_id IS NOT NULL AND (
        public.has_org_role(t.org_id, auth.uid(), 'owner')
        OR public.has_org_role(t.org_id, auth.uid(), 'buyer_admin')
        OR public.has_org_role(t.org_id, auth.uid(), 'seller_admin')
      ))
    )
  )
);

-- ============ Seed help categories + articles ============
INSERT INTO public.help_categories (slug, name, description, module, icon, sort_order) VALUES
  ('primeros-pasos','Primeros pasos','Alta, onboarding y verificación de identidad.','onboarding','Rocket',1),
  ('operaciones','Operaciones','Cómo crear y liberar operaciones seguras.','transactions','FileText',2),
  ('pagos','Pagos y liberación de fondos','Fondeo SPEI, Stripe Connect y liberaciones.','payments','Banknote',3),
  ('cumplimiento','Cumplimiento','KYC, PLD/FT, e.firma y CFDIs.','cumplimiento',' ShieldCheck',4),
  ('disputas','Disputas','Cómo abrir y resolver una disputa.','disputes','MessageSquare',5),
  ('cuenta','Cuenta y organización','Perfil, equipo, roles y facturación.','settings','Users',6)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.help_articles (slug, title, summary, body_md, tags, module, is_published, category_id)
SELECT 'como-funciona-yokto', '¿Cómo funciona YOKTO?',
  'YOKTO actúa como tercero neutral que retiene fondos vía pasarelas certificadas y los libera al verificar cumplimiento.',
  E'# ¿Cómo funciona YOKTO?\n\nYOKTO es un **Pago Seguro contra Cumplimiento**: los fondos se retienen en pasarelas certificadas y se liberan al Vendedor sólo cuando el Comprador verifica que se cumplieron los hitos acordados.\n\n1. **Crea la operación** definiendo partes, hitos y evidencia esperada.\n2. **Fondea** vía SPEI o Stripe.\n3. **Cumple** cada hito y sube evidencia.\n4. **Libera** los fondos al aprobarse.',
  ARRAY['intro','escrow'], 'transactions', true,
  (SELECT id FROM public.help_categories WHERE slug='primeros-pasos')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.help_articles (slug, title, summary, body_md, tags, module, is_published, category_id)
SELECT 'abrir-disputa','¿Cómo abrir una disputa?',
  'Guía paso a paso del wizard de 4 pasos para abrir una disputa dentro de una operación.',
  E'# Abrir una disputa\n\nDentro de la operación activa, presiona **Abrir disputa** y sigue el wizard:\n\n1. Motivo.\n2. Descripción detallada.\n3. Evidencia (documentos, capturas).\n4. Confirmación.\n\nAplica el modelo *loser pays*: la parte perdedora asume los costos de mediación.',
  ARRAY['disputas','mediacion'], 'disputes', true,
  (SELECT id FROM public.help_categories WHERE slug='disputas')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.help_articles (slug, title, summary, body_md, tags, module, is_published, category_id)
SELECT 'fondear-spei','Fondear una operación por SPEI',
  'Instrucciones y tiempos para fondear operaciones vía transferencia SPEI.',
  E'# Fondear por SPEI\n\nEn el detalle de la operación abre la pestaña **Fondear** y usa la CLABE y referencia únicas mostradas. YOKTO reconcilia el depósito automáticamente en minutos.',
  ARRAY['spei','fondeo'], 'payments', true,
  (SELECT id FROM public.help_categories WHERE slug='pagos')
ON CONFLICT (slug) DO NOTHING;
