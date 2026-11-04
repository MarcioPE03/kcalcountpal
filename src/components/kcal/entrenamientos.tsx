import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { NumberInput } from "@/components/kcal/editors";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  actualizarEntrenamiento, borrarEntrenamiento, entrenamientosDiaQuery, guardarEntrenamiento, type Entrenamiento,
} from "@/lib/data";
import { fmt, fmtFechaCorta, validarQuemadas } from "@/lib/nutri";
import { cn } from "@/lib/utils";

const SUGERENCIAS = ["Pesas", "Caminata", "Correr", "Bicicleta", "Fútbol", "Otro"];

type Ent = Omit<Entrenamiento, "calorias_quemadas"> & { calorias_quemadas: number };

export function WorkoutRow({ e, onClick }: { e: Ent; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl px-1 py-2.5 text-left transition-colors active:bg-muted">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-carbs">
        <Flame className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{e.nombre}</p>
        {e.duracion_min ? <p className="text-xs text-muted-foreground">{e.duracion_min} min</p> : null}
      </div>
      <span className="text-sm font-semibold tabular">
        {fmt(e.calorias_quemadas)} <span className="text-xs font-normal text-muted-foreground">kcal</span>
      </span>
    </button>
  );
}

export function EntrenamientoDialog({ open, onOpenChange, fecha, entrenamiento, onGuardado }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  fecha: string;
  entrenamiento?: Ent | null;
  onGuardado?: () => void;
}) {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [kcal, setKcal] = useState(0);
  const [dur, setDur] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNombre(entrenamiento?.nombre ?? "");
    setKcal(entrenamiento?.calorias_quemadas ?? 0);
    setDur(entrenamiento?.duracion_min ?? 0);
  }, [open, entrenamiento]);

  const refrescar = () => qc.invalidateQueries({ queryKey: ["entrenamientos"] });

  async function guardar() {
    if (!nombre.trim()) { toast.error("Poné un nombre al entrenamiento."); return; }
    const err = validarQuemadas(kcal || null);
    if (err) { toast.error(err); return; }
    const datos = { fecha: entrenamiento?.fecha ?? fecha, nombre: nombre.trim(), calorias_quemadas: Math.round(kcal), duracion_min: dur > 0 ? Math.round(dur) : null };
    setGuardando(true);
    try {
      if (entrenamiento) await actualizarEntrenamiento(entrenamiento.id, datos);
      else await guardarEntrenamiento(datos);
      await refrescar();
      toast.success(entrenamiento ? "Entrenamiento actualizado" : "Entrenamiento agregado");
      onOpenChange(false);
      onGuardado?.();
    } catch {
      toast.error("No se pudo guardar el entrenamiento.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!entrenamiento) return;
    try {
      await borrarEntrenamiento(entrenamiento.id);
      await refrescar();
      toast.success("Entrenamiento borrado");
      setConfirmar(false);
      onOpenChange(false);
    } catch {
      toast.error("No se pudo borrar.");
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>{entrenamiento ? "Editar entrenamiento" : "Agregar entrenamiento"}</DialogTitle>
            <p className="text-sm capitalize text-muted-foreground">{fmtFechaCorta(entrenamiento?.fecha ?? fecha)}</p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ent-nombre">Nombre</Label>
              <Input id="ent-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Pesas" maxLength={60} />
              <div className="flex flex-wrap gap-1.5">
                {SUGERENCIAS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNombre(s)}
                    className={cn("rounded-full px-3 py-1 text-xs font-medium", nombre === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
                  >
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
            <Button className="w-full rounded-full" onClick={guardar} disabled={guardando}>
              {guardando && <Loader2 className="size-4 animate-spin" />} Guardar
            </Button>
            {entrenamiento && (
              <Button variant="ghost" className="w-full rounded-full text-destructive" onClick={() => setConfirmar(true)}>
                <Trash2 className="size-4" /> Borrar
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent className="max-w-sm rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar este entrenamiento?</AlertDialogTitle>
            <AlertDialogDescription>No se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={borrar} className="bg-destructive text-destructive-foreground">Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** List of the day's workouts (opened from "Quemadas"): drawer on mobile, popover on desktop. */
export function EntrenamientosSheet({ fecha, children }: { fecha: string; children: ReactNode }) {
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [dialogo, setDialogo] = useState<{ e: Ent | null } | null>(null);
  const lista = useQuery(entrenamientosDiaQuery(fecha));

  const abrir = (e: Ent | null) => { setOpen(false); setDialogo({ e }); };

  const contenido = (
    <div className="px-4 pb-6">
      {lista.data?.length ? (
        <div className="divide-y divide-border/60">
          {lista.data.map((e) => <WorkoutRow key={e.id} e={e} onClick={() => abrir(e)} />)}
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">No registraste entrenamientos este día.</p>
      )}
      <Button className="mt-3 w-full rounded-full" onClick={() => abrir(null)}>
        <Plus className="size-4" /> Agregar entrenamiento
      </Button>
    </div>
  );

  return (
    <>
      {mobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>{children}</DrawerTrigger>
          <DrawerContent>
            <DrawerHeader><DrawerTitle>Entrenamientos · <span className="capitalize">{fmtFechaCorta(fecha)}</span></DrawerTitle></DrawerHeader>
            {contenido}
          </DrawerContent>
        </Drawer>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{children}</PopoverTrigger>
          <PopoverContent className="w-80 p-0 pt-4">
            <p className="mb-1 px-4 font-display font-bold">Entrenamientos</p>
            {contenido}
          </PopoverContent>
        </Popover>
      )}
      <EntrenamientoDialog open={!!dialogo} onOpenChange={(o) => !o && setDialogo(null)} fecha={fecha} entrenamiento={dialogo?.e ?? null} />
    </>
  );
}
