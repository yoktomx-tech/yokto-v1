import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvitation } from "@/lib/orgs.functions";
import { Mail } from "lucide-react";

export const Route = createFileRoute("/invitations/$token")({
  ssr: false,
  component: AcceptInvitation,
});

function AcceptInvitation() {
  const { token } = Route.useParams();
  const accept = useServerFn(acceptInvitation);
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "need_auth" | "accepting" | "done" | "error">("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setStatus("need_auth");
        return;
      }
      setStatus("accepting");
      try {
        await accept({ data: { token } });
        setStatus("done");
        setTimeout(() => navigate({ to: "/dashboard" }), 1200);
      } catch (e: any) {
        setError(e?.message ?? "Error al aceptar");
        setStatus("error");
      }
    })();
  }, [token, accept, navigate]);

  return (
    <div className="min-h-dvh grid place-items-center bg-yo-bg p-4">
      <div className="max-w-sm w-full rounded-lg border border-yo-border bg-yo-surface p-6 text-center">
        <Mail className="size-8 mx-auto text-yo-ac mb-3" />
        <h1 className="text-lg font-bold text-yo-txt mb-2">Invitación a YOKTO</h1>
        {status === "checking" && <p className="text-sm text-yo-txt-3">Verificando…</p>}
        {status === "need_auth" && (
          <>
            <p className="text-sm text-yo-txt-3 mb-4">Crea tu contraseña y completa tu identidad para unirte a la organización.</p>
            <a
              href={`/invitations/${token}/onboarding`}
              className="inline-block px-4 py-2 rounded-md bg-yo-ac text-white text-sm font-medium"
            >
              Continuar registro
            </a>
            <p className="mt-3 text-[11px] text-yo-txt-3">¿Ya tienes cuenta? <a href={`/auth?redirect=${encodeURIComponent(`/invitations/${token}`)}`} className="text-yo-ac hover:underline">Inicia sesión</a></p>
          </>
        )}
        {status === "accepting" && <p className="text-sm text-yo-txt-3">Uniéndote a la organización…</p>}
        {status === "done" && <p className="text-sm text-yo-ok font-medium">¡Listo! Redirigiendo…</p>}
        {status === "error" && (
          <>
            <p className="text-sm text-yo-danger font-medium">{error}</p>
            <a href="/dashboard" className="mt-3 inline-block text-xs text-yo-ac hover:underline">
              Ir al panel
            </a>
          </>
        )}
      </div>
    </div>
  );
}
