import { Link } from "@tanstack/react-router";
import {
  DollarSign, CheckCircle2, AlertTriangle, Upload, FileText, ShieldCheck, ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ActivityItem = {
  id: string;
  event_type: string;
  transaction_id: string;
  transaction_title?: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

const ICON_MAP: Record<string, { icon: typeof DollarSign; color: string; bg: string }> = {
  funded:           { icon: DollarSign,   color: "text-yo-ok",   bg: "bg-yo-ok-bg" },
  conditions_met:   { icon: CheckCircle2, color: "text-yo-ok",   bg: "bg-yo-ok-bg" },
  disputed:         { icon: AlertTriangle, color: "text-yo-err", bg: "bg-yo-err-bg" },
  released:         { icon: ArrowUpRight, color: "text-yo-ac",   bg: "bg-yo-ac-bg" },
  evidence_uploaded: { icon: Upload,      color: "text-yo-info", bg: "bg-yo-info-bg" },
  created:          { icon: FileText,     color: "text-yo-txt-2", bg: "bg-yo-raised" },
  kyc_approved:     { icon: ShieldCheck,  color: "text-yo-ok",   bg: "bg-yo-ok-bg" },
};

const LABEL: Record<string, string> = {
  funded: "Fondos recibidos",
  conditions_met: "Condiciones cumplidas",
  disputed: "Disputa activada",
  released: "Pago liberado",
  evidence_uploaded: "Evidencia subida",
  created: "Transacción creada",
  kyc_approved: "KYC aprobado",
  awaiting_funding: "Esperando fondeo",
  in_progress: "En progreso",
};

function relTime(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "hace un momento";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-yo-txt-3 py-6 text-center">Sin actividad reciente.</p>;
  }
  return (
    <ol className="relative space-y-4">
      <span className="absolute left-[15px] top-2 bottom-2 w-px bg-yo-border" aria-hidden />
      {items.map((it) => {
        const meta = ICON_MAP[it.event_type] ?? ICON_MAP.created;
        const Icon = meta.icon;
        return (
          <li key={it.id} className="relative flex gap-3 pl-0">
            <div className={cn("relative z-10 grid place-items-center size-8 rounded-full shrink-0", meta.bg)}>
              <Icon className={cn("size-3.5", meta.color)} />
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm font-semibold text-yo-txt">
                {LABEL[it.event_type] ?? it.event_type}
                {it.transaction_title ? <span className="font-normal text-yo-txt-2"> — {it.transaction_title}</span> : null}
              </p>
              <p className="mt-0.5 text-xs text-yo-txt-3">
                {relTime(it.created_at)}
                {" · "}
                <Link
                  to="/transactions/$id"
                  params={{ id: it.transaction_id }}
                  className="text-yo-ac hover:underline"
                >
                  Ver transacción →
                </Link>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
