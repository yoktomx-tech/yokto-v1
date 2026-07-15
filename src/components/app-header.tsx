import { useEffect, useState } from "react";
import { Maximize2, Minimize2, Moon, Search, Sun } from "lucide-react";
import { NotificationsBell } from "@/components/notifications-bell";
import { RoleSelectHeader } from "@/components/role-select";
import { UserMenu } from "@/components/user-menu";
import { useTheme } from "@/hooks/use-theme";

export function AppHeader({ email, userId }: { email?: string | null; section?: string; userId?: string }) {
  const { theme, toggle } = useTheme();
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {}
  }

  return (
    <header className="sticky top-0 z-30 border-b border-yo-border bg-yo-surface/85 backdrop-blur-sm">
      <div className="flex h-14 items-center gap-3 pl-14 md:pl-6 pr-4 md:pr-6">
        <div className="shrink-0">
          <RoleSelectHeader />
        </div>

        <div className="hidden md:flex flex-1 max-w-xl relative">
          <Search className="size-4 text-yo-txt-2 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            placeholder="Buscar operaciones, contrapartes, documentos…"
            className="w-full h-9 pl-9 pr-3 rounded-md bg-yo-raised border border-yo-border text-sm text-yo-txt placeholder:text-yo-txt-2 focus:outline-none focus:ring-2 focus:ring-yo-accent/40 focus:border-yo-accent"
          />
        </div>

        <div className="flex-1 md:hidden" />


        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {userId && <NotificationsBell userId={userId} />}
          <button
            onClick={toggleFullscreen}
            className="size-8 grid place-items-center rounded-md text-yo-txt-2 hover:text-yo-txt hover:bg-yo-raised transition"
            aria-label={isFs ? "Salir de pantalla completa" : "Pantalla completa"}
            title={isFs ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFs ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
          <button
            onClick={toggle}
            className="size-8 grid place-items-center rounded-md text-yo-txt-2 hover:text-yo-txt hover:bg-yo-raised transition"
            aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <div className="ml-1">
            <UserMenu email={email ?? null} />
          </div>
        </div>
      </div>
    </header>
  );
}
