
-- Módulo H-BIS Fase 1: fiscal_documents
CREATE TABLE public.fiscal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  hito_id UUID REFERENCES public.transaction_hitos(id) ON DELETE SET NULL,
  parent_cfdi_id UUID REFERENCES public.fiscal_documents(id) ON DELETE SET NULL,

  -- Tipo y clasificación
  tipo TEXT NOT NULL CHECK (tipo IN ('CFDI_PPD','CFDI_PUE','REP')),
  metodo_pago TEXT, -- PPD / PUE
  forma_pago TEXT,  -- clave c_FormaPago
  uso_cfdi TEXT,

  -- Identificación fiscal
  uuid_fiscal TEXT UNIQUE,
  serie TEXT,
  folio TEXT,
  fecha_emision TIMESTAMPTZ,
  fecha_timbrado TIMESTAMPTZ,
  no_certificado_sat TEXT,
  no_certificado_emisor TEXT,
  sello_cfd TEXT,
  sello_sat TEXT,

  -- Partes
  rfc_emisor TEXT,
  nombre_emisor TEXT,
  regimen_fiscal_emisor TEXT,
  rfc_receptor TEXT,
  nombre_receptor TEXT,
  regimen_fiscal_receptor TEXT,
  domicilio_fiscal_receptor TEXT,

  -- Montos
  subtotal NUMERIC(14,2),
  descuento NUMERIC(14,2) DEFAULT 0,
  total NUMERIC(14,2),
  moneda TEXT DEFAULT 'MXN',
  tipo_cambio NUMERIC(14,6),
  total_impuestos_trasladados NUMERIC(14,2) DEFAULT 0,
  total_impuestos_retenidos NUMERIC(14,2) DEFAULT 0,

  -- REP específico
  rep_data JSONB,
  parcialidad_numero INT,
  imp_saldo_ant NUMERIC(14,2),
  imp_pagado NUMERIC(14,2),
  imp_saldo_insoluto NUMERIC(14,2),
  fecha_pago TIMESTAMPTZ,

  -- Storage
  xml_url TEXT NOT NULL,
  pdf_url TEXT,
  xml_hash TEXT,

  -- Validaciones
  estado TEXT NOT NULL DEFAULT 'SUBIDO' CHECK (estado IN ('SUBIDO','VALIDANDO','VALIDADO','ACEPTADO','RECHAZADO','CANCELADO_SAT')),
  estado_sat TEXT DEFAULT 'pendiente_verificacion',
  fecha_consulta_sat TIMESTAMPTZ,
  coherence_checks JSONB DEFAULT '[]'::jsonb,
  coherence_score INT,
  validation_errors JSONB DEFAULT '[]'::jsonb,
  validation_warnings JSONB DEFAULT '[]'::jsonb,
  ai_analysis JSONB,

  -- Decisión
  aceptado_por UUID REFERENCES auth.users(id),
  aceptado_at TIMESTAMPTZ,
  rechazado_por UUID REFERENCES auth.users(id),
  rechazado_at TIMESTAMPTZ,
  motivo_rechazo TEXT,

  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  raw_xml_data JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fiscal_docs_tx ON public.fiscal_documents(transaction_id);
CREATE INDEX idx_fiscal_docs_hito ON public.fiscal_documents(hito_id);
CREATE INDEX idx_fiscal_docs_parent ON public.fiscal_documents(parent_cfdi_id);
CREATE INDEX idx_fiscal_docs_uuid ON public.fiscal_documents(uuid_fiscal);
CREATE INDEX idx_fiscal_docs_estado ON public.fiscal_documents(estado);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_documents TO authenticated;
GRANT ALL ON public.fiscal_documents TO service_role;

ALTER TABLE public.fiscal_documents ENABLE ROW LEVEL SECURITY;

-- Partes de la transacción pueden ver
CREATE POLICY "Parties can view fiscal docs"
ON public.fiscal_documents FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = fiscal_documents.transaction_id
      AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- Emisor (seller) sube
CREATE POLICY "Seller can insert fiscal docs"
ON public.fiscal_documents FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_id
      AND (t.seller_id = auth.uid() OR t.buyer_id = auth.uid())
  )
);

-- Update: solo partes o admin
CREATE POLICY "Parties can update fiscal docs"
ON public.fiscal_documents FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = fiscal_documents.transaction_id
      AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins delete fiscal docs"
ON public.fiscal_documents FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER fiscal_documents_updated_at
BEFORE UPDATE ON public.fiscal_documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.fiscal_documents;
