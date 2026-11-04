import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PenLine, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/kcal/layout";
import { CategoriaSelect, NutrientesForm } from "@/components/kcal/editors";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { borrarProductoPropio, guardarProductoPropio, productosPropiosQuery, type ProductoPropio } from "@/lib/data";
import { coincideBusqueda } from "@/lib/mis-comidas";
import { NUTRIENTES, fmt, vacio, type Nutrientes } from "@/lib/nutri";

export function MisProductos() {
  const { data, isLoading } = useQuery(productosPropiosQuery());
  const [q, setQ] = useState("");
  const [editar, setEditar] = useState<ProductoPropio | null>(null);
  const [borrar, setBorrar] = useState<ProductoPropio | null>(null);
  const qc = useQueryClient();
  const lista = (data ?? []).filter((p) => coincideBusqueda(`${p.marca ?? ""} ${p.nombre} ${p.codigo}`, q));

  return (
    <Card>
      {(data?.length ?? 0) > 4 && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto" className="h-10 rounded-full pl-9" />
        </div>
      )}
      {isLoading && <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />}
      {!isLoading && (data?.length ?? 0) === 0 && (
        <p className="text-sm text-muted-foreground">Cuando escanees un producto y cargues su etiqueta, queda guardado acá para la próxima.</p>
      )}
      <ul className="divide-y">
        {lista.map((p) => (
          <li key={p.id} className="flex items-center gap-2 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium">{p.nombre}</p>
              <p className="text-xs text-muted-foreground tabular">
                {fmt(Number(p.calorias))} kcal {p.base === "porcion" ? "por porción" : "por 100 g"} · {p.codigo}
              </p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Editar producto" onClick={() => setEditar(p)}><PenLine className="size-4" /></Button>
            <Button size="icon" variant="ghost" aria-label="Borrar producto" onClick={() => setBorrar(p)}><Trash2 className="size-4" /></Button>
          </li>
        ))}
      </ul>

      {editar && <EditarProducto p={editar} onClose={() => setEditar(null)} />}

      <AlertDialog open={!!borrar} onOpenChange={(o) => !o && setBorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar este producto?</AlertDialogTitle>
            <AlertDialogDescription>{borrar?.nombre}. Las comidas que ya registraste no cambian.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!borrar) return;
                try {
                  await borrarProductoPropio(borrar.codigo);
                  qc.invalidateQueries({ queryKey: ["productos-propios"] });
                  toast.success("Producto borrado");
                } catch {
                  toast.error("No se pudo borrar.");
                }
              }}
            >
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function EditarProducto({ p, onClose }: { p: ProductoPropio; onClose: () => void }) {
  const inicial = vacio();
  for (const k of NUTRIENTES) inicial[k] = Number(p[k] ?? 0);
  const [nombre, setNombre] = useState(p.nombre);
  const [categoria, setCategoria] = useState(p.categoria);
  const [v, setV] = useState<Nutrientes>(inicial);
  const [tocados, setTocados] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const qc = useQueryClient();

  async function guardar() {
    setGuardando(true);
    // Untouched fields that were missing stay missing (null), the rest are saved as entered.
    const val = (k: keyof Nutrientes) => (p[k] === null && !tocados.has(k) ? null : v[k]);
    try {
      await guardarProductoPropio({
        codigo: p.codigo, nombre: nombre.trim() || p.nombre, marca: p.marca, categoria, origen: "editado", base: p.base,
        porcion_g: p.porcion_g, porcion_ml: p.porcion_ml,
        calorias: v.calorias, proteinas: val("proteinas"), carbohidratos: val("carbohidratos"), grasas: val("grasas"),
        grasas_saturadas: val("grasas_saturadas"), fibra: val("fibra"), azucares: val("azucares"), sodio_mg: val("sodio_mg"),
      });
      qc.invalidateQueries({ queryKey: ["productos-propios"] });
      toast.success("Producto actualizado");
      onClose();
    } catch {
      toast.error(p.base === "100g" && v.calorias > 900 ? "Más de 900 kcal por 100 g no es posible." : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar producto</DialogTitle></DialogHeader>
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre" />
        <CategoriaSelect value={categoria} onChange={setCategoria} className="h-10 text-sm" />
        <p className="text-xs text-muted-foreground">Valores {p.base === "porcion" ? "por porción" : "por 100 g"}</p>
        <NutrientesForm
          value={v}
          resaltar={["proteinas", "carbohidratos", "grasas"].filter((k) => p[k as keyof Nutrientes] === null && !tocados.has(k))}
          onChange={(nv) => {
            const t = new Set(tocados);
            for (const k of NUTRIENTES) if (nv[k] !== v[k]) t.add(k);
            setTocados(t);
            setV(nv);
          }}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>{guardando && <Loader2 className="size-4 animate-spin" />} Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
