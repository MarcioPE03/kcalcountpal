import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Camera, ImagePlus, RefreshCw, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DescripcionInput } from "./editors";
import { analizarComida } from "@/lib/ai.functions";
import { comprimirImagen } from "@/lib/imagen";
import { borradorStore } from "@/lib/stores";
import { fechaLocal, type Momento } from "@/lib/nutri";

const MENSAJES = [
  "Mirando tu plato…",
  "Identificando ingredientes…",
  "Estimando porciones…",
  "Sumando aceite y aderezos…",
  "Calculando nutrientes…",
];

export function Analizando({ foto }: { foto?: string | null }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % MENSAJES.length), 1800);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <div className="relative">
        {foto ? (
          <img src={foto} alt="" className="size-40 rounded-3xl object-cover opacity-80" />
        ) : (
          <div className="size-40 rounded-3xl bg-primary-soft" />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-card text-primary shadow-soft animate-pulse-soft">
            <Sparkles className="size-8" />
          </span>
        </div>
      </div>
      <p key={i} className="mt-6 font-display text-lg font-semibold animate-in fade-in slide-in-from-bottom-1 duration-500">
        {MENSAJES[i]}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">Esto tarda unos segundos</p>
    </div>
  );
}

export function AnalizarFlow({ conFoto, momento }: { conFoto: boolean; momento: Momento }) {
  const analizar = useServerFn(analizarComida);
  const navigate = useNavigate();
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState<{ blob: Blob; dataUrl: string } | null>(null);
  const [desc, setDesc] = useState("");
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function elegir(f?: File) {
    if (!f) return;
    setError(null);
    setProcesando(true);
    try {
      setFoto(await comprimirImagen(f));
    } catch {
      setError("No pudimos leer esa imagen. Probá con otra.");
    } finally {
      setProcesando(false);
    }
  }

  async function enviar() {
    if (cargando) return;
    setError(null);
    setCargando(true);
    try {
      const r = await analizar({
        data: { imagen: foto?.dataUrl ?? null, descripcion: desc.trim() || null, fecha_local: fechaLocal() },
      });
      if (!r.ok) {
        setError(r.mensaje);
        return;
      }
      borradorStore.set({
        origen: foto ? "foto" : "texto",
        descripcion: desc.trim() || null,
        foto: foto?.blob ?? null,
        fotoUrl: foto?.dataUrl ?? null,
        resultado: r.resultado,
      });
      navigate({ to: "/agregar/revisar", search: { momento } });
    } catch {
      setError("Se cortó la conexión. Revisá tu internet y reintentá.");
    } finally {
      setCargando(false);
    }
  }

  if (cargando) return <Analizando foto={foto?.dataUrl} />;

  const puede = conFoto ? !!foto : desc.trim().length > 2;

  return (
    <div className="space-y-5">
      {conFoto && (
        <div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => elegir(e.target.files?.[0])} />
          <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={(e) => elegir(e.target.files?.[0])} />
          {foto ? (
            <div className="relative overflow-hidden rounded-3xl">
              <img src={foto.dataUrl} alt="Tu comida" className="aspect-square w-full object-cover" />
              <button
                onClick={() => setFoto(null)}
                className="absolute right-3 top-3 rounded-full bg-card/90 p-2 shadow-soft"
                aria-label="Quitar foto"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => camRef.current?.click()}
                disabled={procesando}
                className="flex aspect-square flex-col items-center justify-center gap-3 rounded-3xl bg-primary text-primary-foreground shadow-soft active:scale-[0.98]"
              >
                <Camera className="size-9" />
                <span className="font-semibold">Sacar foto</span>
              </button>
              <button
                onClick={() => galRef.current?.click()}
                disabled={procesando}
                className="flex aspect-square flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed bg-card active:scale-[0.98]"
              >
                <ImagePlus className="size-9 text-primary" />
                <span className="font-semibold">Galería</span>
              </button>
            </div>
          )}
          {procesando && <p className="mt-2 text-center text-sm text-muted-foreground">Preparando la foto…</p>}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-semibold">
          {conFoto ? "Describila (opcional, pero ayuda mucho)" : "¿Qué comiste?"}
        </p>
        <DescripcionInput
          value={desc}
          onChange={setDesc}
          placeholder={
            conFoto
              ? "Ej: 200 g de pollo a la plancha, arroz, cocinado con poco aceite"
              : "Ej: 2 empanadas de carne al horno y una manzana"
          }
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex gap-2 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p>{error}</p>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" className="rounded-full" onClick={enviar} disabled={!puede}>
              <RefreshCw className="size-3.5" /> Reintentar
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full" asChild>
              <Link to="/agregar/manual" search={{ momento }}>Cargar manualmente</Link>
            </Button>
          </div>
        </div>
      )}

      <Button className="h-13 w-full rounded-full text-base" disabled={!puede || cargando || procesando} onClick={enviar}>
        <Sparkles className="size-5" /> Analizar con IA
      </Button>
    </div>
  );
}
