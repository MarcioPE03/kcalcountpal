import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Info, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Card, Page, PageHeader } from "@/components/kcal/layout";
import { IngredientesEditor, MomentoPicker } from "@/components/kcal/editors";
import { ConfianzaBadge, TotalesGrid } from "@/components/kcal/totales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { crearComida, nutrientesAColumnas, subirFoto } from "@/lib/data";
import { fmtRango, horaLocal, momentoPorHora, sumar, type Ingrediente, type Momento } from "@/lib/nutri";
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
  const [items, setItems] = useState<Ingrediente[]>(r.ingredientes);
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
      const foto_path = b.foto ? await subirFoto(b.foto) : null;
      await crearComida({
        fecha,
        momento,
        nombre: nombre.trim() || "Comida",
        origen: b.origen,
        descripcion: b.descripcion,
        foto_path,
        confianza: r.confianza,
        kcal_min: kmin,
        kcal_max: kmax,
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
            <p className="mt-1 font-display text-2xl font-extrabold text-primary tabular">{fmtRango(t.calorias, kmin, kmax)}</p>
            <div className="mt-1.5"><ConfianzaBadge c={r.confianza} /></div>
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

      <h2 className="mb-2 mt-6 text-sm font-semibold text-muted-foreground">Ingredientes · es una estimación, ajustala</h2>
      <IngredientesEditor items={items} onChange={setItems} />

      <h2 className="mb-2 mt-6 text-sm font-semibold text-muted-foreground">Momento del día</h2>
      <MomentoPicker value={momento} onChange={setMomento} />

      <Button className="mt-8 h-13 w-full rounded-full text-base" disabled={guardando || items.length === 0} onClick={guardar}>
        {guardando && <Loader2 className="size-4 animate-spin" />} Guardar comida
      </Button>
    </Page>
  );
}
