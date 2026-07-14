import { MetricCard } from "@/components/tx/ui";
import { Wallet, TrendingUp, AlertTriangle, ShieldAlert, ArrowUpRight, RotateCcw, PackageCheck, Send, FileClock, XCircle, CheckCircle2, Undo2 } from "lucide-react";
import { MoneyDisplay } from "@/components/tx/ui/money-display";
import type { ViewRole } from "@/hooks/use-view-role";

export type TxMetricsData = {
  active: number;
  heldAmount: number;
  pendingApproval: number;
  disputed: number;
  releasable: number;
  closed: number;
  // vendedor extras
  readyToRelease: number;
  pendingDeliverables: number;
  changesRequested: number;
  evidenceInReview: number;
  releasedTotal: number;
};

type Props = {
  role: ViewRole;
  data: TxMetricsData;
};

function accentTop(color: string) {
  return { boxShadow: `inset 0 2px 0 0 ${color}` };
}

export function TransactionsMetricsGrid({ role, data }: Props) {
  const cards =
    role === "buyer"
      ? [
          { key: "active",   label: "Operaciones activas",  value: data.active,        tone: "accent" as const, icon: <TrendingUp className="h-4 w-4" />,     color: "#4F46E5", hint: "En curso o por fondear" },
          { key: "held",     label: "Fondos retenidos",     value: <MoneyDisplay amount={data.heldAmount} size="xl" showCurrency={false} />, tone: "accent" as const, icon: <Wallet className="h-4 w-4" />,       color: "#4F46E5", hint: "En pasarela certificada" },
          { key: "approve",  label: "Hitos por aprobar",    value: data.pendingApproval, tone: "warn" as const,  icon: <FileClock className="h-4 w-4" />,     color: "#D97706", hint: "Requieren tu revisión" },
          { key: "dispute",  label: "En disputa",           value: data.disputed,      tone: "err" as const,    icon: <ShieldAlert className="h-4 w-4" />,   color: "#DC2626", hint: "Operaciones congeladas" },
          { key: "release",  label: "Por liberar",          value: <MoneyDisplay amount={data.releasable} size="xl" showCurrency={false} />, tone: "ok" as const,     icon: <ArrowUpRight className="h-4 w-4" />,  color: "#059669", hint: "Listas para orden de liberación" },
          { key: "closed",   label: "Operaciones cerradas", value: data.closed,        tone: "neutral" as const, icon: <PackageCheck className="h-4 w-4" />, color: "#A1A1AA", hint: "Historial" },
        ]
      : [
          { key: "active",   label: "Operaciones activas",     value: data.active,             tone: "accent" as const, icon: <TrendingUp className="h-4 w-4" />,   color: "#4F46E5", hint: "Como vendedor" },
          { key: "release",  label: "Pagos por liberar",       value: <MoneyDisplay amount={data.readyToRelease} size="xl" showCurrency={false} />, tone: "ok" as const, icon: <ArrowUpRight className="h-4 w-4" />, color: "#059669", hint: "Sujetos a validación" },
          { key: "deliver",  label: "Entregables pendientes",  value: data.pendingDeliverables, tone: "warn" as const,  icon: <Send className="h-4 w-4" />,        color: "#D97706", hint: "Requieren evidencia" },
          { key: "changes",  label: "Correcciones solicitadas", value: data.changesRequested,   tone: "err" as const,   icon: <XCircle className="h-4 w-4" />,     color: "#DC2626", hint: "Atención inmediata" },
          { key: "review",   label: "Evidencias en revisión",  value: data.evidenceInReview,   tone: "info" as const,  icon: <FileClock className="h-4 w-4" />,   color: "#0284C7", hint: "Con Yokto o comprador" },
          { key: "released", label: "Pagos liberados",         value: <MoneyDisplay amount={data.releasedTotal} size="xl" showCurrency={false} />, tone: "ok" as const, icon: <CheckCircle2 className="h-4 w-4" />, color: "#059669", hint: "Histórico total" },
        ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <MetricCard
          key={c.key}
          label={c.label}
          value={c.value}
          hint={c.hint}
          icon={c.icon}
          tone={c.tone}
          className="relative before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:rounded-t-[inherit]"
          // línea superior de acento por card:
          // usamos estilo inline en un wrapper via CSS var
        />
      ))}
    </div>
  );
}

// Nota: la "línea superior 2px" se aplica en MetricCard via className "before:*"
// combinado con background. Para variar el color por card sin CSS-in-JS, usamos
// un wrapper dedicado si se necesita color exacto. Mantenemos color por tono
// heredado del MetricCard (texto) — la línea usa currentColor del tono.
export { accentTop };
