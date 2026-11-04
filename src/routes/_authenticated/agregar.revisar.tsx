import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Info, Loader2, PenLine, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, Page, PageHeader } from "@/components/kcal/layout";
import { CategoriaSelect, IngredientesEditor, MomentoPicker, NutrientesForm } from "@/components/kcal/editors";
import { ConfianzaBadge, TotalesGrid } from "@/components/kcal/totales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clasificarCategoria } from "@/lib/ai.functions";
import { borrarProductoPropio, crearComida, crearFavorito, filaProductoPropio, guardarProductoPropio, nutrientesAColumnas } from "@/lib/data";
import { Checkbox } from "@/components/ui/checkbox";
import { gramosDe, valoresProducto } from "@/lib/off";
import { NUTRIENTE_LABEL, crearIngrediente, fechaLocal, fmt, fmtRango, horaLocal, momentoPorHora, sumar, type Ingrediente, type Momento } from "@/lib/nutri";
import { momentoSearch } from "@/lib/search";
import { borradorStore, useBorrador, useFechaSeleccionada } from "@/lib/stores";

export const Route = createFileRoute("/_authenticated/agregar/revisar")({
  validateSearch: momentoSearch,
  head: () => ({
    meta: [
      { title: "Revisar estimación — KcalCountPal" },
      { name: "description", content: "Ajustá ingredientes y cantidades antes de guardar." },
      { property: "og:title", content: "Revisar estimación — KcalCountPal" },
      { property: "og:description", content: "Ajustá ingredientes y cantidades antes de guardar." },
    ],
  }),
  component: Revisar,
});

function Revisar() {
  const b = useBorrador();
  const { momento: m0 } = Route.useSearch();
  if (!b) {
    return (
      <Page>
        <PageHeader title="Revisar" back />
        <p className="text-muted-foreground">No hay ninguna estimación para revisar.</p>
        <Button asChild className="mt-4 rounded-full"><Link to="/agregar">Agregar comida</Link></Button>
      </Page>
    );
  }
  return <Editor key={b.resultado.nombre_plato + b.resultado.totales.calorias} momentoInicial={m0 ?? momentoPorHora(horaLocal())} />;
}

function Editor({ momentoInicial }: { momentoInicial: Momento }) {
  const b = useBorrador()!;
  const r = b.resultado;
  const [fecha] = useFechaSeleccionada();
  const [nombre, setNombre] = useState(r.nombre_plato);
  const [itemsIA, setItems] = useState<Ingrediente[]>(r.ingredientes);
  const p = b.producto;
  const porPorcion = p?.base === "porcion";
  const [modo, setModo] = useState<"gramos" | "porciones">(porPorcion ? "porciones" : "gramos");
  const [cantidad, setCantidad] = useState(porPorcion ? 1 : 100);
  const [categoria, setCategoria] = useState(p?.categoria ?? "Otros");
  const catManual = useRef(!!p?.categoria);
  const [base, setBase] = useState(p?.por100);
  const [editado, setEditado] = useState(false);
  const [editando, setEditando] = useState(!!p && (p.faltantesPrincipales ?? []).length > 0);
  const [faltan, setFaltan] = useState<string[]>(p?.faltantesPrincipales ?? []);
  const [guardarCambios, setGuardarCambios] = useState(false);
  const [propioBorrado, setPropioBorrado] = useState(false);
  const clasificar = useServerFn(clasificarCategoria);
  useEffect(() => {
    if (!p || catManual.current) return;
    let vivo = true;
    clasificar({ data: { nombre: p.nombre, fecha_local: fechaLocal() } })
      .then((res) => { if (vivo && !catManual.current) setCategoria(res.categoria); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [p, clasificar]);
  const gramos = p ? (porPorcion ? cantidad : gramosDe(modo, cantidad, p.porcion_g)) : 0;
  const items = useMemo<Ingrediente[]>(
    () => (p && base ? [crearIngrediente("off", p.nombre, porPorcion ? 0 : gramos, valoresProducto({ por100: base, base: p.base ?? "100g" }, gramos), categoria)] : itemsIA),
    [p, base, porPorcion, gramos, categoria, itemsIA],
  );
  const [momento, setMomento] = useState<Momento>(momentoInicial);
  const [guardando, setGuardando] = useState(false);
  const [fav, setFav] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const t = sumar(items);
  const ratio = r.totales.calorias > 0 ? t.calorias / r.totales.calorias : 1;
  const kmin = Math.round(r.kcal_min * ratio);
  const kmax = Math.round(r.kcal_max * ratio);

  async function guardar() {
    setGuardando(true);
    try {
      const comida = await crearComida({
        fecha,
        momento,
        nombre: nombre.trim() || "Comida",
        origen: b.origen,
        descripcion: b.descripcion,
        confianza: p ? null : r.confianza,
        kcal_min: p ? null : kmin,
        kcal_max: p ? null : kmax,
        ingredientes: items as never,
        ...nutrientesAColumnas(t),
      });
      // Persist the product (base values) only now, when the meal is confirmed. Never blocks the meal.
      if (p && base) {
        const origenProd =
          p.fuente === "etiqueta" ? "etiqueta"
          : p.fuente === "propio" && !propioBorrado && editado ? "editado"
          : p.fuente === "off" && editado && guardarCambios ? "editado"
          : null;
        if (origenProd) {
          try {
            await guardarProductoPropio(filaProductoPropio({ ...p, nombre: nombre.trim() || p.nombre, por100: base, faltantesPrincipales: faltan }, categoria, origenProd));
            qc.invalidateQueries({ queryKey: ["productos-propios"] });
          } catch (e) {
            console.error(e);
            toast.warning("La comida se guardó, pero no pudimos guardar el producto en Mis productos.");
          }
        }
      }
      if (fav) {
        try {
          await crearFavorito({ ...comida, categoria: p ? categoria : null });
          qc.invalidateQueries({ queryKey: ["favoritos"] });
        } catch {
          toast.warning("La comida se guardó, pero no se pudo guardar como favorito.");
        }
      }
      borradorStore.set(null);
      qc.invalidateQueries({ queryKey: ["comidas"] });
      qc.invalidateQueries({ queryKey: ["comidas-rango"] });
      qc.invalidateQueries({ queryKey: ["recientes"] });
      toast.success("Comida guardada");
      navigate({ to: "/" });
    } catch (e) {
      console.error(e);
      toast.error("No se pudo guardar. Reintentá.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Page>
      <PageHeader title="Revisá la estimación" back />
      <Card>
        <div className="flex gap-4">
          {b.fotoUrl && <img src={b.fotoUrl} alt="" className="size-20 shrink-0 rounded-2xl object-cover" />}
          <div className="min-w-0 flex-1">
            <textarea
              value={nombre}
              rows={2}
              onChange={(e) => setNombre(e.target.value.replace(/\n/g, " "))}
              className="w-full resize-none border-0 bg-transparent p-0 font-display text-xl font-bold leading-tight outline-none"
              aria-label="Nombre del plato"
            />
            <p className="mt-1 font-display text-2xl font-extrabold text-primary tabular">
              {p ? `${fmt(t.calorias)} kcal` : fmtRango(t.calorias, kmin, kmax)}
            </p>
            {!p && <div className="mt-1.5"><ConfianzaBadge c={r.confianza} /></div>}
            {p && (
              <p className="mt-1 text-xs text-muted-foreground">
                {p.fuente === "propio" ? "De tus productos" : p.fuente === "etiqueta" ? "Leído de la etiqueta" : "Datos de etiqueta · Open Food Facts"} · Código {p.codigo}
              </p>
            )}
          </div>
        </div>
        <div className="mt-5"><TotalesGrid t={t} /></div>
        {(r.nota || r.corregido_atwater) && (
          <p className="mt-4 flex gap-2 rounded-2xl bg-muted p-3 text-xs text-muted-foreground">
            <Info className="size-4 shrink-0" />
            <span>
              {r.nota}
              {r.corregido_atwater && " Ajustamos las calorías para que cierren con los macros."}
            </span>
          </p>
        )}
      </Card>

      {p ? (
        <>
          {faltan.length > 0 && (
            <div className="mt-4 rounded-2xl border border-carbs bg-carbs/15 p-3 text-sm">
              <p className="flex gap-2 font-semibold">
                <AlertTriangle className="size-4 shrink-0 text-carbs" /> Faltan datos: completalos antes de guardar
              </p>
              <p className="mt-1 pl-6 text-xs">
                No figura{faltan.length > 1 ? "n" : ""}: {faltan.map((k) => NUTRIENTE_LABEL[k as keyof typeof NUTRIENTE_LABEL].toLowerCase()).join(", ")}
                {faltan.includes("proteinas") && ". Las proteínas son clave para tu meta."}
              </p>
            </div>
          )}
          {p.soloPreparado && (
            <p className="mt-3 flex gap-2 rounded-2xl bg-muted p-3 text-xs text-muted-foreground">
              <Info className="size-4 shrink-0" /> La etiqueta solo traía valores del producto preparado.
            </p>
          )}
          {p.fuente === "propio" && !propioBorrado && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => setEditando(true)}>
                <PenLine className="size-3.5" /> Corregir valores
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full text-destructive"
                onClick={async () => {
                  if (!confirm("¿Eliminar este producto de Mis productos? La comida que estás cargando no se pierde.")) return;
                  try {
                    await borrarProductoPropio(p.codigo);
                    setPropioBorrado(true);
                    qc.invalidateQueries({ queryKey: ["productos-propios"] });
                    toast.success("Producto eliminado de Mis productos");
                  } catch {
                    toast.error("No se pudo eliminar el producto.");
                  }
                }}
              >
                <Trash2 className="size-3.5" /> Eliminar este producto
              </Button>
            </div>
          )}
          {p.inconsistente && (
            <p className="mt-4 flex gap-2 rounded-2xl bg-destructive/10 p-3 text-sm">
              <AlertTriangle className="size-4 shrink-0 text-destructive" />
              Datos de etiqueta inconsistentes, revisá los valores.
            </p>
          )}
          {p.faltantes.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">La etiqueta no informa {p.faltantes.join(", ")}; se cuenta como 0.</p>
          )}
          {base && (
            <>
              <h2 className="mb-2 mt-6 flex items-center justify-between text-sm font-semibold text-muted-foreground">
                Valores {porPorcion ? "por porción" : "por 100 g"}
                {!editando && <button className="text-xs font-semibold text-primary" onClick={() => setEditando(true)}>Editar</button>}
              </h2>
              {editando && (
                <Card>
                  <NutrientesForm
                    value={base}
                    resaltar={faltan}
                    onChange={(v) => {
                      const cambiados = (Object.keys(v) as (keyof typeof v)[]).filter((k) => v[k] !== base[k]);
                      setFaltan((f) => f.filter((k) => !cambiados.includes(k as never)));
                      setBase(v);
                      setEditado(true);
                    }}
                  />
                  {p.fuente === "off" && editado && (
                    <label className="mt-4 flex items-center gap-2 text-sm">
                      <Checkbox checked={guardarCambios} onCheckedChange={(c) => setGuardarCambios(c === true)} /> Guardar mis cambios para próximas veces
                    </label>
                  )}
                </Card>
              )}
            </>
          )}
          <h2 className="mb-2 mt-6 text-sm font-semibold text-muted-foreground">Cantidad</h2>
          <Card>
            {porPorcion && <p className="mb-3 text-xs text-muted-foreground">No sabemos cuánto pesa la porción: elegí la cantidad en porciones.</p>}
            {!porPorcion && p.porcion_g && (
              <div className="mb-3 grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
                {(["gramos", "porciones"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setModo(m); setCantidad(m === "gramos" ? Math.round(gramos) || 100 : 1); }}
                    className={"rounded-full py-1.5 text-sm font-medium " + (modo === m ? "bg-card shadow-soft" : "text-muted-foreground")}
                  >
                    {m === "gramos" ? "Gramos" : "Porciones"}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step={modo === "porciones" ? 0.5 : 1}
                value={Number.isFinite(cantidad) ? cantidad : ""}
                onChange={(e) => setCantidad(Number(e.target.value.replace(",", ".")))}
                className="h-11 w-28 rounded-full text-center text-lg tabular"
                aria-label="Cantidad"
              />
              <span className="text-sm text-muted-foreground">
                {porPorcion
                  ? `porción${cantidad === 1 ? "" : "es"}`
                  : modo === "porciones"
                  ? `porción${cantidad === 1 ? "" : "es"} · ${fmt(gramos)} ${p.porcion_ml ? "ml" : "g"}`
                  : p.porcion_ml ? "ml" : "g"}
              </span>
            </div>
            {p.porcion_ml && !porPorcion && <p className="mt-2 text-xs text-muted-foreground">Para bebidas tomamos 1 ml ≈ 1 g.</p>}
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Categoría</span>
              <CategoriaSelect value={categoria} onChange={(c) => { catManual.current = true; setCategoria(c); }} />
            </div>
          </Card>
        </>
      ) : (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold text-muted-foreground">Ingredientes · es una estimación, ajustala</h2>
          <IngredientesEditor items={items} onChange={setItems} />
        </>
      )}

      <h2 className="mb-2 mt-6 text-sm font-semibold text-muted-foreground">Momento del día</h2>
      <MomentoPicker value={momento} onChange={setMomento} />

      <label className="mt-6 flex items-center gap-2 text-sm">
        <Checkbox checked={fav} onCheckedChange={(c) => setFav(c === true)} /> Guardar también como favorito
      </label>

      <Button className="mt-6 h-13 w-full rounded-full text-base" disabled={guardando || items.length === 0 || (!!p && gramos <= 0)} onClick={guardar}>
        {guardando && <Loader2 className="size-4 animate-spin" />} {p && faltan.length > 0 ? "Guardar con datos incompletos" : "Guardar comida"}
      </Button>
    </Page>
  );
}
