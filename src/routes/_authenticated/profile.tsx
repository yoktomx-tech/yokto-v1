import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  UserRound, Edit2, ShieldCheck, Landmark, Star, Users2, Settings, ArrowRight,
  CheckCircle2, Clock, AlertTriangle, Ban,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useViewRole } from "@/hooks/use-view-role";
import { getMockProfile, LEVEL_CFG, TONE_CLASSES } from "@/lib/score-mock";
import { listBankAccounts } from "@/lib/bank-verification.functions";
import { STATUS_UI } from "@/lib/bank-verification/decision";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Mi perfil — CUMPLEX" }, { name: "robots", content: "noindex" }] }),
  component: ProfilePage,
});

type ProfileRow = {
  first_name: string | null; last_name: string | null; second_last_name: string | null;
  legal_name: string | null; trade_name: string | null;
  account_type: "persona_fisica" | "persona_moral" | null;
  rfc: string | null; curp: string | null; regimen_fiscal: string | null;
  fiscal_postal_code: string | null; email: string | null; phone: string | null;
  kyc_status: string | null; kyc_nivel: string | null;
};

function displayName(p: ProfileRow | null): string {
  if (!p) return "";
  if (p.account_type === "persona_moral") return p.legal_name || p.trade_name || "Persona moral";
  return [p.first_name, p.last_name, p.second_last_name].filter(Boolean).join(" ") || p.legal_name || "";
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-yo-border bg-white shadow-sm">
      <header className="flex items-center justify-between px-5 py-3 border-b border-yo-border">
        <h2 className="text-[14px] font-semibold text-yo-txt">{title}</h2>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Row({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2 py-1.5 text-[13.5px]">
      <span className="w-44 shrink-0 text-yo-txt-3">{k}</span>
      <span className={cn("text-yo-txt", mono && "font-mono text-[12.5px]")}>{v || <span className="text-yo-txt-3">—</span>}</span>
    </div>
  );
}

function Badge({ tone, children }: { tone: "ok" | "warn" | "err" | "info" | "neutral"; children: React.ReactNode }) {
  const m: Record<string, string> = {
    ok: "bg-[#ECFDF5] text-[#059669]",
    warn: "bg-[#FFFBEB] text-[#D97706]",
    err: "bg-[#FEF2F2] text-[#DC2626]",
    info: "bg-[#F0F9FF] text-[#0284C7]",
    neutral: "bg-[#F4F4F7] text-[#52525B]",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium", m[tone])}>{children}</span>;
}

function ProfilePage() {
  const { userId, email } = useAuthUser();
  const { currentOrg } = useCurrentOrg();
  const { role } = useViewRole();
  const orgId = currentOrg?.type === "business" ? currentOrg.id : null;

  const { data: profile } = useQuery<ProfileRow | null>({
    queryKey: ["profile-me", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select(
        "first_name,last_name,second_last_name,legal_name,trade_name,account_type,rfc,curp,regimen_fiscal,fiscal_postal_code,email,phone,kyc_status,kyc_nivel"
      ).eq("id", userId).maybeSingle();
      return (data as unknown as ProfileRow) ?? null;
    },
  });

  const listBank = useServerFn(listBankAccounts);
  const { data: banks = [] } = useQuery({
    queryKey: ["bank-accounts-profile", orgId],
    queryFn: () => listBank({ data: { orgId } }),
  });

  const primary = banks.find((b) => b.is_primary) ?? banks[0];
  const scoreProfile = getMockProfile(role);
  const level = LEVEL_CFG[scoreProfile.level];

  const kycOk = profile?.kyc_status === "approved";
  const name = displayName(profile ?? null);
  const initials = (name || email || "U").split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  const isPM = profile?.account_type === "persona_moral";

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <PageHeader
        icon={UserRound}
        title="Mi perfil"
        subtitle="Tu identidad, datos fiscales, cuenta bancaria y reputación dentro de CUMPLEX."
      />

      {/* Header card */}
      <section className="rounded-xl border border-yo-border bg-white shadow-sm p-5 flex items-start gap-4">
        <div className="size-14 rounded-full bg-yo-ac text-white grid place-items-center text-lg font-bold shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[18px] font-semibold text-yo-txt truncate">{name || "—"}</h1>
            <Badge tone="info">{isPM ? "Persona moral" : "Persona física"}</Badge>
          </div>
          <p className="text-[13px] text-yo-txt-2 mt-0.5">{email}</p>
          <p className="text-[12.5px] text-yo-txt-3 mt-0.5 font-mono">{profile?.rfc ?? "RFC pendiente"}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {kycOk
              ? <Badge tone="ok"><CheckCircle2 className="size-3" /> Identidad verificada</Badge>
              : <Badge tone="warn"><Clock className="size-3" /> KYC pendiente</Badge>}
            {primary?.verification_status === "APPROVED"
              ? <Badge tone="ok"><CheckCircle2 className="size-3" /> Banco verificado</Badge>
              : primary
                ? <Badge tone="warn"><Clock className="size-3" /> Banco pendiente</Badge>
                : <Badge tone="neutral"><Landmark className="size-3" /> Sin cuenta</Badge>}
            <Badge tone="info"><Star className="size-3" /> Score {scoreProfile.score}</Badge>
          </div>
        </div>
      </section>

      {/* Datos personales / fiscales */}
      <Card
        title="Datos personales y fiscales"
        action={
          <Link to="/onboarding" className="inline-flex items-center gap-1 text-[12.5px] text-yo-ac hover:underline">
            <Edit2 className="size-3.5" /> Editar
          </Link>
        }
      >
        {isPM ? (
          <>
            <Row k="Razón social" v={profile?.legal_name} />
            <Row k="Nombre comercial" v={profile?.trade_name} />
            <Row k="RFC" v={profile?.rfc} mono />
            <Row k="Régimen fiscal" v={profile?.regimen_fiscal} mono />
            <Row k="Código postal fiscal" v={profile?.fiscal_postal_code} mono />
            <Row k="Correo" v={profile?.email} />
            <Row k="Teléfono" v={profile?.phone} />
          </>
        ) : (
          <>
            <Row k="Nombre" v={name} />
            <Row k="RFC" v={profile?.rfc} mono />
            <Row k="CURP" v={profile?.curp} mono />
            <Row k="Régimen fiscal" v={profile?.regimen_fiscal} mono />
            <Row k="Código postal fiscal" v={profile?.fiscal_postal_code} mono />
            <Row k="Correo" v={profile?.email} />
            <Row k="Teléfono" v={profile?.phone} />
          </>
        )}
      </Card>

      {/* Perfil de Cumplimiento resumen */}
      <Card
        title="Perfil de Cumplimiento"
        action={
          <Link to="/score" className="inline-flex items-center gap-1 text-[12.5px] text-yo-ac hover:underline">
            Ver <ArrowRight className="size-3.5" />
          </Link>
        }
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[12px] text-yo-txt-3">Nivel actual</p>
            <p className={cn("text-[15px] font-semibold mt-0.5", TONE_CLASSES[level.tone].text)}>{level.label}</p>
            <p className="text-[12px] text-yo-txt-3 mt-0.5">Score {scoreProfile.score} / 100 · Rango {level.range}</p>
          </div>
          <div className="min-w-[220px] flex-1 max-w-md">
            <div className="h-2 rounded-full bg-yo-raised overflow-hidden">
              <div className="h-full bg-yo-ac" style={{ width: `${Math.min(100, scoreProfile.score)}%` }} />
            </div>
          </div>
        </div>
      </Card>

      {/* Datos bancarios */}
      <Card
        title="Datos bancarios"
        action={
          <Link to="/compliance/bank-accounts" className="inline-flex items-center gap-1 text-[12.5px] text-yo-ac hover:underline">
            Administrar <ArrowRight className="size-3.5" />
          </Link>
        }
      >
        {!primary ? (
          <div className="text-center py-6">
            <div className="mx-auto size-11 rounded-xl bg-yo-ac-bg grid place-items-center mb-2">
              <Landmark className="size-5 text-yo-ac" />
            </div>
            <p className="text-[13.5px] text-yo-txt">Aún no tienes una cuenta bancaria registrada</p>
            <p className="text-[12.5px] text-yo-txt-3 mt-1 max-w-md mx-auto">
              Agrega una CLABE para recibir pagos, devoluciones o liberaciones dentro de CUMPLEX.
            </p>
            <Link
              to="/compliance/bank-accounts/new"
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-yo-ac text-white text-[12.5px] px-3 py-1.5 hover:bg-yo-ac-hover"
            >
              Agregar CLABE
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-[13.5px] font-medium text-yo-txt">{primary.bank_name || "Cuenta bancaria"}</p>
                <p className="font-mono text-[13px] text-yo-txt-2 mt-0.5">{primary.query_masked}</p>
              </div>
              <StatusChip status={primary.verification_status as string} />
            </div>
            {primary.verification_status !== "APPROVED" && (
              <div className="rounded-lg bg-yo-raised border border-yo-border p-3 text-[12.5px] text-yo-txt-2 flex items-start gap-2">
                <AlertTriangle className="size-4 text-[#D97706] shrink-0 mt-0.5" />
                <div className="flex-1">
                  Para recibir liberaciones, tu cuenta debe estar verificada por Verificamex.
                </div>
                <Link
                  to="/compliance/bank-accounts"
                  className="text-yo-ac hover:underline whitespace-nowrap"
                >
                  Iniciar validación
                </Link>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Reputación */}
      <Card
        title="Mi reputación"
        action={
          <Link to="/score" className="inline-flex items-center gap-1 text-[12.5px] text-yo-ac hover:underline">
            Ver <ArrowRight className="size-3.5" />
          </Link>
        }
      >
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-xl bg-yo-ac-bg grid place-items-center">
            <Star className="size-6 text-yo-ac" />
          </div>
          <div>
            <p className="text-[18px] font-semibold text-yo-txt font-mono">{scoreProfile.score}</p>
            <p className="text-[12.5px] text-yo-txt-3">Basado en operaciones, cumplimiento y documentación.</p>
          </div>
        </div>
      </Card>

      {/* Rol en equipo */}
      <Card title="Rol en equipo" action={
        <Link to="/teams" className="inline-flex items-center gap-1 text-[12.5px] text-yo-ac hover:underline">
          Ver equipo <ArrowRight className="size-3.5" />
        </Link>
      }>
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-yo-raised grid place-items-center">
            <Users2 className="size-5 text-yo-txt-2" />
          </div>
          <div>
            <p className="text-[13.5px] font-medium text-yo-txt">{currentOrg?.name || "Personal"}</p>
            <p className="text-[12px] text-yo-txt-3 capitalize">
              Vista actual: {role === "seller" ? "Vendedor" : "Comprador"}
            </p>
          </div>
        </div>
      </Card>

      {/* Banner hacia Configuración */}
      <Link
        to="/teams"
        className="block rounded-xl border border-yo-border bg-white shadow-sm hover:border-yo-ac transition p-5"
      >
        <div className="flex items-center gap-4">
          <div className="size-11 rounded-xl bg-yo-raised grid place-items-center">
            <Settings className="size-5 text-yo-txt-2" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-yo-txt">Seguridad, notificaciones y más</p>
            <p className="text-[12.5px] text-yo-txt-3">Contraseña, sesiones, privacidad, plan y facturación.</p>
          </div>
          <ArrowRight className="size-4 text-yo-txt-3" />
        </div>
      </Link>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const s = STATUS_UI[status] ?? STATUS_UI.DRAFT;
  const Icon =
    status === "APPROVED" ? CheckCircle2 :
    status === "REJECTED" || status === "ERROR" ? Ban :
    status === "MANUAL_REVIEW" ? AlertTriangle : Clock;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium", s.bg, s.text)}>
      <Icon className="size-3" /> {s.label}
    </span>
  );
}
