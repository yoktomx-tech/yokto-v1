import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Send, ArrowLeft, Mail, RefreshCw, X, CheckCircle2, Clock, AlertTriangle, Link2, Copy,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { InfoBox } from "@/components/tx/ui/info-box";
import { cn } from "@/lib/utils";
import {
  MOCK_INVITATIONS, SECTOR_CFG, formatDate, relativeTime, type Invitation,
} from "@/lib/relationships-mock";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/relationships/invitations")({
  component: InvitationsPage,
});

const TABS = [
  { key: "PENDIENTE", label: "Pendientes" },
  { key: "ACEPTADA",  label: "Aceptadas" },
  { key: "EXPIRADA",  label: "Expiradas" },
  { key: "CANCELADA", label: "Canceladas" },
] as const;

function InvitationsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("PENDIENTE");
  const [showDialog, setShowDialog] = useState(false);

  const filtered = MOCK_INVITATIONS.filter((i) => i.status === tab);

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 max-w-[1200px] mx-auto w-full">
      <div className="flex items-center gap-3">
        <Link to="/relationships" className="h-8 w-8 grid place-items-center rounded-md border border-yo-border bg-white hover:bg-yo-raised text-yo-txt-2">
          <ArrowLeft className="size-4" />
        </Link>
        <PageHeader
          icon={Send}
          title="Invitaciones a contrapartes"
          subtitle="Cada invitación es un evento auditable. Al aceptarse, la contraparte se agrega automáticamente a tu red verificada."
          actions={
            <button
              onClick={() => setShowDialog(true)}
              className="h-9 px-3 inline-flex items-center gap-2 rounded-md bg-[#4F46E5] text-white text-sm font-semibold hover:bg-[#4338CA]"
            >
              <Send className="size-4" /> Invitar contraparte
            </button>
          }
        />
      </div>

      <InfoBox tone="warn" title="Sólo invitaciones formales">
        No se pueden crear contactos manuales. Toda contraparte se materializa por operación cerrada, resultado de búsqueda o aceptación de una invitación con email verificado.
      </InfoBox>

      <div className="border-b border-yo-border">
        <nav className="flex gap-1">
          {TABS.map((t) => {
            const count = MOCK_INVITATIONS.filter((i) => i.status === t.key).length;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-3 h-10 text-sm font-medium border-b-2 -mb-px inline-flex items-center gap-2",
                  active ? "border-[#4F46E5] text-[#4338CA]" : "border-transparent text-yo-txt-2 hover:text-yo-txt",
                )}
              >
                {t.label}
                <span className={cn("text-[11px] px-1.5 rounded-full", active ? "bg-[#EEF2FF] text-[#3730A3]" : "bg-yo-bg text-yo-txt-3")}>{count}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-yo-border rounded-lg p-10 text-center text-sm text-yo-txt-2">
          Sin invitaciones en esta pestaña.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((i) => <InvitationRow key={i.id} inv={i} />)}
        </div>
      )}

      {showDialog && <InviteDialog onClose={() => setShowDialog(false)} />}
    </div>
  );
}

function InvitationRow({ inv }: { inv: Invitation }) {
  const badge =
    inv.status === "PENDIENTE" ? { bg: "#FFFBEB", txt: "#B45309", icon: <Clock className="size-3" /> } :
    inv.status === "ACEPTADA"  ? { bg: "#ECFDF5", txt: "#047857", icon: <CheckCircle2 className="size-3" /> } :
    inv.status === "EXPIRADA"  ? { bg: "#FEF2F2", txt: "#B91C1C", icon: <AlertTriangle className="size-3" /> } :
    inv.status === "RECHAZADA" ? { bg: "#FEF2F2", txt: "#B91C1C", icon: <X className="size-3" /> } :
                                 { bg: "#F4F4F5", txt: "#3F3F46", icon: <X className="size-3" /> };
  const sector = inv.sector ? SECTOR_CFG[inv.sector] : null;
  return (
    <div className="bg-white border border-yo-border rounded-lg p-4 flex items-center gap-4">
      <div className="size-10 rounded-lg bg-[#EEF2FF] text-[#4338CA] grid place-items-center shrink-0">
        <Mail className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-yo-txt truncate">{inv.displayName ?? inv.email}</span>
          {sector && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: sector.bg, color: sector.txt }}>{sector.emoji} {sector.label}</span>}
        </div>
        <div className="text-[11px] text-yo-txt-2 mt-0.5 flex flex-wrap gap-x-2 font-mono">
          <span>{inv.email}</span>
          {inv.rfcHint && <><span>•</span><span>RFC empieza con {inv.rfcHint}</span></>}
          {inv.linkedTxId && <><span>•</span><span className="inline-flex items-center gap-1"><Link2 className="size-3" /> {inv.linkedTxId}</span></>}
        </div>
        <div className="text-[11px] text-yo-txt-3 mt-0.5">
          Enviada {relativeTime(inv.invitedAt)} · Vence {formatDate(inv.expiresAt)} · Por {inv.invitedBy}
        </div>
      </div>
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full shrink-0" style={{ background: badge.bg, color: badge.txt }}>
        {badge.icon} {inv.status}
      </span>
      {inv.status === "PENDIENTE" && (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => toast.success("Invitación reenviada")} title="Reenviar" className="h-8 w-8 grid place-items-center rounded-md border border-yo-border text-yo-txt-2 hover:text-[#4F46E5] hover:border-[#4F46E5]">
            <RefreshCw className="size-4" />
          </button>
          <button onClick={() => toast.success("Enlace copiado")} title="Copiar enlace" className="h-8 w-8 grid place-items-center rounded-md border border-yo-border text-yo-txt-2 hover:text-[#4F46E5] hover:border-[#4F46E5]">
            <Copy className="size-4" />
          </button>
          <button onClick={() => toast("Invitación cancelada")} title="Cancelar" className="h-8 w-8 grid place-items-center rounded-md border border-yo-border text-yo-txt-2 hover:text-[#B91C1C] hover:border-[#B91C1C]">
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sector, setSector] = useState<string>("");
  const [message, setMessage] = useState("");
  const [txId, setTxId] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Email inválido");
      return;
    }
    toast.success("Invitación enviada a " + email);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-yo-border rounded-lg w-full max-w-lg p-5 flex flex-col gap-4"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-yo-txt">Invitar contraparte</h3>
            <p className="text-[12px] text-yo-txt-2">Enviamos un email con el flujo de registro y KYC.</p>
          </div>
          <button type="button" onClick={onClose} className="text-yo-txt-3 hover:text-yo-txt"><X className="size-5" /></button>
        </div>
        <Field label="Email de la contraparte" required>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="h-10 w-full px-3 rounded-md border border-yo-border text-sm focus:outline-none focus:border-[#4F46E5]" />
        </Field>
        <Field label="Nombre o razón social (opcional)">
          <input value={name} onChange={(e) => setName(e.target.value)} className="h-10 w-full px-3 rounded-md border border-yo-border text-sm focus:outline-none focus:border-[#4F46E5]" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sector esperado">
            <select value={sector} onChange={(e) => setSector(e.target.value)} className="h-10 w-full px-3 rounded-md border border-yo-border text-sm bg-white focus:outline-none focus:border-[#4F46E5]">
              <option value="">— Ninguno —</option>
              {Object.entries(SECTOR_CFG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
            </select>
          </Field>
          <Field label="Vincular a operación (opcional)">
            <input value={txId} onChange={(e) => setTxId(e.target.value)} placeholder="YOKTO-YYYY-NNNNN" className="h-10 w-full px-3 rounded-md border border-yo-border text-sm font-mono focus:outline-none focus:border-[#4F46E5]" />
          </Field>
        </div>
        <Field label="Mensaje (opcional)">
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={500} className="w-full px-3 py-2 rounded-md border border-yo-border text-sm resize-none focus:outline-none focus:border-[#4F46E5]" />
          <div className="text-[10px] text-yo-txt-3 mt-1 text-right">{message.length}/500</div>
        </Field>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-10 px-3 rounded-md border border-yo-border bg-white text-sm text-yo-txt-2 hover:text-yo-txt">Cancelar</button>
          <button type="submit" className="h-10 px-4 rounded-md bg-[#4F46E5] text-white text-sm font-semibold hover:bg-[#4338CA] inline-flex items-center gap-2">
            <Send className="size-4" /> Enviar invitación
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-yo-txt-2 font-medium">
        {label}{required && <span className="text-[#DC2626]"> *</span>}
      </span>
      {children}
    </label>
  );
}
