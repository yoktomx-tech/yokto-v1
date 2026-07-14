import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  uploadFiscalDocument,
  listFiscalDocuments,
  validateFiscalDocument,
  acceptFiscalDocument,
  rejectFiscalDocument,
  getEstadoParcialidades,
  getInstruccionesREP,
} from "@/lib/fiscal/fiscal.functions";

type FiscalDoc = {
  id: string;
  transaction_id: string;
  parent_cfdi_id: string | null;
  tipo: string;
  metodo_pago: string | null;
  forma_pago: string | null;
  uuid_fiscal: string;
  serie: string | null;
  folio: string | null;
  fecha_emision: string | null;
  fecha_timbrado: string | null;
  rfc_emisor: string | null;
  nombre_emisor: string | null;
  rfc_receptor: string | null;
  nombre_receptor: string | null;
  total: number | null;
  moneda: string | null;
  imp_pagado: number | null;
  parcialidad_numero: number | null;
  fecha_pago: string | null;
  estado: string;
  estado_sat: string | null;
  coherence_score: number | null;
  validation_errors: any;
  validation_warnings: any;
  ai_analysis: any;
  motivo_rechazo: string | null;
  aceptado_at: string | null;
  rechazado_at: string | null;
  uploaded_by: string;
  created_at: string;
};

interface Props {
  transactionId: string;
  canUpload: boolean;
  userId: string;
}

const ESTADO_BADGE: Record<string, string> = {
  SUBIDO: "border-yo-border text-foreground",
  VALIDANDO: "border-yo-border text-muted-foreground",
  VALIDADO: "bg-yokto-yellow border-yo-border text-foreground",
  ACEPTADO: "bg-yo-ac border-yo-ac text-yokto-cream",
  RECHAZADO: "bg-[#FF3B3B]/10 text-[#FF3B3B] border-[#FF3B3B]",
  CANCELADO_SAT: "bg-[#FF3B3B]/10 text-[#FF3B3B] border-[#FF3B3B]",
};

const SEMAFORO_DOT: Record<string, string> = {
  verde: "bg-emerald-500",
  amarillo: "bg-yellow-400",
  rojo: "bg-red-500",
};

function fmtMoney(v: number | null | undefined, cur: string | null | undefined) {
  const n = Number(v ?? 0);
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: cur ?? "MXN" }).format(n);
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function FiscalPanel({ transactionId, canUpload, userId }: Props) {
  const listFn = useServerFn(listFiscalDocuments);
  const uploadFn = useServerFn(uploadFiscalDocument);
  const validateFn = useServerFn(validateFiscalDocument);
  const acceptFn = useServerFn(acceptFiscalDocument);
  const rejectFn = useServerFn(rejectFiscalDocument);
  const parcialidadesFn = useServerFn(getEstadoParcialidades);
  const repInstrFn = useServerFn(getInstruccionesREP);

  const [docs, setDocs] = useState<FiscalDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [parcial, setParcial] = useState<Record<string, any>>({});
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectMsg, setRejectMsg] = useState("");
  const [instrFor, setInstrFor] = useState<string | null>(null);
  const [instr, setInstr] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      setLoading(true);
      const rows = (await listFn({ data: { transaction_id: transactionId } })) as any as FiscalDoc[];
      setDocs(rows);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando documentos fiscales");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel(`fiscal-${transactionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fiscal_documents", filter: `transaction_id=eq.${transactionId}` },
        () => refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId]);

  const ppds = useMemo(() => docs.filter((d) => d.tipo === "CFDI_PPD"), [docs]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    try {
      for (const file of Array.from(files)) {
        if (!file.name.toLowerCase().endsWith(".xml")) {
          setError(`${file.name}: sólo se aceptan archivos XML`);
          continue;
        }
        const xml_base64 = await fileToBase64(file);
        const created = (await uploadFn({
          data: { transaction_id: transactionId, file_name: file.name, xml_base64 },
        })) as any;
        // Auto-validar tras subir
        if (created?.id) {
          try {
            await validateFn({ data: { fiscal_document_id: created.id } });
          } catch {
            /* mostrar en refresh */
          }
        }
      }
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      setError(e?.message ?? "Error subiendo XML");
    }
  }

  async function handleValidate(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await validateFn({ data: { fiscal_document_id: id } });
    } catch (e: any) {
      setError(e?.message ?? "Error validando");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAccept(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await acceptFn({ data: { fiscal_document_id: id } });
    } catch (e: any) {
      setError(e?.message ?? "Error aceptando");
    } finally {
      setBusyId(null);
    }
  }

  async function submitReject() {
    if (!rejectFor) return;
    setBusyId(rejectFor);
    setError(null);
    try {
      await rejectFn({ data: { fiscal_document_id: rejectFor, motivo: rejectMsg } });
      setRejectFor(null);
      setRejectMsg("");
    } catch (e: any) {
      setError(e?.message ?? "Error rechazando");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleExpand(doc: FiscalDoc) {
    const next = new Set(expanded);
    if (next.has(doc.id)) {
      next.delete(doc.id);
    } else {
      next.add(doc.id);
      if (doc.tipo === "CFDI_PPD" && !parcial[doc.id]) {
        try {
          const p = await parcialidadesFn({ data: { cfdi_id: doc.id } });
          setParcial((prev) => ({ ...prev, [doc.id]: p }));
        } catch {
          /* ignore */
        }
      }
    }
    setExpanded(next);
  }

  async function openInstr(doc: FiscalDoc) {
    setInstrFor(doc.id);
    setInstr(null);
    try {
      const i = await repInstrFn({ data: { cfdi_id: doc.id } });
      setInstr(i);
    } catch (e: any) {
      setError(e?.message ?? "Error");
    }
  }

  return (
    <section className="space-y-6">
      {error && (
        <div role="alert" className="border border-[#FF3B3B] bg-[#FF3B3B]/10 text-[#FF3B3B] p-3 text-sm">
          {error}
        </div>
      )}

      {/* Header + upload */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-display text-2xl tracking-wide">Documentos fiscales</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Sube el XML del CFDI PPD o Complemento de Pago (REP) ya timbrado. YOKTO validará su coherencia contra la transacción.
          </p>
        </div>
        {canUpload && (
          <label className="inline-flex items-center gap-2 border border-yo-border bg-yokto-yellow px-4 py-2 text-[11px] uppercase tracking-[0.14em] cursor-pointer hover:opacity-90">
            <input
              ref={fileRef}
              type="file"
              accept=".xml,application/xml,text/xml"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            Subir XML
          </label>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {!loading && docs.length === 0 && (
        <div className="border border-dashed border-yo-border p-8 text-center text-sm text-muted-foreground">
          Sin documentos fiscales todavía.
        </div>
      )}

      {/* PPDs con progreso de parcialidades */}
      {ppds.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">CFDI PPD</h4>
          {ppds.map((doc) => {
            const p = parcial[doc.id];
            const pct = p?.total ? Math.min(100, Math.round((p.total_pagado / p.total) * 100)) : 0;
            return (
              <div key={doc.id} className="border border-yo-border bg-background">
                <div className="p-4 flex flex-wrap items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] uppercase tracking-[0.14em] border border-yo-border px-1.5 py-0.5">PPD</span>
                      <span className={`text-[11px] uppercase tracking-[0.14em] border px-1.5 py-0.5 ${ESTADO_BADGE[doc.estado] ?? "border-yo-border"}`}>
                        {doc.estado}
                      </span>
                      {doc.estado_sat && (
                        <span className="text-[11px] uppercase tracking-[0.14em] border border-yo-border px-1.5 py-0.5">
                          SAT · {doc.estado_sat}
                        </span>
                      )}
                      {doc.ai_analysis?.semaforo && (
                        <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] border border-yo-border px-1.5 py-0.5">
                          <span className={`size-2 rounded-full ${SEMAFORO_DOT[doc.ai_analysis.semaforo] ?? "bg-muted"}`} />
                          IA
                        </span>
                      )}
                    </div>
                    <p className="mt-2 font-mono text-xs break-all">{doc.uuid_fiscal}</p>
                    <p className="mt-1 text-sm">
                      {doc.nombre_emisor ?? doc.rfc_emisor} → {doc.nombre_receptor ?? doc.rfc_receptor}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Total {fmtMoney(doc.total, doc.moneda)} · Emitido{" "}
                      {doc.fecha_emision ? new Date(doc.fecha_emision).toLocaleDateString("es-MX") : "—"}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => toggleExpand(doc)} className="text-[11px] uppercase tracking-[0.14em] border border-yo-border px-2 py-1 hover:bg-yo-bg">
                      {expanded.has(doc.id) ? "Ocultar" : "Detalles"}
                    </button>
                    {doc.estado === "SUBIDO" && (
                      <button disabled={busyId === doc.id} onClick={() => handleValidate(doc.id)} className="text-[11px] uppercase tracking-[0.14em] border border-yo-border px-2 py-1 hover:bg-yo-bg disabled:opacity-50">
                        Validar
                      </button>
                    )}
                    {doc.estado === "VALIDADO" && (
                      <>
                        <button disabled={busyId === doc.id} onClick={() => handleAccept(doc.id)} className="text-[11px] uppercase tracking-[0.14em] border border-yo-border bg-yo-ac text-yokto-cream px-2 py-1 hover:opacity-90 disabled:opacity-50">
                          Aceptar
                        </button>
                        <button disabled={busyId === doc.id} onClick={() => setRejectFor(doc.id)} className="text-[11px] uppercase tracking-[0.14em] border border-[#FF3B3B] text-[#FF3B3B] px-2 py-1 hover:bg-[#FF3B3B]/10 disabled:opacity-50">
                          Rechazar
                        </button>
                      </>
                    )}
                    {doc.estado === "ACEPTADO" && canUpload && (
                      <button onClick={() => openInstr(doc)} className="text-[11px] uppercase tracking-[0.14em] border border-yo-border px-2 py-1 hover:bg-yo-bg">
                        Instrucciones REP
                      </button>
                    )}
                  </div>
                </div>

                {/* Progreso parcialidades */}
                <div className="px-4 pb-3">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-1">
                    <span>Pagado {p ? fmtMoney(p.total_pagado, doc.moneda) : "—"}</span>
                    <span>Saldo {p ? fmtMoney(p.saldo_insoluto, doc.moneda) : "—"}</span>
                  </div>
                  <div className="h-1.5 bg-yo-bg border border-yo-border">
                    <div className="h-full bg-yo-ac transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {expanded.has(doc.id) && <DocDetail doc={doc} parcialidades={p} allDocs={docs} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Otros documentos: REPs sin padre, PUE, etc. */}
      {docs.filter((d) => d.tipo !== "CFDI_PPD" && !d.parent_cfdi_id).length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Otros documentos</h4>
          {docs
            .filter((d) => d.tipo !== "CFDI_PPD" && !d.parent_cfdi_id)
            .map((doc) => (
              <DocRow
                key={doc.id}
                doc={doc}
                busyId={busyId}
                expanded={expanded.has(doc.id)}
                onExpand={() => toggleExpand(doc)}
                onValidate={() => handleValidate(doc.id)}
                onAccept={() => handleAccept(doc.id)}
                onReject={() => setRejectFor(doc.id)}
                allDocs={docs}
              />
            ))}
        </div>
      )}

      {/* Modal rechazo */}
      {rejectFor && (
        <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={() => setRejectFor(null)}>
          <div className="bg-background border border-yo-border p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-display text-xl mb-3">Rechazar documento</h4>
            <textarea
              value={rejectMsg}
              onChange={(e) => setRejectMsg(e.target.value)}
              className="w-full min-h-[120px] border border-yo-border bg-background p-3 text-sm"
              placeholder="Explica el motivo del rechazo (será enviado al emisor)…"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setRejectFor(null)} className="text-[11px] uppercase tracking-[0.14em] border border-yo-border px-3 py-2">Cancelar</button>
              <button disabled={rejectMsg.trim().length < 5 || busyId === rejectFor} onClick={submitReject} className="text-[11px] uppercase tracking-[0.14em] border border-[#FF3B3B] bg-[#FF3B3B] text-white px-3 py-2 disabled:opacity-50">
                Confirmar rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal instrucciones REP */}
      {instrFor && (
        <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={() => { setInstrFor(null); setInstr(null); }}>
          <div className="bg-background border border-yo-border p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-display text-xl mb-3">Cómo emitir el próximo REP</h4>
            {!instr && <p className="text-sm text-muted-foreground">Generando…</p>}
            {instr && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Parcialidad:</span> {instr.parcialidad_numero}</div>
                  <div><span className="text-muted-foreground">Saldo anterior:</span> {fmtMoney(instr.imp_saldo_ant, instr.moneda)}</div>
                  <div className="col-span-2 font-mono break-all"><span className="text-muted-foreground">UUID padre:</span> {instr.uuid_padre}</div>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-xs text-foreground">
                  {(instr.instrucciones ?? []).map((s: string, i: number) => <li key={i}>{s}</li>)}
                </ol>
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button onClick={() => { setInstrFor(null); setInstr(null); }} className="text-[11px] uppercase tracking-[0.14em] border border-yo-border px-3 py-2">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function DocRow({
  doc,
  busyId,
  expanded,
  onExpand,
  onValidate,
  onAccept,
  onReject,
  allDocs,
}: {
  doc: FiscalDoc;
  busyId: string | null;
  expanded: boolean;
  onExpand: () => void;
  onValidate: () => void;
  onAccept: () => void;
  onReject: () => void;
  allDocs: FiscalDoc[];
}) {
  return (
    <div className="border border-yo-border bg-background">
      <div className="p-4 flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-[0.14em] border border-yo-border px-1.5 py-0.5">{doc.tipo}</span>
            <span className={`text-[11px] uppercase tracking-[0.14em] border px-1.5 py-0.5 ${ESTADO_BADGE[doc.estado] ?? "border-yo-border"}`}>{doc.estado}</span>
            {doc.estado_sat && <span className="text-[11px] uppercase tracking-[0.14em] border border-yo-border px-1.5 py-0.5">SAT · {doc.estado_sat}</span>}
          </div>
          <p className="mt-2 font-mono text-xs break-all">{doc.uuid_fiscal}</p>
          <p className="text-xs text-muted-foreground">Total {fmtMoney(doc.total, doc.moneda)}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={onExpand} className="text-[11px] uppercase tracking-[0.14em] border border-yo-border px-2 py-1 hover:bg-yo-bg">
            {expanded ? "Ocultar" : "Detalles"}
          </button>
          {doc.estado === "SUBIDO" && (
            <button disabled={busyId === doc.id} onClick={onValidate} className="text-[11px] uppercase tracking-[0.14em] border border-yo-border px-2 py-1 hover:bg-yo-bg disabled:opacity-50">Validar</button>
          )}
          {doc.estado === "VALIDADO" && (
            <>
              <button disabled={busyId === doc.id} onClick={onAccept} className="text-[11px] uppercase tracking-[0.14em] border border-yo-border bg-yo-ac text-yokto-cream px-2 py-1 hover:opacity-90 disabled:opacity-50">Aceptar</button>
              <button disabled={busyId === doc.id} onClick={onReject} className="text-[11px] uppercase tracking-[0.14em] border border-[#FF3B3B] text-[#FF3B3B] px-2 py-1 hover:bg-[#FF3B3B]/10 disabled:opacity-50">Rechazar</button>
            </>
          )}
        </div>
      </div>
      {expanded && <DocDetail doc={doc} allDocs={allDocs} />}
    </div>
  );
}

function DocDetail({ doc, parcialidades, allDocs }: { doc: FiscalDoc; parcialidades?: any; allDocs: FiscalDoc[] }) {
  const errs: any[] = Array.isArray(doc.validation_errors) ? doc.validation_errors : [];
  const warns: any[] = Array.isArray(doc.validation_warnings) ? doc.validation_warnings : [];
  const reps = allDocs.filter((d) => d.parent_cfdi_id === doc.id).sort((a, b) => (a.parcialidad_numero ?? 0) - (b.parcialidad_numero ?? 0));
  return (
    <div className="border-t border-yo-border p-4 space-y-4 bg-yo-bg/30">
      {/* AI */}
      {doc.ai_analysis && !doc.ai_analysis.error && (
        <div className="border border-yo-border bg-background p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className={`size-2 rounded-full ${SEMAFORO_DOT[doc.ai_analysis.semaforo] ?? "bg-muted"}`} />
            <span className="text-[11px] uppercase tracking-[0.14em]">Análisis IA · {doc.ai_analysis.recomendacion}</span>
          </div>
          <p className="text-xs text-foreground">{doc.ai_analysis.resumen}</p>
          {doc.ai_analysis.puntos_atencion?.length > 0 && (
            <ul className="mt-2 list-disc list-inside text-xs text-muted-foreground space-y-0.5">
              {doc.ai_analysis.puntos_atencion.map((p: string, i: number) => <li key={i}>{p}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Coherencia */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-1">Score de coherencia</p>
          <p className="font-display text-2xl">{doc.coherence_score ?? "—"}<span className="text-sm text-muted-foreground">/100</span></p>
        </div>
        <div className="space-y-1 text-xs">
          {errs.length === 0 && warns.length === 0 && (
            <p className="text-muted-foreground">Sin observaciones.</p>
          )}
          {errs.map((c, i) => (
            <p key={`e${i}`} className="text-[#FF3B3B]">✗ {c.message}</p>
          ))}
          {warns.map((c, i) => (
            <p key={`w${i}`} className="text-yellow-600">! {c.message}</p>
          ))}
        </div>
      </div>

      {/* Datos clave */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <Meta label="Serie/Folio" v={[doc.serie, doc.folio].filter(Boolean).join("-") || "—"} />
        <Meta label="Método pago" v={doc.metodo_pago ?? "—"} />
        <Meta label="Forma pago" v={doc.forma_pago ?? "—"} />
        <Meta label="Timbrado" v={doc.fecha_timbrado ? new Date(doc.fecha_timbrado).toLocaleString("es-MX") : "—"} />
        <Meta label="Emisor" v={`${doc.rfc_emisor ?? "—"}`} />
        <Meta label="Receptor" v={`${doc.rfc_receptor ?? "—"}`} />
        {doc.parcialidad_numero != null && <Meta label="Parcialidad" v={String(doc.parcialidad_numero)} />}
        {doc.imp_pagado != null && <Meta label="Pagado" v={fmtMoney(doc.imp_pagado, doc.moneda)} />}
      </div>

      {/* REPs hijos */}
      {reps.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-2">Complementos de pago recibidos</p>
          <div className="border border-yo-border divide-y divide-yo-border">
            {reps.map((r) => (
              <div key={r.id} className="p-2 flex items-center justify-between text-xs">
                <div>
                  <span className="font-mono">P{r.parcialidad_numero}</span> · {r.fecha_pago ? new Date(r.fecha_pago).toLocaleDateString("es-MX") : "—"} · {fmtMoney(r.imp_pagado, r.moneda)}
                </div>
                <span className={`uppercase tracking-[0.14em] border px-1.5 py-0.5 ${ESTADO_BADGE[r.estado] ?? "border-yo-border"}`}>{r.estado}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {doc.estado === "RECHAZADO" && doc.motivo_rechazo && (
        <div className="border border-[#FF3B3B] bg-[#FF3B3B]/10 p-3 text-xs text-[#FF3B3B]">
          <strong>Motivo de rechazo:</strong> {doc.motivo_rechazo}
        </div>
      )}
    </div>
  );
}

function Meta({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="text-foreground break-words">{v}</p>
    </div>
  );
}
