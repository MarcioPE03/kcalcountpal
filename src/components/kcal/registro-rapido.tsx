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
import { crearComida, crearFavorito, nutrientesAColumnas } from "@/lib/data";
import { vacio, type Momento } from "@/lib/nutri";

export function RegistroRapido({ fecha, momentoInicial, nombreInicial, onDone }: { fecha: string; momentoInicial: Momento; nombreInicial?: string | undefined; onDone: () => void }) {
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
        <NutrientesForm value={v} onChange={setV} />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={fav} onCheckedChange={(c) => setFav(c === true)} /> Guardar como favorito
        </label>
      </Card>
      <Button className="mt-6 h-13 w-full rounded-full text-base" disabled={!nombre.trim() || guardando} onClick={guardar}>
        {guardando && <Loader2 className="size-4 animate-spin" />} Guardar
      </Button>
    </>
  );
}
