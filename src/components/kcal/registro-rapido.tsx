import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/kcal/layout";
import { CategoriaSelect, MomentoPicker, NutrientesForm } from "@/components/kcal/editors";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { crearComida, crearFavorito, filaProductoPropio, guardarProductoPropio, nutrientesAColumnas } from "@/lib/data";
import { aPor100, normalizarCodigo } from "@/lib/off";
import { cn } from "@/lib/utils";
import { vacio, type Momento } from "@/lib/nutri";

export function RegistroRapido({ fecha, momentoInicial, nombreInicial, codigo, onDone }: { fecha: string; momentoInicial: Momento; nombreInicial?: string | undefined; codigo?: string | undefined; onDone: () => void }) {
  const [base, setBase] = useState<"100g" | "porcion">("porcion");
  const [porcionG, setPorcionG] = useState(0);
  const [nombre, setNombre] = useState(nombreInicial ?? "");
  const [momento, setMomento] = useState<Momento>(momentoInicial);
  const [v, setV] = useState(vacio());
  const [categoria, setCategoria] = useState("Otros");
  const [fav, setFav] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const qc = useQueryClient();

  async function guardar() {
    setGuardando(true);
    const n = nombre.trim();
    const ingredientes = [{ nombre: n, categoria, calorias: v.calorias }];
    try {
      await crearComida({ fecha, momento, nombre: n, origen: "manual", ingredientes: ingredientes as never, ...nutrientesAColumnas(v) });
    } catch {
      toast.error("No se pudo guardar.");
      setGuardando(false);
      return;
    }
    // Coming from the scanner: also remember the product, always as base values per 100 g when the serving weight is known.
    if (codigo) {
      try {
        const conPeso = base === "100g" || porcionG > 0;
        const por100 = base === "porcion" && porcionG > 0 ? aPor100(v, porcionG) : v;
        await guardarProductoPropio(filaProductoPropio(
          { codigo: normalizarCodigo(codigo), nombre: n, por100, porcion_g: base === "porcion" && porcionG > 0 ? porcionG : null, porcion_ml: false, base: conPeso ? "100g" : "porcion" },
          categoria, "manual",
        ));
        qc.invalidateQueries({ queryKey: ["productos-propios"] });
      } catch (e) {
        console.error(e);
        toast.warning("La comida se guardó, pero no pudimos guardar el producto en Mis productos.");
      }
    }
    if (fav) {
      try {
        await crearFavorito({ nombre: n, categoria, ingredientes, ...nutrientesAColumnas(v) });
        qc.invalidateQueries({ queryKey: ["favoritos"] });
      } catch {
        toast.warning("La comida se guardó, pero no se pudo guardar como favorito.");
      }
    }
    qc.invalidateQueries({ queryKey: ["comidas"] });
    qc.invalidateQueries({ queryKey: ["comidas-rango"] });
    qc.invalidateQueries({ queryKey: ["recientes"] });
    toast.success("Comida guardada");
    setGuardando(false);
    onDone();
  }

  return (
    <>
      <Card className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre</Label>
          <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Yogur con granola" />
        </div>
        <div className="space-y-1.5">
          <Label>Momento</Label>
          <MomentoPicker value={momento} onChange={setMomento} />
        </div>
        <div className="space-y-1.5">
          <Label>Categoría</Label>
          <div><CategoriaSelect value={categoria} onChange={setCategoria} className="h-10 text-sm" /></div>
        </div>
        {codigo && (
          <div className="space-y-2">
            <Label>Los valores que cargás son…</Label>
            <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
              {(["porcion", "100g"] as const).map((b) => (
                <button key={b} type="button" onClick={() => setBase(b)}
                  className={cn("rounded-full py-1.5 text-sm font-medium", base === b ? "bg-card shadow-soft" : "text-muted-foreground")}>
                  {b === "porcion" ? "Por porción" : "Por 100 g"}
                </button>
              ))}
            </div>
            {base === "porcion" && (
              <div className="flex items-center gap-2">
                <Input type="number" inputMode="decimal" min={0} value={porcionG || ""} placeholder="—"
                  onChange={(e) => setPorcionG(Math.max(0, Number(e.target.value.replace(",", ".")) || 0))}
                  className="h-10 w-24 rounded-full text-center" aria-label="Gramos de la porción" />
                <span className="text-sm text-muted-foreground">g por porción (si es en ml, poné los ml)</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Se registra {base === "porcion" ? "1 porción" : "100 g"} y guardamos el producto (código {normalizarCodigo(codigo)}) en Mis productos.
            </p>
          </div>
        )}
        <NutrientesForm value={v} onChange={setV} />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={fav} onCheckedChange={(c) => setFav(c === true)} /> Guardar como favorito
        </label>
      </Card>
      <Button className="mt-6 h-13 w-full rounded-full text-base" disabled={!nombre.trim() || guardando || (!!codigo && base === "100g" && v.calorias > 900)} onClick={guardar}>
        {guardando && <Loader2 className="size-4 animate-spin" />} Guardar
      </Button>
    </>
  );
}
