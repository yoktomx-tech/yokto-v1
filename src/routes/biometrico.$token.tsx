import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera, CheckCircle2, XCircle, Loader2, ShieldCheck, IdCard,
  ScanFace, ArrowRight, RefreshCw, Video, AlertTriangle, Check,
} from "lucide-react";
import {
  getEnrollmentByToken, submitBiometricId, submitBiometricSelfie,
  confirmBiometricEnrollment, cancelBiometricEnrollment,
  registerBiometricStartContext, registerBiometricCompleteContext,
} from "@/lib/biometric.functions";
import { CumplexLogo } from "@/components/logo";

export const Route = createFileRoute("/biometrico/$token")({
  head: () => ({ meta: [{ title: "Enrolamiento biométrico — Cumplex" }, { name: "robots", content: "noindex" }] }),
  component: BiometricMobile,
});

type Enrollment = Awaited<ReturnType<typeof getEnrollmentByToken>>;
type IdResult = { ocr_curp: string | null; profile_curp: string | null; curp_match: boolean | null; renapo_ok: boolean | null; status: string };
type Phase = "intro" | "id-choose" | "id-capture" | "id-result" | "selfie" | "review" | "done" | "cancelled" | "error";

function fileToBase64(file: File | Blob): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      const [meta, b64] = s.split(",");
      resolve({ base64: b64 ?? "", mime: meta?.match(/data:(.+);/)?.[1] ?? file.type ?? "image/jpeg" });
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function BiometricMobile() {
  const { token } = useParams({ from: "/biometrico/$token" });
  const get = useServerFn(getEnrollmentByToken);
  const cancel = useServerFn(cancelBiometricEnrollment);
  const startCtx = useServerFn(registerBiometricStartContext);
  const [enroll, setEnroll] = useState<Enrollment | null>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [idResult, setIdResult] = useState<IdResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const e = await get({ data: { token } });
      setEnroll(e);
      setError(null);
      if (e.status === "completed") setPhase("done");
      else if (phase === "intro" && e.status !== "pending") {
        if (e.status === "id_captured" || e.status === "id_verified") setPhase(e.status === "id_verified" ? "selfie" : "id-choose");
        else if (e.status === "face_verified" || e.status === "address_verified") setPhase("review");
      }
    } catch (err) {
      setError((err as Error).message);
      setPhase("error");
    } finally { setLoading(false); }
  }, [get, token, phase]);

  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, []);

  // Bitácora: al abrir la sesión en el móvil registramos IP pública, user-agent y GPS.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user_agent = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : undefined;
      let ip: string | undefined;
      try {
        const r = await fetch("https://api.ipify.org?format=json");
        if (r.ok) ip = (await r.json()).ip;
      } catch { /* ignore */ }
      const geo = await new Promise<{ lat: number; lng: number; accuracy?: number } | null>((resolve) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
          () => resolve(null),
          { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 },
        );
      });
      if (cancelled) return;
      try { await startCtx({ data: { token, user_agent, ip, geo } }); } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [token, startCtx]);


  async function doCancel() {
    try { await cancel({ data: { token } }); } catch { /* ignore */ }
    setPhase("cancelled");
  }

  if (loading) return <MobileShell><Center><Loader2 className="size-6 animate-spin" /></Center></MobileShell>;
  if (phase === "error" || !enroll) return <MobileShell><ErrorCard msg={error ?? "Sesión no válida"} /></MobileShell>;
  if (phase === "cancelled") return <MobileShell><Cancelled /></MobileShell>;

  function goToStep(step: "id" | "face") {
    setError(null);
    setIdResult(null);
    if (step === "id") setPhase("id-choose");
    else setPhase("selfie");
  }

  return (
    <MobileShell>
      {phase !== "intro" && <Progress phase={phase} enroll={enroll} onJump={goToStep} />}
      {phase === "intro" && <Intro onStart={() => setPhase("id-choose")} enroll={enroll} />}
      {phase === "id-choose" && <IdChoose onChoose={() => setPhase("id-capture")} enroll={enroll} setEnroll={setEnroll} />}
      {phase === "id-capture" && (
        <IdCapture
          token={token}
          enroll={enroll}
          onDone={async (res) => { setIdResult(res); await refresh(); setPhase("id-result"); }}
          onError={setError}
        />
      )}
      {phase === "id-result" && idResult && (
        <IdResultScreen
          result={idResult}
          enroll={enroll}
          onRetry={() => { setIdResult(null); setError(null); setPhase("id-capture"); }}
          onContinue={() => { setError(null); setPhase("selfie"); }}
          onCancel={doCancel}
        />
      )}
      {phase === "selfie" && <SelfieCapture token={token} onDone={() => { void refresh(); setPhase("review"); }} onError={setError} />}
      {phase === "review" && <Review token={token} enroll={enroll} onDone={() => { void refresh(); setPhase("done"); }} onError={setError} />}
      {phase === "done" && <Done />}
      {error && phase !== "id-result" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 flex gap-2">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      )}
      {phase !== "done" && phase !== "intro" && phase !== "id-result" && (
        <button onClick={doCancel} className="text-xs text-yo-txt-3 underline mt-2">Cancelar biométrico</button>
      )}
    </MobileShell>
  );
}

// ─── shells ──────────────────────────────────────────────────────────────────
function MobileShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-yo-bg text-yo-txt">
      <header className="px-5 py-4 border-b border-yo-border bg-yo-surface">
        <CumplexLogo variant="auto" className="h-7" />
      </header>
      <main className="max-w-md mx-auto px-4 py-5 flex flex-col gap-4">{children}</main>
    </div>
  );
}
function Center({ children }: { children: React.ReactNode }) { return <div className="min-h-[40vh] grid place-items-center">{children}</div>; }
function ErrorCard({ msg }: { msg: string }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
    <XCircle className="size-8 mx-auto text-red-600 mb-2" />
    <p className="text-sm text-red-800">{msg}</p>
  </div>;
}
function Cancelled() {
  return (
    <div className="rounded-xl border border-yo-border bg-yo-surface p-6 text-center">
      <XCircle className="size-10 mx-auto text-yo-txt-3 mb-2" />
      <h2 className="text-lg font-bold">Enrolamiento cancelado</h2>
      <p className="text-sm text-yo-txt-2 mt-1">Ya puedes cerrar esta ventana. Vuelve a tu computadora para generar un nuevo código si deseas reintentar.</p>
    </div>
  );
}
function Progress({ phase, enroll, onJump }: { phase: Phase; enroll: Enrollment; onJump: (step: "id" | "face") => void }) {
  const idFailed = enroll?.curp_match === false;
  const faceFailed = enroll?.face_match_ok === false;
  const steps = [
    { k: "id" as const, label: "ID", ok: enroll?.curp_match === true, failed: idFailed, active: phase === "id-choose" || phase === "id-capture" || phase === "id-result", jump: "id" as const },
    { k: "face" as const, label: "Rostro", ok: enroll?.face_match_ok === true, failed: faceFailed, active: phase === "selfie", jump: "face" as const },
    { k: "done" as const, label: "Confirmar", ok: phase === "done", failed: false, active: phase === "review", jump: null },
  ];
  return (
    <ol className="grid grid-cols-3 gap-1 text-[11px]">
      {steps.map((s, i) => {
        const tone = s.failed ? "text-red-600" : s.ok ? "text-yo-ok" : s.active ? "text-yo-ac" : "text-yo-txt-3";
        const badge = s.failed
          ? "bg-red-600 text-white border-red-600"
          : s.ok
            ? "bg-yo-ok text-white border-yo-ok"
            : s.active
              ? "bg-yo-ac text-white border-yo-ac"
              : "bg-yo-surface border-yo-border";
        const clickable = !!s.jump && (s.failed || s.ok || s.active);
        return (
          <li key={s.k} className={"flex flex-col items-center gap-1 " + tone}>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => s.jump && onJump(s.jump)}
              className={"grid place-items-center size-7 rounded-full border text-[11px] font-semibold transition " + badge + (clickable ? " cursor-pointer hover:opacity-80" : " cursor-default")}
              aria-label={s.failed ? `Reintentar ${s.label}` : s.label}
            >
              {s.failed ? <XCircle className="size-3.5" /> : s.ok ? <Check className="size-3.5" /> : i + 1}
            </button>
            {s.label}
          </li>
        );
      })}
    </ol>
  );
}

// ─── Intro ───────────────────────────────────────────────────────────────────
function Intro({ onStart, enroll }: { onStart: () => void; enroll: Enrollment }) {
  const name = enroll?.profile ? `${enroll.profile.first_name ?? ""} ${enroll.profile.last_name ?? ""}`.trim() : "";
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-yo-surface border border-yo-border p-5">
        <ShieldCheck className="size-8 text-yo-ac mb-2" />
        <h1 className="text-lg font-bold">Verificación biométrica</h1>
        {name && <p className="text-sm text-yo-txt-2 mt-1">Hola, <b>{name}</b>. Vamos a confirmar tu identidad.</p>}
      </div>
      <ol className="text-sm text-yo-txt-2 flex flex-col gap-3">
        <li className="flex gap-3"><IdCard className="size-5 text-yo-ac shrink-0" /> <span>Toma una foto clara de tu <b>INE o pasaporte</b>.</span></li>
        <li className="flex gap-3"><ScanFace className="size-5 text-yo-ac shrink-0" /> <span>Graba un <b>selfie corto</b> moviendo la cara.</span></li>
      </ol>
      <p className="text-[11px] text-yo-txt-3">
        Al continuar aceptas el tratamiento de tus datos biométricos con el fin exclusivo de verificar tu identidad.
      </p>
      <button onClick={onStart} className="h-11 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold">
        Comenzar
      </button>
    </div>
  );
}

// ─── ID choose ───────────────────────────────────────────────────────────────
function IdChoose({ onChoose, enroll, setEnroll }: { onChoose: () => void; enroll: Enrollment; setEnroll: (e: Enrollment) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">¿Qué identificación usarás?</h2>
      <button onClick={() => { setEnroll({ ...enroll!, id_type: "ine" }); onChoose(); }}
        className="rounded-xl border border-yo-border bg-yo-surface p-4 text-left hover:border-yo-ac">
        <div className="font-semibold">Credencial para votar (INE)</div>
        <div className="text-xs text-yo-txt-3 mt-1">Capturaremos el anverso y el reverso.</div>
      </button>
      <button onClick={() => { setEnroll({ ...enroll!, id_type: "passport" }); onChoose(); }}
        className="rounded-xl border border-yo-border bg-yo-surface p-4 text-left hover:border-yo-ac">
        <div className="font-semibold">Pasaporte mexicano</div>
        <div className="text-xs text-yo-txt-3 mt-1">Sólo página con foto.</div>
      </button>
    </div>
  );
}

// ─── Camera capture (front-facing or environment) ────────────────────────────
function useCamera(facing: "user" | "environment") {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!active) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        if (videoElRef.current) {
          videoElRef.current.srcObject = s;
          try { await videoElRef.current.play(); } catch { /* ignore */ }
        }
        setReady(true);
      } catch (e) {
        setErr("No se pudo acceder a la cámara: " + (e as Error).message);
      }
    })();
    return () => { active = false; streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; setReady(false); };
  }, [facing]);

  // Callback ref: re-attach stream whenever the <video> element remounts.
  const videoRef = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  const snap = useCallback(async (guideEl?: HTMLElement | null): Promise<{ base64: string; mime: string } | null> => {
    const v = videoElRef.current;
    if (!v || !streamRef.current) return null;
    const vw = v.videoWidth, vh = v.videoHeight;
    if (!vw || !vh) return null;

    let sx = 0, sy = 0, sw = vw, sh = vh;
    if (guideEl) {
      const vrect = v.getBoundingClientRect();
      const grect = guideEl.getBoundingClientRect();
      // object-cover: la imagen se escala para cubrir el contenedor;
      // parte sale del recorte visible. Calculamos ese factor.
      const scale = Math.max(vrect.width / vw, vrect.height / vh);
      const contentW = vw * scale;
      const contentH = vh * scale;
      const contentX = (vrect.width - contentW) / 2; // negativo si se recorta lateralmente
      const contentY = (vrect.height - contentH) / 2;
      const gx = grect.left - vrect.left;
      const gy = grect.top - vrect.top;
      sx = Math.max(0, Math.round((gx - contentX) / scale));
      sy = Math.max(0, Math.round((gy - contentY) / scale));
      sw = Math.max(1, Math.min(vw - sx, Math.round(grect.width / scale)));
      sh = Math.max(1, Math.min(vh - sy, Math.round(grect.height / scale)));
    }
    const canvas = document.createElement("canvas");
    canvas.width = sw; canvas.height = sh;
    canvas.getContext("2d")?.drawImage(v, sx, sy, sw, sh, 0, 0, sw, sh);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
    if (!blob) return null;
    return fileToBase64(blob);
  }, []);


  return { videoRef, ready, err, snap, streamRef };
}

// ─── ID capture with framing guide ───────────────────────────────────────────
function IdCapture({ token, enroll, onDone, onError }: { token: string; enroll: Enrollment; onDone: (res: IdResult) => void; onError: (m: string | null) => void }) {
  const cam = useCamera("environment");
  const submit = useServerFn(submitBiometricId);
  const [side, setSide] = useState<"front" | "back">("front");
  const [front, setFront] = useState<{ base64: string; mime: string } | null>(null);
  const [back, setBack] = useState<{ base64: string; mime: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const guideRef = useRef<HTMLDivElement | null>(null);

  async function capture() {
    // Recorte exacto al recuadro guía visible (no a porcentajes ciegos del video).
    const shot = await cam.snap(guideRef.current);
    if (!shot) return;
    if (side === "front") setFront(shot);
    else setBack(shot);
  }

  async function send() {
    if (!front) return;
    setBusy(true); onError(null);
    try {
      const res = await submit({ data: {
        token, id_type: (enroll?.id_type ?? "ine") as "ine" | "passport",
        front_base64: front.base64, front_mime: front.mime,
        back_base64: back?.base64, back_mime: back?.mime,
      } });
      onDone(res as IdResult);
    } catch (e) { onError((e as Error).message); }
    finally { setBusy(false); }
  }

  const shot = side === "front" ? front : back;
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">
        {enroll?.id_type === "passport" ? "Pasaporte" : side === "front" ? "INE — Frente" : "INE — Reverso"}
      </h2>
      <p className="text-xs text-yo-txt-3">Coloca la identificación dentro del recuadro. Evita reflejos.</p>

      <div className="relative aspect-[85/54] rounded-xl overflow-hidden bg-black">
        <video ref={cam.videoRef} className={"absolute inset-0 w-full h-full object-cover " + (shot ? "invisible" : "")} muted playsInline autoPlay />
        {shot && (
          <img src={`data:${shot.mime};base64,${shot.base64}`} alt="Captura" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div ref={guideRef} className="absolute inset-3 border-2 border-yo-ac/80 rounded-lg pointer-events-none" />
      </div>
      {cam.err && <p className="text-xs text-red-600">{cam.err}</p>}


      <div className="flex gap-2">
        {shot ? (
          <>
            <button onClick={() => (side === "front" ? setFront(null) : setBack(null))}
              className="flex-1 h-11 rounded-md border border-yo-border text-sm">Repetir</button>
            {enroll?.id_type === "ine" && side === "front" && (
              <button onClick={() => setSide("back")} className="flex-1 h-11 rounded-md bg-yo-txt text-white text-sm font-semibold">
                Siguiente: reverso
              </button>
            )}
            {(enroll?.id_type === "passport" || side === "back") && (
              <button onClick={send} disabled={busy}
                className="flex-1 h-11 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                Enviar y validar
              </button>
            )}
          </>
        ) : (
          <button onClick={capture} disabled={!cam.ready}
            className="flex-1 h-11 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5">
            <Camera className="size-4" /> Capturar foto
          </button>
        )}
      </div>
    </div>
  );
}

// ─── ID validation result ────────────────────────────────────────────────────
function IdResultScreen({ result, enroll, onRetry, onContinue, onCancel }: {
  result: IdResult; enroll: Enrollment;
  onRetry: () => void; onContinue: () => void; onCancel: () => void;
}) {
  const match = result.curp_match === true;
  const noCurpProfile = !result.profile_curp;
  const ocr = (enroll?.ocr_data ?? {}) as Record<string, unknown>;
  const nombre = String(ocr.nombre ?? [ocr.nombres, ocr.apellidoPaterno, ocr.apellidoMaterno].filter(Boolean).join(" ")).trim();

  return (
    <div className="flex flex-col gap-4">
      <div className={"rounded-xl border p-5 text-center " + (match ? "border-yo-ok/40 bg-yo-ok-bg" : "border-red-200 bg-red-50")}>
        {match ? <CheckCircle2 className="size-10 mx-auto text-yo-ok mb-2" /> : <XCircle className="size-10 mx-auto text-red-600 mb-2" />}
        <h2 className="text-lg font-bold">
          {match ? "Identificación válida" : noCurpProfile ? "No podemos comparar la CURP" : "Los datos no coinciden"}
        </h2>
        <p className={"text-sm mt-1 " + (match ? "text-yo-txt-2" : "text-red-800")}>
          {match
            ? "Los datos del documento coinciden con la CURP registrada en tu onboarding."
            : noCurpProfile
              ? "No hay una CURP registrada en tu perfil para comparar. Cancela y captura tu CURP en el onboarding antes de continuar."
              : "La CURP leída en tu identificación no coincide con la registrada en el onboarding."}
        </p>
      </div>

      <div className="rounded-xl border border-yo-border bg-yo-surface divide-y divide-yo-border text-sm">
        <Row k="Nombre en el documento" v={nombre || "—"} />
        <Row k="CURP en el documento" v={result.ocr_curp ?? "—"} mono />
        <Row k="CURP en tu perfil" v={result.profile_curp ?? "—"} mono />
        <Row k="Validación RENAPO" v={result.renapo_ok == null ? "—" : result.renapo_ok ? "OK" : "Sin coincidencia"} />
        <Row k="Coincidencia" v={match ? "Sí" : "No"} tone={match ? "ok" : "err"} />
      </div>

      <div className="flex flex-col gap-2">
        {match ? (
          <button onClick={onContinue}
            className="h-11 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5">
            <ArrowRight className="size-4" /> Continuar con selfie
          </button>
        ) : (
          <button onClick={onRetry}
            className="h-11 rounded-md bg-yo-txt text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5">
            <RefreshCw className="size-4" /> Repetir captura
          </button>
        )}
        <button onClick={onCancel} className="h-11 rounded-md border border-yo-border text-sm font-semibold">
          Cancelar enrolamiento
        </button>
      </div>
    </div>
  );
}

function Row({ k, v, mono, tone }: { k: string; v: string; mono?: boolean; tone?: "ok" | "err" }) {
  return (
    <div className="flex justify-between gap-3 px-3 py-2">
      <span className="text-yo-txt-3">{k}</span>
      <span className={"font-medium text-right " + (mono ? "font-mono " : "") + (tone === "ok" ? "text-yo-ok " : tone === "err" ? "text-red-700 " : "")}>{v}</span>
    </div>
  );
}

// ─── Selfie + short video ────────────────────────────────────────────────────
function SelfieCapture({ token, onDone, onError }: { token: string; onDone: () => void; onError: (m: string | null) => void }) {
  const cam = useCamera("user");
  const submit = useServerFn(submitBiometricSelfie);
  const [recording, setRecording] = useState(false);
  const [videoB64, setVideoB64] = useState<{ base64: string; mime: string } | null>(null);
  const [selfie, setSelfie] = useState<{ base64: string; mime: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [coachIdx, setCoachIdx] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const chunks = useRef<Blob[]>([]);
  const recRef = useRef<MediaRecorder | null>(null);
  const guideRef = useRef<HTMLDivElement | null>(null);

  // Mensajes de guía que se rotan durante la grabación.
  const REC_MS = 5000;
  const coachSteps = [
    { t: "Centra tu rostro en el círculo", tone: "text-white" },
    { t: "Acércate un poco a la cámara", tone: "text-yo-ac" },
    { t: "Ahora aléjate ligeramente", tone: "text-yo-ac" },
    { t: "Gira suavemente la cabeza", tone: "text-yo-ac" },
    { t: "Mira al frente y no te muevas", tone: "text-yo-ok" },
  ];

  async function record() {
    if (!cam.streamRef.current) return;
    chunks.current = [];
    const rec = new MediaRecorder(cam.streamRef.current, { mimeType: "video/webm" });
    recRef.current = rec;
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = async () => {
      const blob = new Blob(chunks.current, { type: "video/webm" });
      setVideoB64(await fileToBase64(blob));
      const shot = await cam.snap(guideRef.current);
      if (shot) setSelfie(shot);
    };
    rec.start();
    setRecording(true);
    setCoachIdx(0);
    setCountdown(Math.ceil(REC_MS / 1000));

    const stepInterval = Math.floor(REC_MS / coachSteps.length);
    const coachTimer = setInterval(() => setCoachIdx((i) => Math.min(i + 1, coachSteps.length - 1)), stepInterval);
    const countTimer = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);

    setTimeout(() => {
      rec.stop();
      setRecording(false);
      clearInterval(coachTimer);
      clearInterval(countTimer);
      setCountdown(0);
    }, REC_MS);
  }

  async function send() {
    if (!selfie) return;
    setBusy(true); onError(null);
    try {
      await submit({ data: {
        token, selfie_base64: selfie.base64, selfie_mime: selfie.mime,
        video_base64: videoB64?.base64, video_mime: videoB64?.mime,
      } });
      onDone();
    } catch (e) { onError((e as Error).message); }
    finally { setBusy(false); }
  }

  const coach = coachSteps[coachIdx];

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">Selfie y prueba de vida</h2>
      <p className="text-xs text-yo-txt-3">Sigue las indicaciones en pantalla mientras grabamos {Math.round(REC_MS / 1000)} segundos.</p>
      <div className="relative aspect-square rounded-xl overflow-hidden bg-black">
        <video ref={cam.videoRef} className={"absolute inset-0 w-full h-full object-cover scale-x-[-1] " + (selfie ? "invisible" : "")} muted playsInline autoPlay />
        {selfie && (
          <img src={`data:${selfie.mime};base64,${selfie.base64}`} alt="Selfie" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div ref={guideRef} className="absolute inset-6 rounded-full border-2 border-yo-ac/80 pointer-events-none" />
        {recording && (
          <>
            <span className="absolute top-3 left-3 bg-red-600 text-white text-[11px] px-2 py-0.5 rounded-full animate-pulse inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-white" /> REC {countdown}s
            </span>
            <div className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none">
              <span className={"px-3 py-1.5 rounded-full bg-black/70 backdrop-blur text-xs font-semibold " + coach.tone}>
                {coach.t}
              </span>
            </div>
          </>
        )}
        {!recording && !selfie && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none">
            <span className="px-3 py-1.5 rounded-full bg-black/60 text-white text-xs">
              Coloca tu rostro dentro del círculo
            </span>
          </div>
        )}
      </div>
      {cam.err && <p className="text-xs text-red-600">{cam.err}</p>}
      <div className="flex gap-2">
        {selfie ? (
          <>
            <button onClick={() => { setSelfie(null); setVideoB64(null); }} className="flex-1 h-11 rounded-md border border-yo-border text-sm">Repetir</button>
            <button onClick={send} disabled={busy} className="flex-1 h-11 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} Enviar
            </button>
          </>
        ) : (
          <button onClick={record} disabled={!cam.ready || recording} className="flex-1 h-11 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5">
            <Video className="size-4" /> {recording ? `Grabando… ${countdown}s` : `Iniciar grabación (${Math.round(REC_MS / 1000)}s)`}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Review ──────────────────────────────────────────────────────────────────
function Review({ token, enroll, onDone, onError }: { token: string; enroll: Enrollment; onDone: () => void; onError: (m: string | null) => void }) {
  const confirm = useServerFn(confirmBiometricEnrollment);
  const completeCtx = useServerFn(registerBiometricCompleteContext);
  const [busy, setBusy] = useState(false);
  const ocr = (enroll?.ocr_data ?? {}) as Record<string, unknown>;
  const name = String(ocr.nombre ?? [ocr.nombres, ocr.apellidoPaterno, ocr.apellidoMaterno].filter(Boolean).join(" ")).trim();
  const curp = enroll?.profile?.curp;
  const rows: Array<[string, string | number | null | undefined]> = [
    ["Documento", enroll?.id_type === "ine" ? "INE" : "Pasaporte"],
    ["Nombre (OCR)", name || "—"],
    ["CURP en perfil", curp ?? "—"],
    ["CURP coincide", enroll?.curp_match ? "Sí" : "No"],
    ["Match facial", enroll?.face_score != null ? `${Number(enroll.face_score).toFixed(2)} %` : "—"],
  ];
  async function send() {
    setBusy(true); onError(null);
    try {
      // Bitácora de cierre: IP, user-agent y GPS al confirmar.
      try {
        const user_agent = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : undefined;
        let ip: string | undefined;
        try { const r = await fetch("https://api.ipify.org?format=json"); if (r.ok) ip = (await r.json()).ip; } catch { /* ignore */ }
        const geo = await new Promise<{ lat: number; lng: number; accuracy?: number } | null>((resolve) => {
          if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
          navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
            () => resolve(null),
            { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 },
          );
        });
        await completeCtx({ data: { token, user_agent, ip, geo } });
      } catch { /* best-effort */ }
      await confirm({ data: { token } }); onDone();
    }
    catch (e) { onError((e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">Confirma tu información</h2>
      <div className="rounded-xl border border-yo-border bg-yo-surface divide-y divide-yo-border text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 px-3 py-2">
            <span className="text-yo-txt-3">{k}</span>
            <span className="font-medium text-right">{String(v ?? "—")}</span>
          </div>
        ))}
      </div>
      <button onClick={send} disabled={busy}
        className="h-11 rounded-md bg-yo-ac hover:bg-yo-ac-h text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Confirmar enrolamiento
      </button>
    </div>
  );
}

function Done() {
  const [left, setLeft] = useState(5);
  useEffect(() => {
    const t = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    const close = setTimeout(() => {
      try { window.close(); } catch { /* ignore */ }
      // Fallback si el navegador no cierra la pestaña
      try { window.location.href = "about:blank"; } catch { /* ignore */ }
    }, 5000);
    return () => { clearInterval(t); clearTimeout(close); };
  }, []);
  return (
    <div className="rounded-xl border border-yo-ok/40 bg-yo-ok-bg p-6 text-center">
      <CheckCircle2 className="size-10 mx-auto text-yo-ok mb-2" />
      <h2 className="text-lg font-bold">¡Listo!</h2>
      <p className="text-sm text-yo-txt-2 mt-1">Regresa a tu computadora para continuar con el onboarding.</p>
      <p className="mt-3 text-xs text-yo-txt-3">
        Esta ventana se cerrará automáticamente en <b className="text-yo-txt tabular-nums">{left}</b> {left === 1 ? "segundo" : "segundos"}.
      </p>
    </div>
  );
}
