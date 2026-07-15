import { Link } from "@tanstack/react-router";
import { ArrowRight, UserPlus, ListChecks, ShieldCheck } from "lucide-react";

export function EmptyStateDashboard({ name }: { name: string }) {
  return (
    <div className="mt-8 rounded-2xl border border-yo-border bg-yo-surface p-8 sm:p-12 text-center relative overflow-hidden">
      <div aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-yo-ac via-yo-info to-yo-ok" />

      <div className="mx-auto max-w-md">
        <svg viewBox="0 0 120 120" className="mx-auto size-24 mb-6" aria-hidden>
          <defs>
            <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4F46E5" />
              <stop offset="100%" stopColor="#818CF8" />
            </linearGradient>
          </defs>
          <rect x="20" y="20" width="80" height="80" rx="16" fill="url(#g1)" opacity="0.1" />
          <rect x="30" y="30" width="60" height="60" rx="12" fill="none" stroke="#4F46E5" strokeWidth="2" />
          <path d="M45 60 L55 70 L75 50" stroke="#4F46E5" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <h2 className="text-2xl sm:text-3xl font-bold text-yo-txt tracking-tight">
          Bienvenido a YOKTO, {name}
        </h2>
        <p className="mt-2 text-sm text-yo-txt-2">
          Protege tu primer pago contra cumplimiento en menos de 5 minutos.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          <Step n={1} icon={UserPlus} title="Invita a tu contraparte" desc="Comparte por email." />
          <Step n={2} icon={ListChecks} title="Define condiciones" desc="Hitos que activan la liberación." />
          <Step n={3} icon={ShieldCheck} title="Deposita y opera" desc="YOKTO retiene y libera." />
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="/transactions/new"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => {
              event.preventDefault();
              const popup = window.open("/transactions/new", "_blank", "width=1440,height=960");
              if (popup) {
                popup.opener = null;
                popup.focus();
                return;
              }
              window.location.assign("/transactions/new");
            }}
            className="inline-flex items-center gap-2 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold px-5 py-2.5 shadow-sm transition"
          >
            Crear mi primera transacción
            <ArrowRight className="size-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

function Step({ n, icon: Icon, title, desc }: { n: number; icon: typeof UserPlus; title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-yo-border p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="grid place-items-center size-5 rounded-full bg-yo-ac text-white text-[10px] font-bold">{n}</span>
        <Icon className="size-4 text-yo-ac" />
      </div>
      <p className="text-sm font-semibold text-yo-txt">{title}</p>
      <p className="mt-1 text-xs text-yo-txt-3">{desc}</p>
    </div>
  );
}
