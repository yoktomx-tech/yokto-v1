import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Clock, CheckCircle2, XCircle, ArrowRight, RefreshCw, Loader2 } from "lucide-react";
import { getKycStatus, listOwnKycDocuments } from "@/lib/onboarding.functions";

export const Route = createFileRoute("/_authenticated/onboarding/pendiente")({
  head: () => ({
    meta: [
      { title: "Verificación en curso — CUMPLEX" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PendingPage,
});

const LABELS: Record<string, string> = {
  ine_frente: "INE — Frente",
  ine_reverso: "INE — Reverso",
  passport: "Pasaporte",
  selfie_con_id: "Selfie con ID",
  acta_constitutiva: "Acta constitutiva",
  poder_notarial: "Poder notarial",
  cedula_fiscal: "Cédula fiscal",
  constancia_fiscal: "Constancia fiscal",
  proof_of_address: "Comprobante de domicilio",
  other: "Otro",
};

function PendingPage() {
  const navigate = useNavigate();
  const getStatus = useServerFn(getKycStatus);
  const listDocs = useServerFn(listOwnKycDocuments);
  const [status, setStatus] = useState<Awaited<ReturnType<typeof getKycStatus>> | null>(null);
  const [docs, setDocs] = useState<Array<{ id: string; document_type: string; status: string; file_name: string | null; rejection_reason: string | null }>>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const s = await getStatus();
        if (!mounted) return;
        setStatus(s);
        if (s?.kyc_status === "approved") { navigate({ to: "/dashboard" }); return; }
        const d = await listDocs();
        if (mounted) setDocs(d as typeof docs);
      } catch {/* ignore */}
    }
    void load();
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => { mounted = false; clearInterval(id); };
  }, [tick, getStatus, listDocs, navigate]);

  const rejected = status?.kyc_status === "rejected";
  const inReview = status?.kyc_status === "in_review";

  return (
    <div className="min-h-dvh bg-yo-bg text-yo-txt">
      <main className="mx-auto max-w-2xl px-5 py-14">
        <div className="rounded-2xl bg-yo-surface border border-yo-border shadow-sm p-8">
          <div className={"grid place-items-center size-14 rounded-full mb-5 " +
            (rejected ? "bg-yo-err-bg text-yo-err" : "bg-yo-ac-bg text-yo-ac")}>
            {rejected ? <XCircle className="size-7" /> : <Clock className="size-7 animate-pulse" />}
          </div>

          {inReview && (
            <>
              <h1 className="text-2xl font-bold tracking-tight">Estamos verificando tu identidad</h1>
              <p className="mt-2 text-sm text-yo-txt-2">
                Tu solicitud está en revisión. Tiempo estimado: <strong>2 a 24 horas hábiles</strong>. Te notificaremos por correo cuando esté lista.
              </p>
            </>
          )}
          {rejected && (
            <>
              <h1 className="text-2xl font-bold tracking-tight">Tu verificación requiere ajustes</h1>
              {status?.kyc_rejection_reason && (
                <p className="mt-2 text-sm text-yo-err bg-yo-err-bg border border-yo-err/20 rounded-md px-3 py-2">
                  {status.kyc_rejection_reason}
                </p>
              )}
            </>
          )}
          {!inReview && !rejected && status?.kyc_status === "approved" && (
            <>
              <h1 className="text-2xl font-bold tracking-tight">Todo listo</h1>
              <p className="mt-2 text-sm text-yo-txt-2">Tu cuenta está verificada. Redirigiendo al dashboard…</p>
            </>
          )}

          <div className="mt-6">
            <p className="text-xs uppercase tracking-widest font-semibold text-yo-txt-2 mb-2">Documentos entregados</p>
            <ul className="divide-y divide-yo-border rounded-md border border-yo-border overflow-hidden">
              {docs.length === 0 && <li className="p-3 text-sm text-yo-txt-3">Sin documentos</li>}
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="text-yo-txt">{LABELS[d.document_type] ?? d.document_type}</span>
                  <StatusBadge status={d.status} />
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => setTick((t) => t + 1)}
              className="inline-flex items-center gap-1.5 text-sm text-yo-txt-2 hover:text-yo-txt">
              <RefreshCw className="size-4" /> Actualizar
            </button>
            {rejected && (
              <Link to="/onboarding" className="inline-flex items-center gap-1.5 text-sm font-semibold text-yo-ac hover:text-yo-ac-h">
                Corregir documentos <ArrowRight className="size-4" />
              </Link>
            )}
            <Link to="/dashboard" className="ml-auto inline-flex items-center gap-1.5 text-sm text-yo-txt-2 hover:text-yo-txt">
              Ir al dashboard <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-yo-txt-3">
          Esta página se actualiza automáticamente cada 30 segundos.
        </p>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { c: string; label: string }> = {
    pending:   { c: "bg-yo-warn-bg text-yo-warn", label: "En espera" },
    in_review: { c: "bg-yo-ac-bg text-yo-ac-txt", label: "En revisión" },
    approved:  { c: "bg-yo-ok-bg text-yo-ok",     label: "Aprobado" },
    rejected:  { c: "bg-yo-err-bg text-yo-err",   label: "Rechazado" },
  };
  const s = map[status] ?? map.pending;
  return <span className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold " + s.c}>
    {status === "approved" && <CheckCircle2 className="size-3" />}
    {s.label}
  </span>;
}
