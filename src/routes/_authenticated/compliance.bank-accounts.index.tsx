import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Landmark, Plus, ShieldCheck, ShieldAlert, Clock, Ban, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { listBankAccounts, setPrimaryBankAccount, archiveBankAccount } from "@/lib/bank-verification.functions";
import { STATUS_UI } from "@/lib/bank-verification/decision";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/compliance/bank-accounts/")({
  component: BankAccountsIndex,
});

function BankAccountsIndex() {
  const nav = useNavigate();
  const { currentOrg } = useCurrentOrg();
  const list = useServerFn(listBankAccounts);
  const setPrimary = useServerFn(setPrimaryBankAccount);
  const archive = useServerFn(archiveBankAccount);

  const orgId = currentOrg?.type === "business" ? currentOrg.id : null;
  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["bank-accounts", orgId],
    queryFn: () => list({ data: { orgId } }),
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        icon={Landmark}
        title="Cuentas bancarias"
        subtitle="Valida que las cuentas receptoras pertenezcan al titular registrado. Sin validación no se liberan fondos."
        actions={
          <Button onClick={() => nav({ to: "/compliance/bank-accounts/new" })} className="gap-2">
            <Plus className="size-4" /> Validar cuenta
          </Button>
        }
      />

      {isLoading && <div className="text-sm text-yo-txt-2">Cargando…</div>}

      {!isLoading && data.length === 0 && (
        <div className="rounded-xl border border-yo-border bg-white p-10 text-center">
          <div className="mx-auto size-12 rounded-xl bg-yo-ac-bg grid place-items-center mb-3">
            <Landmark className="size-6 text-yo-ac" />
          </div>
          <h2 className="text-lg font-semibold text-yo-txt">Aún no tienes cuentas verificadas</h2>
          <p className="mt-1 text-sm text-yo-txt-2 max-w-md mx-auto">
            Agrega una CLABE para validar que la cuenta receptora pertenece al titular de tu Perfil de Cumplimiento.
          </p>
          <Button className="mt-4 gap-2" onClick={() => nav({ to: "/compliance/bank-accounts/new" })}>
            <Plus className="size-4" /> Validar cuenta bancaria
          </Button>
        </div>
      )}

      <div className="grid gap-3">
        {data.map((a) => {
          const status = STATUS_UI[a.verification_status] ?? STATUS_UI.DRAFT;
          const Icon =
            a.verification_status === "APPROVED" ? ShieldCheck :
            a.verification_status === "REJECTED" || a.verification_status === "ERROR" ? Ban :
            a.verification_status === "MANUAL_REVIEW" ? ShieldAlert : Clock;
          return (
            <div key={a.id} className="rounded-xl border border-yo-border bg-white p-4 flex items-center gap-4">
              <div className={cn("size-10 rounded-lg grid place-items-center", status.bg)}>
                <Icon className={cn("size-5", status.text)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[13px] text-yo-txt">{a.query_masked}</span>
                  <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", status.bg, status.text)}>{status.label}</span>
                  {a.is_primary && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-yo-ac-bg text-yo-ac-txt">Principal</span>}
                </div>
                <p className="text-[12.5px] text-yo-txt-2 mt-0.5">
                  {a.bank_name ?? "Banco no identificado"} · Titular: {a.holder_expected_name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {a.verification_status === "APPROVED" && !a.is_primary && (
                  <Button variant="outline" size="sm" onClick={async () => { await setPrimary({ data: { bankAccountId: a.id } }); refetch(); }}>
                    Marcar principal
                  </Button>
                )}
                <Link
                  to="/compliance/bank-accounts/new"
                  search={{ id: a.id } as never}
                  className="inline-flex items-center gap-1 text-[12.5px] text-yo-ac hover:underline"
                >
                  Ver detalle <ArrowRight className="size-3.5" />
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (confirm("¿Archivar esta cuenta?")) {
                      await archive({ data: { bankAccountId: a.id } });
                      refetch();
                    }
                  }}
                >
                  Archivar
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
