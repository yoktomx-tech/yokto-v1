import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type Comment = {
  id: string;
  author: string;
  role?: string;
  createdAt: string | Date;
  body: string;
  avatar?: string;
  own?: boolean;
};

type Props = {
  comments: Comment[];
  onSubmit?: (body: string) => void | Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  emptyLabel?: string;
  className?: string;
};

function relTime(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

export function CommentThread({
  comments,
  onSubmit,
  placeholder = "Escribe un comentario…",
  disabled,
  emptyLabel = "Aún no hay comentarios.",
  className,
}: Props) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!value.trim() || !onSubmit) return;
    setBusy(true);
    try {
      await onSubmit(value.trim());
      setValue("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {comments.length === 0 ? (
        <p className="text-xs text-yo-txt-3">{emptyLabel}</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => {
            const initials = c.author
              .split(/\s+/)
              .slice(0, 2)
              .map((s) => s[0])
              .join("")
              .toUpperCase();
            return (
              <li
                key={c.id}
                className={cn("flex gap-2.5", c.own && "flex-row-reverse")}
              >
                <div className="h-8 w-8 shrink-0 rounded-full bg-yo-ac-bg text-yo-ac-txt flex items-center justify-center text-[11px] font-semibold overflow-hidden">
                  {c.avatar ? (
                    <img src={c.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials || "?"
                  )}
                </div>
                <div className={cn("min-w-0 max-w-[80%]", c.own && "items-end text-right")}>
                  <div className="flex items-baseline gap-2 text-[11px] text-yo-txt-3">
                    <span className="font-medium text-yo-txt-2">{c.author}</span>
                    {c.role && <span>· {c.role}</span>}
                    <span>· {relTime(c.createdAt)}</span>
                  </div>
                  <div
                    className={cn(
                      "mt-1 rounded-lg px-3 py-2 text-sm leading-relaxed",
                      c.own
                        ? "bg-yo-ac text-white"
                        : "bg-yo-raised text-yo-txt border border-yo-border",
                    )}
                  >
                    {c.body}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {onSubmit && (
        <div className="flex items-end gap-2 pt-1">
          <Textarea
            rows={2}
            value={value}
            disabled={disabled || busy}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="resize-none text-sm"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => void send()}
            disabled={disabled || busy || !value.trim()}
            className="shrink-0"
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            Enviar
          </Button>
        </div>
      )}
    </div>
  );
}
