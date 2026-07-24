import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ShieldCheck, Clock, FileText, Users, Landmark, Scale, Gavel, FileSignature,
  CheckCircle2, XCircle, MessageSquareWarning, ArrowRight, Lock, Hash, Building2,
  User, Calendar, AlertTriangle, Download, Eye, ClipboardCheck, X,
} from "lucide-react";
import { CumplexLogo } from "@/components/logo";
import { InfoBox } from "@/components/tx/ui/info-box";
import { MoneyDisplay } from "@/components/tx/ui/money-display";
import { SectorBadge } from "@/components/tx/ui/sector-badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  component: InviteApprovalPage,
});

// ─────────────────────────────────────────────────────────────────────────
// Mock: en producción se resuelve por token contra transaction_invitations
// ─────────────────────────────────────────────────────────────────────────
type InviteeRole = "comprador" | "vendedor";
type InviteStatus = "ENVIADA" | "VISTA" | "CAMBIOS_SOLICITADOS" | "ACEPTADA" | "RECHAZADA";

interface InviteData {
  token: string;
  inviteStatus: InviteStatus;
  inviteeRole: InviteeRole;             // rol que asume quien abre el link
  creatorRole: InviteeRole;             // rol del creador
  creatorName: string;
  creatorOrg: string;
  operationId: string;                  // OPYYMMDDNNNN
  agreementVersion: string;             // v1, v2…
  agreementHash: string | null;
  expiresAt: string;                    // ISO
  sector: string;
  amount: number;
  currency: string;
  commissionBps: number;
  description: string;
  hitos: Array<{ id: string; titulo: string; monto: number; evidencia: string; plazoDias: number }>;
  documentos: Array<{ nombre: string; tipo: string; obligatorio: boolean }>;
  fiscal: { cfdiRequerido: boolean; usoCfdi: string; formaPago: string; metodoPago: string };
  liberacion: { modo: string; verificador: string; reglaAprobacion: string; ventanaObjeciones: string };
  disputa: { arbitro: string; plazoRespuesta: string; costos: string };
  contraparte: { nombre: string; email: string; rfc: string | null; verificado: boolean };
}

function useInviteMock(token: string): InviteData {
  return useMemo(() => ({
    token,
    inviteStatus: "ENVIADA",
    inviteeRole: "vendedor",
    creatorRole: "comprador",
    creatorName: "María González",
    creatorOrg: "Constructora Norte S.A. de C.V.",
    operationId: "OP" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "0142",
    agreementVersion: "v1",
    agreementHash: null,
    expiresAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
    sector: "Construcción",
    amount: 24500000, // en centavos
    currency: "MXN",
    commissionBps: 150,
    description:
      "Suministro e instalación de estructura metálica para nave industrial, incluye planos ejecutivos, materiales y mano de obra.",
    hitos: [
      { id: "H1", titulo: "Planos ejecutivos aprobados", monto: 4900000, evidencia: "PDF firmado por DRO", plazoDias: 10 },
      { id: "H2", titulo: "Materiales en obra", monto: 9800000, evidencia: "Remisiones + fotos", plazoDias: 25 },
      { id: "H3", titulo: "Entrega final y pruebas", monto: 9800000, evidencia: "Acta de entrega", plazoDias: 45 },
    ],
    documentos: [
      { nombre: "Cotización firmada", tipo: "PDF", obligatorio: true },
      { nombre: "Alcance técnico", tipo: "PDF", obligatorio: true },
      { nombre: "Programa de obra", tipo: "PDF", obligatorio: false },
    ],
    fiscal: {
      cfdiRequerido: true,
      usoCfdi: "G03 – Gastos en general",
      formaPago: "03 – Transferencia",
      metodoPago: "PPD – Pago en parcialidades",
    },
    liberacion: {
      modo: "Por hito con verificación documental",
      verificador: "Comprador + IA Cumplex",
      reglaAprobacion: "Doble confirmación (comprador y verificador)",
      ventanaObjeciones: "72 horas hábiles",
    },
    disputa: {
      arbitro: "Panel Cumplex + perito sectorial",
      plazoRespuesta: "5 días hábiles",
      costos: "Loser-pays (parte perdedora asume gastos)",
    },
    contraparte: {
      nombre: "María González",
      email: "maria@constructoranorte.mx",
      rfc: "CNO*******123",
      verificado: true,
    },
  }), [token]);
}

// ─────────────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────────────
function InviteApprovalPage() {
  const { token } = Route.useParams();
  const data = useInviteMock(token);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const isBuyer = data.inviteeRole === "comprador";
  const copy = isBuyer
    ? {
        title: "Revisa esta operación antes de fondear",
        subtitle: `${data.creatorName} te envió una propuesta de operación protegida. Revisa el monto, los hitos, las reglas de aprobación y las condiciones de devolución antes de aceptar.`,
        cta: "Aceptar operación y continuar a firma",
        roleLabel: "Pagador / Comprador",
        counterpartyLabel: "Beneficiario / Vendedor",
      }
    : {
        title: "Revisa esta operación antes de aceptar entregar",
        subtitle: `${data.creatorName} te invitó a una operación protegida. Revisa los hitos, documentos, fechas y condiciones de liberación antes de aceptar.`,
        cta: "Aceptar operación y continuar a firma",
        roleLabel: "Beneficiario / Vendedor",
        counterpartyLabel: "Pagador / Comprador",
      };

  if (accepted) return <PostAcceptScreen data={data} isBuyer={isBuyer} />;

  return (
    <div className="min-h-dvh bg-yo-bg text-yo-txt">
      {/* Top bar público */}
      <header className="border-b border-yo-border bg-yo-surface">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <CumplexLogo className="h-7" />
          <div className="flex items-center gap-3">
            <div className="text-[11px] text-yo-txt-3 font-mono">Invitación · {token.slice(0, 8)}</div>
            <button
              type="button"
              onClick={() => window.close()}
              aria-label="Cerrar pantalla"
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-yo-border bg-yo-bg hover:bg-yo-surface-2 text-yo-txt-2 hover:text-yo-txt text-xs transition-colors"
            >
              <X className="size-3.5" />
              Cerrar
            </button>
          </div>
        </div>
      </header>

      {/* Header de operación */}
      <section className="border-b border-yo-border bg-yo-surface">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-[11px]">
            <StatusChip status={data.inviteStatus} />
            <ExpiryChip iso={data.expiresAt} />
            <span className="font-mono text-yo-txt-2">{data.operationId}</span>
            <span className="text-yo-txt-3">·</span>
            <SectorBadge sector={data.sector} />
            <span className="text-yo-txt-3">·</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yo-ac/10 text-yo-ac font-medium">
              <ShieldCheck className="size-3" /> Entras como {copy.roleLabel}
            </span>
          </div>
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-yo-txt">{copy.title}</h1>
              <p className="text-sm text-yo-txt-2 mt-1 max-w-3xl">{copy.subtitle}</p>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-yo-txt-3 uppercase tracking-wider">Monto de la operación</div>
              <MoneyDisplay amount={data.amount / 100} currency={data.currency} size="xl" />
              <div className="text-[11px] text-yo-txt-3 mt-1">Comisión Cumplex {(data.commissionBps / 100).toFixed(2)}%</div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Contenido principal */}
        <div className="flex flex-col gap-4 min-w-0">
          <Card icon={FileText} title="Resumen de la operación">
            <p className="text-sm text-yo-txt-2 leading-relaxed">{data.description}</p>
          </Card>

          <Card icon={Users} title="Partes">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <PartyBlock
                title={`${copy.counterpartyLabel} (creador)`}
                name={data.creatorName}
                org={data.creatorOrg}
                verified
              />
              <PartyBlock
                title={`${copy.roleLabel} (tú)`}
                name="Tú, invitado por email"
                org="Se validará en la firma"
                verified={false}
              />
            </div>
          </Card>

          <Card icon={Landmark} title="Monto y comisión">
            <Row label="Monto principal" value={<MoneyDisplay amount={data.amount / 100} currency={data.currency} />} />
            <Row
              label={`Comisión Cumplex (${(data.commissionBps / 100).toFixed(2)}%)`}
              value={<MoneyDisplay amount={((data.amount * data.commissionBps) / 10000) / 100} currency={data.currency} />}
            />
            <Row
              label={isBuyer ? "Total a fondear" : "Neto estimado a recibir"}
              value={
                <MoneyDisplay
                  amount={
                    isBuyer
                      ? (data.amount + (data.amount * data.commissionBps) / 10000) / 100
                      : (data.amount - (data.amount * data.commissionBps) / 10000) / 100
                  }
                  currency={data.currency}
                  size="lg"
                />
              }
              strong
            />
          </Card>

          <Card icon={ClipboardCheck} title={`Hitos (${data.hitos.length})`}>
            <div className="flex flex-col gap-2">
              {data.hitos.map((h, i) => (
                <div key={h.id} className="border border-yo-border rounded-md p-3 flex items-start gap-3">
                  <div className="size-7 rounded-full bg-yo-ac/10 text-yo-ac grid place-items-center text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-yo-txt">{h.titulo}</div>
                    <div className="text-[11px] text-yo-txt-3 mt-0.5">
                      Evidencia: {h.evidencia} · Plazo {h.plazoDias} días
                    </div>
                  </div>
                  <MoneyDisplay amount={h.monto / 100} currency={data.currency} />
                </div>
              ))}
            </div>
          </Card>

          <Card icon={FileText} title="Documentos requeridos">
            <ul className="flex flex-col gap-1.5">
              {data.documentos.map((d) => (
                <li key={d.nombre} className="flex items-center justify-between text-sm">
                  <span className="text-yo-txt">{d.nombre} <span className="text-yo-txt-3 text-xs">({d.tipo})</span></span>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", d.obligatorio ? "bg-yo-warn-bg text-[color:var(--yo-warn)]" : "bg-yo-bg text-yo-txt-3")}>
                    {d.obligatorio ? "Obligatorio" : "Opcional"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card icon={FileSignature} title="Fiscal (CFDI)">
            <Row label="CFDI requerido" value={data.fiscal.cfdiRequerido ? "Sí" : "No"} />
            <Row label="Uso de CFDI" value={data.fiscal.usoCfdi} />
            <Row label="Forma de pago" value={data.fiscal.formaPago} />
            <Row label="Método de pago" value={data.fiscal.metodoPago} />
          </Card>

          <Card icon={Scale} title="Reglas de liberación">
            <Row label="Modo" value={data.liberacion.modo} />
            <Row label="Verificador" value={data.liberacion.verificador} />
            <Row label="Regla de aprobación" value={data.liberacion.reglaAprobacion} />
            <Row label="Ventana de objeciones" value={data.liberacion.ventanaObjeciones} />
          </Card>

          <Card icon={Gavel} title="Disputas">
            <Row label="Árbitro" value={data.disputa.arbitro} />
            <Row label="Plazo de respuesta" value={data.disputa.plazoRespuesta} />
            <Row label="Costos" value={data.disputa.costos} />
          </Card>

          <Card
            icon={FileSignature}
            title={`Contrato preliminar ${data.agreementVersion}`}
            action={
              <button
                onClick={() => setShowContract(true)}
                className="inline-flex items-center gap-1.5 text-xs text-yo-ac hover:underline"
              >
                <Eye className="size-3.5" /> Ver contrato preliminar
              </button>
            }
          >
            <div className="text-xs text-yo-txt-2 flex items-center gap-2">
              <Hash className="size-3.5" />
              Al aceptar, se bloquea la versión y se genera el hash SHA-256 del contrato.
            </div>
          </Card>

          {/* Acciones */}
          <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-yo-surface border-t border-yo-border flex flex-wrap gap-2 justify-end mt-2">
            <button
              onClick={() => setShowRejectModal(true)}
              className="h-10 px-4 rounded-md border border-yo-border bg-white dark:bg-transparent text-sm text-yo-txt-2 hover:text-[#B91C1C] hover:border-[#B91C1C] inline-flex items-center gap-2"
            >
              <XCircle className="size-4" /> Rechazar
            </button>
            <button
              onClick={() => setShowChangesModal(true)}
              className="h-10 px-4 rounded-md border border-yo-border bg-white dark:bg-transparent text-sm text-yo-txt inline-flex items-center gap-2 hover:border-yo-ac"
            >
              <MessageSquareWarning className="size-4" /> Solicitar cambios
            </button>
            <button
              onClick={() => setShowAcceptModal(true)}
              className="h-10 px-4 rounded-md bg-yo-ac text-white text-sm font-semibold inline-flex items-center gap-2 hover:opacity-90"
            >
              <CheckCircle2 className="size-4" /> {copy.cta}
            </button>
          </div>
        </div>

        {/* Sidebar sticky */}
        <aside className="lg:sticky lg:top-6 self-start flex flex-col gap-3">
          <div className="rounded-lg border border-yo-border bg-yo-surface p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-yo-txt mb-3">
              <ShieldCheck className="size-4 text-yo-ac" /> Antes de aceptar
            </div>
            <ul className="flex flex-col gap-2.5 text-[12px] text-yo-txt-2">
              <BulletCheck>Cumplex NO custodia fondos. El dinero se retiene en pasarela certificada (Stripe / SPEI).</BulletCheck>
              <BulletCheck>Sólo se libera cuando se cumplen las condiciones y evidencias pactadas.</BulletCheck>
              <BulletCheck>{isBuyer ? "Como pagador, fondearás al firmar." : "Como beneficiario, cobrarás por hito verificado."}</BulletCheck>
              <BulletCheck>Aceptar bloquea la versión del contrato y genera un hash inmutable.</BulletCheck>
              <BulletCheck>En caso de disputa aplica loser-pays: la parte perdedora asume gastos.</BulletCheck>
            </ul>
          </div>
          <InfoBox tone="warn" title="Verifica antes de aceptar">
            Revisa hitos, montos, plazos y documentos. Después de aceptar sólo puedes salir por acuerdo mutuo o disputa formal.
          </InfoBox>
          <div className="rounded-lg border border-yo-border bg-yo-surface p-4 text-[11px] text-yo-txt-3 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5"><Calendar className="size-3.5" /> Vence: <span className="font-mono text-yo-txt-2">{new Date(data.expiresAt).toLocaleString("es-MX")}</span></div>
            <div className="flex items-center gap-1.5"><Hash className="size-3.5" /> Operación: <span className="font-mono text-yo-txt-2">{data.operationId}</span></div>
            <div className="flex items-center gap-1.5"><User className="size-3.5" /> Invitado por: <span className="text-yo-txt-2">{data.creatorName}</span></div>
          </div>
        </aside>
      </div>

      {showAcceptModal && (
        <AcceptModal
          copy={copy}
          onClose={() => setShowAcceptModal(false)}
          onConfirm={() => { setShowAcceptModal(false); setAccepted(true); toast.success("Operación aceptada. Continuando a firma…"); }}
        />
      )}
      {showRejectModal && (
        <SimpleModal
          title="Rechazar operación"
          confirmLabel="Rechazar definitivamente"
          confirmTone="danger"
          onClose={() => setShowRejectModal(false)}
          onConfirm={() => { setShowRejectModal(false); toast("Operación rechazada. Se notificó al creador."); }}
        >
          <p className="text-sm text-yo-txt-2">Al rechazar, la operación queda cancelada y no podrás reactivarla desde este enlace.</p>
          <textarea placeholder="Motivo (visible para el creador)" rows={4} className="w-full mt-3 border border-yo-border rounded-md p-2 text-sm bg-white dark:bg-transparent" />
        </SimpleModal>
      )}
      {showChangesModal && (
        <SimpleModal
          title="Solicitar cambios"
          confirmLabel="Enviar solicitud"
          onClose={() => setShowChangesModal(false)}
          onConfirm={() => { setShowChangesModal(false); toast.success("Solicitud enviada al creador."); }}
        >
          <p className="text-sm text-yo-txt-2">Indica qué debería ajustarse antes de aceptar. El creador recibirá tus notas y podrá generar una nueva versión.</p>
          <textarea placeholder="Describe los cambios (monto, hitos, plazos, evidencias, fiscal…)" rows={5} className="w-full mt-3 border border-yo-border rounded-md p-2 text-sm bg-white dark:bg-transparent" />
        </SimpleModal>
      )}
      {showContract && (
        <SimpleModal
          title={`Contrato preliminar ${data.agreementVersion}`}
          confirmLabel="Cerrar"
          onClose={() => setShowContract(false)}
          onConfirm={() => setShowContract(false)}
          size="lg"
        >
          <div className="text-xs text-yo-txt-3 mb-2 flex items-center gap-2">
            <FileText className="size-3.5" /> Versión de solo lectura. Se bloqueará al aceptar.
          </div>
          <div className="border border-yo-border rounded-md p-4 max-h-[50vh] overflow-y-auto text-sm text-yo-txt-2 leading-relaxed whitespace-pre-line bg-yo-bg">
{`CONTRATO DE PAGO PROTEGIDO CUMPLEX

Operación: ${data.operationId}
Monto: ${new Intl.NumberFormat("es-MX", { style: "currency", currency: data.currency }).format(data.amount / 100)}
Sector: ${data.sector}

1. Objeto. ${data.description}

2. Hitos y evidencias.
${data.hitos.map((h, i) => `   ${i + 1}. ${h.titulo} — ${new Intl.NumberFormat("es-MX", { style: "currency", currency: data.currency }).format(h.monto / 100)} — Evidencia: ${h.evidencia}`).join("\n")}

3. Reglas de liberación. ${data.liberacion.modo}. Verificador: ${data.liberacion.verificador}.

4. Disputas. Árbitro: ${data.disputa.arbitro}. Costos: ${data.disputa.costos}.

5. Cumplex no custodia fondos ni actúa como intermediario financiero.`}
          </div>
          <button className="mt-3 inline-flex items-center gap-1.5 text-xs text-yo-ac hover:underline"><Download className="size-3.5" /> Descargar PDF</button>
        </SimpleModal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Post-aceptación / vista de creador esperando
// ─────────────────────────────────────────────────────────────────────────
function PostAcceptScreen({ data, isBuyer }: { data: InviteData; isBuyer: boolean }) {
  const hash = "sha256:" + Array.from({ length: 8 }, () => Math.random().toString(16).slice(2, 6)).join("");
  return (
    <div className="min-h-dvh bg-yo-bg grid place-items-center p-4">
      <div className="max-w-lg w-full rounded-lg border border-yo-border bg-yo-surface p-6 text-center flex flex-col gap-3">
        <div className="size-12 rounded-full bg-yo-ok-bg text-[color:var(--yo-ok)] grid place-items-center mx-auto">
          <Lock className="size-6" />
        </div>
        <h1 className="text-xl font-bold text-yo-txt">Versión bloqueada</h1>
        <p className="text-sm text-yo-txt-2">
          Aceptaste la operación <span className="font-mono">{data.operationId}</span>. Se generó el hash del contrato y ahora
          pasa a firma electrónica.
        </p>
        <div className="rounded-md border border-yo-border bg-yo-bg p-2 font-mono text-[11px] text-yo-txt-2 break-all">{hash}</div>
        <div className="text-[12px] text-yo-txt-3">
          Siguiente paso: firma con e.firma / OTP. {isBuyer ? "Después deberás fondear la operación." : "Después esperarás el fondeo del comprador."}
        </div>
        <Link to="/dashboard" className="mt-2 inline-flex items-center justify-center gap-2 h-10 rounded-md bg-yo-ac text-white text-sm font-semibold">
          Continuar a firma <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Piezas UI
// ─────────────────────────────────────────────────────────────────────────
function Card({ icon: Icon, title, children, action }: { icon: any; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-yo-border bg-yo-surface">
      <header className="px-4 h-11 flex items-center justify-between border-b border-yo-border">
        <div className="flex items-center gap-2 text-sm font-semibold text-yo-txt">
          <Icon className="size-4 text-yo-ac" /> {title}
        </div>
        {action}
      </header>
      <div className="p-4 flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-1.5 border-b border-yo-border last:border-0", strong && "pt-2 mt-1 border-t border-yo-border font-semibold")}>
      <span className="text-xs text-yo-txt-2">{label}</span>
      <span className={cn("text-sm text-yo-txt text-right", strong && "text-base")}>{value}</span>
    </div>
  );
}

function PartyBlock({ title, name, org, verified }: { title: string; name: string; org: string; verified: boolean }) {
  return (
    <div className="border border-yo-border rounded-md p-3">
      <div className="text-[10px] uppercase tracking-wider text-yo-txt-3">{title}</div>
      <div className="text-sm font-semibold text-yo-txt mt-1 flex items-center gap-2">
        {org.includes("S.A.") || org.includes("S. de R.L.") ? <Building2 className="size-4" /> : <User className="size-4" />}
        {name}
      </div>
      <div className="text-xs text-yo-txt-2">{org}</div>
      <div className={cn("mt-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full", verified ? "bg-yo-ok-bg text-[color:var(--yo-ok)]" : "bg-yo-warn-bg text-[color:var(--yo-warn)]")}>
        {verified ? <><CheckCircle2 className="size-3" /> Verificado</> : <><AlertTriangle className="size-3" /> Pendiente</>}
      </div>
    </div>
  );
}

function BulletCheck({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="size-3.5 text-yo-ac mt-0.5 shrink-0" />
      <span>{children}</span>
    </li>
  );
}

function StatusChip({ status }: { status: InviteStatus }) {
  const map: Record<InviteStatus, { bg: string; txt: string; label: string }> = {
    ENVIADA:            { bg: "#FEF3C7", txt: "#92400E", label: "Pendiente de aprobación" },
    VISTA:              { bg: "#DBEAFE", txt: "#1E40AF", label: "Vista" },
    CAMBIOS_SOLICITADOS:{ bg: "#FEE2E2", txt: "#B91C1C", label: "Cambios solicitados" },
    ACEPTADA:           { bg: "#DCFCE7", txt: "#166534", label: "Aceptada" },
    RECHAZADA:          { bg: "#F4F4F5", txt: "#3F3F46", label: "Rechazada" },
  };
  const s = map[status];
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: s.bg, color: s.txt }}>{s.label}</span>;
}

function ExpiryChip({ iso }: { iso: string }) {
  const ms = new Date(iso).getTime() - Date.now();
  const hours = Math.max(0, Math.floor(ms / 3600000));
  const tone = hours < 12 ? "err" : hours < 48 ? "warn" : "ok";
  const cls = tone === "err" ? "bg-yo-err-bg text-[color:var(--yo-err)]" : tone === "warn" ? "bg-yo-warn-bg text-[color:var(--yo-warn)]" : "bg-yo-bg text-yo-txt-2";
  return <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", cls)}><Clock className="size-3" /> Vence en {hours} h</span>;
}

// ─────────────────────────────────────────────────────────────────────────
// Modales
// ─────────────────────────────────────────────────────────────────────────
function AcceptModal({
  copy, onClose, onConfirm,
}: { copy: { cta: string; roleLabel: string }; onClose: () => void; onConfirm: () => void }) {
  const [checks, setChecks] = useState({ terminos: false, hitos: false, fiscal: false, disputa: false, hash: false });
  const allOk = Object.values(checks).every(Boolean);
  const toggle = (k: keyof typeof checks) => setChecks((c) => ({ ...c, [k]: !c[k] }));

  return (
    <ModalShell onClose={onClose} title="Confirmar aceptación" size="md">
      <p className="text-sm text-yo-txt-2 mb-3">Confirma que revisaste y aceptas cada punto. Al continuar se bloquea la versión y se genera el hash del contrato.</p>
      <ul className="flex flex-col gap-2">
        <Check label="Revisé el resumen, partes y descripción de la operación." on={checks.terminos} onChange={() => toggle("terminos")} />
        <Check label="Acepto los hitos, montos, plazos y evidencias." on={checks.hitos} onChange={() => toggle("hitos")} />
        <Check label="Estoy de acuerdo con las condiciones fiscales (CFDI/uso/forma de pago)." on={checks.fiscal} onChange={() => toggle("fiscal")} />
        <Check label="Entiendo el proceso de disputa y la regla loser-pays." on={checks.disputa} onChange={() => toggle("disputa")} />
        <Check label="Autorizo bloquear la versión y generar el hash inmutable del contrato." on={checks.hash} onChange={() => toggle("hash")} />
      </ul>
      <div className="flex items-center justify-end gap-2 mt-4">
        <button onClick={onClose} className="h-10 px-3 rounded-md border border-yo-border text-sm text-yo-txt-2">Cancelar</button>
        <button
          disabled={!allOk}
          onClick={onConfirm}
          className={cn("h-10 px-4 rounded-md text-sm font-semibold inline-flex items-center gap-2", allOk ? "bg-yo-ac text-white hover:opacity-90" : "bg-yo-bg text-yo-txt-3 cursor-not-allowed")}
        >
          <CheckCircle2 className="size-4" /> {copy.cta}
        </button>
      </div>
    </ModalShell>
  );
}

function Check({ label, on, onChange }: { label: string; on: boolean; onChange: () => void }) {
  return (
    <label className="flex items-start gap-2 text-sm text-yo-txt cursor-pointer">
      <input type="checkbox" checked={on} onChange={onChange} className="mt-0.5 size-4 accent-[color:var(--yo-ac)]" />
      <span>{label}</span>
    </label>
  );
}

function SimpleModal({
  title, children, onClose, onConfirm, confirmLabel, confirmTone, size,
}: {
  title: string; children: React.ReactNode; onClose: () => void; onConfirm: () => void;
  confirmLabel: string; confirmTone?: "danger"; size?: "md" | "lg";
}) {
  return (
    <ModalShell onClose={onClose} title={title} size={size ?? "md"}>
      {children}
      <div className="flex items-center justify-end gap-2 mt-4">
        <button onClick={onClose} className="h-10 px-3 rounded-md border border-yo-border text-sm text-yo-txt-2">Cancelar</button>
        <button
          onClick={onConfirm}
          className={cn("h-10 px-4 rounded-md text-sm font-semibold text-white",
            confirmTone === "danger" ? "bg-[#B91C1C] hover:bg-[#991B1B]" : "bg-yo-ac hover:opacity-90")}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, size = "md", onClose, children }: { title: string; size?: "md" | "lg"; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn("bg-yo-surface border border-yo-border rounded-lg w-full p-5", size === "lg" ? "max-w-2xl" : "max-w-md")}
      >
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-base font-semibold text-yo-txt">{title}</h3>
          <button onClick={onClose} className="text-yo-txt-3 hover:text-yo-txt"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
