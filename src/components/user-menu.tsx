import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LifeBuoy, LogOut, Settings, User, UserCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function UserMenu({ email }: { email?: string | null }) {
  const [open, setOpen] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!email) return;
    sha256Hex(email.trim().toLowerCase()).then((h) => {
      setAvatar(`https://www.gravatar.com/avatar/${h}?d=mp&s=64`);
    });
  }, [email]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initial = (email ?? "U").slice(0, 1).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="grid place-items-center size-8 rounded-full overflow-hidden bg-yo-ac text-white text-xs font-bold ring-1 ring-yo-border hover:ring-yo-ac transition"
        aria-label="Menú de usuario"
      >
        {avatar ? (
          <img src={avatar} alt="" className="size-full object-cover" />
        ) : (
          <span>{initial}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[280px] rounded-xl border border-yo-border bg-yo-surface shadow-xl overflow-hidden z-50">
          <div className="p-3 border-b border-yo-border bg-yo-ac-bg">
            <div className="flex items-center gap-2">
              <div className="size-8 grid place-items-center rounded-lg bg-yo-ac text-white overflow-hidden">
                {avatar ? (
                  <img src={avatar} alt="" className="size-full object-cover" />
                ) : (
                  <UserCircle className="size-4" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-yo-txt truncate">Mi cuenta</p>
                <p className="text-[11px] text-yo-txt-3 truncate">{email ?? "Sesión activa"}</p>
              </div>
            </div>
          </div>
          <div className="p-2">
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-yo-txt hover:bg-yo-raised transition"
            >
              <User className="size-4 text-yo-txt-3" /> Mi perfil
            </Link>
            <Link
              to="/help"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-yo-txt hover:bg-yo-raised transition"
            >
              <LifeBuoy className="size-4 text-yo-txt-3" /> Centro de ayuda y soporte
            </Link>
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-yo-txt hover:bg-yo-raised transition"
            >
              <Settings className="size-4 text-yo-txt-3" /> Configuración
            </Link>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-yo-txt hover:bg-yo-raised border-t border-yo-border transition"
          >
            <LogOut className="size-4 text-yo-txt-3" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
