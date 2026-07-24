import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import {
  ShieldCheck, Clock, FileText, Users, Landmark, Scale, Gavel, FileSignature,
  CheckCircle2, XCircle, MessageSquareWarning, ArrowRight, Lock, Hash, Building2,
  User, Calendar, AlertTriangle, Download, Eye, ClipboardCheck, X, Info,
  Camera, MapPin, ListChecks, Truck, RefreshCw, Home, Pencil, BellRing, Loader2,
} from "lucide-react";
import { CumplexLogo } from "@/components/logo";
import { InfoBox } from "@/components/tx/ui/info-box";
import { MoneyDisplay } from "@/components/tx/ui/money-display";
import { SectorBadge } from "@/components/tx/ui/sector-badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { remindTransactionCounterparty, isTransactionCreator } from "@/lib/transactions.functions";
import { useQuery } from "@tanstack/react-query";



export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    action: (s.action === "accept" ? "accept" : undefined) as "accept" | undefined,
    view: (s.view === "creator" ? "creator" : undefined) as "creator" | undefined,
  }),
  component: InviteApprovalPage,
});


// ─────────────────────────────────────────────────────────────────────────
// Tipos (mirror del payload API §15.1)
// ─────────────────────────────────────────────────────────────────────────
type InviteeRole = "PAGADOR" | "BENEFICIARIO";
type InviteStatus = "ENVIADA" | "VISTA" | "CAMBIOS_SOLICITADOS" | "ACEPTADA" | "RECHAZADA" | "EXPIRADA";
type AgreementStatus = "SENT" | "UNDER_REVIEW" | "CHANGES_REQUESTED" | "ACCEPTED" | "LOCKED";
type ComisionAbsorbe = "comprador" | "vendedor" | "compartida";

interface Milestone {
  id: string;
  orden: number;
  nombre: string;
  porcentaje: number;
  monto: number; // centavos
  fechaLimite: string; // ISO
  responsable: "Vendedor" | "Comprador";
  criterio: string;
  verificacion: string;
  autoRelease: boolean;
}

interface RequiredDoc {
  nombre: string;
  tipo: "CFDI" | "REP" | "Carta Porte" | "Contrato" | "BL/AWB/Pedimento" | "Escritura/Avalúo" | "Otro";
  obligatorio: boolean;
  cargaEsperada: "Vendedor" | "Comprador" | "Ambos";
}

interface EvidenceItem {
  tipo: "Foto" | "Video" | "GPS" | "Checklist" | "Firma de receptor";
  descripcion: string;
}

interface InviteData {
  token: string;
  inviteStatus: InviteStatus;
  inviteeRole: InviteeRole;
  creatorRole: InviteeRole;
  creatorName: string;
  creatorOrg: string;
  creatorRfcMasked: string;
  creatorVerified: boolean;
  creatorScoreBand: "Alto" | "Medio" | "Bajo" | null;

  operationId: string;
  concepto: string;
  descripcion: string;
  sector: string;
  fechaInicioEstimada: string;
  fechaFinMaxima: string;

  agreementVersion: string;
  agreementStatus: AgreementStatus;
  hashPreliminar: string | null;
  hashFinal: string | null;

  expiresAt: string;
  amount: number;
  currency: string;
  commissionBps: number;
  ivaBps: number; // 1600 = 16%
  comisionAbsorbe: ComisionAbsorbe;
  metodoSugerido: "SPEI" | "Tarjeta";

  milestones: Milestone[];
  documentos: RequiredDoc[];
  evidencias: EvidenceItem[];
  fiscal: { cfdiRequerido: boolean; tipoCfdi: "PPD" | "PUE"; usoCfdi: string; formaPago: string; metodoPago: string; repPosterior: boolean };
  liberacion: {
    modo: string;
    verificador: string;
    reglaAprobacion: string;
    ventanaInspeccionDias: number;
    reglaRechazo: string;
    correccionReenvio: string;
    devolucion: string;
  };
  disputa: {
    cuandoAbrir: string;
    plazoRespuestaDias: number;
    evidenciaAdmisible: string;
    resultados: string[];
  };
}

function useInviteMock(token: string): InviteData {
  return useMemo(() => ({
    token,
    inviteStatus: "ENVIADA",
    inviteeRole: "BENEFICIARIO",
    creatorRole: "PAGADOR",
    creatorName: "María González",
    creatorOrg: "Constructora Norte S.A. de C.V.",
    creatorRfcMasked: "CNO*******123",
    creatorVerified: true,
    creatorScoreBand: "Alto",

    operationId: "OP" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "0142",
    concepto: "Flete Mazatlán–Guadalajara, 12 toneladas de mercancía",
    descripcion:
      "Servicio de autotransporte de carga general con unidad certificada, incluye maniobras de carga/descarga y seguro de mercancía. Ruta Mazatlán → Guadalajara con verificación GPS.",
    sector: "Autotransporte",
    fechaInicioEstimada: new Date(Date.now() + 7 * 86400_000).toISOString(),
    fechaFinMaxima: new Date(Date.now() + 45 * 86400_000).toISOString(),

    agreementVersion: "v1.0",
    agreementStatus: "SENT",
    hashPreliminar: null,
    hashFinal: null,

    expiresAt: new Date(Date.now() + 72 * 3600_000).toISOString(),
    amount: 85000000, // $850,000.00 en centavos
    currency: "MXN",
    commissionBps: 150,
    ivaBps: 1600,
    comisionAbsorbe: "comprador",
    metodoSugerido: "SPEI",

    milestones: [
      {
        id: "H1", orden: 1, nombre: "Carga y salida", porcentaje: 20, monto: 17000000,
        fechaLimite: new Date(Date.now() + 12 * 86400_000).toISOString(),
        responsable: "Vendedor",
        criterio: "Unidad cargada, sellada y con GPS activo saliendo de origen.",
        verificacion: "Carta Porte + foto de carga + GPS", autoRelease: false,
      },
      {
        id: "H2", orden: 2, nombre: "Tránsito y checkpoint intermedio", porcentaje: 30, monto: 25500000,
        fechaLimite: new Date(Date.now() + 25 * 86400_000).toISOString(),
        responsable: "Vendedor",
        criterio: "Reporte de posición GPS en punto medio + estado mercancía.",
        verificacion: "GPS + foto en checkpoint", autoRelease: true,
      },
      {
        id: "H3", orden: 3, nombre: "Entrega en destino", porcentaje: 50, monto: 42500000,
        fechaLimite: new Date(Date.now() + 45 * 86400_000).toISOString(),
        responsable: "Vendedor",
        criterio: "Acta de entrega firmada por receptor + evidencia sin daños.",
        verificacion: "Firma de receptor + fotos + checklist", autoRelease: false,
      },
    ],
    documentos: [
      { nombre: "CFDI PPD", tipo: "CFDI", obligatorio: true, cargaEsperada: "Vendedor" },
      { nombre: "REP posterior", tipo: "REP", obligatorio: true, cargaEsperada: "Vendedor" },
      { nombre: "Carta Porte", tipo: "Carta Porte", obligatorio: true, cargaEsperada: "Vendedor" },
      { nombre: "Contrato firmado", tipo: "Contrato", obligatorio: true, cargaEsperada: "Ambos" },
      { nombre: "BL/AWB/Pedimento", tipo: "BL/AWB/Pedimento", obligatorio: false, cargaEsperada: "Vendedor" },
    ],
    evidencias: [
      { tipo: "Foto", descripcion: "Fotos de carga y descarga" },
      { tipo: "Video", descripcion: "Video corto en punto medio" },
      { tipo: "GPS", descripcion: "Track continuo de la unidad" },
      { tipo: "Checklist", descripcion: "Checklist de entrega firmado" },
      { tipo: "Firma de receptor", descripcion: "Firma digital o física escaneada" },
    ],
    fiscal: {
      cfdiRequerido: true, tipoCfdi: "PPD",
      usoCfdi: "G03 – Gastos en general",
      formaPago: "03 – Transferencia electrónica",
      metodoPago: "PPD – Pago en parcialidades o diferido",
      repPosterior: true,
    },
    liberacion: {
      modo: "Por hito con verificación documental y evidencia",
      verificador: "Comprador + IA Cumplex",
      reglaAprobacion: "Doble confirmación (comprador y verificador)",
      ventanaInspeccionDias: 3,
      reglaRechazo: "El comprador puede rechazar dentro de la ventana indicando motivo verificable.",
      correccionReenvio: "El vendedor puede corregir evidencia y reenviar 1 vez sin abrir disputa.",
      devolucion: "En incumplimiento total, devolución al comprador menos comisiones aplicadas.",
    },
    disputa: {
      cuandoAbrir: "Dentro de la ventana de inspección o si la corrección de evidencia no fue aceptada.",
      plazoRespuestaDias: 5,
      evidenciaAdmisible: "Documentos, fotos, video, GPS y peritajes sectoriales.",
      resultados: [
        "Liberación total al vendedor",
        "Devolución parcial al comprador",
        "Devolución total al comprador",
        "Corrección y reejecución del hito",
      ],
    },
  }), [token]);
}

// ─────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────
function InviteApprovalPage() {
  const { token } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const data = useInviteMock(token);

  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [postState, setPostState] = useState<null | "accepted" | "changes" | "rejected">(null);

  useEffect(() => {
    if (search.action === "accept") setShowAcceptModal(true);
  }, [search.action]);


  // Vista de creador: requiere ?view=creator AND que el usuario autenticado sea el creador real de la operación
  const wantsCreatorView = search.view === "creator";
  const isCreatorFn = useServerFn(isTransactionCreator);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
  const { data: creatorCheck } = useQuery({
    queryKey: ["is-tx-creator", token],
    queryFn: () => isCreatorFn({ data: { transaction_id: token } }),
    enabled: wantsCreatorView && isUuid,
    staleTime: 60_000,
  });
  const isCreatorView = wantsCreatorView && creatorCheck?.is_creator === true;

  const isBuyer = data.inviteeRole === "PAGADOR";
  const roleLabel = isBuyer ? "Pagador / Comprador" : "Beneficiario / Vendedor";
  const counterLabel = isBuyer ? "Beneficiario / Vendedor" : "Pagador / Comprador";

  const copy = isCreatorView
    ? {
        title: "Revisa tu operación antes de firmar",
        subtitle: `Esta es la operación que registraste. Revisa monto, hitos, reglas de aprobación y condiciones. Cuando estés listo, pasa a firma de acuerdos. Podrás ver aquí cuando tu contraparte apruebe, firme o solicite cambios.`,
        cta: "Firmar acuerdo",
      }
    : isBuyer
    ? {
        title: "Revisa esta operación antes de fondear",
        subtitle: `${data.creatorName} te envió una propuesta de operación protegida. Revisa el monto, los hitos, las reglas de aprobación y las condiciones de devolución antes de aceptar.`,
        cta: "Aceptar operación y continuar a firma",
      }
    : {
        title: "Revisa esta operación antes de aceptar entregar",
        subtitle: `${data.creatorName} te invitó a una operación protegida. Revisa los hitos, documentos, fechas y condiciones de liberación antes de aceptar.`,
        cta: "Aceptar operación y continuar a firma",
      };


  // ── Estados especiales (§21) ────────────────────────────────────────
  const now = Date.now();
  const isExpired = data.inviteStatus === "EXPIRADA" || new Date(data.expiresAt).getTime() < now;
  if (isExpired) return <EmptyState token={token} kind="expired" />;
  if (data.inviteStatus === "ACEPTADA" || postState === "accepted")
    return <PostAcceptScreen data={data} isBuyer={isBuyer} />;
  if (data.inviteStatus === "RECHAZADA" || postState === "rejected")
    return <EmptyState token={token} kind="rejected" />;
  if (data.inviteStatus === "CAMBIOS_SOLICITADOS" || postState === "changes")
    return <EmptyState token={token} kind="changes" />;

  // ── Economics ───────────────────────────────────────────────────────
  const ivaOperacion = (data.amount * data.ivaBps) / 10000;
  const totalOperacionConIva = data.amount + ivaOperacion;
  const commission = (data.amount * data.commissionBps) / 10000;
  const ivaComision = (commission * data.ivaBps) / 10000;
  const comisionTotal = commission + ivaComision;
  // Proporción de la comisión que absorbe el comprador (resto lo absorbe el vendedor)
  const pctCompradorAbsorbe =
    data.comisionAbsorbe === "comprador" ? 1 : data.comisionAbsorbe === "vendedor" ? 0 : 0.5;
  const comisionComprador = comisionTotal * pctCompradorAbsorbe;
  const comisionVendedor = comisionTotal * (1 - pctCompradorAbsorbe);
  const totalFondear = totalOperacionConIva + comisionComprador;
  const netoVendedor = totalOperacionConIva - comisionVendedor;
  const absorbeLabel =
    data.comisionAbsorbe === "comprador"
      ? "Comprador (100%)"
      : data.comisionAbsorbe === "vendedor"
      ? "Vendedor (100%)"
      : "Compartida 50% / 50%";


  return (
    <div className="min-h-dvh bg-yo-bg text-yo-txt">
      {/* Top bar público */}
      <header className="border-b border-yo-border bg-yo-surface">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <CumplexLogo className="h-7" />
          <button
            type="button"
            onClick={() => {
              try {
                window.close();
              } catch {
                /* noop */
              }
              // Fallback si la pestaña no fue abierta por script
              if (!window.closed) window.location.href = "/";
            }}
            aria-label="Cerrar pantalla"
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-yo-border bg-yo-bg hover:bg-yo-surface-2 text-yo-txt-2 hover:text-yo-txt text-xs transition-colors"
          >
            <X className="size-3.5" /> Cerrar
          </button>

        </div>
      </header>

      {/* Header de operación */}
      <section className="border-b border-yo-border bg-yo-surface">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-4">
          <div className="flex items-center flex-wrap gap-2 text-[11px]">
            <StatusChip status={data.inviteStatus} />
            <ExpiryChip iso={data.expiresAt} />
            <span className="font-mono text-yo-txt-2">{data.operationId}</span>
            <span className="text-yo-txt-3">·</span>
            <SectorBadge sector={data.sector} />
            <span className="text-yo-txt-3">·</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yo-ac/10 text-yo-ac font-medium">
              <ShieldCheck className="size-3" /> Invitado como {roleLabel}
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
          {/* 9.1 Resumen ejecutivo */}
          <Card icon={FileText} title="Resumen de la operación">
            <Row label="Número" value={<span className="font-mono">{data.operationId}</span>} />
            <Row label="Sector" value={data.sector} />
            <Row label="Concepto" value={data.concepto} />
            <Row label="Monto total" value={<MoneyDisplay amount={data.amount / 100} currency={data.currency} />} />
            <Row label="Fecha estimada de inicio" value={fmtDate(data.fechaInicioEstimada)} />
            <Row label="Fecha máxima de conclusión" value={fmtDate(data.fechaFinMaxima)} />
            <Row label="Estado" value={<StatusChip status={data.inviteStatus} />} />
            <Row label="Invitado como" value={<span className="font-semibold text-yo-ac">{roleLabel}</span>} />
            <div className="mt-2 text-xs text-yo-txt-2 leading-relaxed border-t border-yo-border pt-3">
              {data.descripcion}
            </div>
          </Card>

          {/* 9.2 Partes */}
          <Card icon={Users} title="Partes involucradas">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <PartyBlock
                title={`${counterLabel} (creador)`}
                name={data.creatorName}
                org={data.creatorOrg}
                rfc={data.creatorRfcMasked}
                verified={data.creatorVerified}
                scoreBand={data.creatorScoreBand}
              />
              <PartyBlock
                title={`${roleLabel} (tú)`}
                name="Tú, invitado por email"
                org="Se validará al aceptar y firmar"
                rfc={null}
                verified={false}
                scoreBand={null}
              />
            </div>
            <InfoBox tone="info" title="Privacidad">
              Antes de aceptar, mostramos únicamente banda de score consentida. No se exponen señales internas PLD, PEP, sanciones ni desglose sensible.
            </InfoBox>
          </Card>

          {/* 9.3 Economics */}
          <Card icon={Landmark} title="Monto y condiciones económicas">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-yo-txt-3 mb-1">Operación</div>
            <Row label="Monto principal" value={<MoneyDisplay amount={data.amount / 100} currency={data.currency} />} />
            <Row label="IVA de la operación (16%)" value={<MoneyDisplay amount={ivaOperacion / 100} currency={data.currency} />} />
            <Row label="Total de la operación (con IVA)" value={<MoneyDisplay amount={totalOperacionConIva / 100} currency={data.currency} />} strong />

            <div className="text-[11px] font-semibold uppercase tracking-wider text-yo-txt-3 mt-4 mb-1">Comisión Cumplex</div>
            <Row label={`Comisión Cumplex (${(data.commissionBps / 100).toFixed(2)}%)`} value={<MoneyDisplay amount={commission / 100} currency={data.currency} />} />
            <Row label="IVA de la comisión (16%)" value={<MoneyDisplay amount={ivaComision / 100} currency={data.currency} />} />
            <Row label="Comisión total (con IVA)" value={<MoneyDisplay amount={comisionTotal / 100} currency={data.currency} />} strong />

            <div className="text-[11px] font-semibold uppercase tracking-wider text-yo-txt-3 mt-4 mb-1">Acuerdo entre las partes</div>
            <Row label="Comisión la absorbe" value={<span className="font-medium text-yo-txt">{absorbeLabel}</span>} />
            <Row
              label="Parte a cargo del comprador"
              value={<MoneyDisplay amount={comisionComprador / 100} currency={data.currency} />}
            />
            <Row
              label="Parte a cargo del vendedor"
              value={<MoneyDisplay amount={comisionVendedor / 100} currency={data.currency} />}
            />
            <Row label="Método sugerido de pago" value={data.metodoSugerido} />

            <div className="text-[11px] font-semibold uppercase tracking-wider text-yo-txt-3 mt-4 mb-1">Resultado</div>
            <Row
              label="Total estimado a fondear (comprador)"
              value={<MoneyDisplay amount={totalFondear / 100} currency={data.currency} size={isBuyer ? "lg" : undefined} />}
              strong={isBuyer}
            />
            <Row
              label="Neto estimado a recibir (vendedor)"
              value={<MoneyDisplay amount={netoVendedor / 100} currency={data.currency} size={!isBuyer ? "lg" : undefined} />}
              strong={!isBuyer}
            />

            <InfoBox tone="info" title={isBuyer ? "Como pagador" : "Como beneficiario"}>
              {isBuyer
                ? "Los fondos serán procesados y retenidos por la pasarela configurada (Stripe / SPEI). Cumplex NO custodia fondos. Se emitirá CFDI por la comisión con su IVA correspondiente."
                : "La liberación dependerá del cumplimiento de los hitos y evidencia aceptada. Cumplex NO custodia fondos. El IVA de la operación se traslada según el CFDI que emitas al pagador."}
            </InfoBox>
          </Card>


          {/* 9.4 Hitos */}
          <Card icon={ClipboardCheck} title={`Hitos propuestos (${data.milestones.length})`}>
            <div className="flex flex-col gap-2">
              {data.milestones.map((h) => (
                <MilestoneRow key={h.id} m={h} currency={data.currency} />
              ))}
            </div>
          </Card>

          {/* 9.5 Documentos y evidencia */}
          <Card icon={FileText} title="Documentos y evidencia requerida">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-yo-txt-3 mb-2">Documentos</div>
            <ul className="flex flex-col gap-1.5 mb-4">
              {data.documentos.map((d) => (
                <li key={d.nombre} className="flex items-center justify-between text-sm border-b border-yo-border pb-1.5 last:border-0">
                  <div>
                    <span className="text-yo-txt">{d.nombre}</span>
                    <span className="text-yo-txt-3 text-xs ml-2">Carga: {d.cargaEsperada}</span>
                  </div>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", d.obligatorio ? "bg-yo-warn-bg text-[color:var(--yo-warn)]" : "bg-yo-bg text-yo-txt-3")}>
                    {d.obligatorio ? "Obligatorio" : "Opcional"}
                  </span>
                </li>
              ))}
            </ul>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-yo-txt-3 mb-2">Evidencia</div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {data.evidencias.map((e) => (
                <li key={e.tipo} className="flex items-center gap-2 text-xs text-yo-txt-2">
                  <EvidenceIcon kind={e.tipo} />
                  <span className="font-medium text-yo-txt">{e.tipo}</span>
                  <span className="text-yo-txt-3">— {e.descripcion}</span>
                </li>
              ))}
            </ul>
            <InfoBox tone="info" title={isBuyer ? "Qué revisarás como comprador" : "Qué deberás subir como vendedor"}>
              {isBuyer
                ? "Verás cada documento/evidencia por hito antes de aprobar la liberación correspondiente."
                : "Deberás subir cada documento/evidencia por hito para habilitar la aprobación del comprador."}
            </InfoBox>
          </Card>

          {/* 9.6 Fiscal */}
          <Card icon={FileSignature} title="Términos fiscales">
            <Row label="CFDI requerido" value={data.fiscal.cfdiRequerido ? "Sí" : "No"} />
            <Row label="Tipo esperado" value={data.fiscal.tipoCfdi} />
            <Row label="REP posterior" value={data.fiscal.repPosterior ? "Sí, al recibir cada pago" : "No aplica"} />
            <Row label="Uso de CFDI" value={data.fiscal.usoCfdi} />
            <Row label="Forma de pago" value={data.fiscal.formaPago} />
            <Row label="Método de pago" value={data.fiscal.metodoPago} />
            <InfoBox tone="warn" title="Emisión de CFDI">
              Cumplex NO emite CFDI ni REP por cuenta del vendedor. El proveedor deberá generarlos en su sistema contable/PAC y subir el XML timbrado para validación (UUID, RFC, montos y consistencia).
            </InfoBox>
          </Card>

          {/* 9.7 Reglas de liberación */}
          <Card icon={Scale} title="Reglas de liberación y devolución">
            <Row label="Modo" value={data.liberacion.modo} />
            <Row label="Verificador" value={data.liberacion.verificador} />
            <Row label="Regla de aprobación" value={data.liberacion.reglaAprobacion} />
            <Row label="Ventana de inspección" value={`${data.liberacion.ventanaInspeccionDias} días hábiles`} />
            <Row label="Rechazo" value={data.liberacion.reglaRechazo} />
            <Row label="Corrección y reenvío" value={data.liberacion.correccionReenvio} />
            <Row label="Devolución por incumplimiento" value={data.liberacion.devolucion} />
            <InfoBox tone="info" title={isBuyer ? "Como comprador" : "Como vendedor"}>
              {isBuyer
                ? `Tendrás ${data.liberacion.ventanaInspeccionDias} días para revisar evidencia después de que el vendedor marque un hito como listo.`
                : `Una vez que subas evidencia completa, el comprador tendrá ${data.liberacion.ventanaInspeccionDias} días para aprobar, rechazar o abrir disputa conforme a las reglas acordadas.`}
            </InfoBox>
          </Card>

          {/* 9.8 Reglas de disputa */}
          <Card icon={Gavel} title="Reglas de disputa">
            <Row label="Cuándo abrir" value={data.disputa.cuandoAbrir} />
            <Row label="Plazo de respuesta" value={`${data.disputa.plazoRespuestaDias} días hábiles`} />
            <Row label="Evidencia admisible" value={data.disputa.evidenciaAdmisible} />
            <div className="pt-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-yo-txt-3 mb-1.5">Resultados posibles</div>
              <ul className="text-xs text-yo-txt-2 space-y-1">
                {data.disputa.resultados.map((r) => (
                  <li key={r} className="flex items-start gap-1.5"><ArrowRight className="size-3 mt-0.5 text-yo-ac shrink-0" /> {r}</li>
                ))}
              </ul>
            </div>
            <InfoBox tone="warn" title="Rol de Cumplex">
              Cumplex actúa como tercero neutral para verificar condiciones, documentación y evidencia. No garantiza el resultado comercial de la operación ni sustituye asesoría legal.
            </InfoBox>
          </Card>

          {/* 9.9 Contrato preliminar */}
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
            <Row label="Versión" value={data.agreementVersion} />
            <Row label="Estado" value={<AgreementStatusChip status={data.agreementStatus} />} />
            <Row label="Hash preliminar" value={data.hashPreliminar ?? <span className="text-yo-txt-3">Disponible al bloquear versión</span>} />
            <InfoBox tone="info" title="Versión abierta">
              El contrato todavía NO está bloqueado mientras la invitación esté pendiente. Solo se bloquea cuando ambas partes aceptan la misma versión del acuerdo.
            </InfoBox>
          </Card>

          {/* Acciones §10 */}
          <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-yo-surface border-t border-yo-border flex flex-wrap gap-2 justify-end mt-2">
            {isCreatorView ? (
              <>
                {(() => {
                  const cpAccepted = (data.inviteStatus as string) === "ACEPTADA";
                  const remindFn = useServerFn(remindTransactionCounterparty);
                  const remindMut = useMutation({
                    mutationFn: () => remindFn({ data: { transaction_id: token } }),
                    onSuccess: () => toast.success("Recordatorio enviado a la contraparte"),
                    onError: (e: any) => toast.error(e?.message ?? "No se pudo enviar el recordatorio"),
                  });
                  const editLocked = creatorCheck?.can_edit === false && !!creatorCheck?.lock_reason;
                  const lockReason = creatorCheck?.lock_reason ?? null;
                  return (
                    <>
                      <button
                        onClick={() => !editLocked && navigate({ to: "/transactions/$id", params: { id: token } })}
                        disabled={editLocked}
                        title={editLocked ? (lockReason ?? undefined) : undefined}
                        className={cn(
                          "h-10 px-4 rounded-md border text-sm inline-flex items-center gap-2",
                          editLocked
                            ? "border-yo-border bg-yo-raised/40 text-yo-txt-3 cursor-not-allowed"
                            : "border-yo-border bg-white dark:bg-transparent text-yo-txt hover:border-yo-ac",
                        )}
                      >
                        {editLocked ? <Lock className="size-4" /> : <Pencil className="size-4" />}
                        {editLocked ? "Edición bloqueada" : "Editar operación"}
                      </button>

                      {!cpAccepted && (
                        <button
                          onClick={() => remindMut.mutate()}
                          disabled={remindMut.isPending}
                          className="h-10 px-4 rounded-md border border-yo-ac/40 text-sm font-semibold text-yo-ac hover:bg-yo-ac/10 inline-flex items-center gap-2 disabled:opacity-60"
                        >
                          {remindMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}
                          {remindMut.isPending ? "Enviando…" : "Enviar recordatorio"}
                        </button>
                      )}
                      <button
                        onClick={() => cpAccepted && setShowAcceptModal(true)}
                        disabled={!cpAccepted}
                        title={!cpAccepted ? "La contraparte aún no acepta la operación. Envía un recordatorio y espera su aceptación para firmar." : undefined}
                        className={cn(
                          "h-10 px-4 rounded-md text-sm font-semibold inline-flex items-center gap-2",
                          cpAccepted
                            ? "bg-yo-ac text-white hover:opacity-90"
                            : "bg-yo-raised/40 border border-yo-border text-yo-txt-3 cursor-not-allowed"
                        )}
                      >
                        <FileSignature className="size-4" /> {cpAccepted ? copy.cta : "Esperando contraparte"}
                      </button>
                    </>
                  );
                })()}
              </>
            ) : (

              <>
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
              </>
            )}
          </div>

        </div>

        {/* Sidebar sticky "Antes de aceptar" */}
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

      {/* Modales */}
      {showAcceptModal && (
        <AcceptInvitationDialog
          cta={copy.cta}
          onClose={() => setShowAcceptModal(false)}
          onConfirm={() => {
            setShowAcceptModal(false);
            setPostState("accepted");
            toast.success("Operación aceptada. Continuando a firma…");
          }}
        />
      )}
      {showRejectModal && (
        <RejectInvitationDialog
          onClose={() => setShowRejectModal(false)}
          onConfirm={() => {
            setShowRejectModal(false);
            setPostState("rejected");
            toast("Operación rechazada. Se notificó al creador.");
          }}
        />
      )}
      {showChangesModal && (
        <RequestChangesDialog
          onClose={() => setShowChangesModal(false)}
          onConfirm={() => {
            setShowChangesModal(false);
            setPostState("changes");
            toast.success("Solicitud de cambios enviada al creador.");
          }}
        />
      )}
      {showContract && (
        <ContractPreviewModal data={data} onClose={() => setShowContract(false)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §21 · Estados especiales
// ─────────────────────────────────────────────────────────────────────────
function EmptyState({ token, kind }: { token: string; kind: "expired" | "rejected" | "changes" }) {
  const map = {
    expired: {
      icon: Clock,
      tone: "warn" as const,
      title: "Esta invitación expiró",
      body: "Solicita a la contraparte que genere una nueva invitación o que reenvíe la operación.",
      primary: { label: "Contactar soporte", to: "/help" as const },
      secondary: { label: "Volver al dashboard", to: "/dashboard" as const },
    },
    rejected: {
      icon: XCircle,
      tone: "err" as const,
      title: "Operación rechazada",
      body: "Notificamos al creador. El historial de esta operación quedará disponible para auditoría.",
      primary: { label: "Volver al dashboard", to: "/dashboard" as const },
      secondary: { label: "Contactar soporte", to: "/help" as const },
    },
    changes: {
      icon: MessageSquareWarning,
      tone: "warn" as const,
      title: "Cambios solicitados",
      body: "Tu solicitud fue enviada al creador. Te avisaremos cuando exista una nueva versión para revisar.",
      primary: { label: "Volver al dashboard", to: "/dashboard" as const },
      secondary: { label: "Ver notificaciones", to: "/notifications" as const },
    },
  }[kind];

  const Icon = map.icon;
  const iconBg =
    map.tone === "err" ? "bg-yo-err-bg text-[color:var(--yo-err)]" :
    map.tone === "warn" ? "bg-yo-warn-bg text-[color:var(--yo-warn)]" :
    "bg-yo-ac/10 text-yo-ac";

  return (
    <div className="min-h-dvh bg-yo-bg grid place-items-center p-4">
      <div className="max-w-md w-full rounded-lg border border-yo-border bg-yo-surface p-6 text-center flex flex-col gap-3">
        <div className={cn("size-12 rounded-full grid place-items-center mx-auto", iconBg)}>
          <Icon className="size-6" />
        </div>
        <h1 className="text-xl font-bold text-yo-txt">{map.title}</h1>
        <p className="text-sm text-yo-txt-2">{map.body}</p>
        <div className="text-[11px] text-yo-txt-3 font-mono">Invitación · {token.slice(0, 8)}</div>
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <Link to={map.secondary.to} className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-md border border-yo-border text-sm text-yo-txt-2 hover:text-yo-txt">
            <Home className="size-4" /> {map.secondary.label}
          </Link>
          <Link to={map.primary.to} className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-md bg-yo-ac text-white text-sm font-semibold hover:opacity-90">
            {map.primary.label} <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Post-aceptación
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
    <div className={cn("flex items-start justify-between gap-3 py-1.5 border-b border-yo-border last:border-0", strong && "pt-2 mt-1 border-t border-yo-border font-semibold")}>
      <span className="text-xs text-yo-txt-2 shrink-0">{label}</span>
      <span className={cn("text-sm text-yo-txt text-right min-w-0", strong && "text-base")}>{value}</span>
    </div>
  );
}

function PartyBlock({ title, name, org, rfc, verified, scoreBand }: {
  title: string; name: string; org: string; rfc: string | null; verified: boolean; scoreBand: "Alto" | "Medio" | "Bajo" | null;
}) {
  return (
    <div className="border border-yo-border rounded-md p-3">
      <div className="text-[10px] uppercase tracking-wider text-yo-txt-3">{title}</div>
      <div className="text-sm font-semibold text-yo-txt mt-1 flex items-center gap-2">
        {org.includes("S.A.") || org.includes("S. de R.L.") ? <Building2 className="size-4" /> : <User className="size-4" />}
        {name}
      </div>
      <div className="text-xs text-yo-txt-2">{org}</div>
      {rfc && <div className="text-[11px] text-yo-txt-3 font-mono mt-0.5">RFC: {rfc}</div>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className={cn("inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full", verified ? "bg-yo-ok-bg text-[color:var(--yo-ok)]" : "bg-yo-warn-bg text-[color:var(--yo-warn)]")}>
          {verified ? <><CheckCircle2 className="size-3" /> Verificado</> : <><AlertTriangle className="size-3" /> Pendiente</>}
        </span>
        {scoreBand && (
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-yo-ac/10 text-yo-ac">
            <ShieldCheck className="size-3" /> Score {scoreBand}
          </span>
        )}
      </div>
    </div>
  );
}

function MilestoneRow({ m, currency }: { m: Milestone; currency: string }) {
  return (
    <div className="border border-yo-border rounded-md p-3">
      <div className="flex items-start gap-3">
        <div className="size-7 rounded-full bg-yo-ac/10 text-yo-ac grid place-items-center text-xs font-bold shrink-0">{m.orden}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-yo-txt">{m.nombre}</div>
          <div className="text-[11px] text-yo-txt-3 mt-0.5">
            {m.porcentaje}% · Vence {fmtDate(m.fechaLimite)} · Responsable {m.responsable}
          </div>
        </div>
        <MoneyDisplay amount={m.monto / 100} currency={currency} />
      </div>
      <div className="mt-2 pl-10 grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-yo-txt-2">
        <div><span className="text-yo-txt-3">Criterio: </span>{m.criterio}</div>
        <div><span className="text-yo-txt-3">Verificación: </span>{m.verificacion}</div>
        <div>
          <span className="text-yo-txt-3">Auto-release: </span>
          <span className={cn("font-medium", m.autoRelease ? "text-[color:var(--yo-ok)]" : "text-yo-txt")}>{m.autoRelease ? "Sí" : "No"}</span>
        </div>
      </div>
    </div>
  );
}

function EvidenceIcon({ kind }: { kind: EvidenceItem["tipo"] }) {
  const Icon = kind === "Foto" ? Camera : kind === "Video" ? Camera : kind === "GPS" ? MapPin : kind === "Checklist" ? ListChecks : Truck;
  return <Icon className="size-3.5 text-yo-ac shrink-0" />;
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
    EXPIRADA:           { bg: "#F4F4F5", txt: "#71717A", label: "Expirada" },
  };
  const s = map[status];
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: s.bg, color: s.txt }}>{s.label}</span>;
}

function AgreementStatusChip({ status }: { status: AgreementStatus }) {
  const map: Record<AgreementStatus, { bg: string; txt: string; label: string }> = {
    SENT:               { bg: "#DBEAFE", txt: "#1E40AF", label: "Enviado" },
    UNDER_REVIEW:       { bg: "#FEF3C7", txt: "#92400E", label: "En revisión" },
    CHANGES_REQUESTED:  { bg: "#FEE2E2", txt: "#B91C1C", label: "Cambios solicitados" },
    ACCEPTED:           { bg: "#DCFCE7", txt: "#166534", label: "Aceptado" },
    LOCKED:             { bg: "#EDE9FE", txt: "#5B21B6", label: "Bloqueado" },
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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

// ─────────────────────────────────────────────────────────────────────────
// §11 · Modal aceptación
// ─────────────────────────────────────────────────────────────────────────
function AcceptInvitationDialog({ cta, onClose, onConfirm }: { cta: string; onClose: () => void; onConfirm: () => void }) {
  const [checks, setChecks] = useState({
    resumen: false, economicas: false, hitos: false, docs: false, liberacion: false, custodia: false,
  });
  const allOk = Object.values(checks).every(Boolean);
  const toggle = (k: keyof typeof checks) => setChecks((c) => ({ ...c, [k]: !c[k] }));

  return (
    <ModalShell onClose={onClose} title="Aceptar operación" size="md">
      <p className="text-sm text-yo-txt-2 mb-3">Antes de continuar, confirma que revisaste esta versión.</p>
      <ul className="flex flex-col gap-2">
        <Check label="Leí el resumen de la operación." on={checks.resumen} onChange={() => toggle("resumen")} />
        <Check label="Revisé monto, comisión y condiciones económicas." on={checks.economicas} onChange={() => toggle("economicas")} />
        <Check label="Revisé hitos, fechas límite y entregables." on={checks.hitos} onChange={() => toggle("hitos")} />
        <Check label="Revisé documentos y evidencia requerida." on={checks.docs} onChange={() => toggle("docs")} />
        <Check label="Entiendo las reglas de liberación y devolución." on={checks.liberacion} onChange={() => toggle("liberacion")} />
        <Check label="Entiendo que Cumplex NO custodia fondos." on={checks.custodia} onChange={() => toggle("custodia")} />
      </ul>
      <p className="text-[11px] text-yo-txt-3 mt-3 leading-relaxed">
        Esta aceptación bloqueará la versión si ambas partes han aceptado los mismos términos. La firma contractual se solicitará en el siguiente paso.
      </p>
      <div className="flex items-center justify-end gap-2 mt-4">
        <button onClick={onClose} className="h-10 px-3 rounded-md border border-yo-border text-sm text-yo-txt-2">Cancelar</button>
        <button
          disabled={!allOk}
          onClick={onConfirm}
          className={cn("h-10 px-4 rounded-md text-sm font-semibold inline-flex items-center gap-2",
            allOk ? "bg-yo-ac text-white hover:opacity-90" : "bg-yo-bg text-yo-txt-3 cursor-not-allowed")}
        >
          <CheckCircle2 className="size-4" /> {cta}
        </button>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §12 · Modal solicitud de cambios
// ─────────────────────────────────────────────────────────────────────────
type ChangeSection = "Monto" | "Hitos" | "Fechas" | "Documentos" | "Fiscal" | "Otro";
const SECTIONS: ChangeSection[] = ["Monto", "Hitos", "Fechas", "Documentos", "Fiscal", "Otro"];

function RequestChangesDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  const [seccion, setSeccion] = useState<ChangeSection>("Monto");
  const [motivo, setMotivo] = useState("");
  const [propuesta, setPropuesta] = useState("");
  const motivoOk = motivo.trim().length >= 30;

  return (
    <ModalShell onClose={onClose} title="Solicitar cambios" size="md">
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-yo-txt-3">¿Qué parte del acuerdo debe ajustarse?</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {SECTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeccion(s)}
                className={cn("h-8 px-3 rounded-md border text-xs font-medium",
                  seccion === s ? "bg-yo-ac text-white border-yo-ac" : "bg-white dark:bg-transparent border-yo-border text-yo-txt-2 hover:border-yo-ac")}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-yo-txt-3">Explica el cambio solicitado *</label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Detalla qué debería ajustarse y por qué (mínimo 30 caracteres)"
            rows={4}
            className="w-full mt-1.5 border border-yo-border rounded-md p-2 text-sm bg-white dark:bg-transparent"
          />
          <div className={cn("text-[10px] mt-0.5 text-right", motivoOk ? "text-[color:var(--yo-ok)]" : "text-yo-txt-3")}>
            {motivo.trim().length} / 30 caracteres
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-yo-txt-3">Propuesta concreta (opcional)</label>
          <textarea
            value={propuesta}
            onChange={(e) => setPropuesta(e.target.value)}
            placeholder="Ej. cambiar hito 2 a 40% y postergar 5 días"
            rows={3}
            className="w-full mt-1.5 border border-yo-border rounded-md p-2 text-sm bg-white dark:bg-transparent"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 mt-4">
        <button onClick={onClose} className="h-10 px-3 rounded-md border border-yo-border text-sm text-yo-txt-2">Cancelar</button>
        <button
          disabled={!motivoOk}
          onClick={onConfirm}
          className={cn("h-10 px-4 rounded-md text-sm font-semibold inline-flex items-center gap-2",
            motivoOk ? "bg-yo-ac text-white hover:opacity-90" : "bg-yo-bg text-yo-txt-3 cursor-not-allowed")}
        >
          <RefreshCw className="size-4" /> Enviar solicitud de cambios
        </button>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §13 · Modal rechazo
// ─────────────────────────────────────────────────────────────────────────
const REJECT_REASONS = [
  "Monto no corresponde al acuerdo previo",
  "Hitos o fechas no viables",
  "Documentos/evidencia excesivos",
  "Condiciones fiscales incompatibles",
  "No reconozco a la contraparte",
  "Otro motivo",
];

function RejectInvitationDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  const [motivo, setMotivo] = useState<string>("");
  const [comentario, setComentario] = useState("");
  const canConfirm = motivo.length > 0;

  return (
    <ModalShell onClose={onClose} title="Rechazar operación" size="md">
      <div className="flex flex-col gap-3">
        <InfoBox tone="warn" title="No se elimina el historial">
          Rechazar cancela la operación. La invitación desaparece del Inbox y el historial queda visible para auditoría. El creador será notificado.
        </InfoBox>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-yo-txt-3">Motivo de rechazo *</label>
          <div className="mt-1.5 flex flex-col gap-1.5">
            {REJECT_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm text-yo-txt cursor-pointer">
                <input type="radio" name="reject-reason" checked={motivo === r} onChange={() => setMotivo(r)} className="size-4 accent-[color:var(--yo-ac)]" />
                {r}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-yo-txt-3">Comentario adicional (opcional)</label>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Contexto adicional para el creador"
            rows={3}
            className="w-full mt-1.5 border border-yo-border rounded-md p-2 text-sm bg-white dark:bg-transparent"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 mt-4">
        <button onClick={onClose} className="h-10 px-3 rounded-md border border-yo-border text-sm text-yo-txt-2">Cancelar</button>
        <button
          disabled={!canConfirm}
          onClick={onConfirm}
          className={cn("h-10 px-4 rounded-md text-sm font-semibold text-white inline-flex items-center gap-2",
            canConfirm ? "bg-[#B91C1C] hover:bg-[#991B1B]" : "bg-yo-bg text-yo-txt-3 cursor-not-allowed")}
        >
          <XCircle className="size-4" /> Rechazar definitivamente
        </button>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Modal contrato preliminar
// ─────────────────────────────────────────────────────────────────────────
function ContractPreviewModal({ data, onClose }: { data: InviteData; onClose: () => void }) {
  return (
    <ModalShell onClose={onClose} title={`Contrato preliminar ${data.agreementVersion}`} size="lg">
      <div className="text-xs text-yo-txt-3 mb-2 flex items-center gap-2">
        <Info className="size-3.5" /> Versión de solo lectura. Se bloqueará al aceptar y se generará el hash SHA-256.
      </div>
      <div className="border border-yo-border rounded-md p-4 max-h-[50vh] overflow-y-auto text-sm text-yo-txt-2 leading-relaxed whitespace-pre-line bg-yo-bg">
{`CONTRATO DE PAGO PROTEGIDO CUMPLEX

Operación: ${data.operationId}
Concepto: ${data.concepto}
Monto: ${new Intl.NumberFormat("es-MX", { style: "currency", currency: data.currency }).format(data.amount / 100)}
Sector: ${data.sector}
Inicio estimado: ${fmtDate(data.fechaInicioEstimada)}
Conclusión máxima: ${fmtDate(data.fechaFinMaxima)}

1. Objeto. ${data.descripcion}

2. Hitos y evidencias.
${data.milestones.map((h) => `   ${h.orden}. ${h.nombre} — ${h.porcentaje}% (${new Intl.NumberFormat("es-MX", { style: "currency", currency: data.currency }).format(h.monto / 100)}) — Vence ${fmtDate(h.fechaLimite)} — Verificación: ${h.verificacion}`).join("\n")}

3. Reglas de liberación. ${data.liberacion.modo}. Verificador: ${data.liberacion.verificador}. Ventana de inspección: ${data.liberacion.ventanaInspeccionDias} días.

4. Disputas. Plazo de respuesta: ${data.disputa.plazoRespuestaDias} días. Evidencia admisible: ${data.disputa.evidenciaAdmisible}.

5. Fiscal. CFDI ${data.fiscal.tipoCfdi}. Uso: ${data.fiscal.usoCfdi}. Forma de pago: ${data.fiscal.formaPago}.

6. Cumplex actúa como tercero neutral y NO custodia fondos ni actúa como intermediario financiero.`}
      </div>
      <div className="flex items-center justify-between mt-3">
        <button className="inline-flex items-center gap-1.5 text-xs text-yo-ac hover:underline"><Download className="size-3.5" /> Descargar PDF borrador</button>
        <button onClick={onClose} className="h-9 px-3 rounded-md border border-yo-border text-sm text-yo-txt-2">Cerrar</button>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Modal shell + helpers
// ─────────────────────────────────────────────────────────────────────────
function Check({ label, on, onChange }: { label: string; on: boolean; onChange: () => void }) {
  return (
    <label className="flex items-start gap-2 text-sm text-yo-txt cursor-pointer">
      <input type="checkbox" checked={on} onChange={onChange} className="mt-0.5 size-4 accent-[color:var(--yo-ac)]" />
      <span>{label}</span>
    </label>
  );
}

function ModalShell({ title, size = "md", onClose, children }: { title: string; size?: "md" | "lg"; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn("bg-yo-surface border border-yo-border rounded-lg w-full p-5 max-h-[90vh] overflow-y-auto", size === "lg" ? "max-w-2xl" : "max-w-md")}
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
