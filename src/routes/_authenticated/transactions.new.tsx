import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
} from "@/lib/transactions.functions";
import { Step1Schema, Step2Schema, Step3Schema, Step4Schema } from "@/lib/validations/transaction";

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

const TOTAL_STEPS = 5;

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

  const upsertDraft = useServerFn(upsertTransactionDraft);
  const cancelDraft = useServerFn(cancelTransactionDraft);
  const saveHitos = useServerFn(saveTransactionHitos);
  const saveMonto = useServerFn(saveTransactionMonto);

  useEffect(() => {
    supabase.from("profiles").select("kyc_status").eq("id", user.id).maybeSingle().then(({ data }) => {
      setKycOk(data?.kyc_status === "approved");
    });
  }, [user.id]);

  const sectorDef = useMemo(() => (sector ? getSector(sector) : undefined), [sector]);

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
              {step === 5 && "Revisión y firma"}
            </h1>
          </div>
          <button
            onClick={handleCancel}
            className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
        </div>

        <WizardProgress current={step} total={TOTAL_STEPS} labels={["Sector","Partes","Hitos","Monto","Revisión"]} />

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
          {step >= 3 && (
            <div className="py-12 text-center space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">En construcción</p>
              <p className="text-foreground">
                Los pasos <strong>Hitos, Monto</strong> y <strong>Revisión</strong> se activarán en la siguiente iteración.
              </p>
              <p className="text-sm text-muted-foreground">
                Tu borrador <span className="font-mono">{numero}</span> quedó guardado y puedes retomarlo desde <em>Transacciones</em>.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-between gap-3">
          <button
            onClick={() => (step === 1 ? handleCancel() : setStep((s) => s - 1))}
            className="px-5 py-2.5 border border-yo-border text-[12px] uppercase tracking-[0.14em] font-semibold hover:bg-yo-ac-h hover:text-white"
          >
            {step === 1 ? "Cancelar" : "Atrás"}
          </button>
          {step < 3 ? (
            <button
              onClick={goNext}
              disabled={saving}
              className="px-6 py-2.5 bg-yo-ac text-white text-[12px] uppercase tracking-[0.14em] font-semibold border border-yo-border hover:bg-yo-ac-h disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Continuar →"}
            </button>
          ) : (
            <button
              onClick={() => navigate({ to: "/transactions" })}
              className="px-6 py-2.5 bg-yo-ac text-white text-[12px] uppercase tracking-[0.14em] font-semibold border border-yo-border hover:bg-yo-ac-h"
            >
              Ir a mis transacciones
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
