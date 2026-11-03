import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Card, Page, PageHeader } from "@/components/kcal/layout";
import { IngredientesEditor, MomentoPicker, NutrientesForm } from "@/components/kcal/editors";
import { ConfianzaBadge, TotalesGrid } from "@/components/kcal/totales";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  borrarComida, comidaANutrientes, comidaQuery, leerIngredientes, nutrientesAColumnas, urlFoto, type Comida,
} from "@/lib/data";
import { MOMENTOS, fmt, fmtFechaCorta, fmtRango, sumar, type Momento } from "@/lib/nutri";

export const Route = createFileRoute("/_authenticated/comida/$id")({
  head: () => ({
    meta: [
      { title: "Detalle de comida — KcalCountPal" },
      { name: "description", content: "Nutrientes de tu comida, con opción de editar o borrar." },
      { property: "og:title", content: "Detalle de comida — KcalCountPal" },
      { property: "og:description", content: "Nutrientes de tu comida, con opción de editar o borrar." },
    ],
  }),
  component: Detalle,
});

function Detalle() {
  const { id } = Route.useParams();
  const q = useQuery(comidaQuery(id));
  const foto = useQuery({ queryKey: ["foto", q.data?.foto_path], queryFn: () => urlFoto(q.data?.foto_path ?? null), enabled: !!q.data?.foto_path });
  const [editando, setEditando] = useState(false);

  if (q.isLoading) return <Page><Skeleton className="h-64 w-full rounded-3xl" /></Page>;
  if (!q.data) return <Page><PageHeader title="Comida" back /><p className="text-muted-foreground">No encontramos esta comida.</p></Page>;
  const c = q.data;

  if (editando) return <Editar c={c} onDone={() => setEditando(false)} />;

  const t = comidaANutrientes(c);
  const ings = leerIngredientes(c);
  return (
    <Page>
      <PageHeader title="Detalle" back right={
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setEditando(true)} aria-label="Editar"><Pencil className="size-5" /></Button>
      } />
      {foto.data && <img src={foto.data} alt={c.nombre} className="mb-4 aspect-[4/3] w-full rounded-3xl object-cover" />}
      <Card>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {MOMENTOS.find((m) => m.key === c.momento)?.label} · <span className="capitalize">{fmtFechaCorta(c.fecha)}</span>
        </p>
        <h2 className="mt-1 text-2xl font-bold">{c.nombre}</h2>
        <p className="mt-1 font-display text-2xl font-extrabold text-primary tabular">
          {fmtRango(t.calorias, c.kcal_min != null ? Number(c.kcal_min) : null, c.kcal_max != null ? Number(c.kcal_max) : null)}
        </p>
        <div className="mt-1.5"><ConfianzaBadge c={c.confianza} /></div>
        <div className="mt-5"><TotalesGrid t={t} /></div>
      </Card>
      {ings.length > 0 && (
        <Card className="mt-4">
          <h3 className="mb-2 font-bold">Ingredientes</h3>
          <ul className="divide-y divide-border/60">
            {ings.map((i) => (
              <li key={i.id} className="flex justify-between py-2 text-sm">
                <span>{i.nombre} <span className="text-muted-foreground">· {fmt(i.gramos)} g</span></span>
                <span className="tabular text-muted-foreground">{fmt(i.calorias)} kcal</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {c.descripcion && <p className="mt-4 px-1 text-sm text-muted-foreground">“{c.descripcion}”</p>}
      <BorrarBoton c={c} />
    </Page>
  );
}

function BorrarBoton({ c }: { c: Comida }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [borrando, setBorrando] = useState(false);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="mt-6 w-full rounded-full text-destructive">
          <Trash2 className="size-4" /> Borrar comida
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle>¿Borrar “{c.nombre}”?</AlertDialogTitle>
          <AlertDialogDescription>Se borra del diario junto con su foto. No se puede deshacer.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={borrando}
            className="bg-destructive text-destructive-foreground"
            onClick={async () => {
              setBorrando(true);
              try {
                await borrarComida(c);
                qc.invalidateQueries({ queryKey: ["comidas"] });
                qc.invalidateQueries({ queryKey: ["comidas-rango"] });
                qc.invalidateQueries({ queryKey: ["recientes"] });
                toast.success("Comida borrada");
                navigate({ to: "/" });
              } catch {
                toast.error("No se pudo borrar.");
                setBorrando(false);
              }
            }}
          >
            Borrar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Editar({ c, onDone }: { c: Comida; onDone: () => void }) {
  const qc = useQueryClient();
  const ings0 = leerIngredientes(c);
  const [nombre, setNombre] = useState(c.nombre);
  const [momento, setMomento] = useState<Momento>(c.momento as Momento);
  const [items, setItems] = useState(ings0);
  const [manual, setManual] = useState(comidaANutrientes(c));
  const [guardando, setGuardando] = useState(false);
  const conIngredientes = ings0.length > 0;
  const t = conIngredientes ? sumar(items) : manual;

  async function guardar() {
    setGuardando(true);
    const t0 = Number(c.calorias);
    const ratio = t0 > 0 ? t.calorias / t0 : 1;
    const { error } = await supabase.from("comidas").update({
      nombre: nombre.trim() || c.nombre,
      momento,
      ingredientes: (conIngredientes ? items : c.ingredientes) as never,
      kcal_min: c.kcal_min != null ? Math.round(Number(c.kcal_min) * ratio) : null,
      kcal_max: c.kcal_max != null ? Math.round(Number(c.kcal_max) * ratio) : null,
      updated_at: new Date().toISOString(),
      ...nutrientesAColumnas(t),
    }).eq("id", c.id);
    setGuardando(false);
    if (error) { toast.error("No se pudo guardar."); return; }
    qc.invalidateQueries({ queryKey: ["comida", c.id] });
    qc.invalidateQueries({ queryKey: ["comidas"] });
    qc.invalidateQueries({ queryKey: ["comidas-rango"] });
    toast.success("Cambios guardados");
    onDone();
  }

  return (
    <Page>
      <PageHeader title="Editar comida" right={<Button variant="ghost" onClick={onDone}>Cancelar</Button>} />
      <Card className="space-y-4">
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} className="font-semibold" aria-label="Nombre" />
        <p className="font-display text-2xl font-extrabold text-primary tabular">{fmt(t.calorias)} kcal</p>
        {conIngredientes && <TotalesGrid t={t} />}
      </Card>
      <div className="mt-5">
        {conIngredientes ? <IngredientesEditor items={items} onChange={setItems} /> : <Card><NutrientesForm value={manual} onChange={setManual} /></Card>}
      </div>
      <h2 className="mb-2 mt-6 text-sm font-semibold text-muted-foreground">Momento del día</h2>
      <MomentoPicker value={momento} onChange={setMomento} />
      <Button className="mt-8 h-13 w-full rounded-full text-base" disabled={guardando} onClick={guardar}>
        {guardando && <Loader2 className="size-4 animate-spin" />} Guardar cambios
      </Button>
    </Page>
  );
}
