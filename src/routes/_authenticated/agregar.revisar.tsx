import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, Page, PageHeader } from "@/components/kcal/layout";
import { CategoriaSelect, IngredientesEditor, MomentoPicker } from "@/components/kcal/editors";
import { ConfianzaBadge, TotalesGrid } from "@/components/kcal/totales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clasificarCategoria } from "@/lib/ai.functions";
import { crearComida, nutrientesAColumnas } from "@/lib/data";
import { gramosDe, valoresPara } from "@/lib/off";
import { crearIngrediente, fechaLocal, fmt, fmtRango, horaLocal, momentoPorHora, sumar, type Ingrediente, type Momento } from "@/lib/nutri";
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
  const [modo, setModo] = useState<"gramos" | "porciones">("gramos");
  const [cantidad, setCantidad] = useState(100);
  const [categoria, setCategoria] = useState("Otros");
  const catManual = useRef(false);
  const clasificar = useServerFn(clasificarCategoria);
  useEffect(() => {
    if (!p) return;
    let vivo = true;
    clasificar({ data: { nombre: p.nombre, fecha_local: fechaLocal() } })
      .then((res) => { if (vivo && !catManual.current) setCategoria(res.categoria); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [p, clasificar]);
  const gramos = p ? gramosDe(modo, cantidad, p.porcion_g) : 0;
  const items = useMemo<Ingrediente[]>(
    () => (p ? [crearIngrediente("off", p.nombre, gramos, valoresPara(p.por100, gramos), categoria)] : itemsIA),
    [p, gramos, categoria, itemsIA],
  );
  const [momento, setMomento] = useState<Momento>(momentoInicial);
  const [guardando, setGuardando] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const t = sumar(items);
  const ratio = r.totales.calorias > 0 ? t.calorias / r.totales.calorias : 1;
  const kmin = Math.round(r.kcal_min * ratio);
  const kmax = Math.round(r.kcal_max * ratio);

  async function guardar() {
    setGuardando(true);
    try {
      await crearComida({
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
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="h-auto border-0 bg-transparent p-0 font-display text-xl font-bold shadow-none focus-visible:ring-0"
              aria-label="Nombre del plato"
            />
            <p className="mt-1 font-display text-2xl font-extrabold text-primary tabular">
              {p ? `${fmt(t.calorias)} kcal` : fmtRango(t.calorias, kmin, kmax)}
            </p>
            {!p && <div className="mt-1.5"><ConfianzaBadge c={r.confianza} /></div>}
            {p && <p className="mt-1 text-xs text-muted-foreground">Datos de etiqueta · Open Food Facts</p>}
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
          {p.inconsistente && (
            <p className="mt-4 flex gap-2 rounded-2xl bg-destructive/10 p-3 text-sm">
              <AlertTriangle className="size-4 shrink-0 text-destructive" />
              Datos de etiqueta inconsistentes, revisá los valores.
            </p>
          )}
          {p.faltantes.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">La etiqueta no informa {p.faltantes.join(", ")}; se cuenta como 0.</p>
          )}
          <h2 className="mb-2 mt-6 text-sm font-semibold text-muted-foreground">Cantidad</h2>
          <Card>
            {p.porcion_g && (
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
                {modo === "porciones"
                  ? `porción${cantidad === 1 ? "" : "es"} · ${fmt(gramos)} ${p.porcion_ml ? "ml" : "g"}`
                  : p.porcion_ml ? "ml" : "g"}
              </span>
            </div>
            {p.porcion_ml && <p className="mt-2 text-xs text-muted-foreground">Para bebidas tomamos 1 ml ≈ 1 g.</p>}
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

      <Button className="mt-8 h-13 w-full rounded-full text-base" disabled={guardando || items.length === 0 || (!!p && gramos <= 0)} onClick={guardar}>
        {guardando && <Loader2 className="size-4 animate-spin" />} Guardar comida
      </Button>
    </Page>
  );
}
