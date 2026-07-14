import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Upload, FileText, ShieldCheck, ShieldAlert, Loader2, Download, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { validateCfdiDocument } from "@/lib/tx-documents.functions";

type DocType = "CONTRATO" | "CFDI" | "COMPROBANTE_PAGO" | "GARANTIA" | "ACTA_ENTREGA" | "OTRO";

type Doc = {
  id: string;
  transaction_id: string;
  uploaded_by: string;
  doc_type: DocType;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  note: string | null;
  cfdi_uuid: string | null;
  cfdi_rfc_emisor: string | null;
  cfdi_rfc_receptor: string | null;
  cfdi_total_cents: number | null;
  cfdi_fecha: string | null;
  sat_status: "valid" | "invalid" | "cancelled" | "not_verified" | "error" | null;
  sat_message: string | null;
  validated_at: string | null;
  created_at: string;
};

const DOC_TYPE_LABEL: Record<DocType, string> = {
  CONTRATO: "Contrato",
  CFDI: "CFDI (Factura)",
  COMPROBANTE_PAGO: "Comprobante de pago",
  GARANTIA: "Garantía",
  ACTA_ENTREGA: "Acta de entrega",
  OTRO: "Otro",
};

const SAT_META: Record<string, { label: string; cls: string }> = {
  valid: { label: "SAT válido", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  not_verified: { label: "Parseado — SAT pendiente", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  invalid: { label: "SAT inválido", cls: "bg-red-50 text-red-800 border-red-200" },
  cancelled: { label: "Cancelado en SAT", cls: "bg-red-50 text-red-800 border-red-200" },
  error: { label: "Error al parsear", cls: "bg-red-50 text-red-800 border-red-200" },
};

export function DocumentsPanel({ transactionId, canUpload, userId }: { transactionId: string; canUpload: boolean; userId: string }) {
  const [items, setItems] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<DocType>("CONTRATO");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const validateFn = useServerFn(validateCfdiDocument);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("transaction_documents")
      .select("*")
      .eq("transaction_id", transactionId)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Doc[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [transactionId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { setError("Archivo mayor a 20 MB"); return; }
    setUploading(true); setError(null);
    try {
      const path = `${transactionId}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("transaction-documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: inserted, error: insErr } = await supabase
        .from("transaction_documents").insert({
          transaction_id: transactionId, uploaded_by: userId, doc_type: docType,
          file_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size,
          note: note.trim() || null,
        }).select().single();
      if (insErr) throw insErr;
      setNote(""); e.target.value = "";
      await load();
      // Auto-validate CFDI XML
      if (docType === "CFDI" && (file.name.toLowerCase().endsWith(".xml") || file.type.includes("xml"))) {
        setValidatingId(inserted.id);
        try { await validateFn({ data: { documentId: inserted.id } }); } catch { /* noop */ }
        setValidatingId(null);
        await load();
      }
    } catch (err) { setError((err as Error).message); }
    finally { setUploading(false); }
  }

  async function download(doc: Doc) {
    const { data, error: err } = await supabase.storage
      .from("transaction-documents").createSignedUrl(doc.file_path, 60);
    if (err || !data) { setError(err?.message ?? "No se pudo generar el enlace"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function validate(id: string) {
    setValidatingId(id); setError(null);
    try { await validateFn({ data: { documentId: id } }); await load(); }
    catch (err) { setError((err as Error).message); }
    finally { setValidatingId(null); }
  }

  async function remove(doc: Doc) {
    if (!confirm(`¿Eliminar "${doc.file_name}"?`)) return;
    setError(null);
    await supabase.storage.from("transaction-documents").remove([doc.file_path]);
    await supabase.from("transaction_documents").delete().eq("id", doc.id);
    await load();
  }

  return (
    <section className="border border-yo-border bg-background p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display text-2xl tracking-wide flex items-center gap-2">
            <FileText className="size-5" /> Documentos
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Contratos, facturas (CFDI XML), comprobantes de pago y actas. XMLs de CFDI se parsean automáticamente.
          </p>
        </div>
      </div>

      {canUpload && (
        <div className="flex flex-col gap-2 border border-dashed border-yo-border p-3 mb-4">
          <div className="flex flex-wrap gap-2">
            <label className="flex-1 min-w-40 text-sm">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Tipo</span>
              <select value={docType} onChange={(e) => setDocType(e.target.value as DocType)}
                className="input-editorial w-full mt-1">
                {(Object.keys(DOC_TYPE_LABEL) as DocType[]).map(k => <option key={k} value={k}>{DOC_TYPE_LABEL[k]}</option>)}
              </select>
            </label>
            <label className="flex-[2] min-w-60 text-sm">
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Nota (opcional)</span>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200}
                className="input-editorial w-full mt-1" />
            </label>
          </div>
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer mt-2">
            <span className="inline-flex items-center gap-2 border border-yo-border bg-background px-3 h-9 hover:bg-yo-hover">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploading ? "Subiendo…" : "Subir archivo"}
            </span>
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading}
              accept=".pdf,.xml,.jpg,.jpeg,.png,.webp,application/pdf,text/xml,application/xml,image/*" />
            <span className="text-xs text-muted-foreground">PDF, XML (CFDI), imágenes — hasta 20 MB</span>
          </label>
        </div>
      )}

      {error && <div className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-3">{error}</div>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando documentos…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay documentos.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((d) => {
            const sat = d.sat_status ? SAT_META[d.sat_status] : null;
            const isCfdi = d.doc_type === "CFDI";
            const canValidate = isCfdi && (d.file_name.toLowerCase().endsWith(".xml") || (d.mime_type ?? "").includes("xml"));
            return (
              <li key={d.id} className="border border-yo-border p-3 bg-background">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] uppercase tracking-[0.14em] border border-yo-border px-1.5 py-0.5">{DOC_TYPE_LABEL[d.doc_type]}</span>
                      <span className="text-sm font-medium truncate">{d.file_name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {d.mime_type ?? "?"} · {d.size_bytes ? `${Math.round(d.size_bytes / 1024)} KB` : ""} · {new Date(d.created_at).toLocaleString("es-MX")}
                    </div>
                    {d.note && <div className="text-xs mt-1 italic">"{d.note}"</div>}
                    {isCfdi && d.cfdi_uuid && (
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div><span className="text-muted-foreground">UUID:</span> <span className="font-mono text-[10px]">{d.cfdi_uuid}</span></div>
                        <div><span className="text-muted-foreground">Emisor:</span> {d.cfdi_rfc_emisor}</div>
                        <div><span className="text-muted-foreground">Receptor:</span> {d.cfdi_rfc_receptor}</div>
                        <div><span className="text-muted-foreground">Total:</span> {d.cfdi_total_cents != null ? `$${(d.cfdi_total_cents / 100).toFixed(2)}` : "—"}</div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canValidate && (
                      <button onClick={() => validate(d.id)} disabled={validatingId === d.id}
                        className="inline-flex items-center gap-1 h-8 px-2 border border-yo-border text-xs hover:bg-yo-hover">
                        {validatingId === d.id ? <Loader2 className="size-3 animate-spin" /> : <ShieldCheck className="size-3" />}
                        Validar
                      </button>
                    )}
                    <button onClick={() => download(d)} className="inline-flex items-center gap-1 h-8 px-2 border border-yo-border text-xs hover:bg-yo-hover">
                      <Download className="size-3" /> Ver
                    </button>
                    {d.uploaded_by === userId && (
                      <button onClick={() => remove(d)} className="inline-flex items-center gap-1 h-8 px-2 border border-red-300 text-red-600 text-xs hover:bg-red-50">
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
                {sat && (
                  <div className={`mt-2 border px-3 py-2 text-xs ${sat.cls} flex items-center gap-2`}>
                    {d.sat_status === "valid" ? <ShieldCheck className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
                    <span className="font-semibold">{sat.label}</span>
                    {d.sat_message && <span className="opacity-80">— {d.sat_message}</span>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
