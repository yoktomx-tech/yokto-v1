import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ShieldCheck,
  Download,
  RefreshCw,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Info,
  XCircle,
  FileText,
  History,
  Eye,
  BarChart3,
  Bell,
  UserCheck,
  ChevronRight,
  X,
  Lock,
  UserPlus,
  Building2,
  User,
  Briefcase,
  ClipboardList,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useViewRole } from "@/hooks/use-view-role";
import {
  getMockProfile,
  LEVEL_CFG,
  TONE_CLASSES,
  KYC_CFG,
  DOC_STATUS_CFG,
  DOC_CATEGORY_LABEL,
  ALERT_TONE,
  PERSON_TYPE_CFG,
  fmtDate,
  fmtDateTime,
  type ComplianceDoc,
  type ScoreComponent,
  type PersonType,
  type DocCategory,
  type Representative,
  type ComplianceProfile,
} from "@/lib/score-mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/score")({
  head: () => ({
    meta: [
      { title: "Perfil de Cumplimiento — YOKTO" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ScorePage,
});

type TabKey = "resumen" | "kyc" | "docs" | "score" | "alerts" | "history" | "visibility";

function buildTabs(personType: PersonType): { key: TabKey; label: string; icon: typeof ShieldCheck }[] {
  const kycLabel = personType === "PM" ? "Verificación de Empresa" : "Verificación de Identidad";
  const kycIcon = personType === "PM" ? Building2 : UserCheck;
  return [
    { key: "resumen", label: "Resumen", icon: BarChart3 },
    { key: "kyc", label: kycLabel, icon: kycIcon },
    { key: "docs", label: "Documentos del Perfil", icon: FileText },
    { key: "score", label: "Indicadores", icon: ShieldCheck },
    { key: "alerts", label: "Alertas", icon: Bell },
    { key: "history", label: "Historial", icon: History },
    { key: "visibility", label: "Visibilidad", icon: Eye },
  ];
}


function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  const c = TONE_CLASSES[tone] ?? TONE_CLASSES.neutral;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", c.bg, c.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", c.dot)} />
      {children}
    </span>
  );
}

function ScorePage() {
  const { role } = useViewRole();
  const viewRole = role === "buyer" ? "buyer" : "seller";
  const [personType, setPersonType] = useState<PersonType>("PM");
  const profile = useMemo(() => getMockProfile(viewRole, personType), [viewRole, personType]);
  const [tab, setTab] = useState<TabKey>("resumen");
  const [openDoc, setOpenDoc] = useState<ComplianceDoc | null>(null);
  const [openComponent, setOpenComponent] = useState<ScoreComponent | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [recalcOpen, setRecalcOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  const levelCfg = LEVEL_CFG[profile.level];
  const ptCfg = PERSON_TYPE_CFG[personType];
  const tabs = useMemo(() => buildTabs(personType), [personType]);

  const subtitle =
    viewRole === "buyer"
      ? "Evalúa tu comportamiento de aprobación, pagos, disputas y documentación."
      : "Evalúa tu cumplimiento documental, entregables, hitos y operaciones.";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ShieldCheck}
        title="Perfil de Cumplimiento"
        subtitle={subtitle}
        actions={
          <>
            <PersonTypeSelect value={personType} onChange={setPersonType} />
            <button
              onClick={() => setCompleteOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-yo-ac hover:bg-yo-ac-h text-white px-3 py-2 text-sm font-medium transition"
            >
              <ClipboardList className="size-4" /> Completar perfil
            </button>
            <button
              onClick={() => setRecalcOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-yo-border bg-yo-surface px-3 py-2 text-sm font-medium text-yo-txt hover:bg-yo-raised transition"
            >
              <RefreshCw className="size-4" /> Actualizar
            </button>
            <button className="inline-flex items-center gap-2 rounded-lg border border-yo-border bg-yo-surface px-3 py-2 text-sm font-medium text-yo-txt hover:bg-yo-raised transition">
              <Download className="size-4" /> Descargar reporte
            </button>
          </>
        }
      />

      {/* Identity card */}
      <div className="rounded-lg border border-yo-border bg-yo-surface p-4 flex flex-wrap items-center gap-4">
        <div className="size-11 rounded-lg bg-yo-ac-bg grid place-items-center text-yo-ac-txt font-semibold">
          {personType === "PM" ? <Building2 className="size-5" /> : personType === "PFAE" ? <Briefcase className="size-5" /> : <User className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-yo-txt truncate">{profile.displayName}</p>
          <p className="text-xs text-yo-txt-2 mt-0.5 flex items-center gap-2 flex-wrap">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", ptCfg.bg, ptCfg.text)}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
              {ptCfg.label}
            </span>
            <span className="text-yo-txt-3">·</span>
            <span className="font-mono">RFC {profile.rfc}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-yo-txt-2">
          <Badge tone={levelCfg.tone}>{levelCfg.label}</Badge>
          {personType === "PM" ? (
            <Badge tone={KYC_CFG[profile.kyb].tone}>KYB {KYC_CFG[profile.kyb].label.toLowerCase()}</Badge>
          ) : (
            <Badge tone={KYC_CFG[profile.kyc].tone}>KYC {KYC_CFG[profile.kyc].label.toLowerCase()}</Badge>
          )}
          <span>
            Score <span className="font-mono font-semibold text-yo-txt">{profile.score}</span>/100
          </span>
          <span className="text-yo-txt-3">· {fmtDateTime(profile.lastCalculatedAt)}</span>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Score de cumplimiento" value={`${profile.score}/100`} tone="accent" mono />
        <MetricCard label="Nivel actual" value={levelCfg.label} tone={levelCfg.tone} />
        <MetricCard label="Documentos requeridos" value={`${profile.docCompletionPct}%`} tone="accent" mono />
        <MetricCard
          label="Alertas activas"
          value={String(profile.activeAlertsCount)}
          tone={profile.activeAlertsCount > 0 ? "warn" : "ok"}
          mono
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-yo-border overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {tabs.map((t) => {
            const Ico = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px",
                  active
                    ? "border-yo-ac text-yo-ac"
                    : "border-transparent text-yo-txt-2 hover:text-yo-txt hover:border-yo-border-s",
                )}
              >
                <Ico className="size-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 70/30 layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <div className="min-w-0 flex flex-col gap-6">
          {tab === "resumen" && <ResumenTab profile={profile} onOpenComp={setOpenComponent} />}
          {tab === "kyc" && <KycTab profile={profile} />}
          {tab === "docs" && (
            <DocsTab profile={profile} onOpen={setOpenDoc} onUpload={() => setUploadOpen(true)} />
          )}
          {tab === "score" && <ScoreTab profile={profile} onOpen={setOpenComponent} />}
          {tab === "alerts" && <AlertsTab profile={profile} />}
          {tab === "history" && <HistoryTab profile={profile} />}
          {tab === "visibility" && <VisibilityTab profile={profile} />}
        </div>

        {/* Sidebar 30% */}
        <aside className="flex flex-col gap-4">
          <ChecklistCard profile={profile} />
          <SidebarAlerts profile={profile} />
          <NextActionsCard personType={personType} onUpload={() => setUploadOpen(true)} onComplete={() => setCompleteOpen(true)} />
          <DisclaimerCard />
        </aside>
      </div>

      {/* Drawers & Modals */}
      {openDoc && <DocDrawer doc={openDoc} onClose={() => setOpenDoc(null)} />}
      {openComponent && <ScoreExplainDrawer comp={openComponent} onClose={() => setOpenComponent(null)} />}
      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} />}
      {recalcOpen && <RecalcModal onClose={() => setRecalcOpen(false)} />}
      {completeOpen && <CompleteProfileDrawer profile={profile} onClose={() => setCompleteOpen(false)} onUpload={() => { setCompleteOpen(false); setUploadOpen(true); }} />}
    </div>
  );
}

function PersonTypeSelect({ value, onChange }: { value: PersonType; onChange: (v: PersonType) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as PersonType)}
      className="rounded-lg border border-yo-border bg-yo-surface px-3 py-2 text-sm font-medium text-yo-txt hover:bg-yo-raised transition"
      title="Tipo de perfil de cumplimiento"
    >
      <option value="PF">Persona Física</option>
      <option value="PFAE">Persona Física con Actividad Empresarial</option>
      <option value="PM">Persona Moral</option>
    </select>
  );
}


function MetricCard({
  label,
  value,
  tone,
  mono,
}: {
  label: string;
  value: string;
  tone: string;
  mono?: boolean;
}) {
  const c = TONE_CLASSES[tone] ?? TONE_CLASSES.accent;
  return (
    <div className="relative rounded-lg border border-yo-border bg-yo-surface p-4 overflow-hidden">
      <div className={cn("absolute inset-x-0 top-0 h-0.5", c.dot)} />
      <p className="text-[11px] uppercase tracking-wider text-yo-txt-3 font-medium">{label}</p>
      <p className={cn("mt-2 text-2xl font-bold text-yo-txt", mono && "font-mono")}>{value}</p>
    </div>
  );
}

/* ---------- Tabs ---------- */

function ResumenTab({
  profile,
  onOpenComp,
}: {
  profile: ReturnType<typeof getMockProfile>;
  onOpenComp: (c: ScoreComponent) => void;
}) {
  return (
    <>
      <ScoreCard profile={profile} />
      <div className="rounded-lg border border-yo-border bg-yo-surface p-5">
        <h3 className="text-sm font-semibold text-yo-txt mb-4">Métricas clave</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {profile.metrics.map((m) => {
            const tone =
              m.state === "great" ? "ok" : m.state === "good" ? "accent" : m.state === "review" ? "warn" : "err";
            return (
              <div key={m.label} className="flex items-center justify-between rounded-md border border-yo-border bg-yo-raised px-3 py-2.5">
                <span className="text-sm text-yo-txt-2">{m.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-yo-txt">{m.value}</span>
                  <Badge tone={tone}>
                    {m.state === "great" ? "Excelente" : m.state === "good" ? "Bueno" : m.state === "review" ? "Revisar" : "Bajo"}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <ScoreBreakdown profile={profile} onOpen={onOpenComp} compact />
    </>
  );
}

function ScoreCard({ profile }: { profile: ReturnType<typeof getMockProfile> }) {
  const pct = profile.score;
  const r = 54;
  const c = 2 * Math.PI * r;
  const cfg = LEVEL_CFG[profile.level];
  return (
    <div className="rounded-lg border border-yo-border bg-yo-surface p-6 flex flex-col md:flex-row gap-6 items-center">
      <div className="relative shrink-0">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={r} fill="none" stroke="var(--yo-border)" strokeWidth="10" />
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (pct / 100) * c}
            transform="rotate(-90 70 70)"
            className="text-yo-ac"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="font-mono text-3xl font-bold text-yo-txt">{profile.score}</div>
            <div className="text-[11px] text-yo-txt-3">/100</div>
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Badge tone={cfg.tone}>{cfg.label}</Badge>
          <span className="text-xs text-yo-txt-3">Rango {cfg.range}</span>
        </div>
        <h3 className="text-lg font-semibold text-yo-txt">Score de Cumplimiento</h3>
        <p className="text-sm text-yo-txt-2 mt-1 max-w-xl">
          Tu perfil mantiene buen cumplimiento documental y bajo nivel de disputas. Continúa cerrando operaciones sin
          incidencias para mejorar tu nivel.
        </p>
        <p className="text-[11px] text-yo-txt-3 mt-3 flex items-start gap-1.5">
          <Info className="size-3.5 shrink-0 mt-0.5" />
          Este score se calcula únicamente con información generada dentro de operaciones en YOKTO.
        </p>
      </div>
    </div>
  );
}

function ScoreBreakdown({
  profile,
  onOpen,
  compact,
}: {
  profile: ReturnType<typeof getMockProfile>;
  onOpen: (c: ScoreComponent) => void;
  compact?: boolean;
}) {
  return (
    <div className="rounded-lg border border-yo-border bg-yo-surface p-5">
      <h3 className="text-sm font-semibold text-yo-txt mb-4">Desglose del score</h3>
      <div className="flex flex-col gap-4">
        {profile.components.map((c) => (
          <button
            key={c.key}
            onClick={() => onOpen(c)}
            className="text-left group"
          >
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-yo-txt group-hover:text-yo-ac transition">{c.label}</span>
              <span className="font-mono font-semibold text-yo-txt">{c.score}%</span>
            </div>
            <div className="h-2 rounded-full bg-yo-raised overflow-hidden">
              <div className="h-full bg-yo-ac rounded-full" style={{ width: `${c.score}%` }} />
            </div>
            {!compact && <p className="text-xs text-yo-txt-2 mt-1.5">{c.explanation}</p>}
            <p className="text-[11px] text-yo-txt-3 mt-1">Peso: {(c.weight * 100).toFixed(0)}%</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function KycTab({ profile }: { profile: ComplianceProfile }) {
  const isPM = profile.personType === "PM";
  const title = isPM ? "Verificación de Empresa" : "Verificación de Identidad";
  const status = isPM ? profile.kyb : profile.kyc;
  return (
    <>
      <div className="rounded-lg border border-yo-border bg-yo-surface">
        <div className="px-5 py-4 border-b border-yo-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-yo-txt">{title}</h3>
            <p className="text-xs text-yo-txt-2 mt-0.5 inline-flex items-center gap-2">
              Estado: <Badge tone={KYC_CFG[status].tone}>{KYC_CFG[status].label}</Badge>
            </p>
          </div>
          <button className="text-sm text-yo-ac hover:text-yo-ac-h font-medium">Ver detalle</button>
        </div>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 p-5">
          {profile.identityFields.map((f) => (
            <div key={f.label}>
              <dt className="text-[11px] uppercase tracking-wider text-yo-txt-3 flex items-center gap-1">
                {f.label}
                {f.sensitive && <Lock className="size-3 text-yo-txt-3" />}
              </dt>
              <dd className={cn("mt-1 text-sm", f.sensitive ? "text-yo-txt-2" : "text-yo-txt", f.mono && "font-mono")}>{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {isPM && <RepresentativesCard reps={profile.representatives} />}
    </>
  );
}

function RepresentativesCard({ reps }: { reps: Representative[] }) {
  const statusTone = (s: Representative["status"]) => (s === "APPROVED" ? "ok" : s === "PENDING" ? "warn" : "err");
  const statusLabel = (s: Representative["status"]) => (s === "APPROVED" ? "Verificado" : s === "PENDING" ? "Pendiente" : "Rechazado");
  return (
    <div className="rounded-lg border border-yo-border bg-yo-surface">
      <div className="px-5 py-4 border-b border-yo-border flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-yo-txt">Representantes y autorizados</h3>
          <p className="text-xs text-yo-txt-2 mt-0.5">
            Los autorizados no sustituyen al representante legal; sus permisos dependen de su rol operativo y facultades documentadas.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-yo-ac hover:bg-yo-ac-h text-white px-3 py-2 text-sm font-medium">
          <UserPlus className="size-4" /> Agregar representante
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-yo-raised text-yo-txt-2 text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-5 py-2.5 font-medium">Nombre</th>
              <th className="text-left px-4 py-2.5 font-medium">Rol</th>
              <th className="text-left px-4 py-2.5 font-medium">Documento</th>
              <th className="text-left px-4 py-2.5 font-medium">Estado</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-yo-border">
            {reps.map((r) => (
              <tr key={r.id} className="hover:bg-yo-raised/60">
                <td className="px-5 py-3 text-yo-txt font-medium flex items-center gap-2">
                  {r.isLegal && <ShieldCheck className="size-4 text-[#059669]" />}
                  {r.name}
                </td>
                <td className="px-4 py-3 text-yo-txt-2">{r.role}</td>
                <td className="px-4 py-3 text-yo-txt-2">{r.document}</td>
                <td className="px-4 py-3"><Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge></td>
                <td className="px-4 py-3 text-right"><button className="text-xs font-medium text-yo-ac hover:text-yo-ac-h">Ver detalle</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function DocsTab({
  profile,
  onOpen,
  onUpload,
}: {
  profile: ComplianceProfile;
  onOpen: (d: ComplianceDoc) => void;
  onUpload: () => void;
}) {
  const [filter, setFilter] = useState<"ALL" | DocCategory>("ALL");
  const cats = useMemo(() => {
    const set = new Set<DocCategory>();
    profile.docs.forEach((d) => set.add(d.category));
    return Array.from(set);
  }, [profile.docs]);
  const filtered = filter === "ALL" ? profile.docs : profile.docs.filter((d) => d.category === filter);

  return (
    <div className="rounded-lg border border-yo-border bg-yo-surface">
      <div className="px-5 py-4 border-b border-yo-border flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-yo-txt">Documentos del Perfil</h3>
          <p className="text-xs text-yo-txt-2 mt-0.5">
            Estos documentos forman parte de tu perfil de cumplimiento. No pertenecen a una operación específica.
          </p>
        </div>
        <button
          onClick={onUpload}
          className="inline-flex items-center gap-2 rounded-lg bg-yo-ac hover:bg-yo-ac-h text-white px-3 py-2 text-sm font-medium transition"
        >
          <Upload className="size-4" /> Subir documento
        </button>
      </div>
      <div className="px-5 py-3 border-b border-yo-border flex flex-wrap gap-1.5">
        <FilterChip active={filter === "ALL"} onClick={() => setFilter("ALL")}>Todos</FilterChip>
        {cats.map((c) => (
          <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)}>
            {DOC_CATEGORY_LABEL[c]}
          </FilterChip>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-yo-raised text-yo-txt-2 text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-5 py-2.5 font-medium">Documento</th>
              <th className="text-left px-4 py-2.5 font-medium">Categoría</th>
              <th className="text-left px-4 py-2.5 font-medium">Estado</th>
              <th className="text-left px-4 py-2.5 font-medium">Vigencia</th>
              <th className="text-left px-4 py-2.5 font-medium">Actualizado</th>
              <th className="text-left px-4 py-2.5 font-medium">Revisado por</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-yo-border">
            {filtered.map((d) => (
              <tr key={d.id} className="hover:bg-yo-raised/60 cursor-pointer" onClick={() => onOpen(d)}>
                <td className="px-5 py-3 text-yo-txt font-medium">
                  {d.name}
                  {d.required && <span className="ml-2 text-[10px] uppercase tracking-wider text-yo-txt-3">Requerido</span>}
                </td>
                <td className="px-4 py-3 text-yo-txt-2">{DOC_CATEGORY_LABEL[d.category]}</td>
                <td className="px-4 py-3"><Badge tone={DOC_STATUS_CFG[d.status].tone}>{DOC_STATUS_CFG[d.status].label}</Badge></td>
                <td className="px-4 py-3 text-yo-txt-2 font-mono text-xs">{d.expiresAt ? fmtDate(d.expiresAt) : "—"}</td>
                <td className="px-4 py-3 text-yo-txt-2 font-mono text-xs">{fmtDate(d.updatedAt)}</td>
                <td className="px-4 py-3 text-yo-txt-2">{d.reviewedBy}</td>
                <td className="px-4 py-3 text-right"><ChevronRight className="size-4 text-yo-txt-3 inline" /></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-yo-txt-3">Sin documentos en esta categoría.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full text-xs font-medium border transition",
        active ? "bg-yo-ac text-white border-yo-ac" : "bg-yo-surface text-yo-txt-2 border-yo-border hover:bg-yo-raised",
      )}
    >
      {children}
    </button>
  );
}


function ScoreTab({
  profile,
  onOpen,
}: {
  profile: ReturnType<typeof getMockProfile>;
  onOpen: (c: ScoreComponent) => void;
}) {
  return (
    <>
      <ScoreCard profile={profile} />
      <ScoreBreakdown profile={profile} onOpen={onOpen} />
    </>
  );
}

function AlertsTab({ profile }: { profile: ReturnType<typeof getMockProfile> }) {
  return (
    <div className="flex flex-col gap-3">
      {profile.alerts.map((a) => {
        const tone = ALERT_TONE[a.severity];
        const Ico = a.severity === "ERROR" ? XCircle : a.severity === "WARN" ? AlertTriangle : a.severity === "OK" ? CheckCircle2 : Info;
        const c = TONE_CLASSES[tone];
        return (
          <div key={a.id} className={cn("rounded-lg border border-yo-border p-4 flex gap-3 bg-yo-surface")}>
            <div className={cn("shrink-0 size-9 rounded-lg grid place-items-center", c.bg)}>
              <Ico className={cn("size-5", c.text)} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-yo-txt">{a.title}</p>
                  <p className="text-sm text-yo-txt-2 mt-0.5">{a.message}</p>
                </div>
                <span className="text-[11px] text-yo-txt-3 font-mono shrink-0">{fmtDate(a.createdAt)}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Badge tone={a.status === "ACTIVE" ? "warn" : a.status === "RESOLVED" ? "ok" : "neutral"}>
                  {a.status === "ACTIVE" ? "Activa" : a.status === "RESOLVED" ? "Resuelta" : "Ignorada"}
                </Badge>
                {a.actionLabel && a.status === "ACTIVE" && (
                  <button className="text-xs font-medium text-yo-ac hover:text-yo-ac-h">{a.actionLabel} →</button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HistoryTab({ profile }: { profile: ReturnType<typeof getMockProfile> }) {
  const max = 100;
  const min = 0;
  const pts = [...profile.history].reverse();
  const w = 600, h = 140, pad = 16;
  const step = (w - pad * 2) / Math.max(1, pts.length - 1);
  const path = pts
    .map((p, i) => {
      const x = pad + i * step;
      const y = h - pad - ((p.score - min) / (max - min)) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <>
      <div className="rounded-lg border border-yo-border bg-yo-surface p-5">
        <h3 className="text-sm font-semibold text-yo-txt mb-3">Evolución del score</h3>
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
          <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="var(--yo-border)" />
          <path d={path} fill="none" stroke="currentColor" className="text-yo-ac" strokeWidth="2" />
          {pts.map((p, i) => {
            const x = pad + i * step;
            const y = h - pad - ((p.score - min) / (max - min)) * (h - pad * 2);
            return <circle key={i} cx={x} cy={y} r="3" className="fill-yo-ac" />;
          })}
        </svg>
      </div>

      <div className="rounded-lg border border-yo-border bg-yo-surface overflow-hidden">
        <div className="px-5 py-3 border-b border-yo-border">
          <h3 className="text-sm font-semibold text-yo-txt">Historial de score</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-yo-raised text-yo-txt-2 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium">Fecha</th>
                <th className="text-left px-4 py-2.5 font-medium">Score</th>
                <th className="text-left px-4 py-2.5 font-medium">Nivel</th>
                <th className="text-left px-4 py-2.5 font-medium">Motivo</th>
                <th className="text-right px-5 py-2.5 font-medium">Cambio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yo-border">
              {profile.history.map((h, i) => (
                <tr key={i}>
                  <td className="px-5 py-3 text-yo-txt-2 font-mono text-xs">{fmtDate(h.date)}</td>
                  <td className="px-4 py-3 text-yo-txt font-mono font-semibold">{h.score}</td>
                  <td className="px-4 py-3"><Badge tone={LEVEL_CFG[h.level].tone}>{LEVEL_CFG[h.level].label}</Badge></td>
                  <td className="px-4 py-3 text-yo-txt-2">{h.reason}</td>
                  <td className={cn("px-5 py-3 text-right font-mono text-sm font-semibold", h.delta > 0 ? "text-[#059669]" : h.delta < 0 ? "text-[#DC2626]" : "text-yo-txt-3")}>
                    {h.delta > 0 ? `+${h.delta}` : h.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-yo-border bg-yo-surface overflow-hidden">
        <div className="px-5 py-3 border-b border-yo-border">
          <h3 className="text-sm font-semibold text-yo-txt">Bitácora de auditoría</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-yo-raised text-yo-txt-2 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium">Fecha</th>
                <th className="text-left px-4 py-2.5 font-medium">Evento</th>
                <th className="text-left px-4 py-2.5 font-medium">Usuario</th>
                <th className="text-left px-4 py-2.5 font-medium">Módulo</th>
                <th className="text-left px-5 py-2.5 font-medium">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yo-border">
              {profile.audit.map((a, i) => (
                <tr key={i}>
                  <td className="px-5 py-3 text-yo-txt-2 font-mono text-xs">{fmtDateTime(a.date)}</td>
                  <td className="px-4 py-3 text-yo-txt">{a.event}</td>
                  <td className="px-4 py-3 text-yo-txt-2">{a.user}</td>
                  <td className="px-4 py-3 text-yo-txt-2">{a.module}</td>
                  <td className="px-5 py-3 text-yo-txt-2">{a.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function VisibilityTab() {
  const rows = [
    { field: "Nivel de cumplimiento", cp: "Sí", bo: "Sí", edit: "No" },
    { field: "Score global", cp: "Sí, parcial", bo: "Sí", edit: "No" },
    { field: "Documentos completos", cp: "Parcial", bo: "Sí", edit: "Sí" },
    { field: "Archivos completos", cp: "No, salvo permisos", bo: "Sí", edit: "Sí" },
    { field: "Historial de disputas", cp: "Resumen", bo: "Sí", edit: "No" },
    { field: "Observaciones internas", cp: "No", bo: "Sí", edit: "No" },
  ];
  return (
    <>
      <div className="rounded-lg border border-[#EBEBF0] bg-[#F0F9FF] p-4 flex gap-3">
        <Info className="size-5 text-[#0284C7] shrink-0" />
        <p className="text-sm text-[#0C4A6E]">
          Tu contraparte no puede ver archivos sensibles completos salvo que estén vinculados a una operación compartida
          o hayas autorizado su uso dentro del flujo de cumplimiento.
        </p>
      </div>
      <div className="rounded-lg border border-yo-border bg-yo-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-yo-raised text-yo-txt-2 text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-5 py-2.5 font-medium">Dato</th>
              <th className="text-left px-4 py-2.5 font-medium">Visible para contraparte</th>
              <th className="text-left px-4 py-2.5 font-medium">Visible para backoffice</th>
              <th className="text-left px-5 py-2.5 font-medium">Editable</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-yo-border">
            {rows.map((r) => (
              <tr key={r.field}>
                <td className="px-5 py-3 text-yo-txt font-medium">{r.field}</td>
                <td className="px-4 py-3 text-yo-txt-2">{r.cp}</td>
                <td className="px-4 py-3 text-yo-txt-2">{r.bo}</td>
                <td className="px-5 py-3 text-yo-txt-2">{r.edit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------- Sidebar ---------- */

function ChecklistCard({ profile }: { profile: ReturnType<typeof getMockProfile> }) {
  const done = profile.checklist.filter((c) => c.done).length;
  return (
    <div className="rounded-lg border border-yo-border bg-yo-surface p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-yo-txt">Checklist de mejora</h3>
        <span className="text-xs font-mono text-yo-txt-2">{done}/{profile.checklist.length}</span>
      </div>
      <ul className="flex flex-col gap-2.5">
        {profile.checklist.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-sm">
            {c.done ? (
              <CheckCircle2 className="size-4 text-[#059669] shrink-0 mt-0.5" />
            ) : (
              <Circle className="size-4 text-yo-txt-3 shrink-0 mt-0.5" />
            )}
            <span className={cn(c.done ? "text-yo-txt-2 line-through" : "text-yo-txt")}>{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SidebarAlerts({ profile }: { profile: ReturnType<typeof getMockProfile> }) {
  const active = profile.alerts.filter((a) => a.status === "ACTIVE").slice(0, 3);
  if (active.length === 0) {
    return (
      <div className="rounded-lg border border-yo-border bg-yo-surface p-5 text-center">
        <CheckCircle2 className="size-8 text-[#059669] mx-auto mb-2" />
        <p className="text-sm font-medium text-yo-txt">Sin alertas activas</p>
        <p className="text-xs text-yo-txt-2 mt-1">Tu perfil no presenta pendientes críticos.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-yo-border bg-yo-surface p-5">
      <h3 className="text-sm font-semibold text-yo-txt mb-3">Alertas activas</h3>
      <ul className="flex flex-col gap-3">
        {active.map((a) => {
          const c = TONE_CLASSES[ALERT_TONE[a.severity]];
          return (
            <li key={a.id} className="flex items-start gap-2">
              <span className={cn("mt-1.5 size-2 rounded-full shrink-0", c.dot)} />
              <div className="min-w-0">
                <p className="text-sm text-yo-txt font-medium">{a.title}</p>
                <p className="text-xs text-yo-txt-2 mt-0.5">{a.message}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NextActionsCard({ viewRole, onUpload }: { viewRole: "buyer" | "seller"; onUpload: () => void }) {
  const actions =
    viewRole === "buyer"
      ? ["Completar verificación", "Subir documento", "Ver recomendaciones"]
      : ["Subir documento", "Corregir observaciones", "Ver checklist de mejora"];
  return (
    <div className="rounded-lg border border-yo-border bg-yo-surface p-5">
      <h3 className="text-sm font-semibold text-yo-txt mb-3">Próximas acciones</h3>
      <div className="flex flex-col gap-2">
        {actions.map((a, i) => (
          <button
            key={a}
            onClick={i === 1 || (viewRole === "seller" && i === 0) ? onUpload : undefined}
            className="w-full text-left px-3 py-2 rounded-md bg-yo-raised hover:bg-yo-border text-sm text-yo-txt transition flex items-center justify-between"
          >
            {a}
            <ChevronRight className="size-4 text-yo-txt-3" />
          </button>
        ))}
      </div>
    </div>
  );
}

function DisclaimerCard() {
  return (
    <div className="rounded-lg border border-yo-border bg-yo-raised p-4">
      <p className="text-[11px] text-yo-txt-2 leading-relaxed">
        El Perfil de Cumplimiento es un indicador interno basado en datos de operaciones realizadas en YOKTO. No
        constituye calificación crediticia, dictamen financiero ni garantía de cumplimiento.
      </p>
    </div>
  );
}

/* ---------- Drawer / Modal ---------- */

function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-yo-surface border-l border-yo-border flex flex-col animate-in slide-in-from-right">
        <div className="flex items-center justify-between px-5 py-4 border-b border-yo-border">
          <h3 className="text-sm font-semibold text-yo-txt">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-yo-raised">
            <X className="size-4 text-yo-txt-2" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function DocDrawer({ doc, onClose }: { doc: ComplianceDoc; onClose: () => void }) {
  return (
    <Drawer title={doc.name} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={DOC_STATUS_CFG[doc.status].tone}>{DOC_STATUS_CFG[doc.status].label}</Badge>
          <Badge tone="accent">{doc.category}</Badge>
        </div>
        <div className="aspect-[4/3] rounded-lg border border-yo-border bg-yo-raised grid place-items-center text-yo-txt-3 text-sm">
          Vista previa PDF
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-[11px] uppercase tracking-wider text-yo-txt-3">Vigencia</dt><dd className="mt-1 font-mono text-yo-txt">{doc.expiresAt ? fmtDate(doc.expiresAt) : "—"}</dd></div>
          <div><dt className="text-[11px] uppercase tracking-wider text-yo-txt-3">Actualizado</dt><dd className="mt-1 font-mono text-yo-txt">{fmtDate(doc.updatedAt)}</dd></div>
          <div><dt className="text-[11px] uppercase tracking-wider text-yo-txt-3">Revisado por</dt><dd className="mt-1 text-yo-txt">{doc.reviewedBy}</dd></div>
          <div><dt className="text-[11px] uppercase tracking-wider text-yo-txt-3">Hash</dt><dd className="mt-1 font-mono text-yo-txt-2 text-xs">{doc.hash ?? "—"}</dd></div>
        </dl>
        {doc.notes && (
          <div className="rounded-lg border border-[#EBEBF0] bg-[#FFFBEB] p-3">
            <p className="text-xs text-[#78350F]">{doc.notes}</p>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <button className="flex-1 rounded-lg border border-yo-border bg-yo-surface px-3 py-2 text-sm font-medium text-yo-txt hover:bg-yo-raised">
            Descargar
          </button>
          <button className="flex-1 rounded-lg bg-yo-ac hover:bg-yo-ac-h text-white px-3 py-2 text-sm font-medium">
            Reemplazar
          </button>
        </div>
      </div>
    </Drawer>
  );
}

function ScoreExplainDrawer({ comp, onClose }: { comp: ScoreComponent; onClose: () => void }) {
  return (
    <Drawer title={comp.label} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-yo-border bg-yo-raised p-4 text-center">
          <p className="text-[11px] uppercase tracking-wider text-yo-txt-3">Puntaje</p>
          <p className="font-mono text-4xl font-bold text-yo-txt mt-1">{comp.score}<span className="text-lg text-yo-txt-3">/100</span></p>
          <p className="text-xs text-yo-txt-2 mt-2">Peso en el score total: {(comp.weight * 100).toFixed(0)}%</p>
        </div>
        <div>
          <h4 className="text-xs uppercase tracking-wider text-yo-txt-3 mb-1.5">Explicación</h4>
          <p className="text-sm text-yo-txt-2">{comp.explanation}</p>
        </div>
        <div className="rounded-lg border border-[#EBEBF0] bg-[#F0F9FF] p-3 flex gap-2">
          <Info className="size-4 text-[#0284C7] shrink-0 mt-0.5" />
          <p className="text-xs text-[#0C4A6E]">
            Este indicador se recalcula automáticamente conforme cierras nuevas operaciones en YOKTO.
          </p>
        </div>
      </div>
    </Drawer>
  );
}

function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-yo-surface rounded-xl border border-yo-border shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-yo-border">
          <h3 className="text-sm font-semibold text-yo-txt">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-yo-raised"><X className="size-4 text-yo-txt-2" /></button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-yo-border flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

function UploadModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="Subir documento"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-yo-border bg-yo-surface px-3 py-2 text-sm font-medium text-yo-txt hover:bg-yo-raised">Cancelar</button>
          <button onClick={onClose} className="rounded-lg bg-yo-ac hover:bg-yo-ac-h text-white px-3 py-2 text-sm font-medium">Subir documento</button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-xs uppercase tracking-wider text-yo-txt-3 font-medium">Tipo de documento</label>
          <select className="mt-1.5 w-full rounded-lg border border-yo-border bg-yo-surface px-3 py-2 text-sm text-yo-txt">
            <option>Constancia de situación fiscal</option>
            <option>Identificación oficial</option>
            <option>Comprobante de domicilio</option>
            <option>Acta constitutiva</option>
            <option>Poder del representante</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase tracking-wider text-yo-txt-3 font-medium">Fecha emisión</label>
            <input type="date" className="mt-1.5 w-full rounded-lg border border-yo-border bg-yo-surface px-3 py-2 text-sm text-yo-txt" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-yo-txt-3 font-medium">Vigencia</label>
            <input type="date" className="mt-1.5 w-full rounded-lg border border-yo-border bg-yo-surface px-3 py-2 text-sm text-yo-txt" />
          </div>
        </div>
        <div className="rounded-lg border-2 border-dashed border-yo-border bg-yo-raised p-6 text-center">
          <Upload className="size-6 text-yo-txt-3 mx-auto mb-2" />
          <p className="text-sm text-yo-txt">Arrastra tu documento aquí o selecciona un archivo</p>
          <p className="text-xs text-yo-txt-3 mt-1">PDF, JPG o PNG · máximo 20 MB</p>
          <button className="mt-3 rounded-lg border border-yo-border bg-yo-surface px-3 py-1.5 text-xs font-medium text-yo-txt hover:bg-yo-raised">
            Seleccionar archivo
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RecalcModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="Recalcular score"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="rounded-lg border border-yo-border bg-yo-surface px-3 py-2 text-sm font-medium text-yo-txt hover:bg-yo-raised">Cancelar</button>
          <button onClick={onClose} className="rounded-lg bg-yo-ac hover:bg-yo-ac-h text-white px-3 py-2 text-sm font-medium inline-flex items-center gap-2">
            <RefreshCw className="size-4" /> Recalcular
          </button>
        </>
      }
    >
      <p className="text-sm text-yo-txt-2">
        Tu score se actualizará con la información más reciente de operaciones, hitos, documentos y disputas registradas
        en YOKTO. El resultado puede tardar unos segundos.
      </p>
    </Modal>
  );
}
