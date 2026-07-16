import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Users, Search, Send, Star, EyeOff, Filter, ChevronRight, Shield,
  TrendingUp, AlertTriangle, Briefcase, CheckCircle2, Building2, User,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { NoCustodyBanner } from "@/components/payments/ui/no-custody-banner";
import { InfoBox } from "@/components/tx/ui/info-box";
import { cn } from "@/lib/utils";
import {
  MOCK_COUNTERPARTIES, MOCK_INVITATIONS, SECTOR_CFG, STATUS_CFG, TRUST_CFG, COMPLIANCE_CFG,
  formatMoney, relativeTime, maskRfc, computeMetrics, complianceLevelOf, hasAlert,
  type Counterparty, type RelationshipStatus, type SectorId,
} from "@/lib/relationships-mock";

export const Route = createFileRoute("/_authenticated/relationships/")({
  component: RelationshipsListPage,
});

type TabKey = "TODAS" | "CLIENTES" | "PROVEEDORES" | "COMPRADORES" | "VENDEDORES" | "INVITACIONES" | "CON_ALERTA";
const TABS: { key: TabKey; label: string }[] = [
  { key: "TODAS",        label: "Todas" },
  { key: "CLIENTES",     label: "Clientes" },
  { key: "PROVEEDORES",  label: "Proveedores" },
  { key: "COMPRADORES",  label: "Compradores" },
  { key: "VENDEDORES",   label: "Vendedores" },
  { key: "INVITACIONES", label: "Invitaciones" },
  { key: "CON_ALERTA",   label: "Con alerta" },
];

function RelationshipsListPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("TODAS");
  const [q, setQ] = useState("");
  const [sector, setSector] = useState<SectorId | "ALL">("ALL");
  const [personType, setPersonType] = useState<"ALL" | "PF" | "PFAE" | "PM">("ALL");
  const [status, setStatus] = useState<"ALL" | RelationshipStatus>("ALL");
  const [scope, setScope] = useState<"ALL" | "PERSONAL" | "TEAM">("ALL");

  const filtered = useMemo(() => {
    return MOCK_COUNTERPARTIES.filter((c) => {
      if (tab === "CLIENTES" && !(c.role === "BUYER" || c.role === "BOTH")) return false;
      if (tab === "PROVEEDORES" && !(c.role === "SELLER" || c.role === "BOTH")) return false;
      if (tab === "COMPRADORES" && !(c.role === "BUYER" || c.role === "BOTH")) return false;
      if (tab === "VENDEDORES" && !(c.role === "SELLER" || c.role === "BOTH")) return false;
      if (tab === "INVITACIONES" && c.source !== "INVITATION") return false;
      if (tab === "CON_ALERTA" && !hasAlert(c)) return false;
      if (tab !== "CON_ALERTA" && c.hidden) return false;
      if (sector !== "ALL" && !c.sectors.includes(sector)) return false;
      if (personType !== "ALL" && c.personType !== personType) return false;
      if (status !== "ALL" && c.status !== status) return false;
      if (scope !== "ALL" && (c.scope ?? "PERSONAL") !== scope) return false;
      if (q.trim()) {
        const s = q.toLowerCase();
        const hay = `${c.displayName} ${c.legalName ?? ""} ${c.rfc} ${c.email} ${c.yoktoId} ${c.ownerMember ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [tab, q, sector, personType, status, scope]);

  const kpis = useMemo(() => computeMetrics(MOCK_COUNTERPARTIES, MOCK_INVITATIONS), []);

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 max-w-[1600px] mx-auto w-full">
      <PageHeader
        icon={Users}
        title="Relaciones de Confianza"
        subtitle="Contrapartes reales derivadas de operaciones, búsqueda verificada o invitaciones formales. YOKTO no permite crear contactos manuales."
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/relationships/invitations"
              className="h-9 px-3 inline-flex items-center gap-2 rounded-md border border-yo-border bg-white text-sm font-medium text-yo-txt hover:bg-yo-raised"
            >
              <Send className="size-4" /> Invitaciones
            </Link>
            <Link
              to="/relationships/search"
              className="h-9 px-3 inline-flex items-center gap-2 rounded-md bg-[#4F46E5] text-white text-sm font-semibold hover:bg-[#4338CA]"
            >
              <Search className="size-4" /> Buscar contraparte
            </Link>
          </div>
        }
      />

      <NoCustodyBanner />

      {/* KPIs — según spec: Contrapartes, Ops activas, Volumen histórico, Invitaciones */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={<Users className="size-4" />} label="Contrapartes" value={String(kpis.totalCounterparties)} hint={`${kpis.activas} activas · ${kpis.kycVerified} con KYC`} />
        <KPI icon={<Briefcase className="size-4" />} label="Operaciones activas" value={String(kpis.opsActivas)} hint={`${kpis.disputadas} con disputa histórica`} />
        <KPI icon={<TrendingUp className="size-4" />} label="Volumen histórico" value={formatMoney(kpis.volTotal)} hint={`Trust promedio ${kpis.trustPromedio}/100`} />
        <KPI
          icon={<Send className="size-4" />}
          label="Invitaciones"
          value={`${kpis.invitacionesPendientes} pendientes`}
          hint={kpis.invitacionesVencenHoy > 0 ? `${kpis.invitacionesVencenHoy} vence hoy` : `${kpis.conAlerta} con alerta`}
          tone={kpis.invitacionesVencenHoy > 0 ? "warn" : undefined}
        />
      </section>

      <InfoBox tone="info" title="Cómo se agregan contrapartes">
        Toda relación proviene de una operación cerrada, una búsqueda por RFC/CURP/YOKTO ID o una invitación formal aceptada.
        No es posible dar de alta contactos manualmente — así garantizamos identidad verificada en ambos extremos.
      </InfoBox>

      {/* Tabs */}
      <div className="border-b border-yo-border overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-3 h-10 text-sm font-medium border-b-2 -mb-px transition-colors",
                  active ? "border-[#4F46E5] text-[#4338CA]" : "border-transparent text-yo-txt-2 hover:text-yo-txt",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Filters */}
      <section className="bg-white border border-yo-border rounded-lg p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-yo-txt-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrar por nombre, RFC, YOKTO ID o email"
            className="w-full h-9 pl-9 pr-3 rounded-md border border-yo-border bg-white text-sm focus:outline-none focus:border-[#4F46E5]"
          />
        </div>
        <Select value={sector} onChange={(v) => setSector(v as SectorId | "ALL")} label={<><Filter className="size-3.5" /> Sector</>}>
          <option value="ALL">Todos los sectores</option>
          {Object.entries(SECTOR_CFG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
        </Select>
        <Select value={personType} onChange={(v) => setPersonType(v as "ALL" | "PF" | "PFAE" | "PM")} label="Tipo persona">
          <option value="ALL">Todos</option>
          <option value="PF">Persona Física</option>
          <option value="PFAE">PFAE</option>
          <option value="PM">Persona Moral</option>
        </Select>
        <Select value={status} onChange={(v) => setStatus(v as "ALL" | RelationshipStatus)} label="Estado">
          <option value="ALL">Todos</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </section>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState onSearch={() => navigate({ to: "/relationships/search" })} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {filtered.map((c) => <CounterpartyCard key={c.id} c={c} />)}
        </div>
      )}
    </div>
  );
}

function KPI({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: string; hint?: string; tone?: "warn" }) {
  return (
    <div className={cn("bg-white border rounded-lg p-4", tone === "warn" ? "border-[#F59E0B]" : "border-yo-border")}>
      <div className="flex items-center gap-2 text-yo-txt-2 text-[11px] uppercase tracking-wider font-medium">
        <span className={tone === "warn" ? "text-[#B45309]" : "text-[#4F46E5]"}>{icon}</span>{label}
      </div>
      <div className="mt-1 text-[22px] font-bold text-yo-txt font-mono">{value}</div>
      {hint && <div className={cn("text-[11px]", tone === "warn" ? "text-[#B45309]" : "text-yo-txt-3")}>{hint}</div>}
    </div>
  );
}

function Select({ value, onChange, label, children }: { value: string; onChange: (v: string) => void; label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="inline-flex items-center gap-2 h-9 px-2 rounded-md border border-yo-border bg-white text-xs text-yo-txt-2">
      <span className="inline-flex items-center gap-1 pl-1">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent text-sm text-yo-txt outline-none pr-1">
        {children}
      </select>
    </label>
  );
}

function CounterpartyCard({ c }: { c: Counterparty }) {
  const status = STATUS_CFG[c.status];
  const trust = TRUST_CFG[c.trustLevel];
  const comp = COMPLIANCE_CFG[complianceLevelOf(c)];
  const PersonIcon = c.personType === "PM" ? Building2 : User;
  const alertActive = hasAlert(c);
  return (
    <Link
      to="/relationships/$counterpartyId"
      params={{ counterpartyId: c.id }}
      className={cn(
        "group bg-white border rounded-lg p-4 hover:shadow-sm transition-all flex flex-col gap-3",
        alertActive ? "border-[#F59E0B]/50 hover:border-[#F59E0B]" : "border-yo-border hover:border-[#4F46E5]",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="size-11 rounded-lg bg-[#EEF2FF] text-[#4338CA] grid place-items-center shrink-0">
          <PersonIcon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {c.starred && <Star className="size-3.5 text-[#F59E0B] fill-[#F59E0B]" />}
            <h3 className="text-[15px] font-semibold text-yo-txt truncate">{c.displayName}</h3>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-yo-txt-2">
            <span className="font-mono">{c.yoktoId}</span>
            <span>•</span>
            <span className="font-mono">{maskRfc(c.rfc, true)}</span>
            <span>•</span>
            <span>{c.personType === "PM" ? "Persona Moral" : c.personType === "PFAE" ? "PFAE" : "Persona Física"}</span>
          </div>
          <div className="mt-1 text-[11px] text-yo-txt-3">
            Roles: {c.role === "BOTH" ? "Comprador y Vendedor" : c.role === "BUYER" ? "Comprador · Pagador" : "Vendedor · Beneficiario"}
          </div>
        </div>
        <span
          className="text-[10px] font-medium px-2 py-1 rounded-full inline-flex items-center gap-1"
          style={{ background: status.bg, color: status.txt }}
        >
          <span className="size-1.5 rounded-full" style={{ background: status.dot }} />
          {status.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: comp.bg, color: comp.txt }}>
          {comp.label}
        </span>
        {c.sectors.map((s) => {
          const cfg = SECTOR_CFG[s];
          return (
            <span key={s} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.txt }}>
              {cfg.emoji} {cfg.label}
            </span>
          );
        })}
        <span className="text-[11px] px-2 py-0.5 rounded-full ml-auto" style={{ background: trust.bg, color: trust.txt }}>
          Trust {c.trustLevel} · {c.trustScore}
        </span>
      </div>

      {alertActive && (
        <div className="text-[11px] px-2 py-1 rounded-md bg-[#FFFBEB] text-[#B45309] inline-flex items-center gap-1.5">
          <AlertTriangle className="size-3" />
          {c.metrics.disputedOps > 0 ? "Disputas históricas" : c.status === "BLOQUEADA" ? "Contraparte bloqueada" : c.status === "PAUSADA" ? "Relación pausada" : "KYC pendiente"}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric label="Ops totales" value={String(c.metrics.totalOps)} />
        <Metric label="Volumen" value={formatMoney(c.metrics.totalVolumeMxn)} />
        <Metric label="A tiempo" value={`${Math.round(c.metrics.onTimeRate * 100)}%`} />
      </div>

      <div className="flex items-center justify-between text-[11px] text-yo-txt-3">
        <span className="inline-flex items-center gap-1">
          {c.kycVerified
            ? <><CheckCircle2 className="size-3 text-emerald-600" /> KYC verificado</>
            : <><AlertTriangle className="size-3 text-amber-600" /> Sin KYC</>}
        </span>
        <span className="inline-flex items-center gap-1">
          <Briefcase className="size-3" /> {c.metrics.activeOps} activas · última interacción {relativeTime(c.lastInteractionAt)}
        </span>
        <ChevronRight className="size-4 text-yo-txt-3 group-hover:text-[#4F46E5]" />
      </div>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-yo-bg border border-yo-border rounded-md p-2">
      <div className="text-[10px] uppercase tracking-wider text-yo-txt-3">{label}</div>
      <div className="text-[13px] font-semibold text-yo-txt font-mono">{value}</div>
    </div>
  );
}

function EmptyState({ onSearch }: { onSearch: () => void }) {
  return (
    <div className="bg-white border border-dashed border-yo-border rounded-lg p-10 text-center">
      <div className="mx-auto size-12 rounded-full bg-[#EEF2FF] grid place-items-center text-[#4338CA]">
        <Users className="size-6" />
      </div>
      <h3 className="mt-3 text-base font-semibold text-yo-txt">Sin contrapartes en esta vista</h3>
      <p className="mt-1 text-sm text-yo-txt-2 max-w-md mx-auto">
        Empieza buscando una contraparte por RFC, CURP, email o YOKTO ID. Si no está registrada, puedes invitarla formalmente.
      </p>
      <div className="mt-4 inline-flex gap-2">
        <button onClick={onSearch} className="h-9 px-3 inline-flex items-center gap-2 rounded-md bg-[#4F46E5] text-white text-sm font-medium hover:bg-[#4338CA]">
          <Search className="size-4" /> Buscar contraparte
        </button>
        <Link to="/relationships/invitations" className="h-9 px-3 inline-flex items-center gap-2 rounded-md border border-yo-border bg-white text-sm font-medium text-yo-txt hover:bg-yo-raised">
          <Send className="size-4" /> Invitar contraparte
        </Link>
      </div>
      <p className="mt-4 text-[11px] text-yo-txt-3">
        <EyeOff className="inline size-3 mr-1" /> No es posible crear contactos manuales — todas las contrapartes son entidades verificadas.
      </p>
    </div>
  );
}
