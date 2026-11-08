import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2, Sparkles, Undo2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/kcal/layout";
import { DescripcionInput } from "@/components/kcal/editors";
import { Button } from "@/components/ui/button";
import { corregirComida } from "@/lib/ai.functions";
import { MAX_ACLARACION, apilar, deshacer, diffCorreccion, type DiffCorreccion } from "@/lib/correccion";
import { fechaLocal, fmt, type Ingrediente } from "@/lib/nutri";

/**
 * "¿Querés corregir o aclarar algo?" card. Nothing is persisted here: the parent receives the new list
 * via onAplicar and keeps saving under its own button.
 */
export function CorregirConIA({ items, nombrePlato, imagen, onAplicar }: {
  items: Ingrediente[];
  nombrePlato: string;
  /** Compressed photo, only while still in memory on the review screen. */
  imagen?: string | null;
  onAplicar: (items: Ingrediente[]) => void;
}) {
  const corregir = useServerFn(corregirComida);
  const [texto, setTexto] = useState("");
  const [corriendo, setCorriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pregunta, setPregunta] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ despues: Ingrediente[]; cambios: string[]; diff: DiffCorreccion } | null>(null);
  const [historial, setHistorial] = useState<Ingrediente[][]>([]);
  const enVuelo = useRef(false);

  async function enviar() {
    const aclaracion = texto.trim();
    if (!aclaracion || enVuelo.current || items.length === 0) return;
    enVuelo.current = true;
    setCorriendo(true);
    setError(null);
    setPregunta(null);
    setPreview(null);
    try {
      const imagenValida = imagen && imagen.startsWith("data:image/") ? imagen : null;
      const r = await corregir({ data: { ingredientes: items, nombre_plato: nombrePlato, aclaracion, imagen: imagenValida, fecha_local: fechaLocal() } });
      if (!r.ok) { setError(r.mensaje); return; }
      if (r.pregunta) { setPregunta(r.pregunta); return; }
      setPreview({ despues: r.ingredientes, cambios: r.cambios, diff: diffCorreccion(items, r.ingredientes) });
    } catch (e) {
      console.error(e);
      setError("No pudimos corregir la comida. Reintentá.");
    } finally {
      enVuelo.current = false;
      setCorriendo(false);
    }
  }

  function aplicar() {
    if (!preview || preview.diff.vacia) return;
    setHistorial((h) => apilar(h, items));
    onAplicar(preview.despues);
    setPreview(null);
    setTexto("");
    toast.success("Corrección aplicada");
  }

  function volver() {
    const { anterior, resto } = deshacer(historial);
    if (!anterior) return;
    setHistorial(resto);
    onAplicar(anterior);
  }

  const d = preview?.diff;
  return (
    <Card className="mt-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-bold">¿Querés corregir o aclarar algo?</h2>
        {historial.length > 0 && (
          <Button variant="ghost" size="sm" className="rounded-full" onClick={volver}><Undo2 className="size-4" /> Deshacer</Button>
        )}
      </div>
      <DescripcionInput value={texto} onChange={setTexto} maxLength={MAX_ACLARACION}
        placeholder="Ej: no comí la grasa del bife, eran 150 g de arroz, sin aceite" />
      <Button className="mt-3 w-full rounded-full" disabled={!texto.trim() || corriendo || items.length === 0} onClick={enviar}>
        {corriendo ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {corriendo ? "Corrigiendo…" : "Corregir"}
      </Button>

      {error && (
        <div className="mt-3 rounded-2xl bg-muted p-3 text-sm">
          <p>{error}</p>
          <Button variant="outline" size="sm" className="mt-2 rounded-full" onClick={enviar} disabled={corriendo}>Reintentar</Button>
        </div>
      )}
      {pregunta && <p className="mt-3 rounded-2xl bg-primary-soft p-3 text-sm">{pregunta}</p>}

      {preview && d && (
        <div className="mt-4 rounded-2xl border p-3">
          <p className="font-display text-lg font-bold tabular">Antes {fmt(d.kcalAntes)} kcal → Después {fmt(d.kcalDespues)} kcal</p>
          {d.cambioGrande && (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium"><AlertTriangle className="size-3.5 text-carbs" /> El total cambia más de un 50 %. Revisalo antes de aplicar.</p>
          )}
          {d.sinCambios && <p className="mt-2 text-sm text-muted-foreground">La IA no encontró nada para cambiar.</p>}
          <ul className="mt-2 space-y-1 text-sm">
            {d.eliminadas.map((i) => <li key={"e" + i.id}><span className="font-medium">Se elimina:</span> {i.nombre} <span className="text-muted-foreground tabular">(−{fmt(i.calorias)} kcal)</span></li>)}
            {d.modificadas.map((m) => (
              <li key={"m" + m.despues.id}>
                <span className="font-medium">Cambia:</span> {m.despues.nombre} <span className="text-muted-foreground tabular">({fmt(m.antes.gramos)} → {fmt(m.despues.gramos)} g · {fmt(m.antes.calorias)} → {fmt(m.despues.calorias)} kcal)</span>
                {m.manual && <span className="ml-1 rounded-full bg-carbs/15 px-2 py-0.5 text-[11px] font-medium">editada a mano, se modificará</span>}
              </li>
            ))}
            {d.agregadas.map((i) => <li key={"a" + i.id}><span className="font-medium">Se agrega:</span> {i.nombre} <span className="text-muted-foreground tabular">({fmt(i.gramos)} g · {fmt(i.calorias)} kcal)</span></li>)}
          </ul>
          {preview.cambios.length > 0 && (
            <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">
              {preview.cambios.map((c, idx) => <p key={idx}>• {c}</p>)}
            </div>
          )}
          {d.vacia && <p className="mt-2 text-sm font-medium">Esta corrección deja la comida sin ingredientes, así que no se puede aplicar.</p>}
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" className="flex-1 rounded-full" onClick={() => setPreview(null)}>Descartar</Button>
            <Button className="flex-1 rounded-full" disabled={d.vacia || d.sinCambios} onClick={aplicar}>Aplicar</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
