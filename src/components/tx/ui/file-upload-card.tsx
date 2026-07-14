import { useCallback, useRef, useState, type DragEvent, type ReactNode } from "react";
import { UploadCloud, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  label?: ReactNode;
  hint?: ReactNode;
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  onFiles: (files: File[]) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
};

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUploadCard({
  label = "Arrastra archivos aquí o haz clic para seleccionar",
  hint,
  accept,
  multiple = true,
  maxSizeMB = 20,
  onFiles,
  disabled,
  className,
}: Props) {
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<File[]>([]);
  const input = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    async (list: FileList | null) => {
      if (!list) return;
      const arr = Array.from(list);
      const max = maxSizeMB * 1024 * 1024;
      const bad = arr.find((f) => f.size > max);
      if (bad) {
        setError(`El archivo "${bad.name}" supera ${maxSizeMB}MB`);
        return;
      }
      setError(null);
      setQueue(arr);
      await onFiles(arr);
    },
    [maxSizeMB, onFiles],
  );

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (disabled) return;
    void handle(e.dataTransfer.files);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={cn(
          "w-full rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
          "flex flex-col items-center justify-center gap-2",
          drag
            ? "border-yo-ac bg-yo-ac-bg"
            : "border-yo-border bg-yo-surface hover:border-yo-border-s hover:bg-yo-raised",
          disabled && "opacity-60 cursor-not-allowed",
        )}
      >
        <UploadCloud className={cn("h-6 w-6", drag ? "text-yo-ac" : "text-yo-txt-3")} />
        <div className="text-sm text-yo-txt font-medium">{label}</div>
        {hint && <div className="text-xs text-yo-txt-3">{hint}</div>}
        <input
          ref={input}
          type="file"
          hidden
          accept={accept}
          multiple={multiple}
          onChange={(e) => void handle(e.target.files)}
        />
      </button>
      {error && <div className="text-xs text-[color:var(--yo-err)]">{error}</div>}
      {queue.length > 0 && (
        <ul className="space-y-1.5">
          {queue.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-2 rounded-md border border-yo-border bg-yo-raised px-2.5 py-1.5 text-xs"
            >
              <FileText className="h-3.5 w-3.5 text-yo-txt-3 shrink-0" />
              <span className="truncate flex-1 text-yo-txt">{f.name}</span>
              <span className="font-mono text-yo-txt-3">{fmtSize(f.size)}</span>
              <button
                type="button"
                onClick={() => setQueue((q) => q.filter((_, j) => j !== i))}
                className="text-yo-txt-3 hover:text-yo-txt"
                aria-label="Quitar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
