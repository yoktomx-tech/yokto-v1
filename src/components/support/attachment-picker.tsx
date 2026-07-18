import { useRef, useState } from "react";
import { Paperclip, X, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createAttachmentUploadUrl } from "@/lib/support.functions";
import { supabase } from "@/integrations/supabase/client";

export type PendingAttachment = { id: string; name: string; size: number };

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 5;
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.xml,.json,.xlsx,.docx";

export function AttachmentPicker({
  ticketId,
  value,
  onChange,
}: {
  ticketId: string;
  value: PendingAttachment[];
  onChange: (next: PendingAttachment[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const signFn = useServerFn(createAttachmentUploadUrl);

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setErr(null); setBusy(true);
    try {
      const remaining = MAX_FILES - value.length;
      const arr = Array.from(files).slice(0, Math.max(0, remaining));
      const added: PendingAttachment[] = [];
      for (const f of arr) {
        if (f.size > MAX_BYTES) throw new Error(`"${f.name}" excede 15 MB.`);
        const sig = await signFn({ data: { ticketId, fileName: f.name, mimeType: f.type || "application/octet-stream", sizeBytes: f.size } });
        const { error } = await supabase.storage.from("support-attachments").uploadToSignedUrl(sig.path, sig.token, f, {
          contentType: f.type || "application/octet-stream",
        });
        if (error) throw error;
        added.push({ id: sig.attachmentId, name: f.name, size: f.size });
      }
      onChange([...value, ...added]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy || value.length >= MAX_FILES}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-yo-border bg-white text-xs hover:bg-yo-raised disabled:opacity-40">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
          Adjuntar archivo
        </button>
        <span className="text-[11px] text-yo-txt-3">Máx. {MAX_FILES} archivos · 15 MB c/u · PDF, imágenes, Office, XML/CSV/JSON</span>
      </div>
      <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden"
        onChange={(e) => pick(e.target.files)} />
      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((a) => (
            <li key={a.id} className="flex items-center justify-between text-xs bg-yo-bg border border-yo-border rounded px-2 py-1">
              <span className="truncate">{a.name} <span className="text-yo-txt-3">· {(a.size/1024).toFixed(0)} KB</span></span>
              <button type="button" onClick={() => onChange(value.filter((x) => x.id !== a.id))}
                className="text-yo-txt-3 hover:text-yo-err"><X className="size-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      {err && <p className="text-[11px] text-yo-err">{err}</p>}
    </div>
  );
}
