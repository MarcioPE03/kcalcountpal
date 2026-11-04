import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, CameraOff, Flashlight, FlashlightOff, Loader2, MessageSquareText, PenLine, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Page, PageHeader } from "@/components/kcal/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buscarProducto } from "@/lib/off.functions";
import { codigoValido, valoresPara, type ProductoOFF } from "@/lib/off";
import { crearIngrediente, horaLocal, momentoPorHora, type Momento } from "@/lib/nutri";
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

type Estado = "iniciando" | "escaneando" | "denegado" | "sin_camara" | "buscando";
type Fallo = { mensaje: string; nombre: string | null } | null;

type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

function irARevisar(p: ProductoOFF, momento: Momento, navigate: ReturnType<typeof useNavigate>) {
  const v = valoresPara(p.por100, 100);
  const ing = crearIngrediente("off", p.nombre, 100, v, "Otros");
  borradorStore.set({
    origen: "codigo",
    descripcion: null,
    fotoUrl: null,
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

function Escaner({ momento }: { momento: Momento }) {
  const buscar = useServerFn(buscarProducto);
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const listoRef = useRef(false);
  const [estado, setEstado] = useState<Estado>("iniciando");
  const [fallo, setFallo] = useState<Fallo>(null);
  const [linterna, setLinterna] = useState<boolean | null>(null);
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  const detener = useCallback(() => {
    stopRef.current();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const consultar = useCallback(
    async (codigo: string) => {
      setEstado("buscando");
      setFallo(null);
      try {
        const r = await buscar({ data: { codigo } });
        if (r.ok) return irARevisar(r.producto, momento, navigate);
        const mensajes: Record<string, string> = {
          no_encontrado: "No encontramos este producto en Open Food Facts.",
          sin_datos: "Este producto no tiene datos nutricionales completos.",
          invalido: "Los datos de la etiqueta de este producto no son válidos.",
          codigo_invalido: "Código inválido, revisá que esté bien escrito.",
          red: "No pudimos consultar la base de productos. Revisá tu conexión.",
        };
        setFallo({ mensaje: mensajes[r.motivo] ?? "No pudimos leer este producto.", nombre: r.nombre });
      } catch {
        setFallo({ mensaje: "Se cortó la conexión. Reintentá.", nombre: null });
      }
      setEstado("escaneando");
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
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
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

      const BD = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
      const formatos = ["ean_13", "ean_8", "upc_a"];
      const soportados = BD ? await BD.getSupportedFormats?.().catch(() => []) : [];
      if (BD && formatos.some((f) => soportados?.includes(f))) {
        const det = new BD({ formats: formatos.filter((f) => soportados?.includes(f)) });
        let activo = true;
        stopRef.current = () => { activo = false; };
        const loop = async () => {
          if (!activo || listoRef.current) return;
          try {
            const r = await det.detect(video);
            for (const b of r) detectado(b.rawValue);
          } catch { /* frame not ready */ }
          if (activo) setTimeout(loop, 200);
        };
        void loop();
      } else {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (cancelado) return;
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A]);
        const reader = new BrowserMultiFormatReader(hints);
        const controls = await reader.decodeFromVideoElement(video, (res) => { if (res) detectado(res.getText()); });
        stopRef.current = () => controls.stop();
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

  function reintentar() {
    setFallo(null);
    detener();
    setEstado("iniciando");
    setIntento((i) => i + 1);
  }

  const camaraViva = estado === "escaneando" && !listoRef.current;

  return (
    <div className="space-y-5">
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-muted">
        <video ref={videoRef} playsInline muted className={"size-full object-cover " + (camaraViva || estado === "iniciando" ? "" : "hidden")} />
        {camaraViva && (
          <>
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-2xl border-2 border-primary-foreground/80" />
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
        {estado === "buscando" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="font-semibold">Buscando el producto…</p>
          </div>
        )}
        {(estado === "denegado" || estado === "sin_camara") && (
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
            <Button size="sm" variant="outline" className="mt-2 rounded-full" onClick={reintentar}>
              <RefreshCw className="size-3.5" /> Reintentar
            </Button>
          </div>
        )}
        {!camaraViva && estado === "escaneando" && fallo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button variant="outline" className="rounded-full" onClick={reintentar}>
              <RefreshCw className="size-4" /> Escanear otro
            </Button>
          </div>
        )}
      </div>
      {camaraViva && <p className="text-center text-sm text-muted-foreground">Apuntá al código de barras del envase</p>}

      {fallo && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex gap-2 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p>{fallo.mensaje}</p>
              {fallo.nombre && <p className="mt-0.5 text-muted-foreground">{fallo.nombre}</p>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="rounded-full" asChild>
              <Link to="/agregar/manual" search={{ momento }}><PenLine className="size-3.5" /> Cargar manualmente</Link>
            </Button>
            <Button size="sm" variant="outline" className="rounded-full" asChild>
              <Link to="/agregar/describir" search={{ momento, texto: fallo.nombre ?? undefined }}>
                <MessageSquareText className="size-3.5" /> Describir con IA
              </Link>
            </Button>
          </div>
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
          <Button className="h-11 rounded-full" onClick={enviarManual} disabled={estado === "buscando" || manual.replace(/\s/g, "").length < 8}>
            Buscar
          </Button>
        </div>
        {manualError && <p className="mt-2 text-sm text-destructive">{manualError}</p>}
      </div>
    </div>
  );
}
