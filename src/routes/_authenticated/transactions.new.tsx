import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  SECTORES, getSector, calcularFee, PLANTILLAS_HITOS, plantillaToDraft,
  type SectorId, type HitoDraft,
} from "@/lib/sectors";
import {
  searchCounterpart,
  upsertTransactionDraft,
  cancelTransactionDraft,
  saveTransactionHitos,
  saveTransactionMonto,
  signAndActivateTransaction,
} from "@/lib/transactions.functions";
import { Step1Schema, Step2Schema, Step3Schema, Step4Schema, Step5Schema } from "@/lib/validations/transaction";


export const Route = createFileRoute("/_authenticated/transactions/new")({
  head: () => ({ meta: [{ title: "Nueva transacción — YOKTO" }, { name: "robots", content: "noindex" }] }),
  component: NewTransactionWizard,
});

type Rol = "PAGADOR" | "BENEFICIARIO";

type Contraparte = {
  user_id: string | null;
  email: string;
  nombre: string;
  rfc?: string | null;
};

const TOTAL_STEPS = 6;

function NewTransactionWizard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [txId, setTxId] = useState<string | null>(null);
  const [numero, setNumero] = useState<string | null>(null);
  const [kycOk, setKycOk] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Paso 1
  const [sector, setSector] = useState<SectorId | null>(null);

  // Paso 2
  const [rol, setRol] = useState<Rol>("PAGADOR");
  const [descripcion, setDescripcion] = useState("");
  const [contraparte, setContraparte] = useState<Contraparte | null>(null);

  // Paso 3
  const [hitos, setHitos] = useState<HitoDraft[]>([]);

  // Paso 4
  const [monto, setMonto] = useState<number>(0);
  const [metodoPago, setMetodoPago] = useState<"SPEI" | "TARJETA" | "OXXO">("SPEI");
  const [fechaInicio, setFechaInicio] = useState<string>(new Date().toISOString().slice(0, 10));
  const [fechaFin, setFechaFin] = useState<string>("");

  // Paso 5
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [aceptaRetencion, setAceptaRetencion] = useState(false);
  const [firmando, setFirmando] = useState(false);
  const [firmaResult, setFirmaResult] = useState<{ status: string; activated: boolean } | null>(null);

  // Auto-save
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const upsertDraft = useServerFn(upsertTransactionDraft);
  const cancelDraft = useServerFn(cancelTransactionDraft);
  const saveHitos = useServerFn(saveTransactionHitos);
  const saveMonto = useServerFn(saveTransactionMonto);
  const signAndActivate = useServerFn(signAndActivateTransaction);


  useEffect(() => {
    supabase.from("profiles").select("kyc_status").eq("id", user.id).maybeSingle().then(({ data }) => {
      setKycOk(data?.kyc_status === "approved");
    });
  }, [user.id]);

  const sectorDef = useMemo(() => (sector ? getSector(sector) : undefined), [sector]);

  // Auto-save cada 30s si hay borrador y estamos en pasos 2-4
  useEffect(() => {
    if (!txId || step < 2 || step > 4 || !sector) return;
    const interval = setInterval(async () => {
      const payload = Step2Schema.safeParse({
        rol, descripcion,
        contraparte_user_id: contraparte?.user_id ?? null,
        contraparte_email: contraparte?.email ?? null,
        contraparte_nombre: contraparte?.nombre ?? null,
        contraparte_rfc: contraparte?.rfc ?? null,
      });
      if (!payload.success) return;
      try {
        await upsertDraft({ data: { transaction_id: txId, step1: { sector }, step2: payload.data } });
        setLastSavedAt(new Date());
      } catch { /* silencio */ }
    }, 30_000);
    return () => clearInterval(interval);
  }, [txId, step, sector, rol, descripcion, contraparte, upsertDraft]);

  const handleFirmar = useCallback(async () => {
    setError(null);
    const parsed = Step5Schema.safeParse({ acepta_terminos: aceptaTerminos, acepta_retencion: aceptaRetencion });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Acepta los términos"); return; }
    if (!txId) { setError("Falta el borrador"); return; }
    setFirmando(true);
    try {
      const res = await signAndActivate({
        data: { transaction_id: txId, acepta_terminos: true, acepta_retencion: true },
      });
      setFirmaResult({ status: res.status ?? "pending_signature", activated: res.activated });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFirmando(false);
    }
  }, [txId, aceptaTerminos, aceptaRetencion, signAndActivate]);


  const goNext = useCallback(async () => {
    setError(null);
    if (step === 1) {
      const r = Step1Schema.safeParse({ sector });
      if (!r.success) { setError(r.error.issues[0]?.message ?? "Selecciona un sector"); return; }
      setStep(2);
      return;
    }
    if (step === 2) {
      const payload = {
        rol,
        descripcion,
        contraparte_user_id: contraparte?.user_id ?? null,
        contraparte_email: contraparte?.email ?? null,
        contraparte_nombre: contraparte?.nombre ?? null,
        contraparte_rfc: contraparte?.rfc ?? null,
      };
      const r = Step2Schema.safeParse(payload);
      if (!r.success) { setError(r.error.issues[0]?.message ?? "Revisa los campos"); return; }
      setSaving(true);
      try {
        const res = await upsertDraft({
          data: { transaction_id: txId ?? undefined, step1: { sector: sector! }, step2: r.data },
        });
        setTxId(res.id);
        setNumero(res.numero ?? null);
        // Pre-cargar plantilla de hitos si aún no hay
        if (hitos.length === 0 && sector) {
          const plantillas = PLANTILLAS_HITOS[sector];
          setHitos(plantillas.map((p, i) => plantillaToDraft(p, i + 1, fechaInicio)));
        }
        setStep(3);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSaving(false);
      }
      return;
    }
    if (step === 3) {
      const r = Step3Schema.safeParse({ hitos });
      if (!r.success) { setError(r.error.issues[0]?.message ?? "Revisa los hitos"); return; }
      if (!txId) { setError("Falta guardar los pasos anteriores"); return; }
      setSaving(true);
      try {
        await saveHitos({ data: { transaction_id: txId, hitos: r.data.hitos } });
        setStep(4);
      } catch (e) {
        setError((e as Error).message);
      } finally { setSaving(false); }
      return;
    }
    if (step === 4) {
      const r = Step4Schema.safeParse({
        monto,
        metodo_pago: metodoPago,
        fecha_inicio_estimada: fechaInicio || null,
        fecha_fin_estimada: fechaFin || null,
      });
      if (!r.success) { setError(r.error.issues[0]?.message ?? "Revisa el monto"); return; }
      if (!txId || !sector) { setError("Falta información previa"); return; }
      setSaving(true);
      try {
        await saveMonto({ data: { transaction_id: txId, sector, step4: r.data } });
        setStep(5);
      } catch (e) {
        setError((e as Error).message);
      } finally { setSaving(false); }
      return;
    }
    // Paso 5: Fase 3
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }, [step, sector, rol, descripcion, contraparte, txId, hitos, monto, metodoPago, fechaInicio, fechaFin, upsertDraft, saveHitos, saveMonto]);

  async function handleCancel() {
    if (txId) {
      try { await cancelDraft({ data: { id: txId } }); } catch { /* ignore */ }
    }
    navigate({ to: "/transactions" });
  }

  if (kycOk === false) {
    return (
      <main className="flex-1">
        <div className="container-editorial py-16 max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Requisito</p>
          <h1 className="mt-2 font-display text-5xl tracking-wide">Completa tu verificación</h1>
          <p className="mt-3 text-muted-foreground">Necesitas KYC aprobado para crear transacciones.</p>
          <button
            onClick={() => navigate({ to: "/onboarding" })}
            className="mt-6 inline-flex items-center px-5 py-2.5 bg-yo-ac text-white text-[12px] uppercase tracking-[0.14em] font-semibold border border-yo-border"
          >
            Ir a onboarding
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1">
      <div className="container-editorial py-10 max-w-4xl">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Módulo C · Nueva transacción {numero && <span className="ml-2 font-mono text-foreground">{numero}</span>}
            </p>
            <h1 className="mt-1 font-display text-4xl md:text-5xl tracking-wide text-foreground">
              {step === 1 && "¿Qué tipo de operación?"}
              {step === 2 && "Partes de la transacción"}
              {step === 3 && "Hitos y condiciones"}
              {step === 4 && "Monto y comisiones"}
              {step === 5 && "Revisión final"}
              {step === 6 && "Firma y activación"}
            </h1>
          </div>
          <button
            onClick={handleCancel}
            className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
        </div>

        <WizardProgress current={step} total={TOTAL_STEPS} labels={["Sector","Partes","Hitos","Monto","Revisión","Firma"]} />

        {error && (
          <div className="mt-6 border border-[#FF3B3B] bg-[#FF3B3B]/10 p-3 text-sm text-[#FF3B3B]">{error}</div>
        )}

        <div className="mt-8 border border-yo-border bg-background p-6 md:p-8">
          {step === 1 && <Step1 sector={sector} setSector={setSector} />}
          {step === 2 && (
            <Step2
              sector={sector!}
              rol={rol}
              setRol={setRol}
              descripcion={descripcion}
              setDescripcion={setDescripcion}
              contraparte={contraparte}
              setContraparte={setContraparte}
            />
          )}
          {step === 3 && sector && (
            <Step3 sector={sector} hitos={hitos} setHitos={setHitos} fechaBase={fechaInicio} />
          )}
          {step === 4 && sector && (
            <Step4
              sector={sector}
              monto={monto} setMonto={setMonto}
              metodoPago={metodoPago} setMetodoPago={setMetodoPago}
              fechaInicio={fechaInicio} setFechaInicio={setFechaInicio}
              fechaFin={fechaFin} setFechaFin={setFechaFin}
            />
          )}
          {(step === 5 || step === 6) && (
            <Step5
              mode={step === 5 ? "review" : "sign"}
              numero={numero}
              sector={sector}
              rol={rol}
              descripcion={descripcion}
              contraparte={contraparte}
              hitos={hitos}
              monto={monto}
              metodoPago={metodoPago}
              fechaInicio={fechaInicio}
              fechaFin={fechaFin}
              aceptaTerminos={aceptaTerminos}
              setAceptaTerminos={setAceptaTerminos}
              aceptaRetencion={aceptaRetencion}
              setAceptaRetencion={setAceptaRetencion}
              firmando={firmando}
              firmaResult={firmaResult}
              onFirmar={handleFirmar}
            />
          )}
        </div>

        {lastSavedAt && step >= 2 && step <= 4 && (
          <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Guardado automático · {lastSavedAt.toLocaleTimeString("es-MX")}
          </div>
        )}

        <div className="mt-6 flex justify-between gap-3">
          <button
            onClick={() => (step === 1 ? handleCancel() : setStep((s) => s - 1))}
            disabled={step === 6 && (firmando || firmaResult?.activated === true)}
            className="px-5 py-2.5 border border-yo-border text-[12px] uppercase tracking-[0.14em] font-semibold hover:bg-yo-ac-h hover:text-white disabled:opacity-40"
          >
            {step === 1 ? "Cancelar" : "Atrás"}
          </button>
          {step < 6 ? (
            <button
              onClick={goNext}
              disabled={saving}
              className="px-6 py-2.5 bg-yo-ac text-white text-[12px] uppercase tracking-[0.14em] font-semibold border border-yo-border hover:bg-yo-ac-h disabled:opacity-50"
            >
              {saving ? "Guardando…" : step === 5 ? "Continuar a firma →" : "Continuar →"}
            </button>
          ) : firmaResult ? (
            <button
              onClick={() => navigate({ to: "/transactions" })}
              className="px-6 py-2.5 bg-yokto-yellow text-yokto-black text-[12px] uppercase tracking-[0.14em] font-semibold border border-yokto-black hover:bg-yokto-yellow/80"
            >
              Ir a mis transacciones →
            </button>
          ) : (
            <button
              onClick={handleFirmar}
              disabled={firmando || !aceptaTerminos || !aceptaRetencion}
              className="px-6 py-2.5 bg-yokto-black text-yokto-yellow text-[12px] uppercase tracking-[0.14em] font-semibold border border-yokto-black hover:opacity-90 disabled:opacity-40"
            >
              {firmando ? "Firmando…" : "Firmar y activar ✓"}
            </button>
          )}
        </div>



        {sectorDef && step > 1 && (
          <div className="mt-6 border border-yo-border/40 bg-yo-bg/30 p-4 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{sectorDef.emoji} {sectorDef.titulo}</span>
            {" · "}Tiempo típico: {sectorDef.tiempo_tipico}
            {" · "}Monto típico: {sectorDef.monto_tipico}
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Progreso ────────────────────────────────────────────────────────────────
function WizardProgress({ current, total, labels }: { current: number; total: number; labels: string[] }) {
  return (
    <div className="mt-6">
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => {
          const n = i + 1;
          return (
            <div
              key={n}
              className={`h-1.5 flex-1 border border-yo-border ${n <= current ? "bg-yokto-yellow" : "bg-background"}`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {labels.map((l, i) => (
          <span key={l} className={i + 1 === current ? "text-foreground font-semibold" : ""}>{l}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Paso 1: Sector ──────────────────────────────────────────────────────────
function Step1({ sector, setSector }: { sector: SectorId | null; setSector: (s: SectorId) => void }) {
  const selected = sector ? getSector(sector) : undefined;
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Elige la categoría que mejor describe tu operación. Esto define plantillas de hitos, documentos requeridos y comisiones aplicables.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SECTORES.map((s) => {
          const isActive = sector === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSector(s.id)}
              className={`text-left p-4 border transition ${
                isActive
                  ? "border-yokto-black bg-yo-bg ring-2 ring-yokto-black"
                  : "border-yo-border hover:border-yokto-black hover:bg-yo-bg/40"
              }`}
            >
              <div className="text-3xl">{s.emoji}</div>
              <div className="mt-2 text-[11px] uppercase tracking-[0.14em] font-semibold">{s.titulo}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.descripcion}</div>
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="border border-yo-border bg-yo-bg/40 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Tiempo típico</div>
            <div className="text-foreground">{selected.tiempo_tipico}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Monto típico</div>
            <div className="text-foreground">{selected.monto_tipico}</div>
          </div>
          <div className="sm:col-span-2">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Ejemplos</div>
            <div className="text-foreground">{selected.ejemplos.join(" · ")}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Paso 2: Partes ──────────────────────────────────────────────────────────
type SearchResult = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  legal_name: string | null;
  email: string | null;
  rfc: string | null;
  account_type: string | null;
  kyc_status: string | null;
};

function Step2({
  sector, rol, setRol, descripcion, setDescripcion, contraparte, setContraparte,
}: {
  sector: SectorId;
  rol: Rol; setRol: (r: Rol) => void;
  descripcion: string; setDescripcion: (d: string) => void;
  contraparte: Contraparte | null; setContraparte: (c: Contraparte | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [inviteMode, setInviteMode] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteNombre, setInviteNombre] = useState("");
  const search = useServerFn(searchCounterpart);
  const sectorDef = getSector(sector)!;

  useEffect(() => {
    if (query.trim().length < 3) { setResults(null); return; }
    const h = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await search({ data: { query: query.trim() } });
        setResults(res.results);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(h);
  }, [query, search]);

  function pickResult(r: SearchResult) {
    const nombre = r.legal_name || [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email || "Contraparte";
    setContraparte({ user_id: r.id, email: r.email ?? "", nombre, rfc: r.rfc });
    setQuery(nombre);
    setResults(null);
    setInviteMode(false);
  }

  function applyInvite() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) return;
    if (inviteNombre.trim().length < 2) return;
    setContraparte({ user_id: null, email: inviteEmail.trim().toLowerCase(), nombre: inviteNombre.trim(), rfc: null });
  }

  return (
    <div className="space-y-6">
      {/* Selector de rol */}
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-foreground mb-2">Tu rol en esta transacción</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(["PAGADOR", "BENEFICIARIO"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRol(r)}
              className={`p-4 border text-left ${
                rol === r ? "border-yokto-black bg-yo-bg ring-2 ring-yokto-black" : "border-yo-border hover:border-yokto-black"
              }`}
            >
              <div className="text-[11px] uppercase tracking-[0.14em] font-semibold">
                Soy {r === "PAGADOR" ? "el pagador" : "el beneficiario"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {r === "PAGADOR" ? "Comprador / cliente que deposita los fondos" : "Vendedor / proveedor que recibe los fondos al cumplir"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Búsqueda de contraparte */}
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-foreground mb-2">
          Buscar contraparte por RFC o email
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (contraparte?.user_id) setContraparte(null); }}
          placeholder="ABCD850101XYZ o contraparte@empresa.mx"
          className="input-editorial"
        />
        {searching && <p className="mt-1 text-xs text-muted-foreground">Buscando…</p>}
        {results && results.length > 0 && (
          <div className="mt-2 border border-yo-border divide-y divide-yo-border/40">
            {results.map((r) => {
              const nombre = r.legal_name || [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => pickResult(r)}
                  className="w-full text-left px-3 py-2 hover:bg-yo-bg/40 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-foreground">{nombre}</div>
                    <div className="text-xs text-muted-foreground">{r.rfc ?? "sin RFC"} · {r.email}</div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-[0.14em] px-2 py-1 border ${
                    r.kyc_status === "approved" ? "bg-yokto-yellow border-yo-border text-yokto-black" : "border-yo-border text-muted-foreground"
                  }`}>KYC {r.kyc_status ?? "n/a"}</span>
                </button>
              );
            })}
          </div>
        )}
        {results && results.length === 0 && !inviteMode && (
          <div className="mt-2 border border-yo-border/60 bg-yo-bg/40 p-3 text-sm text-muted-foreground">
            No encontramos a esa contraparte en YOKTO.{" "}
            <button
              type="button"
              onClick={() => { setInviteMode(true); setInviteEmail(query.includes("@") ? query : ""); }}
              className="underline text-foreground"
            >
              Invitarla por email
            </button>
          </div>
        )}

        {inviteMode && (
          <div className="mt-3 border border-yo-border bg-yo-bg/40 p-4 space-y-3">
            <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-foreground">Invitar contraparte nueva</div>
            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="contraparte@empresa.mx" className="input-editorial" />
            <input type="text" value={inviteNombre} onChange={(e) => setInviteNombre(e.target.value)} placeholder="Nombre o razón social" className="input-editorial" />
            <div className="flex gap-2">
              <button type="button" onClick={applyInvite} className="px-4 py-2 bg-yokto-yellow text-yokto-black text-[11px] uppercase tracking-[0.14em] font-semibold border border-yo-border">
                Usar como contraparte
              </button>
              <button type="button" onClick={() => { setInviteMode(false); setContraparte(null); }} className="px-4 py-2 border border-yo-border text-[11px] uppercase tracking-[0.14em]">
                Cancelar
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Recibirá un correo con instrucciones para crear su cuenta YOKTO y firmar. La transacción queda en <strong>pendiente de firma</strong> hasta que complete su KYC básico.
            </p>
          </div>
        )}

        {contraparte && (
          <div className="mt-3 border-2 border-yokto-black bg-background p-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Contraparte seleccionada</div>
              <div className="text-sm font-semibold text-foreground">{contraparte.nombre}</div>
              <div className="text-xs text-muted-foreground">
                {contraparte.email}{contraparte.rfc ? ` · ${contraparte.rfc}` : ""} · {contraparte.user_id ? "usuario YOKTO" : "por invitar"}
              </div>
            </div>
            <button type="button" onClick={() => setContraparte(null)} className="text-[11px] uppercase tracking-[0.14em] underline text-muted-foreground">
              Cambiar
            </button>
          </div>
        )}
      </div>

      {/* Descripción */}
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-foreground mb-2">Descripción de la operación</div>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={4}
          placeholder={sectorDef.placeholder_descripcion}
          maxLength={1000}
          className="input-editorial resize-y"
        />
        <div className="mt-1 text-[11px] text-muted-foreground text-right">{descripcion.length}/1000</div>
      </div>
    </div>
  );
}

// ─── Paso 3: Hitos ──────────────────────────────────────────────────────────
const TIPOS_VERIF: Array<{ id: HitoDraft["tipo_verificacion"]; label: string }> = [
  { id: "DOCUMENTAL", label: "Documental" },
  { id: "EVIDENCIA_FISICA", label: "Evidencia física" },
  { id: "GPS", label: "GPS / tracking" },
  { id: "CHECKLIST", label: "Checklist" },
  { id: "AUTOMATICO", label: "Automático" },
  { id: "MANUAL_YOKTO", label: "Verificado por YOKTO" },
];

function Step3({
  sector, hitos, setHitos, fechaBase,
}: {
  sector: SectorId;
  hitos: HitoDraft[];
  setHitos: (h: HitoDraft[]) => void;
  fechaBase: string;
}) {
  const suma = hitos.reduce((s, h) => s + Number(h.monto_porcentaje || 0), 0);
  const ok = Math.abs(suma - 100) < 0.01;

  function update(idx: number, patch: Partial<HitoDraft>) {
    setHitos(hitos.map((h, i) => (i === idx ? { ...h, ...patch } : h)));
  }
  function remove(idx: number) {
    setHitos(hitos.filter((_, i) => i !== idx).map((h, i) => ({ ...h, orden: i + 1 })));
  }
  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= hitos.length) return;
    const copy = [...hitos];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    setHitos(copy.map((h, i) => ({ ...h, orden: i + 1 })));
  }
  function addBlank() {
    setHitos([
      ...hitos,
      {
        orden: hitos.length + 1,
        titulo: "Nuevo hito",
        descripcion: "",
        monto_porcentaje: 0,
        fecha_limite: fechaBase,
        tipo_verificacion: "DOCUMENTAL",
        documentos_requeridos: [],
        evidencia_requerida: [],
        responsable: "PAGADOR",
        auto_release: false,
      },
    ]);
  }
  function resetPlantilla() {
    const p = PLANTILLAS_HITOS[sector];
    setHitos(p.map((pl, i) => plantillaToDraft(pl, i + 1, fechaBase)));
  }
  function distribuirIgual() {
    if (hitos.length === 0) return;
    const each = Math.floor((100 / hitos.length) * 100) / 100;
    const resto = 100 - each * hitos.length;
    setHitos(hitos.map((h, i) => ({ ...h, monto_porcentaje: i === 0 ? each + resto : each })));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Divide la operación en hitos verificables. Los fondos se liberan hito por hito conforme se aprueban.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={resetPlantilla} className="px-3 py-1.5 border border-yo-border text-[11px] uppercase tracking-[0.14em]">
            Usar plantilla del sector
          </button>
          <button type="button" onClick={distribuirIgual} className="px-3 py-1.5 border border-yo-border text-[11px] uppercase tracking-[0.14em]">
            Distribuir 100% igual
          </button>
        </div>
      </div>

      <div className={`border p-3 text-sm flex items-center justify-between ${ok ? "border-yo-border bg-yokto-yellow/30 text-yokto-black" : "border-[#FF3B3B] bg-[#FF3B3B]/10 text-[#FF3B3B]"}`}>
        <span>Suma actual: <strong>{suma.toFixed(2)}%</strong> {ok ? "✓ correcto" : "· debe sumar exactamente 100%"}</span>
        <span className="text-xs">{hitos.length} hito{hitos.length === 1 ? "" : "s"}</span>
      </div>

      <div className="space-y-4">
        {hitos.map((h, idx) => (
          <div key={idx} className="border border-yo-border p-4 bg-background space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
                Hito {h.orden}
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} className="px-2 py-1 border border-yo-border text-xs disabled:opacity-30">↑</button>
                <button type="button" onClick={() => move(idx, 1)} disabled={idx === hitos.length - 1} className="px-2 py-1 border border-yo-border text-xs disabled:opacity-30">↓</button>
                <button type="button" onClick={() => remove(idx)} className="px-2 py-1 border border-[#FF3B3B] text-[#FF3B3B] text-xs">Eliminar</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Título</span>
                <input type="text" value={h.titulo} onChange={(e) => update(idx, { titulo: e.target.value })} className="input-editorial mt-1" />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">% del monto</span>
                <input type="number" min={0} max={100} step={0.01} value={h.monto_porcentaje} onChange={(e) => update(idx, { monto_porcentaje: Number(e.target.value) })} className="input-editorial mt-1" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Descripción</span>
                <textarea rows={2} value={h.descripcion} onChange={(e) => update(idx, { descripcion: e.target.value })} className="input-editorial mt-1 resize-y" />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Fecha límite</span>
                <input type="date" value={h.fecha_limite} onChange={(e) => update(idx, { fecha_limite: e.target.value })} className="input-editorial mt-1" />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Tipo de verificación</span>
                <select value={h.tipo_verificacion} onChange={(e) => update(idx, { tipo_verificacion: e.target.value as HitoDraft["tipo_verificacion"] })} className="input-editorial mt-1">
                  {TIPOS_VERIF.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Aprueba</span>
                <select value={h.responsable} onChange={(e) => update(idx, { responsable: e.target.value as "PAGADOR" | "BENEFICIARIO" })} className="input-editorial mt-1">
                  <option value="PAGADOR">Pagador</option>
                  <option value="BENEFICIARIO">Beneficiario</option>
                </select>
              </label>
              <label className="flex items-center gap-2 sm:mt-6">
                <input type="checkbox" checked={h.auto_release} onChange={(e) => update(idx, { auto_release: e.target.checked })} />
                <span className="text-xs text-foreground">Liberación automática al aprobar</span>
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Documentos requeridos (separa por coma)</span>
                <input
                  type="text"
                  value={h.documentos_requeridos.join(", ")}
                  onChange={(e) => update(idx, { documentos_requeridos: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  className="input-editorial mt-1"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addBlank} className="w-full px-4 py-3 border-2 border-dashed border-yo-border text-[12px] uppercase tracking-[0.14em] font-semibold hover:bg-yo-bg">
        + Agregar hito
      </button>
    </div>
  );
}

// ─── Paso 4: Monto y comisiones ─────────────────────────────────────────────
function Step4({
  sector, monto, setMonto, metodoPago, setMetodoPago, fechaInicio, setFechaInicio, fechaFin, setFechaFin,
}: {
  sector: SectorId;
  monto: number; setMonto: (n: number) => void;
  metodoPago: "SPEI" | "TARJETA" | "OXXO"; setMetodoPago: (m: "SPEI" | "TARJETA" | "OXXO") => void;
  fechaInicio: string; setFechaInicio: (s: string) => void;
  fechaFin: string; setFechaFin: (s: string) => void;
}) {
  const sectorDef = getSector(sector)!;
  const fee = useMemo(() => calcularFee(sector, monto || 0, 0), [sector, monto]);
  const fmt = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-foreground mb-2">Monto de la operación (MXN)</div>
        <input
          type="number"
          min={100}
          step={100}
          value={monto || ""}
          onChange={(e) => setMonto(Number(e.target.value))}
          placeholder="Ej: 150000"
          className="input-editorial text-2xl font-display tracking-wide"
        />
        <p className="mt-1 text-xs text-muted-foreground">Rango típico para {sectorDef.titulo}: {sectorDef.monto_tipico}</p>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-foreground mb-2">Método de pago</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {sectorDef.metodos_pago.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetodoPago(m)}
              className={`p-3 border text-left ${metodoPago === m ? "border-yokto-black bg-yo-bg ring-2 ring-yokto-black" : "border-yo-border hover:border-yokto-black"}`}
            >
              <div className="text-[11px] uppercase tracking-[0.14em] font-semibold">{m}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {m === "SPEI" ? "Transferencia interbancaria" : m === "TARJETA" ? "Débito o crédito" : "Pago en efectivo"}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Fecha estimada de inicio</span>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="input-editorial mt-1" />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Fecha estimada de fin</span>
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="input-editorial mt-1" />
        </label>
      </div>

      {/* Fee breakdown */}
      <div className="border-2 border-yokto-black bg-yo-bg/40 p-5 space-y-2">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Desglose de comisiones</div>
        <Row label="Monto de la operación" value={fmt(monto || 0)} />
        <Row
          label={`Comisión YOKTO ${fee.fee_tipo === "FIJO" ? "(tarifa fija)" : `(${(FEES_PCT(sector) * 100).toFixed(2)}%)`}`}
          value={fmt(fee.comision_final)}
        />
        <Row label="IVA (16%) sobre comisión" value={fmt(fee.iva_comision)} />
        <div className="border-t border-yo-border pt-2 mt-2">
          <Row
            label={<span className="font-semibold text-foreground">Total a depositar por el pagador</span>}
            value={<span className="font-display text-2xl">{fmt(fee.total_a_depositar)}</span>}
          />
        </div>
        <p className="text-[11px] text-muted-foreground pt-2">
          Comisión efectiva: <strong>{fee.porcentaje_efectivo.toFixed(2)}%</strong> del monto de la operación.
          {fee.descuento_aplicado > 0 && ` · Descuento por volumen aplicado: ${(fee.descuento_aplicado * 100).toFixed(0)}%.`}
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground tabular-nums">{value}</span>
    </div>
  );
}

function FEES_PCT(sector: SectorId): number {
  // Espejo simple del FEES.porcentaje_base sin re-exportar
  const map: Record<SectorId, number> = {
    AUTOTRANSPORTE: 0.018, CONSTRUCCION: 0.022, COMERCIO_EXTERIOR: 0.015,
    INMOBILIARIO: 0.012, VEHICULOS: 0.025, SERVICIOS: 0.030,
  };
  return map[sector];
}

// ─── Paso 5: Revisión y firma ───────────────────────────────────────────────
function Step5({
  mode, numero, sector, rol, descripcion, contraparte, hitos, monto, metodoPago,
  fechaInicio, fechaFin,
  aceptaTerminos, setAceptaTerminos, aceptaRetencion, setAceptaRetencion,
  firmando, firmaResult, onFirmar,
}: {
  mode: "review" | "sign";
  numero: string | null;
  sector: SectorId | null;
  rol: Rol;
  descripcion: string;
  contraparte: Contraparte | null;
  hitos: HitoDraft[];
  monto: number;
  metodoPago: "SPEI" | "TARJETA" | "OXXO";
  fechaInicio: string;
  fechaFin: string;
  aceptaTerminos: boolean;
  setAceptaTerminos: (v: boolean) => void;
  aceptaRetencion: boolean;
  setAceptaRetencion: (v: boolean) => void;
  firmando: boolean;
  firmaResult: { status: string; activated: boolean } | null;
  onFirmar: () => void;
}) {
  const sectorDef = sector ? getSector(sector) : null;
  const fee = useMemo(() => (sector ? calcularFee(sector, monto || 0, 0) : null), [sector, monto]);
  const fmt = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

  if (firmaResult) {
    return (
      <div className="py-10 text-center space-y-4">
        <div className="text-6xl">{firmaResult.activated ? "✓" : "⏳"}</div>
        <h2 className="font-display text-3xl tracking-wide text-foreground">
          {firmaResult.activated ? "Transacción activada" : "Firma registrada"}
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {firmaResult.activated
            ? `Ambas partes firmaron. La transacción ${numero} está lista para fondearse.`
            : contraparte?.user_id
              ? `Notificamos a ${contraparte?.nombre} para que firme y active la transacción ${numero}.`
              : `Enviamos una invitación a ${contraparte?.email}. La transacción ${numero} quedará pendiente hasta que se registre y firme.`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border border-yo-border bg-yo-bg/30 p-4">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Contrato de depósito en garantía</div>
        <div className="mt-1 font-mono text-sm text-foreground">{numero}</div>
        <p className="mt-2 text-xs text-muted-foreground">
          Revisa cuidadosamente los términos. Al firmar aceptas que YOKTO retenga los fondos y libere hito por hito conforme se cumplan las condiciones.
        </p>
      </div>

      {/* Resumen general */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SummaryCard title="Sector">
          <div>{sectorDef?.emoji} {sectorDef?.titulo}</div>
        </SummaryCard>
        <SummaryCard title="Tu rol">
          <div>{rol === "PAGADOR" ? "Pagador (deposita)" : "Beneficiario (recibe)"}</div>
        </SummaryCard>
        <SummaryCard title="Contraparte">
          <div className="font-semibold">{contraparte?.nombre}</div>
          <div className="text-xs text-muted-foreground">
            {contraparte?.email}{contraparte?.rfc ? ` · ${contraparte.rfc}` : ""} · {contraparte?.user_id ? "usuario YOKTO" : "por invitar"}
          </div>
        </SummaryCard>
        <SummaryCard title="Método de pago">
          <div>{metodoPago}</div>
          <div className="text-xs text-muted-foreground">{fechaInicio} → {fechaFin || "s/f"}</div>
        </SummaryCard>
        <SummaryCard title="Descripción" wide>
          <div className="text-sm whitespace-pre-wrap">{descripcion}</div>
        </SummaryCard>
      </section>

      {/* Hitos */}
      <section>
        <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-foreground mb-2">Hitos ({hitos.length})</div>
        <div className="border border-yo-border divide-y divide-yo-border/50">
          {hitos.map((h) => (
            <div key={h.orden} className="p-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">{h.orden}. {h.titulo}</div>
                <div className="text-xs text-muted-foreground">
                  {h.tipo_verificacion} · aprueba {h.responsable.toLowerCase()} · vence {h.fecha_limite}
                  {h.auto_release && " · auto-liberación"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-foreground tabular-nums">{Number(h.monto_porcentaje).toFixed(2)}%</div>
                <div className="text-xs text-muted-foreground tabular-nums">{fmt((monto || 0) * (Number(h.monto_porcentaje) / 100))}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Comisiones */}
      {fee && (
        <section className="border-2 border-yokto-black bg-yo-bg/40 p-4 space-y-1">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Comisiones y total</div>
          <Row label="Monto de la operación" value={fmt(monto || 0)} />
          <Row label="Comisión YOKTO" value={fmt(fee.comision_final)} />
          <Row label="IVA 16%" value={fmt(fee.iva_comision)} />
          <div className="border-t border-yo-border pt-2 mt-2">
            <Row
              label={<span className="font-semibold text-foreground">Total a depositar</span>}
              value={<span className="font-display text-xl">{fmt(fee.total_a_depositar)}</span>}
            />
          </div>
        </section>
      )}

      {mode === "sign" && (
        <>
          {/* Términos */}
          <section className="space-y-3 border border-yo-border p-4 bg-background">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={aceptaTerminos}
                onChange={(e) => setAceptaTerminos(e.target.checked)}
              />
              <span className="text-sm text-foreground">
                Declaro que la información es veraz y acepto los <a href="/terminos" target="_blank" className="underline">Términos y Condiciones</a>, el <a href="/privacidad" target="_blank" className="underline">Aviso de Privacidad</a> y las reglas de disputa de YOKTO.
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={aceptaRetencion}
                onChange={(e) => setAceptaRetencion(e.target.checked)}
              />
              <span className="text-sm text-foreground">
                Entiendo que los fondos serán retenidos en cuenta de garantía hasta el cumplimiento verificable de cada hito y que YOKTO no es entidad financiera.
              </span>
            </label>
          </section>

          <p className="text-[11px] text-muted-foreground">
            Al pulsar <strong>Firmar y activar</strong> se registra tu firma electrónica con fecha, hora e IP.
            {contraparte?.user_id
              ? " Se notificará a tu contraparte para que firme también."
              : " Se enviará una invitación por correo a la contraparte."}
          </p>

          {/* Botón inline redundante para mobile */}
          <button
            onClick={onFirmar}
            disabled={firmando || !aceptaTerminos || !aceptaRetencion}
            className="w-full md:hidden px-6 py-3 bg-yokto-black text-yokto-yellow text-[12px] uppercase tracking-[0.14em] font-semibold border border-yokto-black hover:opacity-90 disabled:opacity-40"
          >
            {firmando ? "Firmando…" : "Firmar y activar ✓"}
          </button>
        </>
      )}

    </div>
  );
}

function SummaryCard({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`border border-yo-border p-3 ${wide ? "md:col-span-2" : ""}`}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{title}</div>
      <div className="mt-1 text-foreground">{children}</div>
    </div>
  );
}

