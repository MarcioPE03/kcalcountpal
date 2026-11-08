import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Flame, Heart, Loader2, MoreVertical, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Card, Page, PageHeader } from "@/components/kcal/layout";
import { NumberInput } from "@/components/kcal/editors";
import { SUGERENCIAS } from "@/components/kcal/entrenamientos";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  entrenamientosRecientesQuery, favoritosEntrenamientosQuery, guardarEntrenamiento, guardarFavoritoEntrenamiento,
  guardarVariosEntrenamientos, quitarFavoritoEntrenamiento, renombrarFavoritoEntrenamiento, type FavoritoEntrenamiento,
} from "@/lib/data";
import { FACTORES_RAPIDOS, agruparPorFecha, coincideBusqueda } from "@/lib/mis-comidas";
import {
  MAX_SELECCION_ENT, claveDe, escalarEntrenamiento, fechaValidaOHoy, filasEntrenamientoParaRegistrar,
  type ItemEnt, type SelEnt,
} from "@/lib/mis-entrenamientos";
import { fechaLocal, fmt, fmtFechaCorta, validarQuemadas } from "@/lib/nutri";
import { cn } from "@/lib/utils";

const search = z.object({ tab: z.string().optional(), fecha: z.string().optional() });

export const Route = createFileRoute("/_authenticated/agregar/entrenamiento")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Agregar entrenamiento — KcalCountPal" },
      { name: "description", content: "Registrá entrenamientos recientes, favoritos o uno nuevo." },
      { property: "og:title", content: "Agregar entrenamiento — KcalCountPal" },
      { property: "og:description", content: "Registrá entrenamientos recientes, favoritos o uno nuevo." },
    ],
  }),
  component: Entrenamientos,
});

const TABS = ["recientes", "favoritos", "nuevo"] as const;
const PAGINA = 20;
const fx = (f: number) => String(f).replace(".", ",");

function Entrenamientos() {
  const s = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const tab = (TABS as readonly string[]).includes(s.tab ?? "") ? s.tab! : "recientes";
  const fecha = fechaValidaOHoy(s.fecha);

  const recientes = useQuery(entrenamientosRecientesQuery());
  const favoritos = useQuery(favoritosEntrenamientosQuery());
  const favClaves = useMemo(() => new Set(favoritos.data?.map((f) => f.clave)), [favoritos.data]);
  const [sel, setSel] = useState<Map<string, SelEnt>>(new Map());

  function toggle(item: ItemEnt) {
    const clave = claveDe(item);
    setSel((prev) => {
      const m = new Map(prev);
      if (m.has(clave)) m.delete(clave);
      else {
        if (m.size >= MAX_SELECCION_ENT) { toast.info(`Máximo ${MAX_SELECCION_ENT} entrenamientos por vez.`); return prev; }
        m.set(clave, { clave, item, factor: 1 });
      }
      return m;
    });
  }
  function setFactor(clave: string, factor: number) {
    setSel((prev) => {
      const x = prev.get(clave);
      if (!x) return prev;
      return new Map(prev).set(clave, { ...x, factor });
    });
  }

  const favMut = useMutation({
    mutationFn: async (item: ItemEnt) => {
      const k = claveDe(item);
      if (favClaves.has(k)) await quitarFavoritoEntrenamiento(k);
      else await guardarFavoritoEntrenamiento(item);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favoritos-entrenamientos"] }),
    onError: () => toast.error("No se pudo actualizar el favorito."),
  });

  const lista = [...sel.values()];
  const escalados = lista.map((x) => escalarEntrenamiento(x.item, x.factor));
  const invalido = escalados.some((v) => v.error);
  const total = escalados.reduce((a, v) => a + v.calorias_quemadas, 0);

  const registrar = useMutation({
    mutationFn: () => guardarVariosEntrenamientos(filasEntrenamientoParaRegistrar(lista, fecha)),
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["entrenamientos"] });
      toast.success(`${n} ${n === 1 ? "entrenamiento registrado" : "entrenamientos registrados"}`);
      navigate({ to: "/" });
    },
    onError: () => toast.error("No se pudo registrar. Reintentá."),
  });

  const p: FilaProps = { sel, toggle, setFactor, favClaves, onFav: (i) => favMut.mutate(i), favPending: favMut.isPending };
  const mostrarBoton = tab !== "nuevo" && sel.size > 0;

  return (
    <Page className={mostrarBoton ? "pb-48" : ""}>
      <PageHeader title="Entrenamiento" back />
      <p className="-mt-3 mb-4 text-sm capitalize text-muted-foreground">{fecha === fechaLocal() ? "Hoy" : fmtFechaCorta(fecha)}</p>
      <Tabs value={tab} onValueChange={(t) => navigate({ to: "/agregar/entrenamiento", search: (prev) => ({ ...prev, tab: t }), replace: true })}>
        <TabsList className="mb-4 grid w-full grid-cols-3 rounded-full">
          <TabsTrigger value="recientes" className="rounded-full">Recientes</TabsTrigger>
          <TabsTrigger value="favoritos" className="rounded-full">Favoritos</TabsTrigger>
          <TabsTrigger value="nuevo" className="rounded-full">Nuevo</TabsTrigger>
        </TabsList>
        <TabsContent value="recientes"><Recientes data={recientes.data} cargando={recientes.isLoading} p={p} /></TabsContent>
        <TabsContent value="favoritos"><Favoritos data={favoritos.data} cargando={favoritos.isLoading} p={p} /></TabsContent>
        <TabsContent value="nuevo"><Nuevo fecha={fecha} onDone={() => navigate({ to: "/" })} /></TabsContent>
      </Tabs>

      {mostrarBoton && (
        <div className="fixed inset-x-0 z-40 px-4 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)]">
          <Button className="mx-auto flex h-13 w-full max-w-md rounded-full text-base shadow-fab" disabled={invalido || registrar.isPending} onClick={() => registrar.mutate()}>
            {registrar.isPending && <Loader2 className="size-4 animate-spin" />}
            Registrar ({sel.size}) · {fmt(total)} kcal
          </Button>
        </div>
      )}
    </Page>
  );
}

type FilaProps = {
  sel: Map<string, SelEnt>;
  toggle: (i: ItemEnt) => void;
  setFactor: (clave: string, f: number) => void;
  favClaves: Set<string>;
  onFav: (i: ItemEnt) => void;
  favPending: boolean;
};

function Fila({ item, p, menu }: { item: ItemEnt; p: FilaProps; menu?: React.ReactNode }) {
  const clave = claveDe(item);
  const s = p.sel.get(clave);
  const v = s ? escalarEntrenamiento(item, s.factor) : null;
  const kcal = v ? v.calorias_quemadas : Number(item.calorias_quemadas);
  const dur = v ? v.duracion_min : item.duracion_min;
  const esFav = p.favClaves.has(clave);
  return (
    <div className={cn("rounded-2xl px-1 py-2.5", s && "bg-primary-soft/60 px-2")}>
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-carbs"><Flame className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-medium">{item.nombre}</p>
          <p className="text-xs tabular text-muted-foreground">
            <span className="font-semibold text-foreground">{fmt(kcal)} kcal</span>{dur ? ` · ${dur} min` : ""}
          </p>
        </div>
        {menu ?? (
          <button aria-label={esFav ? "Quitar de favoritos" : "Agregar a favoritos"} disabled={p.favPending} onClick={() => p.onFav(item)} className="rounded-full p-2 text-primary">
            <Heart className={cn("size-5", esFav && "fill-current")} />
          </button>
        )}
        <button aria-label={s ? "Quitar de la selección" : "Seleccionar"} onClick={() => p.toggle(item)}
          className={cn("flex size-9 items-center justify-center rounded-full", s ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary")}>
          {s ? <Check className="size-5" /> : <Plus className="size-5" />}
        </button>
      </div>
      {s && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-12">
          {FACTORES_RAPIDOS.map((f) => (
            <button key={f} onClick={() => p.setFactor(clave, f)}
              className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", s.factor === f ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>
              ×{fx(f)}
            </button>
          ))}
          {v?.error && <span className="flex items-center gap-1 text-xs font-medium text-carbs"><AlertTriangle className="size-3.5" />{v.error}. Cambiá el multiplicador o quitala.</span>}
        </div>
      )}
    </div>
  );
}

function Buscador({ q, setQ }: { q: string; setQ: (s: string) => void }) {
  return (
    <div className="relative mb-3">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre" className="h-11 rounded-full pl-9" />
    </div>
  );
}

type Reciente = ItemEnt & { id: string; fecha: string };

function Recientes({ data, cargando, p }: { data: Reciente[] | undefined; cargando: boolean; p: FilaProps }) {
  const [q, setQ] = useState("");
  const [n, setN] = useState(PAGINA);
  const filtradas = (data ?? []).filter((e) => coincideBusqueda(e.nombre, q));
  const grupos = agruparPorFecha(filtradas.slice(0, n), fechaLocal());
  return (
    <Card>
      <Buscador q={q} setQ={(v) => { setQ(v); setN(PAGINA); }} />
      {cargando && <p className="py-3 text-sm text-muted-foreground">Cargando…</p>}
      {!cargando && filtradas.length === 0 && <p className="py-3 text-sm text-muted-foreground">{q ? "No encontramos entrenamientos con ese nombre." : "Todavía no registraste entrenamientos."}</p>}
      {grupos.map((g) => (
        <div key={g.fecha} className="mt-2">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.titulo}</h3>
          {g.items.map((e) => <Fila key={e.id} item={e} p={p} />)}
        </div>
      ))}
      {filtradas.length > n && <Button variant="ghost" className="mt-2 w-full rounded-full" onClick={() => setN(n + PAGINA)}>Ver más</Button>}
    </Card>
  );
}

function Favoritos({ data, cargando, p }: { data: FavoritoEntrenamiento[] | undefined; cargando: boolean; p: FilaProps }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [renombrar, setRenombrar] = useState<FavoritoEntrenamiento | null>(null);
  const [quitar, setQuitar] = useState<FavoritoEntrenamiento | null>(null);
  const [nombre, setNombre] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const filtrados = (data ?? []).filter((f) => coincideBusqueda(f.nombre, q));
  const refrescar = () => qc.invalidateQueries({ queryKey: ["favoritos-entrenamientos"] });
  return (
    <Card>
      <Buscador q={q} setQ={setQ} />
      {cargando && <p className="py-3 text-sm text-muted-foreground">Cargando…</p>}
      {!cargando && (data?.length ?? 0) === 0 && <p className="py-3 text-sm text-muted-foreground">Todavía no tenés favoritos. Tocá el corazón en un entrenamiento reciente.</p>}
      {!cargando && (data?.length ?? 0) > 0 && filtrados.length === 0 && <p className="py-3 text-sm text-muted-foreground">No encontramos favoritos con ese nombre.</p>}
      {filtrados.map((f) => (
        <Fila key={f.id} item={f} p={p} menu={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Opciones" className="rounded-full p-2 text-muted-foreground"><MoreVertical className="size-5" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setNombre(f.nombre); setRenombrar(f); }}>Renombrar</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setQuitar(f)}>Quitar de favoritos</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        } />
      ))}

      <Dialog open={!!renombrar} onOpenChange={(o) => !o && setRenombrar(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>Renombrar favorito</DialogTitle></DialogHeader>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre" maxLength={60} />
          <DialogFooter>
            <Button className="rounded-full" disabled={!nombre.trim() || ocupado} onClick={async () => {
              setOcupado(true);
              try { await renombrarFavoritoEntrenamiento(renombrar!.id, nombre); await refrescar(); setRenombrar(null); }
              catch { toast.error("No se pudo renombrar."); }
              setOcupado(false);
            }}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!quitar} onOpenChange={(o) => !o && setQuitar(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar “{quitar?.nombre}” de favoritos?</AlertDialogTitle>
            <AlertDialogDescription>Los entrenamientos ya registrados no se borran.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={ocupado} onClick={async () => {
              setOcupado(true);
              try { await quitarFavoritoEntrenamiento(quitar!.clave); await refrescar(); }
              catch { toast.error("No se pudo quitar."); }
              setOcupado(false);
              setQuitar(null);
            }}>Quitar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function Nuevo({ fecha, onDone }: { fecha: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [kcal, setKcal] = useState(0);
  const [dur, setDur] = useState(0);
  const [fav, setFav] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (guardando) return;
    if (!nombre.trim()) { toast.error("Poné un nombre al entrenamiento."); return; }
    const err = validarQuemadas(kcal || null);
    if (err) { toast.error(err); return; }
    const datos = { fecha, nombre: nombre.trim(), calorias_quemadas: Math.round(kcal), duracion_min: dur > 0 ? Math.round(dur) : null };
    setGuardando(true);
    try {
      await guardarEntrenamiento(datos);
    } catch {
      toast.error("No se pudo guardar el entrenamiento.");
      setGuardando(false);
      return;
    }
    if (fav) {
      try { await guardarFavoritoEntrenamiento(datos); qc.invalidateQueries({ queryKey: ["favoritos-entrenamientos"] }); }
      catch { toast.warning("El entrenamiento se guardó, pero no se pudo agregar a favoritos."); }
    }
    await qc.invalidateQueries({ queryKey: ["entrenamientos"] });
    toast.success("Entrenamiento agregado");
    onDone();
  }

  return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="ent-nombre">Nombre</Label>
        <Input id="ent-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Pesas" maxLength={60} />
        <div className="flex flex-wrap gap-1.5">
          {SUGERENCIAS.map((s) => (
            <button key={s} type="button" onClick={() => setNombre(s)}
              className={cn("rounded-full px-3 py-1 text-xs font-medium", nombre === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1 space-y-2">
          <Label htmlFor="ent-kcal">Calorías quemadas</Label>
          <NumberInput id="ent-kcal" value={kcal} onChange={setKcal} aria-label="Calorías quemadas" />
        </div>
        <div className="flex-1 space-y-2">
          <Label htmlFor="ent-dur">Duración (min)</Label>
          <NumberInput id="ent-dur" value={dur} onChange={setDur} aria-label="Duración en minutos" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={fav} onCheckedChange={(c) => setFav(c === true)} /> Guardar como favorito
      </label>
      <Button className="h-12 w-full rounded-full" onClick={guardar} disabled={guardando}>
        {guardando && <Loader2 className="size-4 animate-spin" />} Guardar
      </Button>
    </Card>
  );
}
