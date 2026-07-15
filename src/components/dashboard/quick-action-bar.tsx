import { Link } from "@tanstack/react-router";
import { Plus, Upload, MessageSquare, Download } from "lucide-react";

export function QuickActionBar() {
  return (
    <div className="sticky bottom-4 mt-8 z-20">
      <div className="mx-auto max-w-3xl rounded-full bg-yo-txt text-white shadow-xl flex items-center gap-1 p-1.5">
        <a
          href="/transactions/new"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold transition"
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">Nueva transacción</span>
        </a>
        <Link
          to="/kyc"
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 text-sm font-medium transition"
        >
          <Upload className="size-4" />
          <span className="hidden md:inline">Documentos</span>
        </Link>
        <Link
          to="/disputes"
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 text-sm font-medium transition"
        >
          <MessageSquare className="size-4" />
          <span className="hidden md:inline">Mensajes</span>
        </Link>
        <Link
          to="/reports"
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 text-sm font-medium transition"
        >
          <Download className="size-4" />
          <span className="hidden md:inline">Reportes</span>
        </Link>
      </div>
    </div>
  );
}
