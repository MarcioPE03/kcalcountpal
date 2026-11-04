import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CopyPlus, Heart, Loader2, MoreVertical, PenLine, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Card, Page, PageHeader } from "@/components/kcal/layout";
import { MomentoPicker } from "@/components/kcal/editors";
import { ICONO } from "@/components/kcal/meal";
import { RegistroRapido } from "@/components/kcal/registro-rapido";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  borrarFavoritoPorClave, copiaDe, crearComida, crearFavorito, favoritosQuery, recientesQuery, registrarVarias, renombrarFavorito, uid,
  type Comida, type Favorito,
} from "@/lib/data";
import {
  FACTORES_RAPIDOS, MAX_SELECCION, agruparPorFecha, claveComida, coincideBusqueda, escalarComida, filasParaRegistrar, validarFactor,
  type ItemComida, type Seleccion,
} from "@/lib/mis-comidas";
import { MOMENTOS, fechaLocal, fmt, fmtFechaCorta, horaLocal, momentoPorHora, sumarDias, type Momento } from "@/lib/nutri";
import { fechaStore } from "@/lib/stores";
import { cn } from "@/lib/utils";

const search = z.object({
  tab: z.string().optional(),
  momento: z.string().optional(),
  fecha: z.string().optional(),
  nombre: z.string().optional(),
  codigo: z.string().optional(), // reserved for the next step
});

export const Route = createFileRoute("/_authenticated/agregar/mis-comidas")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Mis comidas — KcalCountPal" },
      { name: "description", content: "Volvé a registrar tus comidas recientes y favoritas sin usar IA." },
      { property: "og:title", content: "Mis comidas — KcalCountPal" },
      { property: "og:description", content: "Volvé a registrar tus comidas recientes y favoritas sin usar IA." },
    ],
  }),
  component: MisComidas,
});

const TABS = ["recientes", "favoritos", "rapido"] as const;
const MOMENTO_KEYS = MOMENTOS.map((m) => m.key) as string[];
const PAGINA = 30;

type Sel = Seleccion & { texto: string };

function MisComidas() {
  const s = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const tab = (TABS as readonly string[]).includes(s.tab ?? "") ? s.tab! : "recientes";
  const fecha = s.fecha && /^\d{4}-\d{2}-\d{2}$/.test(s.fecha) ? s.fecha : fechaStore.get();
  const momento0 = (MOMENTO_KEYS.includes(s.momento ?? "") ? s.momento : momentoPorHora(horaLocal())) as Momento;

  const recientes = useQuery(recientesQuery());
  const favoritos = useQuery(favoritosQuery());
  const favClaves = useMemo(() => new Set(favoritos.data?.map((f) => f.clave)), [favoritos.data]);

  const [sel, setSel] = useState<Map<string, Sel>>(new Map());
  const [confirmar, setConfirmar] = useState(false);
  const [momento, setMomento] = useState<Momento>(momento0);

  function toggle(clave: string, item: ItemComida) {
    setSel((prev) => {
      const m = new Map(prev);
      if (m.has(clave)) m.delete(clave);
      else {
        if (m.size >= MAX_SELECCION) { toast.info(`Máximo ${MAX_SELECCION} comidas por vez.`); return prev; }
        m.set(clave, { clave, item, factor: 1, texto: "1" });
      }
      return m;
    });
  }
  function setFactor(clave: string, texto: string) {
    setSel((prev) => {
      const m = new Map(prev);
      const x = m.get(clave);
      if (!x) return prev;
      const f = validarFactor(texto);
      m.set(clave, { ...x, texto, factor: f ?? x.factor });
      return m;
    });
  }

  const favMut = useMutation({
    mutationFn: async ({ clave, item }: { clave: string; item: ItemComida }) => {
      if (favClaves.has(clave)) await borrarFavoritoPorClave(clave);
      else await crearFavorito(item);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favoritos"] }),
    onError: () => toast.error("No se pudo actualizar el favorito."),
  });

  const registrar = useMutation({
    mutationFn: () => registrarVarias(filasParaRegistrar([...sel.values()], fecha, momento)),
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["comidas"] });
      qc.invalidateQueries({ queryKey: ["comidas-rango"] });
      qc.invalidateQueries({ queryKey: ["recientes"] });
      toast.success(`${n} ${n === 1 ? "comida registrada" : "comidas registradas"}`);
      navigate({ to: "/" });
    },
    onError: () => toast.error("No se pudo registrar. Reintentá."),
  });

  const lista = [...sel.values()];
  const total = lista.reduce((a, x) => a + escalarComida(x.item, x.factor).calorias, 0);
  const invalido = lista.some((x) => validarFactor(x.texto) == null);

  const filaProps = { sel, toggle, setFactor, favClaves, onFav: (clave: string, item: ItemComida) => favMut.mutate({ clave, item }), favPending: favMut.isPending };

  return (
    <Page className={tab !== "rapido" && sel.size > 0 ? "pb-48" : ""}>
      <PageHeader title="Mis comidas" back />
      <p className="-mt-3 mb-4 text-sm capitalize text-muted-foreground">{fecha === fechaLocal() ? "Hoy" : fmtFechaCorta(fecha)}</p>
      <Tabs value={tab} onValueChange={(t) => navigate({ to: "/agregar/mis-comidas", search: (p) => ({ ...p, tab: t }), replace: true })}>
        <TabsList className="mb-4 grid w-full grid-cols-3 rounded-full">
          <TabsTrigger value="recientes" className="rounded-full">Recientes</TabsTrigger>
          <TabsTrigger value="favoritos" className="rounded-full">Favoritos</TabsTrigger>
          <TabsTrigger value="rapido" className="rounded-full">Registro rápido</TabsTrigger>
        </TabsList>

        <TabsContent value="recientes">
          <CopiarAyer fecha={fecha} momento={momento} />
          <Recientes data={recientes.data} cargando={recientes.isLoading} filaProps={filaProps} />
        </TabsContent>

        <TabsContent value="favoritos">
          <Favoritos data={favoritos.data} cargando={favoritos.isLoading} filaProps={filaProps} />
        </TabsContent>

        <TabsContent value="rapido">
          <RegistroRapido fecha={fecha} momentoInicial={momento0} nombreInicial={s.nombre} onDone={() => navigate({ to: "/" })} />
        </TabsContent>
      </Tabs>

      {tab !== "rapido" && sel.size > 0 && (
        <div className="fixed inset-x-0 z-40 px-4 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)]">
          <Button className="mx-auto flex h-13 w-full max-w-md rounded-full text-base shadow-fab" disabled={invalido || registrar.isPending} onClick={() => setConfirmar(true)}>
            Registrar ({sel.size}) · {fmt(total)} kcal
          </Button>
        </div>
      )}

      <Drawer open={confirmar} onOpenChange={setConfirmar}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-md">
            <DrawerHeader><DrawerTitle>Registrar {sel.size} {sel.size === 1 ? "comida" : "comidas"}</DrawerTitle></DrawerHeader>
            <div className="max-h-[40vh] space-y-1 overflow-y-auto px-4">
              {lista.map((x) => (
                <div key={x.clave} className="flex justify-between gap-2 text-sm">
                  <span className="truncate">{x.item.nombre}{x.factor !== 1 && <span className="text-muted-foreground"> ×{fmt(x.factor, 1)}</span>}</span>
                  <span className="shrink-0 tabular">{fmt(escalarComida(x.item, x.factor).calorias)} kcal</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2 font-semibold"><span>Total</span><span className="tabular">{fmt(total)} kcal</span></div>
            </div>
            <div className="px-4 pt-4">
              <p className="mb-2 text-sm font-semibold text-muted-foreground">Momento del día</p>
              <MomentoPicker value={momento} onChange={setMomento} />
            </div>
            <DrawerFooter>
              <Button className="h-12 rounded-full" disabled={registrar.isPending || invalido} onClick={() => registrar.mutate()}>
                {registrar.isPending && <Loader2 className="size-4 animate-spin" />} Confirmar
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </Page>
  );
}

type FilaProps = {
  sel: Map<string, Sel>;
  toggle: (clave: string, item: ItemComida) => void;
  setFactor: (clave: string, t: string) => void;
  favClaves: Set<string>;
  onFav: (clave: string, item: ItemComida) => void;
  favPending: boolean;
};

function Fila({ item, origen, p, menu }: { item: ItemComida; origen?: string; p: FilaProps; menu?: React.ReactNode }) {
  const clave = claveComida(item.nombre, item.calorias);
  const s = p.sel.get(clave);
  const Icon = origen ? (ICONO[origen as keyof typeof ICONO] ?? PenLine) : Heart;
  const v = s ? escalarComida(item, s.factor) : null;
  const n = (k: "calorias" | "proteinas_g" | "carbohidratos_g" | "grasas_g") => (v ? v[k] : Number(item[k]));
  const esFav = p.favClaves.has(clave);
  const factorMal = s && validarFactor(s.texto) == null;
  return (
    <div className={cn("rounded-2xl px-1 py-2.5", s && "bg-primary-soft/60 px-2")}>
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{item.nombre}</p>
          <p className="text-xs tabular text-muted-foreground">
            <span className="font-semibold text-foreground">{fmt(n("calorias"))} kcal</span> ·{" "}
            <span className="text-protein">P {fmt(n("proteinas_g"))}</span> · <span className="text-carbs">C {fmt(n("carbohidratos_g"))}</span> ·{" "}
            <span className="text-fat">G {fmt(n("grasas_g"))}</span>
          </p>
        </div>
        {menu ?? (
          <button aria-label={esFav ? "Quitar de favoritos" : "Agregar a favoritos"} disabled={p.favPending} onClick={() => p.onFav(clave, item)} className="rounded-full p-2 text-primary">
            <Heart className={cn("size-5", esFav && "fill-current")} />
          </button>
        )}
        <button
          aria-label={s ? "Quitar de la selección" : "Seleccionar"}
          onClick={() => p.toggle(clave, item)}
          className={cn("flex size-9 items-center justify-center rounded-full", s ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary")}
        >
          {s ? <Check className="size-5" /> : <Plus className="size-5" />}
        </button>
      </div>
      {s && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-12">
          {FACTORES_RAPIDOS.map((f) => (
            <button key={f} onClick={() => p.setFactor(clave, String(f).replace(".", ","))}
              className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", s.factor === f && !factorMal ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>
              ×{String(f).replace(".", ",")}
            </button>
          ))}
          <Input value={s.texto} onChange={(e) => p.setFactor(clave, e.target.value)} inputMode="decimal" aria-label="Cantidad"
            className={cn("h-7 w-16 rounded-full text-center text-xs", factorMal && "border-destructive")} />
          {factorMal && <span className="text-xs text-destructive">Entre 0,1 y 10</span>}
        </div>
      )}
    </div>
  );
}

function Buscador({ q, setQ, ayuda }: { q: string; setQ: (s: string) => void; ayuda?: string }) {
  return (
    <div className="mb-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre" className="h-11 rounded-full pl-9" />
      </div>
      {ayuda && <p className="mt-1 px-3 text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );
}

function Recientes({ data, cargando, filaProps }: { data: Comida[] | undefined; cargando: boolean; filaProps: FilaProps }) {
  const [q, setQ] = useState("");
  const [n, setN] = useState(PAGINA);
  const filtradas = (data ?? []).filter((c) => coincideBusqueda(c.nombre, q));
  const grupos = agruparPorFecha(filtradas.slice(0, n), fechaLocal());
  return (
    <Card className="mt-3">
      <Buscador q={q} setQ={(v) => { setQ(v); setN(PAGINA); }} ayuda="Busca entre tus comidas recientes." />
      {cargando && <p className="py-3 text-sm text-muted-foreground">Cargando…</p>}
      {!cargando && filtradas.length === 0 && <p className="py-3 text-sm text-muted-foreground">{q ? "No encontramos comidas con ese nombre." : "Todavía no registraste comidas."}</p>}
      {grupos.map((g) => (
        <div key={g.fecha} className="mt-2">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.titulo}</h3>
          {g.items.map((c) => <Fila key={c.id} item={c} origen={c.origen} p={filaProps} />)}
        </div>
      ))}
      {filtradas.length > n && <Button variant="ghost" className="mt-2 w-full rounded-full" onClick={() => setN(n + PAGINA)}>Ver más</Button>}
    </Card>
  );
}

function Favoritos({ data, cargando, filaProps }: { data: Favorito[] | undefined; cargando: boolean; filaProps: FilaProps }) {
  const [q, setQ] = useState("");
  const [renombrar, setRenombrar] = useState<Favorito | null>(null);
  const [quitar, setQuitar] = useState<Favorito | null>(null);
  const [nombre, setNombre] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const qc = useQueryClient();
  const filtrados = (data ?? []).filter((f) => coincideBusqueda(f.nombre, q));

  return (
    <Card>
      <Buscador q={q} setQ={setQ} />
      {cargando && <p className="py-3 text-sm text-muted-foreground">Cargando…</p>}
      {!cargando && (data?.length ?? 0) === 0 && (
        <p className="py-3 text-sm text-muted-foreground">Todavía no tenés favoritos. Tocá el corazón en una comida reciente para guardarla.</p>
      )}
      {!cargando && (data?.length ?? 0) > 0 && filtrados.length === 0 && <p className="py-3 text-sm text-muted-foreground">No encontramos favoritos con ese nombre.</p>}
      {filtrados.map((f) => (
        <Fila key={f.id} item={f} p={filaProps} menu={
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
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre" />
          <DialogFooter>
            <Button className="rounded-full" disabled={!nombre.trim() || ocupado} onClick={async () => {
              setOcupado(true);
              try { await renombrarFavorito(renombrar!.id, nombre); qc.invalidateQueries({ queryKey: ["favoritos"] }); setRenombrar(null); }
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
            <AlertDialogDescription>Las comidas ya registradas no se borran.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={ocupado} onClick={async () => {
              setOcupado(true);
              try { await borrarFavoritoPorClave(quitar!.clave); qc.invalidateQueries({ queryKey: ["favoritos"] }); }
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

function CopiarAyer({ fecha, momento }: { fecha: string; momento: Momento }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const ayer = sumarDias(fecha, -1);
  const [vacio, setVacio] = useState(false);
  const copiar = useMutation({
    mutationFn: async (soloMomento: boolean) => {
      await uid();
      let q = supabase.from("comidas").select("*").eq("fecha", ayer);
      if (soloMomento) q = q.eq("momento", momento);
      const { data, error } = await q;
      if (error) throw error;
      for (const c of data) await crearComida(copiaDe(c, fecha));
      return data.length;
    },
    onSuccess: (n) => {
      if (!n) { setVacio(true); return; }
      qc.invalidateQueries({ queryKey: ["comidas"] });
      qc.invalidateQueries({ queryKey: ["comidas-rango"] });
      toast.success(`${n} ${n === 1 ? "comida copiada" : "comidas copiadas"}`);
      navigate({ to: "/" });
    },
    onError: () => toast.error("No se pudo copiar."),
  });
  const label = MOMENTOS.find((m) => m.key === momento)?.label ?? momento;
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">Copiar del día anterior <span className="font-normal text-muted-foreground">· {fmtFechaCorta(ayer)}</span></h2>
        <CopyPlus className="size-5 text-muted-foreground" />
      </div>
      <div className="mt-3 flex gap-2">
        <button disabled={copiar.isPending} onClick={() => { setVacio(false); copiar.mutate(true); }} className="flex-1 rounded-full bg-primary-soft px-3 py-2 text-sm font-medium text-primary disabled:opacity-50">
          Solo {label.toLowerCase()}
        </button>
        <button disabled={copiar.isPending} onClick={() => { setVacio(false); copiar.mutate(false); }} className="flex-1 rounded-full border px-3 py-2 text-sm font-medium disabled:opacity-50">
          Todo el día
        </button>
      </div>
      {vacio && <p className="mt-2 text-sm text-muted-foreground">No hay comidas para copiar de ese día.</p>}
    </Card>
  );
}
