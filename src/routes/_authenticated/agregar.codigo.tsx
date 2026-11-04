import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Camera, CameraOff, Flashlight, FlashlightOff, Loader2, MessageSquareText, PenLine, RefreshCw, ScanBarcode } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Page, PageHeader } from "@/components/kcal/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { leerEtiqueta } from "@/lib/ai.functions";
import { comprimirImagen } from "@/lib/imagen";
import { buscarProducto } from "@/lib/off.functions";
import { codigoValido, normalizarCodigo, valoresProducto, type ProductoOFF } from "@/lib/off";
import { crearIngrediente, fechaLocal, horaLocal, momentoPorHora, type Momento } from "@/lib/nutri";
import { momentoSearch } from "@/lib/search";
import { borradorStore } from "@/lib/stores";

export const Route = createFileRoute("/_authenticated/agregar/codigo")({
  validateSearch: momentoSearch,
  head: () => ({
    meta: [
      { title: "Escanear código — KcalCountPal" },
      { name: "description", content: "Escaneá el código de barras de un producto y cargá sus nutrientes." },
      { property: "og:title", content: "Escanear código — KcalCountPal" },
      { property: "og:description", content: "Escaneá el código de barras de un producto y cargá sus nutrientes." },
    ],
  }),
  component: () => {
    const { momento } = Route.useSearch();
    return (
      <Page>
        <PageHeader title="Escanear código" back />
        <Escaner momento={momento ?? momentoPorHora(horaLocal())} />
      </Page>
    );
  },
});

type Estado = "iniciando" | "escaneando" | "denegado" | "sin_camara" | "buscando" | "detenido" | "leyendo";
type Fallo = { mensaje: string; nombre: string | null; codigo: string | null; etiqueta: boolean } | null;
type Motor = "nativo" | "ZXing" | null;

type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

function irARevisar(p: ProductoOFF, momento: Momento, navigate: ReturnType<typeof useNavigate>, fotoUrl: string | null = null) {
  const cant = p.base === "porcion" ? 1 : 100;
  const v = valoresProducto(p, cant);
  const ing = crearIngrediente("off", p.nombre, p.base === "porcion" ? 0 : 100, v, p.categoria ?? "Otros");
  borradorStore.set({
    origen: "codigo",
    descripcion: null,
    fotoUrl,
    producto: p,
    resultado: {
      nombre_plato: p.nombre,
      confianza: "alta",
      kcal_min: v.calorias,
      kcal_max: v.calorias,
      nota: null,
      corregido_atwater: false,
      ingredientes: [ing],
      totales: v,
    },
  });
  navigate({ to: "/agregar/revisar", search: { momento } });
}

const MENSAJES: Record<string, string> = {
  no_encontrado: "No encontramos este producto.",
  sin_datos: "Este producto no tiene datos nutricionales.",
  invalido: "Los datos de la etiqueta de este producto no son válidos.",
  codigo_invalido: "Código inválido, revisá que esté bien escrito.",
  red: "No pudimos consultar la base de productos. Revisá tu conexión.",
};

function Escaner({ momento }: { momento: Momento }) {
  const buscar = useServerFn(buscarProducto);
  const leer = useServerFn(leerEtiqueta);
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const listoRef = useRef(false);
  const [estado, setEstado] = useState<Estado>("iniciando");
  const [fallo, setFallo] = useState<Fallo>(null);
  const [motor, setMotor] = useState<Motor>(null);
  const [linterna, setLinterna] = useState<boolean | null>(null);
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  /** Releases the camera completely (not just hidden). */
  const detener = useCallback(() => {
    stopRef.current();
    stopRef.current = () => {};
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const consultar = useCallback(
    async (crudo: string) => {
      const codigo = normalizarCodigo(crudo);
      setEstado("buscando");
      setFallo(null);
      try {
        const r = await buscar({ data: { codigo: crudo } });
        if (r.ok) return irARevisar(r.producto, momento, navigate);
        setFallo({
          mensaje: MENSAJES[r.motivo] ?? "No pudimos leer este producto.",
          nombre: r.nombre,
          codigo,
          etiqueta: r.motivo === "no_encontrado" || r.motivo === "sin_datos" || r.motivo === "invalido",
        });
      } catch {
        setFallo({ mensaje: "Se cortó la conexión. Reintentá.", nombre: null, codigo, etiqueta: false });
      }
      setEstado("detenido");
    },
    [buscar, momento, navigate],
  );

  const detectado = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (listoRef.current || !codigoValido(code)) return;
      listoRef.current = true;
      detener();
      navigator.vibrate?.(80);
      void consultar(code);
    },
    [consultar, detener],
  );

  useEffect(() => {
    let cancelado = false;
    listoRef.current = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setEstado("sin_camara"); return; }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
          },
          audio: false,
        });
      } catch (e) {
        const n = (e as DOMException)?.name;
        setEstado(n === "NotAllowedError" || n === "SecurityError" ? "denegado" : "sin_camara");
        return;
      }
      if (cancelado) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const caps = (track?.getCapabilities?.() ?? {}) as { focusMode?: string[]; torch?: boolean };
      if (caps.focusMode?.includes("continuous")) {
        track?.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
      }
      setLinterna(caps.torch ? false : null);
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play().catch(() => {});
      setEstado("escaneando");

      const formatos = ["ean_13", "ean_8", "upc_a"];
      const BD = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
      const soportados = BD ? await BD.getSupportedFormats?.().catch(() => []) : [];
      if (cancelado) return;
      if (BD && formatos.some((f) => soportados?.includes(f))) {
        setMotor("nativo");
        const det = new BD({ formats: formatos.filter((f) => soportados?.includes(f)) });
        let activo = true;
        stopRef.current = () => { activo = false; };
        const loop = async () => {
          if (!activo || listoRef.current) return;
          try {
            const r = await det.detect(video);
            for (const b of r) detectado(b.rawValue);
          } catch { /* frame not ready */ }
          if (activo) setTimeout(loop, 150);
        };
        void loop();
      } else {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (cancelado) return;
        setMotor("ZXing");
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        const reader = new BrowserMultiFormatReader(hints);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        let activo = true;
        stopRef.current = () => { activo = false; };
        // ~10 decodes per second over the central crop (where the guide box is).
        const tick = () => {
          if (!activo || listoRef.current || !ctx) return;
          const w = video.videoWidth, h = video.videoHeight;
          if (w && h) {
            const cw = Math.round(w * 0.8), ch = Math.round(h * 0.4);
            canvas.width = cw; canvas.height = ch;
            ctx.drawImage(video, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, cw, ch);
            try { detectado(reader.decodeFromCanvas(canvas).getText()); } catch { /* nothing found in this frame */ }
          }
          if (activo) setTimeout(tick, 100);
        };
        tick();
      }
    })();
    return () => { cancelado = true; detener(); };
  }, [intento, detectado, detener]);

  async function toggleLinterna() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || linterna === null) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !linterna } as MediaTrackConstraintSet] });
      setLinterna(!linterna);
    } catch { setLinterna(null); }
  }

  function enviarManual() {
    const c = manual.replace(/\s/g, "");
    if (!codigoValido(c)) { setManualError("Código inválido, revisá que esté bien escrito"); return; }
    setManualError(null);
    listoRef.current = true;
    detener();
    void consultar(c);
  }

  function escanearOtro() {
    setFallo(null);
    detener();
    setEstado("iniciando");
    setIntento((i) => i + 1);
  }

  async function fotoEtiqueta(f?: File) {
    if (!f || !fallo?.codigo) return;
    const actual = fallo;
    setEstado("leyendo");
    try {
      const { dataUrl } = await comprimirImagen(f);
      const r = await leer({ data: { imagen: dataUrl, codigo: actual.codigo!, nombre: actual.nombre, fecha_local: fechaLocal() } });
      if (r.ok) return irARevisar(r.producto, momento, navigate, dataUrl);
      setFallo({ ...actual, mensaje: r.mensaje });
    } catch {
      setFallo({ ...actual, mensaje: "No pudimos leer la foto. Reintentá." });
    }
    setEstado("detenido");
  }

  const camaraViva = estado === "escaneando" || estado === "iniciando";
  const sinCamara = estado === "denegado" || estado === "sin_camara";

  return (
    <div className="space-y-5 pb-4">
      <input ref={fotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void fotoEtiqueta(e.target.files?.[0]); e.target.value = ""; }} />

      {(camaraViva || sinCamara) && (
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-muted">
          <video ref={videoRef} playsInline muted className={"size-full object-cover " + (camaraViva ? "" : "hidden")} />
          {estado === "escaneando" && (
            <>
              <div className="pointer-events-none absolute inset-x-[10%] top-1/2 h-[40%] -translate-y-1/2 rounded-2xl border-2 border-primary-foreground/90 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]" />
              {motor && (
                <span className="absolute bottom-2 left-3 rounded-full bg-card/85 px-2 py-0.5 text-[10px] text-muted-foreground">Lector: {motor}</span>
              )}
              {linterna !== null && (
                <button
                  onClick={toggleLinterna}
                  className="absolute right-3 top-3 rounded-full bg-card/90 p-2.5 shadow-soft"
                  aria-label={linterna ? "Apagar linterna" : "Encender linterna"}
                >
                  {linterna ? <FlashlightOff className="size-5" /> : <Flashlight className="size-5" />}
                </button>
              )}
            </>
          )}
          {sinCamara && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
              <CameraOff className="size-8 text-muted-foreground" />
              <p className="font-semibold">
                {estado === "denegado" ? "No tenemos permiso para usar la cámara" : "No encontramos una cámara disponible"}
              </p>
              <p className="text-sm text-muted-foreground">
                {estado === "denegado"
                  ? "Habilitala desde el candado de la barra de direcciones (Permisos → Cámara) y tocá Reintentar. También podés escribir el código abajo."
                  : "Podés escribir el código de barras abajo."}
              </p>
              <Button size="sm" variant="outline" className="mt-2 rounded-full" onClick={escanearOtro}>
                <RefreshCw className="size-3.5" /> Reintentar
              </Button>
            </div>
          )}
        </div>
      )}
      {estado === "escaneando" && <p className="text-center text-sm text-muted-foreground">Apuntá al código de barras dentro del recuadro</p>}

      {(estado === "buscando" || estado === "leyendo") && (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-muted py-8">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="font-semibold">{estado === "leyendo" ? "Leyendo la etiqueta…" : "Buscando el producto…"}</p>
        </div>
      )}

      {fallo && estado === "detenido" && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex gap-2 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="min-w-0">
              <p>{fallo.mensaje}</p>
              {fallo.nombre && <p className="mt-0.5 text-muted-foreground">{fallo.nombre}</p>}
              <p className="mt-1 text-xs text-muted-foreground">
                {fallo.codigo && <>Código {fallo.codigo}</>}{motor && <> · Lector: {motor}</>}
              </p>
            </div>
          </div>
          {fallo.etiqueta && fallo.codigo && (
            <Button className="mt-3 h-11 w-full rounded-full" onClick={() => fotoRef.current?.click()}>
              <Camera className="size-4" /> Fotografiar etiqueta nutricional
            </Button>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="rounded-full" asChild>
              <Link to="/agregar/mis-comidas" search={{ tab: "rapido", momento, nombre: fallo.nombre ?? undefined, codigo: fallo.codigo ?? undefined }}>
                <PenLine className="size-3.5" /> Cargar manualmente
              </Link>
            </Button>
            <Button size="sm" variant="outline" className="rounded-full" asChild>
              <Link to="/agregar/describir" search={{ momento, texto: fallo.nombre ?? undefined }}>
                <MessageSquareText className="size-3.5" /> Describir con IA
              </Link>
            </Button>
          </div>
          <Button size="sm" variant="ghost" className="mt-2 rounded-full" onClick={escanearOtro}>
            <ScanBarcode className="size-3.5" /> Escanear otro
          </Button>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-semibold">¿No lo lee? Escribí el código</p>
        <div className="flex gap-2">
          <Input
            inputMode="numeric"
            placeholder="Ej: 7790070012345"
            value={manual}
            onChange={(e) => { setManual(e.target.value.replace(/[^\d\s]/g, "")); setManualError(null); }}
            onKeyDown={(e) => e.key === "Enter" && enviarManual()}
            className="h-11 rounded-full"
            aria-label="Código de barras"
          />
          <Button className="h-11 rounded-full" onClick={enviarManual} disabled={estado === "buscando" || estado === "leyendo" || manual.replace(/\s/g, "").length < 8}>
            Buscar
          </Button>
        </div>
        {manualError && <p className="mt-2 text-sm text-destructive">{manualError}</p>}
      </div>
    </div>
  );
}
