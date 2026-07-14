
-- Enum values (deben commitearse antes de usarse; policies solo referencian valores existentes)
ALTER TYPE public.transaction_status ADD VALUE IF NOT EXISTS 'pending_signature';
ALTER TYPE public.transaction_status ADD VALUE IF NOT EXISTS 'partial_release';

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS numero TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS comision_cents BIGINT,
  ADD COLUMN IF NOT EXISTS iva_comision_cents BIGINT,
  ADD COLUMN IF NOT EXISTS total_a_depositar_cents BIGINT,
  ADD COLUMN IF NOT EXISTS descuento_volumetrico NUMERIC(5,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS clabe_virtual TEXT,
  ADD COLUMN IF NOT EXISTS fecha_activacion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_firma_pagador TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_firma_beneficiario TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_completada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_cancelada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contrato_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS auto_release_global BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS repse_requerido BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS creado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ip_creacion INET,
  ADD COLUMN IF NOT EXISTS beneficiario_nombre TEXT;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_sector_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_sector_check
  CHECK (sector IS NULL OR sector IN (
    'AUTOTRANSPORTE','CONSTRUCCION','COMERCIO_EXTERIOR',
    'INMOBILIARIO','VEHICULOS','SERVICIOS'
  ));

CREATE SEQUENCE IF NOT EXISTS public.transaction_numero_seq START 1;

CREATE OR REPLACE FUNCTION public.assign_transaction_numero()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero := 'YOKTO-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                  LPAD(nextval('public.transaction_numero_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tx_numero ON public.transactions;
CREATE TRIGGER trg_tx_numero
  BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.assign_transaction_numero();

UPDATE public.transactions
SET numero = 'YOKTO-' || TO_CHAR(created_at, 'YYYY') || '-' ||
             LPAD(nextval('public.transaction_numero_seq')::TEXT, 5, '0')
WHERE numero IS NULL;

CREATE TABLE IF NOT EXISTS public.transaction_hitos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  orden INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  monto_porcentaje NUMERIC(5,2) NOT NULL CHECK (monto_porcentaje >= 0 AND monto_porcentaje <= 100),
  monto_cents BIGINT,
  fecha_limite DATE,
  tipo_verificacion TEXT NOT NULL CHECK (tipo_verificacion IN (
    'DOCUMENTAL','EVIDENCIA_FISICA','GPS','CHECKLIST','AUTOMATICO','MANUAL_YOKTO'
  )),
  documentos_requeridos TEXT[] NOT NULL DEFAULT '{}',
  evidencia_requerida TEXT[] NOT NULL DEFAULT '{}',
  responsable TEXT NOT NULL CHECK (responsable IN ('PAGADOR','BENEFICIARIO')),
  auto_release BOOLEAN NOT NULL DEFAULT FALSE,
  estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN (
    'PENDIENTE','EN_CURSO','EN_REVISION','APROBADO','RECHAZADO','CANCELADO'
  )),
  aprobado_por TEXT,
  aprobado_at TIMESTAMPTZ,
  liberacion_stripe_transfer_id TEXT,
  notas_rechazo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (transaction_id, orden)
);

CREATE INDEX IF NOT EXISTS idx_hitos_tx ON public.transaction_hitos(transaction_id);
CREATE INDEX IF NOT EXISTS idx_hitos_estado ON public.transaction_hitos(estado);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_hitos TO authenticated;
GRANT ALL ON public.transaction_hitos TO service_role;

ALTER TABLE public.transaction_hitos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hitos view via transaction" ON public.transaction_hitos
  FOR SELECT TO authenticated
  USING (
    transaction_id IN (
      SELECT id FROM public.transactions
      WHERE buyer_id = auth.uid() OR seller_id = auth.uid()
        OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'mediator')
    )
  );

CREATE POLICY "hitos manage by buyer draft" ON public.transaction_hitos
  FOR ALL TO authenticated
  USING (
    transaction_id IN (
      SELECT id FROM public.transactions
      WHERE (buyer_id = auth.uid() AND status = 'draft')
         OR has_role(auth.uid(), 'admin')
    )
  )
  WITH CHECK (
    transaction_id IN (
      SELECT id FROM public.transactions
      WHERE (buyer_id = auth.uid() AND status = 'draft')
         OR has_role(auth.uid(), 'admin')
    )
  );

DROP TRIGGER IF EXISTS trg_hitos_updated_at ON public.transaction_hitos;
CREATE TRIGGER trg_hitos_updated_at
  BEFORE UPDATE ON public.transaction_hitos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
