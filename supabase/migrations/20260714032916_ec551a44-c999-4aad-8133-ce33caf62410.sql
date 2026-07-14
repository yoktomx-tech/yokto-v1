
ALTER TABLE public.disputes DROP CONSTRAINT IF EXISTS disputes_reason_code_check;
ALTER TABLE public.disputes
  ADD CONSTRAINT disputes_reason_code_check
  CHECK (reason_code IN (
    'incumplimiento_hito',
    'documentos_invalidos',
    'mercancia_incompleta',
    'calidad_insuficiente',
    'plazo_vencido',
    'fraude_sospechado',
    'condiciones_no_acordadas',
    'otro',
    -- legado (registros previos)
    'not_delivered','not_as_described','quality','delay','fraud','other'
  ));
