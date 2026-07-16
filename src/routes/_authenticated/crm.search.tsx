import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, ArrowLeft, Send, CheckCircle2, Building2, User, ShieldCheck, EyeOff } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { InfoBox } from "@/components/tx/ui/info-box";
import {
  MOCK_COUNTERPARTIES, SECTOR_CFG, TRUST_CFG, maskRfc, maskEmail, type Counterparty,
} from "@/lib/relationships-mock";

export const Route = createFileRoute("/_authenticated/crm/search")({
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const [criteria, setCriteria] = useState<"AUTO" | "RFC" | "CURP" | "EMAIL" | "YOKTO_ID" | "NAME" | "OP">("AUTO");
  const [submitted, setSubmitted] = useState(false);

  const results = useMemo(() => {
    if (!submitted || !q.trim()) return [];
    const s = q.trim().toLowerCase();
    return MOCK_COUNTERPARTIES.filter((c) => {
      const hay = `${c.displayName} ${c.legalName ?? ""} ${c.rfc} ${c.curp ?? ""} ${c.email} ${c.yoktoId}`.toLowerCase();
      return hay.includes(s);
    }).slice(0, 8);
  }, [q, submitted]);

  const notFound = submitted && q.trim() && results.length === 0;

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 max-w-[1100px] mx-auto w-full">
      <div className="flex items-center gap-3">
        <Link to="/crm" className="h-8 w-8 grid place-items-center rounded-md border border-yo-border bg-white hover:bg-yo-raised text-yo-txt-2">
          <ArrowLeft className="size-4" />
        </Link>
        <PageHeader
          icon={Search}
          title="Buscar contraparte"
          subtitle="Localiza personas físicas, morales o freelancers ya verificados en YOKTO. Nunca se muestran datos sensibles sin relación operativa."
        />
      </div>

      <InfoBox tone="info" title="Privacidad por diseño">
        Sólo verás la información pública mínima (nombre público, YOKTO ID enmascarado, sector). Los datos completos (RFC, CURP, domicilio) se revelan al abrir una operación conjunta.
      </InfoBox>

      <section className="bg-white border border-yo-border rounded-lg p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["AUTO", "RFC", "CURP", "EMAIL", "YOKTO_ID", "NAME", "OP"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setCriteria(k)}
              className={"text-xs h-8 px-3 rounded-full border " + (criteria === k
                ? "bg-[#EEF2FF] border-[#4F46E5] text-[#3730A3] font-semibold"
                : "bg-white border-yo-border text-yo-txt-2 hover:text-yo-txt")}
            >
              {k === "AUTO" ? "Autodetectar" : k === "YOKTO_ID" ? "YOKTO ID" : k === "NAME" ? "Nombre / Razón social" : k === "OP" ? "Número de operación" : k}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-yo-txt-3" />
            <input
              autoFocus
              value={q}
              onChange={(e) => { setQ(e.target.value); setSubmitted(false); }}
              placeholder={
                criteria === "RFC" ? "Ej. TNB120315AA1" :
                criteria === "CURP" ? "Ej. LOSM880412MDFPRR07" :
                criteria === "EMAIL" ? "contacto@empresa.mx" :
                criteria === "YOKTO_ID" ? "YKT-00000" :
                criteria === "NAME" ? "Nombre o razón social" :
                criteria === "OP" ? "YOKTO-2026-00000" :
                "RFC, CURP, email, YOKTO ID, razón social o número de operación"
              }
              className="w-full h-11 pl-10 pr-3 rounded-md border border-yo-border bg-white text-sm font-mono focus:outline-none focus:border-[#4F46E5]"
            />
          </div>
          <button type="submit" className="h-11 px-4 rounded-md bg-[#4F46E5] text-white text-sm font-semibold hover:bg-[#4338CA] inline-flex items-center gap-2">
            <Search className="size-4" /> Buscar
          </button>
        </form>
        <p className="text-[11px] text-yo-txt-3 inline-flex items-center gap-1">
          <EyeOff className="size-3" /> No se muestran contrapartes ocultas ni bloqueadas por otros usuarios.
        </p>
      </section>

      {results.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs uppercase tracking-wider text-yo-txt-3 font-semibold">
            {results.length} resultado{results.length === 1 ? "" : "s"}
          </h3>
          {results.map((c) => <ResultRow key={c.id} c={c} />)}
        </section>
      )}

      {notFound && <NotFoundBlock query={q} />}
    </div>
  );
}

function ResultRow({ c }: { c: Counterparty }) {
  const trust = TRUST_CFG[c.trustLevel];
  const Icon = c.personType === "PM" ? Building2 : User;
  return (
    <Link
      to="/crm/$counterpartyId"
      params={{ counterpartyId: c.id }}
      className="bg-white border border-yo-border rounded-lg p-4 flex items-center gap-4 hover:border-[#4F46E5] hover:shadow-sm transition-all"
    >
      <div className="size-10 rounded-lg bg-[#EEF2FF] text-[#4338CA] grid place-items-center shrink-0">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-yo-txt truncate">{c.displayName}</div>
        <div className="text-[11px] text-yo-txt-2 flex flex-wrap gap-x-2 gap-y-0.5 font-mono">
          <span>{c.yoktoId}</span>
          <span>•</span>
          <span>{maskRfc(c.rfc, false)}</span>
          <span>•</span>
          <span className="font-sans">{maskEmail(c.email, false)}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {c.sectors.map((s) => {
            const cfg = SECTOR_CFG[s];
            return <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.txt }}>{cfg.emoji} {cfg.label}</span>;
          })}
        </div>
      </div>
      <div className="text-right shrink-0 flex flex-col items-end gap-1">
        <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: trust.bg, color: trust.txt }}>
          Trust {c.trustLevel}
        </span>
        {c.kycVerified && (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700">
            <ShieldCheck className="size-3" /> KYC verificado
          </span>
        )}
      </div>
    </Link>
  );
}

function NotFoundBlock({ query }: { query: string }) {
  return (
    <div className="bg-white border border-dashed border-yo-border rounded-lg p-8 text-center">
      <div className="mx-auto size-12 rounded-full bg-[#FFFBEB] grid place-items-center text-[#B45309]">
        <Search className="size-6" />
      </div>
      <h3 className="mt-3 text-base font-semibold text-yo-txt">Sin coincidencias en el directorio YOKTO</h3>
      <p className="mt-1 text-sm text-yo-txt-2 max-w-md mx-auto">
        No encontramos una contraparte registrada para <span className="font-mono">{query}</span>. Puedes enviarle una invitación formal para que se registre y quede vinculada a tu red.
      </p>
      <Link
        to="/crm/invitations"
        className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-md bg-[#4F46E5] text-white text-sm font-semibold hover:bg-[#4338CA]"
      >
        <Send className="size-4" /> Invitar contraparte
      </Link>
      <p className="mt-3 text-[11px] text-yo-txt-3 inline-flex items-center gap-1 justify-center">
        <CheckCircle2 className="size-3 text-emerald-600" /> La invitación registra un evento de auditoría con tu identidad como emisor.
      </p>
    </div>
  );
}
