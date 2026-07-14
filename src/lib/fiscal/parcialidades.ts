// Tracker de parcialidades: dado un CFDI PPD y sus REPs, calcula
// pagado, pendiente, número de parcialidades y estado.

export interface ParcialidadRow {
  numero: number;
  fecha_pago?: string | null;
  imp_pagado: number;
  imp_saldo_ant?: number | null;
  imp_saldo_insoluto?: number | null;
  rep_id: string;
  rep_uuid?: string | null;
  estado: string;
}

export interface EstadoParcialidades {
  cfdi_id: string;
  cfdi_uuid: string;
  total_cfdi: number;
  total_pagado: number;
  saldo_pendiente: number;
  num_parcialidades: number;
  pagos: ParcialidadRow[];
  status: "sin_pagos" | "parcialmente_pagado" | "pagado_totalmente";
}

interface CFDIRow {
  id: string;
  uuid_fiscal: string | null;
  total: number | null;
}

interface REPRow {
  id: string;
  uuid_fiscal: string | null;
  parcialidad_numero: number | null;
  fecha_pago: string | null;
  imp_pagado: number | null;
  imp_saldo_ant: number | null;
  imp_saldo_insoluto: number | null;
  estado: string;
}

export function buildEstadoParcialidades(cfdi: CFDIRow, reps: REPRow[]): EstadoParcialidades {
  const total_cfdi = Number(cfdi.total ?? 0);
  const activos = reps.filter((r) => r.estado !== "RECHAZADO" && r.estado !== "CANCELADO_SAT");
  const total_pagado = activos.reduce((acc, r) => acc + Number(r.imp_pagado ?? 0), 0);
  const saldo_pendiente = Math.max(0, total_cfdi - total_pagado);
  const pagos: ParcialidadRow[] = activos
    .sort((a, b) => (a.parcialidad_numero ?? 0) - (b.parcialidad_numero ?? 0))
    .map((r) => ({
      numero: r.parcialidad_numero ?? 0,
      fecha_pago: r.fecha_pago,
      imp_pagado: Number(r.imp_pagado ?? 0),
      imp_saldo_ant: r.imp_saldo_ant !== null ? Number(r.imp_saldo_ant) : null,
      imp_saldo_insoluto: r.imp_saldo_insoluto !== null ? Number(r.imp_saldo_insoluto) : null,
      rep_id: r.id,
      rep_uuid: r.uuid_fiscal,
      estado: r.estado,
    }));

  const status: EstadoParcialidades["status"] =
    total_pagado <= 0.02
      ? "sin_pagos"
      : saldo_pendiente <= 0.02
        ? "pagado_totalmente"
        : "parcialmente_pagado";

  return {
    cfdi_id: cfdi.id,
    cfdi_uuid: cfdi.uuid_fiscal ?? "",
    total_cfdi,
    total_pagado,
    saldo_pendiente,
    num_parcialidades: activos.length,
    pagos,
    status,
  };
}
