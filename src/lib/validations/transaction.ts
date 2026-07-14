// Esquemas Zod por paso del wizard de transacciones (Módulo C)
import { z } from "zod";
import { SECTOR_IDS } from "@/lib/sectors";

export const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}(?:[A-Z\d]{3})?$/i;

export const Step1Schema = z.object({
  sector: z.enum(SECTOR_IDS),
});

export const Step2Schema = z.object({
  rol: z.enum(["PAGADOR", "BENEFICIARIO"]),
  descripcion: z.string().trim().min(10, "Describe la operación (mínimo 10 caracteres)").max(1000),
  // Contraparte: o bien es un usuario existente (user_id), o es una invitación (email + nombre)
  contraparte_user_id: z.string().uuid().optional().nullable(),
  contraparte_email: z.string().trim().email("Correo inválido").max(255).optional().nullable(),
  contraparte_nombre: z.string().trim().min(2).max(200).optional().nullable(),
  contraparte_rfc: z.string().trim().regex(RFC_REGEX, "RFC inválido").optional().nullable(),
}).refine(
  (v) => Boolean(v.contraparte_user_id) || Boolean(v.contraparte_email && v.contraparte_nombre),
  { message: "Selecciona una contraparte existente o invita una nueva con email y nombre", path: ["contraparte_email"] },
);

export const HitoSchema = z.object({
  orden: z.number().int().min(1),
  titulo: z.string().trim().min(3).max(120),
  descripcion: z.string().trim().max(500).optional().nullable(),
  monto_porcentaje: z.number().min(0).max(100),
  fecha_limite: z.string().min(4), // ISO date
  tipo_verificacion: z.enum(["DOCUMENTAL","EVIDENCIA_FISICA","GPS","CHECKLIST","AUTOMATICO","MANUAL_YOKTO"]),
  documentos_requeridos: z.array(z.string()).default([]),
  evidencia_requerida: z.array(z.string()).default([]),
  responsable: z.enum(["PAGADOR","BENEFICIARIO"]),
  auto_release: z.boolean().default(false),
});

export const Step3Schema = z.object({
  hitos: z.array(HitoSchema).min(1, "Agrega al menos un hito"),
}).refine(
  (v) => Math.abs(v.hitos.reduce((s, h) => s + h.monto_porcentaje, 0) - 100) < 0.01,
  { message: "La suma de los porcentajes de los hitos debe ser exactamente 100%", path: ["hitos"] },
);

export const Step4Schema = z.object({
  monto: z.number().positive("El monto debe ser positivo").min(100, "Monto mínimo: $100 MXN"),
  metodo_pago: z.enum(["SPEI", "TARJETA", "OXXO"]),
  fecha_inicio_estimada: z.string().optional().nullable(),
  fecha_fin_estimada: z.string().optional().nullable(),
});

export const Step5Schema = z.object({
  acepta_terminos: z.literal(true, { errorMap: () => ({ message: "Debes aceptar los términos" }) }),
  acepta_retencion: z.literal(true, { errorMap: () => ({ message: "Confirma que entiendes la retención de fondos" }) }),
});

export type WizardDraft = {
  transaction_id?: string;
  step1?: z.infer<typeof Step1Schema>;
  step2?: z.infer<typeof Step2Schema>;
  step3?: z.infer<typeof Step3Schema>;
  step4?: z.infer<typeof Step4Schema>;
};
