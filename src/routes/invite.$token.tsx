import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck, Clock, FileText, Users, Landmark, Scale, Gavel, FileSignature,
  CheckCircle2, XCircle, MessageSquareWarning, ArrowRight, ArrowLeft, Lock, Hash,
  Building2, User, Calendar, AlertTriangle, Download, Eye, ClipboardCheck, X,
  RefreshCw, Copy, Ban, Truck, Package, Camera, MapPin, PenLine,
} from "lucide-react";
import { CumplexLogo } from "@/components/logo";
import { InfoBox } from "@/components/tx/ui/info-box";
import { MoneyDisplay } from "@/components/tx/ui/money-display";
import { SectorBadge } from "@/components/tx/ui/sector-badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  component: InviteReviewPage,
});

// ─────────────────────────────────────────────────────────────────────────
// Tipos y mock (en producción viene de GET /api/invitations/[token])
// ─────────────────────────────────────────────────────────────────────────
type InvitationRole = "PAGADOR" | "BENEFICIARIO";
type InviteState =
  | "ENVIADA" | "VISTA" | "CAMBIOS_SOLICITADOS" | "ACEPTADA" | "RECHAZADA" | "EXPIRADA";

interface Party {
  nombre: string;
  razonSocial?: string;
  rfcMasked: string;
  rol: InvitationRole;
  verificado: boolean;
  scoreBanda?: "A" | "B" | "C";
}

interface Milestone {
  orden: number;
  nombre: string;
  porcentaje: number;
  monto: number;
  fechaLimite: string;
  responsable: "Comprador" | "Vendedor";
  criterio: string;
  verificacion: string;
  autoRelease: boolean;
}

interface InviteData {
  token: string;
  invitation: {
    id: string;
    estado: InviteState;
    rol_invitado: InvitationRole;
    expira_at: string;
    created_at: string;
    invited_by_name: string;
  };
  transaction: {
    id: string;
    numero: string;
    sector: string;
    titulo: string;
    descripcion: string;
    monto_total: number; // centavos
    moneda: "MXN";
    fecha_inicio: string;
    fecha_fin: string;
  };
  agreement_version: {
    version_number: number;
    status: "SENT" | "UNDER_REVIEW" | "CHANGES_REQUESTED" | "ACCEPTED" | "LOCKED";
    hash_preliminar?: string;
  };
  parties: { creator: Party; invited: Party };
  economics: {
    monto_bruto: number;
    comision_bps: number;
    absorbe: "comprador" | "vendedor" | "compartida";
    metodo_sugerido: "SPEI" | "Tarjeta";
  };
  milestones: Milestone[];
  documentos: string[];
  evidencia: string[];
  fiscal: { cfdi: string; rep: boolean; validaciones: string[] };
  liberacion: { modo: string; ventanaRevision: string; correccion: string; devolucion: string };
  disputa: { cuando: string; plazo: string; evidencia: string; resultados: string };
}

const HEADER_COPY: Record<InvitationRole, { title: string; subtitle: string; primaryCta: string; roleLabel: string; counterpartyLabel: string }> = {
  PAGADOR: {
    title: "Revisa esta operación antes de fondear",
    subtitle: "Acepta únicamente si el monto, los hitos y las reglas de liberación son correctos.",
    primaryCta: "Aceptar operación y continuar a firma",
    roleLabel: "Comprador / Pagador",
    counterpartyLabel: "Vendedor / Beneficiario",
  },
  BENEFICIARIO: {
    title: "Revisa esta operación antes de aceptar entregar",
    subtitle: "Acepta únicamente si puedes cumplir los hitos, documentos y fechas acordadas.",
    primaryCta: "Aceptar operación y continuar a firma",
    roleLabel: "Vendedor / Beneficiario",
    counterpartyLabel: "Comprador / Pagador",
  },
};

function useInviteMock(token: string): InviteData {
  return useMemo(() => ({
    token,
    invitation: {
      id: "inv_" + token.slice(0, 6),
      estado: "ENVIADA",
      rol_invitado: "PAGADOR",
      expira_at: new Date(Date.now() + 18 * 3600 * 1000).toISOString(),
      created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      invited_by_name: "DevStudio MX",
    },
    transaction: {
      id: "tx_demo",
      numero: "CUMPLEX-2026-014",
      sector: "Autotransporte",
      titulo: "Flete Mazatlán → Guadalajara",
      descripcion: "Flete Mazatlán–Guadalajara, 12 toneladas de mercancía, entrega directa en almacén del destinatario.",
      monto_total: 85000000,
      moneda: "MXN",
      fecha_inicio: new Date(Date.now() + 5 * 86400 * 1000).toISOString(),
      fecha_fin: new Date(Date.now() + 25 * 86400 * 1000).toISOString(),
    },
    agreement_version: { version_number: 1, status: "SENT" },
    parties: {
      creator: { nombre: "DevStudio MX", razonSocial: "DevStudio Servicios S.A. de C.V.", rfcMasked: "DSS***456A1", rol: "BENEFICIARIO", verificado: true, scoreBanda: "A" },
      invited: { nombre: "Tú", rfcMasked: "***", rol: "PAGADOR", verificado: false },
    },
    economics: { monto_bruto: 85000000, comision_bps: 150, absorbe: "compartida", metodo_sugerido: "SPEI" },
    milestones: [
      { orden: 1, nombre: "Carga y salida",        porcentaje: 20, monto: 17000000, fechaLimite: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),  responsable: "Vendedor", criterio: "Unidad cargada y en ruta", verificacion: "Carta Porte + foto de carga + GPS", autoRelease: false },
      { orden: 2, nombre: "Tránsito verificado",   porcentaje: 30, monto: 25500000, fechaLimite: new Date(Date.now() + 14 * 86400 * 1000).toISOString(), responsable: "Vendedor", criterio: "Punto medio confirmado", verificacion: "Tracking GPS + checkpoint",         autoRelease: true  },
      { orden: 3, nombre: "Entrega y firma",       porcentaje: 50, monto: 42500000, fechaLimite: new Date(Date.now() + 22 * 86400 * 1000).toISOString(), responsable: "Vendedor", criterio: "Recepción firmada",     verificacion: "Firma receptor + fotos + REP",       autoRelease: false },
    ],
    documentos: ["CFDI PPD", "REP posterior", "Carta Porte", "Contrato de servicio"],
    evidencia:  ["Fotos de carga", "Video breve de salida", "Tracking GPS", "Checklist de entrega", "Firma del receptor"],
    fiscal: { cfdi: "PPD (Pago en parcialidades)", rep: true, validaciones: ["XML timbrado", "UUID válido", "RFC coincidente", "Montos consistentes", "Forma de pago real"] },
    liberacion: { modo: "Por hito, con auto-release opcional", ventanaRevision: "72 horas hábiles por hito", correccion: "Reenvío de evidencia hasta 2 veces", devolucion: "Reembolso proporcional por hito no cumplido" },
    disputa: { cuando: "Desde el momento del rechazo de evidencia o incumplimiento de plazo", plazo: "5 días hábiles para responder", evidencia: "Documentos, fotos, videos, GPS, comunicaciones", resultados: "Liberación, devolución parcial, devolución total o corrección" },
  }), [token]);
}

// ─────────────────────────────────────────────────────────────────────────
// Página principal — enruta según estado
// ─────────────────────────────────────────────────────────────────────────
function InviteReviewPage() {
  const { token } = Route.useParams();
  const data = useInviteMock(token);
  const [state, setState] = useState<InviteState>(data.invitation.estado);
  const now = Date.now();
  const expired = new Date(data.invitation.expira_at).getTime() < now;

  if (expired) return <StateShell><ExpiredState /></StateShell>;
  if (state === "RECHAZADA") return <StateShell><ResolvedState kind="rechazada" /></StateShell>;
  if (state === "ACEPTADA") return <StateShell><ResolvedState kind="aceptada" /></StateShell>;
  if (state === "CAMBIOS_SOLICITADOS") return <StateShell><ChangesSentState /></StateShell>;

  return (
    <ReviewLayout
      data={data}
      onAccepted={() => setState("ACEPTADA")}
      onRejected={() => setState("RECHAZADA")}
      onChanges={() => setState("CAMBIOS_SOLICITADOS")}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Layout de revisión
// ─────────────────────────────────────────────────────────────────────────
function ReviewLayout({
  data, onAccepted, onRejected, onChanges,
}: { data: InviteData; onAccepted: () => void; onRejected: () => void; onChanges: () => void }) {
  const copy = HEADER_COPY[data.invitation.rol_invitado];
  const isBuyer = data.invitation.rol_invitado === "PAGADOR";

  // Checklist antes de aceptar
  const [checks, setChecks] = useState({ partes: false, monto: false, hitos: false, docs: false, liberacion: false, disputa: false });
  const allChecked = Object.values(checks).every(Boolean);
  const toggle = (k: keyof typeof checks) => setChecks((c) => ({ ...c, [k]: !c[k] }));

  const [showAccept, setShowAccept] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showChanges, setShowChanges] = useState(false);
  const [showContract, setShowContract] = useState(false);

  // Auditoría: invitation_opened (mock)
  useEffect(() => {
    // POST /api/invitations/[token]/view
    // console.info("audit:invitation_opened", { token: data.token });
  }, [data.token]);

  return (
    <div className="min-h-dvh bg-yo-bg text-yo-txt">
      {/* Top bar público */}
      <header className="border-b border-yo-border bg-yo-surface sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CumplexLogo className="h-7" />
            <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs text-yo-txt-3 hover:text-yo-txt">
              <ArrowLeft className="size-3.5" /> Volver a inicio
            </Link>
          </div>
          <div className="text-[11px] text-yo-txt-3 font-mono">Invitación · {data.token.slice(0, 8)}</div>
        </div>
      </header>

      {/* Header de invitación (wireframe 7.3) */}
      <section className="border-b border-yo-border bg-yo-surface">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 mb-3">
            <StateChip state={data.invitation.estado} />
            <ExpiryChip iso={data.invitation.expira_at} />
            <span className="text-[11px] text-yo-txt-3">Enviada por <span className="text-yo-txt-2 font-medium">{data.invitation.invited_by_name}</span></span>
          </div>
          <h1 className="text-2xl font-bold">{copy.title}</h1>
          <p className="text-sm text-yo-txt-2 mt-1 max-w-3xl">{copy.subtitle}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[12px] text-yo-txt-2">
            <span className="font-mono">Operación {data.transaction.numero}</span>
            <span>·</span>
            <SectorBadge sector={data.transaction.sector} />
            <span>·</span>
            <span>Monto total <strong className="text-yo-txt"><MoneyDisplay amount={data.transaction.monto_total / 100} currency={data.transaction.moneda} /></strong></span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-yo-ac font-medium">
              <ShieldCheck className="size-3.5" /> Tu rol: {copy.roleLabel}
            </span>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Columna principal */}
        <div className="flex flex-col gap-4 min-w-0">
          <OperationSummaryCard data={data} />
          <PartiesPreviewCard data={data} copy={copy} />
          <EconomicsPreviewCard data={data} isBuyer={isBuyer} />
          <MilestonesPreviewCard data={data} />
          <RequiredDocumentsPreviewCard data={data} isBuyer={isBuyer} />
          <FiscalTermsPreviewCard data={data} />
          <ReleaseRulesPreviewCard data={data} isBuyer={isBuyer} />
          <DisputeRulesPreviewCard data={data} />
          <PreliminaryContractCard data={data} onOpen={() => setShowContract(true)} />

          {/* Barra de acciones */}
          <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-yo-surface border-t border-yo-border flex flex-wrap gap-2 justify-end mt-2 z-10">
            <button onClick={() => setShowReject(true)} className="h-10 px-4 rounded-md border border-yo-border bg-transparent text-sm text-yo-txt-2 hover:text-[#B91C1C] hover:border-[#B91C1C] inline-flex items-center gap-2">
              <XCircle className="size-4" /> Rechazar
            </button>
            <button onClick={() => setShowChanges(true)} className="h-10 px-4 rounded-md border border-yo-border bg-transparent text-sm text-yo-txt inline-flex items-center gap-2 hover:border-yo-ac">
              <MessageSquareWarning className="size-4" /> Solicitar cambios
            </button>
            <button
              onClick={() => setShowAccept(true)}
              disabled={!allChecked}
              title={allChecked ? "" : "Marca todos los puntos del panel lateral antes de aceptar"}
              className={cn("h-10 px-4 rounded-md text-sm font-semibold inline-flex items-center gap-2",
                allChecked ? "bg-yo-ac text-white hover:opacity-90" : "bg-yo-bg text-yo-txt-3 border border-yo-border cursor-not-allowed")}
            >
              <CheckCircle2 className="size-4" /> {copy.primaryCta}
            </button>
          </div>
        </div>

        {/* Sidebar sticky — Antes de aceptar */}
        <aside className="lg:sticky lg:top-[76px] self-start flex flex-col gap-3">
          <BeforeAcceptSidebar data={data} checks={checks} toggle={toggle} allChecked={allChecked} />
          <InfoBox tone="warn" title="Regla clave">
            Aceptar bloquea la versión del acuerdo si ambas partes aceptaron los mismos términos. Después sólo se sale por acuerdo mutuo o disputa formal.
          </InfoBox>
          <div className="rounded-lg border border-yo-border bg-yo-surface p-4 text-[11px] text-yo-txt-3 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5"><Hash className="size-3.5" /> Versión: <span className="font-mono text-yo-txt-2">v{data.agreement_version.version_number}.0</span></div>
            <div className="flex items-center gap-1.5"><Calendar className="size-3.5" /> Enviada: <span className="font-mono text-yo-txt-2">{new Date(data.invitation.created_at).toLocaleString("es-MX")}</span></div>
            <div className="flex items-center gap-1.5"><Clock className="size-3.5" /> Vence: <span className="font-mono text-yo-txt-2">{new Date(data.invitation.expira_at).toLocaleString("es-MX")}</span></div>
          </div>
        </aside>
      </div>

      {showAccept && (
        <AcceptInvitationDialog
          copy={copy}
          onClose={() => setShowAccept(false)}
          onConfirm={() => { setShowAccept(false); toast.success("Operación aceptada. Continuando a firma…"); onAccepted(); }}
        />
      )}
      {showReject && (
        <RejectInvitationDialog
          onClose={() => setShowReject(false)}
          onConfirm={() => { setShowReject(false); toast("Operación rechazada. Se notificó al creador."); onRejected(); }}
        />
      )}
      {showChanges && (
        <RequestChangesDialog
          onClose={() => setShowChanges(false)}
          onConfirm={() => { setShowChanges(false); toast.success("Solicitud de cambios enviada."); onChanges(); }}
        />
      )}
      {showContract && <PreliminaryContractDialog data={data} onClose={() => setShowContract(false)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Cards
// ─────────────────────────────────────────────────────────────────────────
function Card({ icon: Icon, title, action, children }: { icon: any; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-yo-border bg-yo-surface">
      <header className="px-4 h-11 flex items-center justify-between border-b border-yo-border">
        <div className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-yo-ac" /> {title}</div>
        {action}
      </header>
      <div className="p-4 flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-1.5 border-b border-yo-border last:border-0", strong && "pt-2 mt-1 border-t font-semibold")}>
      <span className="text-xs text-yo-txt-2">{label}</span>
      <span className={cn("text-sm text-right", strong && "text-base")}>{value}</span>
    </div>
  );
}

function OperationSummaryCard({ data }: { data: InviteData }) {
  const t = data.transaction;
  return (
    <Card icon={FileText} title="Resumen de la operación">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
        <div>
          <Row label="Número" value={<span className="font-mono">{t.numero}</span>} />
          <Row label="Sector" value={t.sector} />
          <Row label="Concepto" value={t.titulo} />
          <Row label="Estado" value={<StateChip state={data.invitation.estado} />} />
        </div>
        <div>
          <Row label="Fecha estimada de inicio" value={new Date(t.fecha_inicio).toLocaleDateString("es-MX")} />
          <Row label="Fecha máxima de conclusión" value={new Date(t.fecha_fin).toLocaleDateString("es-MX")} />
          <Row label="Invitado como" value={HEADER_COPY[data.invitation.rol_invitado].roleLabel} />
          <Row label="Monto total" value={<MoneyDisplay amount={t.monto_total / 100} currency={t.moneda} />} strong />
        </div>
      </div>
      <p className="text-sm text-yo-txt-2 mt-3 leading-relaxed">{t.descripcion}</p>
    </Card>
  );
}

function PartiesPreviewCard({ data, copy }: { data: InviteData; copy: (typeof HEADER_COPY)[InvitationRole] }) {
  return (
    <Card icon={Users} title="Partes involucradas">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <PartyBlock title={`${copy.counterpartyLabel} · Creador`} party={data.parties.creator} showScore />
        <PartyBlock title={`${copy.roleLabel} · Tú`} party={data.parties.invited} />
      </div>
      <p className="text-[11px] text-yo-txt-3 mt-2">
        Antes de aceptar sólo mostramos verificación y una banda de score limitada. No exponemos señales internas (PLD, PEP, sanciones ni desglose sensible).
      </p>
    </Card>
  );
}

function PartyBlock({ title, party, showScore }: { title: string; party: Party; showScore?: boolean }) {
  const isOrg = !!party.razonSocial;
  return (
    <div className="border border-yo-border rounded-md p-3">
      <div className="text-[10px] uppercase tracking-wider text-yo-txt-3">{title}</div>
      <div className="text-sm font-semibold mt-1 flex items-center gap-2">
        {isOrg ? <Building2 className="size-4" /> : <User className="size-4" />}
        {party.razonSocial ?? party.nombre}
      </div>
      {party.razonSocial && <div className="text-xs text-yo-txt-2">{party.nombre}</div>}
      <div className="text-[11px] text-yo-txt-3 font-mono mt-1">RFC {party.rfcMasked}</div>
      <div className="mt-2 flex items-center gap-2">
        <span className={cn("inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full",
          party.verificado ? "bg-yo-ok-bg text-[color:var(--yo-ok)]" : "bg-yo-warn-bg text-[color:var(--yo-warn)]")}>
          {party.verificado ? <><CheckCircle2 className="size-3" /> Verificado</> : <><AlertTriangle className="size-3" /> Verificación pendiente</>}
        </span>
        {showScore && party.scoreBanda && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yo-ac/10 text-yo-ac font-semibold">Score banda {party.scoreBanda}</span>
        )}
      </div>
    </div>
  );
}

function EconomicsPreviewCard({ data, isBuyer }: { data: InviteData; isBuyer: boolean }) {
  const bruto = data.economics.monto_bruto;
  const comision = Math.round((bruto * data.economics.comision_bps) / 10000);
  const iva = Math.round(comision * 0.16);
  const totalFondear = bruto + comision + iva;
  const netoRecibir = bruto - (data.economics.absorbe === "vendedor" ? comision + iva : data.economics.absorbe === "compartida" ? Math.round((comision + iva) / 2) : 0);

  return (
    <Card icon={Landmark} title="Monto y condiciones económicas">
      <Row label="Monto bruto de operación" value={<MoneyDisplay amount={bruto / 100} />} />
      <Row label={`Comisión Cumplex (${(data.economics.comision_bps / 100).toFixed(2)}%)`} value={<MoneyDisplay amount={comision / 100} />} />
      <Row label="IVA de comisión Cumplex (16%)" value={<MoneyDisplay amount={iva / 100} />} />
      <Row label="Método sugerido de pago" value={data.economics.metodo_sugerido} />
      <Row label="Quién absorbe la comisión" value={{ comprador: "Comprador", vendedor: "Vendedor", compartida: "Compartida 50/50" }[data.economics.absorbe]} />
      {isBuyer ? (
        <>
          <Row label="Total estimado a fondear" value={<MoneyDisplay amount={totalFondear / 100} size="lg" />} strong />
          <p className="text-[11px] text-yo-txt-3 mt-1">Los fondos serán procesados y retenidos por la pasarela configurada. Cumplex no custodia fondos.</p>
        </>
      ) : (
        <>
          <Row label="Monto estimado a recibir" value={<MoneyDisplay amount={netoRecibir / 100} size="lg" />} strong />
          <p className="text-[11px] text-yo-txt-3 mt-1">La liberación depende del cumplimiento de los hitos y la evidencia aceptada.</p>
        </>
      )}
    </Card>
  );
}

function evidenciaIcon(v: string) {
  const s = v.toLowerCase();
  if (s.includes("gps")) return MapPin;
  if (s.includes("foto")) return Camera;
  if (s.includes("firma")) return PenLine;
  if (s.includes("carta") || s.includes("port")) return Truck;
  return Package;
}

function MilestonesPreviewCard({ data }: { data: InviteData }) {
  return (
    <Card icon={ClipboardCheck} title={`Hitos propuestos (${data.milestones.length})`}>
      <div className="flex flex-col gap-2">
        {data.milestones.map((h) => (
          <div key={h.orden} className="border border-yo-border rounded-md p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="size-7 rounded-full bg-yo-ac/10 text-yo-ac grid place-items-center text-xs font-bold shrink-0">{h.orden}</div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{h.nombre}</div>
                  <div className="text-[11px] text-yo-txt-3 mt-0.5">
                    {h.porcentaje}% · Vence {new Date(h.fechaLimite).toLocaleDateString("es-MX")} · Responsable: {h.responsable}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <MoneyDisplay amount={h.monto / 100} />
                <div className={cn("mt-1 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full",
                  h.autoRelease ? "bg-yo-ok-bg text-[color:var(--yo-ok)]" : "bg-yo-bg text-yo-txt-2 border border-yo-border")}>
                  {h.autoRelease ? "Auto-release" : "Aprobación manual"}
                </div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-yo-txt-2">
              <div><span className="text-yo-txt-3">Criterio:</span> {h.criterio}</div>
              <div><span className="text-yo-txt-3">Verificación:</span> {h.verificacion}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RequiredDocumentsPreviewCard({ data, isBuyer }: { data: InviteData; isBuyer: boolean }) {
  return (
    <Card icon={FileText} title="Documentos y evidencia requerida">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-yo-txt-3 mb-2">Documentos</div>
          <ul className="flex flex-col gap-1.5 text-sm">
            {data.documentos.map((d) => (
              <li key={d} className="flex items-center gap-2"><FileText className="size-3.5 text-yo-txt-3" />{d}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-yo-txt-3 mb-2">Evidencia</div>
          <ul className="flex flex-col gap-1.5 text-sm">
            {data.evidencia.map((e) => {
              const Icon = evidenciaIcon(e);
              return <li key={e} className="flex items-center gap-2"><Icon className="size-3.5 text-yo-txt-3" />{e}</li>;
            })}
          </ul>
        </div>
      </div>
      <InfoBox tone="info" className="mt-2">
        {isBuyer
          ? "Como comprador, esto es lo que deberás revisar para aprobar cada liberación."
          : "Como vendedor, esto es lo que deberás subir para obtener cada liberación."}
      </InfoBox>
    </Card>
  );
}

function FiscalTermsPreviewCard({ data }: { data: InviteData }) {
  return (
    <Card icon={FileSignature} title="Términos fiscales">
      <Row label="Tipo de CFDI esperado" value={data.fiscal.cfdi} />
      <Row label="REP posterior requerido" value={data.fiscal.rep ? "Sí" : "No"} />
      <div className="mt-2">
        <div className="text-[11px] uppercase tracking-wider text-yo-txt-3 mb-1">Cumplex validará</div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-y-1 text-sm">
          {data.fiscal.validaciones.map((v) => (
            <li key={v} className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-yo-ac" /> {v}</li>
          ))}
        </ul>
      </div>
      <InfoBox tone="warn" className="mt-2">
        Cumplex no emite CFDI ni REP por cuenta del vendedor. El proveedor deberá generarlos en su sistema contable/PAC y subir el XML timbrado para validación.
      </InfoBox>
    </Card>
  );
}

function ReleaseRulesPreviewCard({ data, isBuyer }: { data: InviteData; isBuyer: boolean }) {
  return (
    <Card icon={Scale} title="Reglas de liberación y devolución">
      <Row label="Modo de liberación" value={data.liberacion.modo} />
      <Row label="Ventana de revisión" value={data.liberacion.ventanaRevision} />
      <Row label="Corrección y reenvío" value={data.liberacion.correccion} />
      <Row label="Devolución por incumplimiento" value={data.liberacion.devolucion} />
      <InfoBox tone="info" className="mt-2">
        {isBuyer
          ? "Tendrás la ventana de revisión indicada para aprobar, rechazar o abrir disputa después de que el vendedor marque un hito como listo."
          : "Una vez que subas evidencia completa, el comprador tendrá la ventana indicada para aprobar, rechazar o abrir disputa."}
      </InfoBox>
    </Card>
  );
}

function DisputeRulesPreviewCard({ data }: { data: InviteData }) {
  return (
    <Card icon={Gavel} title="Reglas de disputa">
      <Row label="Cuándo puede abrirse" value={data.disputa.cuando} />
      <Row label="Plazo para responder" value={data.disputa.plazo} />
      <Row label="Evidencia admisible" value={data.disputa.evidencia} />
      <Row label="Posibles resultados" value={data.disputa.resultados} />
      <InfoBox tone="warn" className="mt-2">
        Cumplex actúa como tercero neutral para verificar condiciones, documentación y evidencia. No garantiza el resultado comercial de la operación ni sustituye asesoría legal.
      </InfoBox>
    </Card>
  );
}

function PreliminaryContractCard({ data, onOpen }: { data: InviteData; onOpen: () => void }) {
  return (
    <Card
      icon={FileSignature}
      title={`Contrato preliminar · v${data.agreement_version.version_number}.0`}
      action={
        <div className="flex items-center gap-2">
          <button onClick={onOpen} className="inline-flex items-center gap-1.5 text-xs text-yo-ac hover:underline">
            <Eye className="size-3.5" /> Ver contrato preliminar
          </button>
        </div>
      }
    >
      <Row label="Estado" value="Borrador enviado para aprobación" />
      <Row label="Hash preliminar" value={<span className="font-mono text-yo-txt-3">Disponible al bloquear versión</span>} />
      <p className="text-[11px] text-yo-txt-3 mt-1">
        El contrato NO está bloqueado mientras la invitación esté pendiente. Sólo se bloquea cuando ambas partes aceptan la misma versión del acuerdo.
      </p>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sidebar "Antes de aceptar"
// ─────────────────────────────────────────────────────────────────────────
function BeforeAcceptSidebar({
  data, checks, toggle, allChecked,
}: {
  data: InviteData;
  checks: Record<string, boolean>;
  toggle: (k: any) => void;
  allChecked: boolean;
}) {
  return (
    <div className="rounded-lg border border-yo-border bg-yo-surface p-4">
      <div className="flex items-center gap-2 text-sm font-semibold mb-3">
        <ShieldCheck className="size-4 text-yo-ac" /> Antes de aceptar
      </div>
      <div className="text-[11px] text-yo-txt-3 flex flex-wrap gap-x-2 gap-y-1 mb-3">
        <StateChip state={data.invitation.estado} />
        <ExpiryChip iso={data.invitation.expira_at} />
      </div>
      <ul className="flex flex-col gap-2 text-[12px]">
        <CheckItem label="Revisé las partes de la operación" on={checks.partes} onChange={() => toggle("partes")} />
        <CheckItem label="Revisé monto, comisión y condiciones de pago" on={checks.monto} onChange={() => toggle("monto")} />
        <CheckItem label="Revisé hitos y fechas límite" on={checks.hitos} onChange={() => toggle("hitos")} />
        <CheckItem label="Revisé documentos y evidencia requeridos" on={checks.docs} onChange={() => toggle("docs")} />
        <CheckItem label="Revisé reglas de liberación y devolución" on={checks.liberacion} onChange={() => toggle("liberacion")} />
        <CheckItem label="Revisé términos de disputa" on={checks.disputa} onChange={() => toggle("disputa")} />
      </ul>
      <div className={cn("mt-3 text-[11px] flex items-center gap-1.5", allChecked ? "text-[color:var(--yo-ok)]" : "text-yo-txt-3")}>
        {allChecked ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
        {allChecked ? "Puedes aceptar la operación" : "Marca los seis puntos para habilitar aceptar"}
      </div>
    </div>
  );
}

function CheckItem({ label, on, onChange }: { label: string; on: boolean; onChange: () => void }) {
  return (
    <label className="flex items-start gap-2 cursor-pointer">
      <input type="checkbox" checked={on} onChange={onChange} className="mt-0.5 size-4 accent-[color:var(--yo-ac)]" />
      <span className={cn(on ? "text-yo-txt" : "text-yo-txt-2")}>{label}</span>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Modales
// ─────────────────────────────────────────────────────────────────────────
function AcceptInvitationDialog({ copy, onClose, onConfirm }: { copy: { primaryCta: string }; onClose: () => void; onConfirm: () => void }) {
  const [checks, setChecks] = useState({ resumen: false, econ: false, hitos: false, docs: false, liberacion: false, custodia: false });
  const allOk = Object.values(checks).every(Boolean);
  const t = (k: keyof typeof checks) => setChecks((c) => ({ ...c, [k]: !c[k] }));
  return (
    <ModalShell title="Aceptar operación" onClose={onClose}>
      <p className="text-sm text-yo-txt-2 mb-3">Antes de continuar, confirma que revisaste esta versión.</p>
      <ul className="flex flex-col gap-2">
        <CheckItem label="Leí el resumen de la operación" on={checks.resumen} onChange={() => t("resumen")} />
        <CheckItem label="Revisé monto, comisión y condiciones económicas" on={checks.econ} onChange={() => t("econ")} />
        <CheckItem label="Revisé hitos, fechas límite y entregables" on={checks.hitos} onChange={() => t("hitos")} />
        <CheckItem label="Revisé documentos y evidencia requerida" on={checks.docs} onChange={() => t("docs")} />
        <CheckItem label="Entiendo las reglas de liberación / devolución" on={checks.liberacion} onChange={() => t("liberacion")} />
        <CheckItem label="Entiendo que Cumplex no custodia fondos" on={checks.custodia} onChange={() => t("custodia")} />
      </ul>
      <p className="text-[11px] text-yo-txt-3 mt-3">
        Al aceptar, confirmas que revisaste la versión vigente del acuerdo. La firma contractual se solicitará en el siguiente paso, una vez que la versión quede bloqueada.
      </p>
      <div className="flex items-center justify-end gap-2 mt-4">
        <button onClick={onClose} className="h-10 px-3 rounded-md border border-yo-border text-sm text-yo-txt-2">Cancelar</button>
        <button
          disabled={!allOk}
          onClick={onConfirm}
          className={cn("h-10 px-4 rounded-md text-sm font-semibold inline-flex items-center gap-2",
            allOk ? "bg-yo-ac text-white hover:opacity-90" : "bg-yo-bg text-yo-txt-3 border border-yo-border cursor-not-allowed")}
        >
          <CheckCircle2 className="size-4" /> {copy.primaryCta}
        </button>
      </div>
    </ModalShell>
  );
}

function RequestChangesDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  const SECTIONS = ["MONTO", "HITOS", "FECHAS", "DOCUMENTOS", "FISCAL", "LIBERACION", "DISPUTA", "OTRO"] as const;
  const [section, setSection] = useState<typeof SECTIONS[number]>("MONTO");
  const [motivo, setMotivo] = useState("");
  const [propuesta, setPropuesta] = useState("");
  const canSend = motivo.trim().length >= 30;
  return (
    <ModalShell title="Solicitar cambios" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-yo-txt-2 mb-1">Sección a modificar</div>
          <div className="flex flex-wrap gap-1.5">
            {SECTIONS.map((s) => (
              <button key={s} onClick={() => setSection(s)}
                className={cn("h-8 px-2.5 rounded-md border text-[11px] font-medium",
                  section === s ? "border-yo-ac text-yo-ac bg-yo-ac/5" : "border-yo-border text-yo-txt-2 hover:text-yo-txt")}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-yo-txt-2">Explica el cambio solicitado (mín. 30)</span>
          <textarea rows={4} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full border border-yo-border rounded-md p-2 text-sm bg-transparent" />
          <span className="text-[10px] text-yo-txt-3 text-right">{motivo.length}/500</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-yo-txt-2">Propuesta concreta (opcional)</span>
          <textarea rows={3} value={propuesta} onChange={(e) => setPropuesta(e.target.value)} className="w-full border border-yo-border rounded-md p-2 text-sm bg-transparent" />
        </label>
      </div>
      <div className="flex items-center justify-end gap-2 mt-4">
        <button onClick={onClose} className="h-10 px-3 rounded-md border border-yo-border text-sm text-yo-txt-2">Cancelar</button>
        <button disabled={!canSend} onClick={onConfirm}
          className={cn("h-10 px-4 rounded-md text-sm font-semibold text-white", canSend ? "bg-yo-ac hover:opacity-90" : "bg-yo-bg text-yo-txt-3 border border-yo-border cursor-not-allowed")}>
          Enviar solicitud de cambios
        </button>
      </div>
    </ModalShell>
  );
}

function RejectInvitationDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [comentario, setComentario] = useState("");
  return (
    <ModalShell title="Rechazar operación" onClose={onClose}>
      <p className="text-sm text-yo-txt-2 mb-3">Rechazar no borra la operación: queda cerrada con historial disponible para auditoría.</p>
      <label className="flex flex-col gap-1 mb-3">
        <span className="text-[11px] uppercase tracking-wider text-yo-txt-2">Motivo de rechazo *</span>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className="h-10 w-full px-3 rounded-md border border-yo-border text-sm bg-transparent" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wider text-yo-txt-2">Comentario (opcional)</span>
        <textarea rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} className="w-full border border-yo-border rounded-md p-2 text-sm bg-transparent" />
      </label>
      <div className="flex items-center justify-end gap-2 mt-4">
        <button onClick={onClose} className="h-10 px-3 rounded-md border border-yo-border text-sm text-yo-txt-2">Cancelar</button>
        <button disabled={!motivo.trim()} onClick={onConfirm}
          className={cn("h-10 px-4 rounded-md text-sm font-semibold text-white",
            motivo.trim() ? "bg-[#B91C1C] hover:bg-[#991B1B]" : "bg-yo-bg text-yo-txt-3 border border-yo-border cursor-not-allowed")}>
          Rechazar definitivamente
        </button>
      </div>
    </ModalShell>
  );
}

function PreliminaryContractDialog({ data, onClose }: { data: InviteData; onClose: () => void }) {
  const t = data.transaction;
  return (
    <ModalShell title={`Contrato preliminar · v${data.agreement_version.version_number}.0`} size="lg" onClose={onClose}>
      <div className="text-[11px] text-yo-txt-3 mb-2 flex items-center gap-2">
        <FileText className="size-3.5" /> Versión de solo lectura. Se bloqueará al aceptar por ambas partes.
      </div>
      <div className="border border-yo-border rounded-md p-4 max-h-[50vh] overflow-y-auto text-sm text-yo-txt-2 leading-relaxed whitespace-pre-line bg-yo-bg">
{`CONTRATO DE PAGO PROTEGIDO CUMPLEX

Operación: ${t.numero}
Monto: ${new Intl.NumberFormat("es-MX", { style: "currency", currency: t.moneda }).format(t.monto_total / 100)}
Sector: ${t.sector}

1. Objeto. ${t.descripcion}

2. Hitos y evidencias.
${data.milestones.map((h) => `   ${h.orden}. ${h.nombre} — ${h.porcentaje}% (${new Intl.NumberFormat("es-MX", { style: "currency", currency: t.moneda }).format(h.monto / 100)}) — Vence ${new Date(h.fechaLimite).toLocaleDateString("es-MX")} — Evidencia: ${h.verificacion}`).join("\n")}

3. Reglas de liberación. ${data.liberacion.modo}. Ventana de revisión: ${data.liberacion.ventanaRevision}.

4. Términos fiscales. CFDI ${data.fiscal.cfdi}. REP posterior: ${data.fiscal.rep ? "sí" : "no"}.

5. Disputas. ${data.disputa.cuando}. Plazo: ${data.disputa.plazo}. Resultados posibles: ${data.disputa.resultados}.

6. Cumplex no custodia fondos ni actúa como intermediario financiero. Los fondos se retienen en pasarela certificada.`}
      </div>
      <div className="flex items-center justify-between mt-3">
        <button className="inline-flex items-center gap-1.5 text-xs text-yo-ac hover:underline"><Download className="size-3.5" /> Descargar borrador PDF</button>
        <button onClick={onClose} className="h-10 px-3 rounded-md border border-yo-border text-sm">Cerrar</button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children, size = "md" }: { title: string; onClose: () => void; children: React.ReactNode; size?: "md" | "lg" }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className={cn("bg-yo-surface border border-yo-border rounded-lg w-full p-5", size === "lg" ? "max-w-2xl" : "max-w-md")}>
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="text-yo-txt-3 hover:text-yo-txt"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Estados vacíos / especiales
// ─────────────────────────────────────────────────────────────────────────
function StateShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-yo-bg text-yo-txt">
      <header className="border-b border-yo-border bg-yo-surface">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <CumplexLogo className="h-7" />
          <Link to="/dashboard" className="text-xs text-yo-txt-3 hover:text-yo-txt inline-flex items-center gap-1">
            <ArrowLeft className="size-3.5" /> Volver a inicio
          </Link>
        </div>
      </header>
      <div className="max-w-lg mx-auto p-6 mt-10">{children}</div>
    </div>
  );
}

function ExpiredState() {
  return (
    <div className="rounded-lg border border-yo-border bg-yo-surface p-6 text-center flex flex-col gap-3">
      <div className="size-12 rounded-full bg-yo-err-bg text-[color:var(--yo-err)] grid place-items-center mx-auto"><Clock className="size-6" /></div>
      <h1 className="text-xl font-bold">Esta invitación expiró</h1>
      <p className="text-sm text-yo-txt-2">Solicita a la contraparte que genere una nueva invitación o que reenvíe la operación.</p>
      <div className="flex items-center justify-center gap-2 mt-2">
        <Link to="/dashboard" className="h-10 px-4 rounded-md border border-yo-border text-sm inline-flex items-center">Volver al dashboard</Link>
        <a href="mailto:soporte@cumplex.mx" className="h-10 px-4 rounded-md bg-yo-ac text-white text-sm font-semibold inline-flex items-center">Contactar soporte</a>
      </div>
    </div>
  );
}

function ResolvedState({ kind }: { kind: "aceptada" | "rechazada" }) {
  const navigate = useNavigate();
  const isOk = kind === "aceptada";
  return (
    <div className="rounded-lg border border-yo-border bg-yo-surface p-6 text-center flex flex-col gap-3">
      <div className={cn("size-12 rounded-full grid place-items-center mx-auto",
        isOk ? "bg-yo-ok-bg text-[color:var(--yo-ok)]" : "bg-yo-err-bg text-[color:var(--yo-err)]")}>
        {isOk ? <Lock className="size-6" /> : <Ban className="size-6" />}
      </div>
      <h1 className="text-xl font-bold">{isOk ? "Esta operación ya fue aceptada" : "Esta operación fue rechazada"}</h1>
      <p className="text-sm text-yo-txt-2">
        {isOk
          ? "Continúa con la firma o revisa el expediente de operación."
          : "La invitación quedó cerrada. El historial permanece disponible para auditoría."}
      </p>
      {isOk && (
        <div className="flex items-center justify-center gap-2 mt-2">
          <button onClick={() => navigate({ to: "/dashboard" })} className="h-10 px-4 rounded-md border border-yo-border text-sm">Ver operación</button>
          <button onClick={() => navigate({ to: "/dashboard" })} className="h-10 px-4 rounded-md bg-yo-ac text-white text-sm font-semibold inline-flex items-center gap-2">
            Ir a firma <ArrowRight className="size-4" />
          </button>
        </div>
      )}
      {!isOk && (
        <Link to="/dashboard" className="mt-2 h-10 inline-flex items-center justify-center px-4 rounded-md border border-yo-border text-sm">Volver al dashboard</Link>
      )}
    </div>
  );
}

function ChangesSentState() {
  return (
    <div className="rounded-lg border border-yo-border bg-yo-surface p-6 text-center flex flex-col gap-3">
      <div className="size-12 rounded-full bg-yo-warn-bg text-[color:var(--yo-warn)] grid place-items-center mx-auto"><MessageSquareWarning className="size-6" /></div>
      <h1 className="text-xl font-bold">Cambios solicitados</h1>
      <p className="text-sm text-yo-txt-2">Tu solicitud fue enviada al creador. Te avisaremos cuando exista una nueva versión para revisar.</p>
      <Link to="/dashboard" className="mt-2 h-10 inline-flex items-center justify-center px-4 rounded-md bg-yo-ac text-white text-sm font-semibold">Volver al dashboard</Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Chips
// ─────────────────────────────────────────────────────────────────────────
function StateChip({ state }: { state: InviteState }) {
  const map: Record<InviteState, { bg: string; txt: string; label: string }> = {
    ENVIADA:             { bg: "#FEF3C7", txt: "#92400E", label: "Pendiente de aprobación" },
    VISTA:               { bg: "#DBEAFE", txt: "#1E40AF", label: "Vista" },
    CAMBIOS_SOLICITADOS: { bg: "#FEE2E2", txt: "#B91C1C", label: "Cambios solicitados" },
    ACEPTADA:            { bg: "#DCFCE7", txt: "#166534", label: "Aceptada" },
    RECHAZADA:           { bg: "#F4F4F5", txt: "#3F3F46", label: "Rechazada" },
    EXPIRADA:            { bg: "#F4F4F5", txt: "#3F3F46", label: "Expirada" },
  };
  const s = map[state];
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: s.bg, color: s.txt }}>{s.label}</span>;
}

function ExpiryChip({ iso }: { iso: string }) {
  const ms = new Date(iso).getTime() - Date.now();
  const hours = Math.max(0, Math.floor(ms / 3600000));
  const tone = hours < 12 ? "err" : hours < 48 ? "warn" : "ok";
  const cls = tone === "err" ? "bg-yo-err-bg text-[color:var(--yo-err)]" : tone === "warn" ? "bg-yo-warn-bg text-[color:var(--yo-warn)]" : "bg-yo-bg text-yo-txt-2 border border-yo-border";
  return <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", cls)}><Clock className="size-3" /> Vence en {hours}h</span>;
}

// Vista del creador esperando (exportada para uso interno)
export function CreatorWaitingPanel({ invited, expiresAt }: { invited: string; expiresAt: string }) {
  return (
    <div className="rounded-lg border border-yo-border bg-yo-surface p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <StateChip state="ENVIADA" />
        <ExpiryChip iso={expiresAt} />
      </div>
      <div>
        <div className="text-sm font-semibold">Esperando aprobación de contraparte</div>
        <div className="text-xs text-yo-txt-2 mt-0.5">
          La operación fue enviada a <span className="font-medium text-yo-txt">{invited}</span>. Aún no ha sido aceptada.
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <button className="h-9 px-3 rounded-md border border-yo-border text-xs inline-flex items-center gap-1.5"><RefreshCw className="size-3.5" /> Reenviar invitación</button>
        <button className="h-9 px-3 rounded-md border border-yo-border text-xs inline-flex items-center gap-1.5"><Copy className="size-3.5" /> Copiar enlace seguro</button>
        <button className="h-9 px-3 rounded-md border border-yo-border text-xs inline-flex items-center gap-1.5 hover:text-[#B91C1C] hover:border-[#B91C1C]"><Ban className="size-3.5" /> Cancelar invitación</button>
      </div>
      <p className="text-[11px] text-yo-txt-3">No puedes firmar por la contraparte, marcar como aceptada manualmente ni fondear hasta que se acepte y firme.</p>
    </div>
  );
}
