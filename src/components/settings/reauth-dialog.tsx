import { useState } from "react";
import { Lock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/use-auth-user";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirmed: () => void | Promise<void>;
  title?: string;
  description?: string;
  requireText?: string;
};

export function ReauthDialog({
  open, onClose, onConfirmed,
  title = "Confirma tu identidad",
  description = "Ingresa tu contraseña para continuar con esta acción sensible.",
  requireText,
}: Props) {
  const { email } = useAuthUser();
  const [pwd, setPwd] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (requireText && text !== requireText) {
      toast.error(`Escribe exactamente "${requireText}"`);
      return;
    }
    if (!email) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    setBusy(false);
    if (error) {
      toast.error("Contraseña incorrecta");
      return;
    }
    await onConfirmed();
    setPwd(""); setText("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg bg-yo-surface border border-yo-border shadow-xl">
        <header className="flex items-center justify-between px-5 py-4 border-b border-yo-border">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-yo-ac" />
            <h3 className="text-[15px] font-semibold">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-yo-txt-3 hover:text-yo-txt">
            <X className="size-4" />
          </button>
        </header>
        <div className="p-5 space-y-4">
          <p className="text-[13px] text-yo-txt-2">{description}</p>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-yo-txt-3">Contraseña</label>
            <input
              type="password" autoFocus required
              value={pwd} onChange={(e) => setPwd(e.target.value)}
              className="mt-1 w-full h-10 rounded-md border border-yo-border bg-background px-3 text-sm"
            />
          </div>
          {requireText && (
            <div>
              <label className="text-[11px] uppercase tracking-wider text-yo-txt-3">
                Escribe <span className="font-mono text-red-600">{requireText}</span> para confirmar
              </label>
              <input
                required
                value={text} onChange={(e) => setText(e.target.value)}
                className="mt-1 w-full h-10 rounded-md border border-yo-border bg-background px-3 text-sm font-mono"
              />
            </div>
          )}
        </div>
        <footer className="flex justify-end gap-2 px-5 py-4 border-t border-yo-border bg-yo-raised/40 rounded-b-lg">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-md border border-yo-border text-sm">
            Cancelar
          </button>
          <button type="submit" disabled={busy}
            className="h-9 px-4 rounded-md bg-yo-ac text-white text-sm font-medium disabled:opacity-50">
            {busy ? "Verificando…" : "Confirmar"}
          </button>
        </footer>
      </form>
    </div>
  );
}
