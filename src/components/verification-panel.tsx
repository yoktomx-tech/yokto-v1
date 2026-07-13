import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Sparkles, ShieldCheck, ShieldAlert, ShieldX, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { analyzeEvidence } from "@/lib/verification.functions";

type Evidence = {
  id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  note: string | null;
  ai_provider: string | null;
  ai_verdict: "approve" | "review" | "reject" | null;
  ai_score: number | null;
  ai_summary: string | null;
  analyzed_at: string | null;
  created_at: string;
  uploaded_by: string;
};

const VERDICT_META: Record<string, { label: string; cls: string; Icon: typeof ShieldCheck }> = {
  approve: { label: "Recomendado aprobar", cls: "bg-emerald-50 text-emerald-800 border-emerald-200", Icon: ShieldCheck },
  review:  { label: "Requiere revisión",   cls: "bg-amber-50 text-amber-800 border-amber-200",       Icon: ShieldAlert },
  reject:  { label: "Recomendado rechazar", cls: "bg-red-50 text-red-800 border-red-200",             Icon: ShieldX },
};

export function VerificationPanel({ transactionId, canUpload }: { transactionId: string; canUpload: boolean }) {
  const [items, setItems] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [provider, setProvider] = useState<"gemini" | "openai">("gemini");
  const analyzeFn = useServerFn(analyzeEvidence);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("verification_evidence")
      .select("*")
      .eq("transaction_id", transactionId)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Evidence[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [transactionId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) throw new Error("Sesión expirada");
      const path = `${transactionId}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("verification-evidence")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("verification_evidence").insert({
        transaction_id: transactionId, uploaded_by: uid, file_path: path,
        file_name: file.name, mime_type: file.type, size_bytes: file.size,
        note: note.trim() || null,
      });
      if (insErr) throw insErr;
      setNote("");
      e.target.value = "";
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function analyze(id: string) {
    setAnalyzingId(id); setError(null);
    try {
      await analyzeFn({ data: { evidenceId: id, provider } });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAnalyzingId(null);
    }
  }

  return (
    <section className="rounded-lg border border-yo-border bg-yo-surface p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-yo-txt flex items-center gap-2">
            <Sparkles className="size-4 text-yo-ac" /> Verificación IA de cumplimiento
          </h3>
          <p className="text-xs text-yo-txt-3 mt-0.5">
            Sube evidencia (fotos, PDF, comprobantes) y pide un análisis con ChatGPT o Gemini.
          </p>
        </div>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as "gemini" | "openai")}
          className="text-xs h-8 rounded-md border border-yo-border bg-background px-2"
        >
          <option value="gemini">Google Gemini</option>
          <option value="openai">OpenAI GPT</option>
        </select>
      </div>

      {canUpload && (
        <div className="flex flex-col gap-2 rounded-md border border-dashed border-yo-border p-3 mb-4">
          <input
            type="text" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Nota breve sobre esta evidencia (opcional)"
            className="h-9 rounded-md border border-yo-border bg-background px-3 text-sm"
          />
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <span className="inline-flex items-center gap-2 rounded-md border border-yo-border bg-background px-3 h-9 hover:bg-yo-hover">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploading ? "Subiendo…" : "Subir archivo"}
            </span>
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading}
              accept="image/*,application/pdf" />
            <span className="text-xs text-yo-txt-3">Imágenes o PDF, hasta 10 MB</span>
          </label>
        </div>
      )}

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-3">{error}</div>}

      {loading ? (
        <p className="text-sm text-yo-txt-3">Cargando evidencia…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-yo-txt-3">Aún no hay evidencia registrada.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((it) => {
            const meta = it.ai_verdict ? VERDICT_META[it.ai_verdict] : null;
            const Icon = meta?.Icon;
            return (
              <li key={it.id} className="rounded-md border border-yo-border p-3 bg-background">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{it.file_name}</div>
                    <div className="text-xs text-yo-txt-3">
                      {it.mime_type ?? "?"} · {it.size_bytes ? `${Math.round(it.size_bytes / 1024)} KB` : ""} ·{" "}
                      {new Date(it.created_at).toLocaleString("es-MX")}
                    </div>
                    {it.note && <div className="text-xs mt-1 text-yo-txt-2">"{it.note}"</div>}
                  </div>
                  <button
                    onClick={() => analyze(it.id)}
                    disabled={analyzingId === it.id}
                    className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-yo-border bg-yo-surface hover:bg-yo-hover text-xs font-medium"
                  >
                    {analyzingId === it.id ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                    {it.ai_verdict ? "Re-analizar" : "Analizar con IA"}
                  </button>
                </div>
                {meta && Icon && (
                  <div className={`mt-3 rounded-md border px-3 py-2 text-xs ${meta.cls}`}>
                    <div className="flex items-center gap-1.5 font-semibold">
                      <Icon className="size-3.5" /> {meta.label} · score {it.ai_score}/100
                      <span className="ml-auto opacity-70">{it.ai_provider}</span>
                    </div>
                    {it.ai_summary && <p className="mt-1 leading-relaxed">{it.ai_summary}</p>}
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
