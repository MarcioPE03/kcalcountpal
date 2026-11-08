import { AlertTriangle, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { CategoriaSelect, NumberInput } from "@/components/kcal/editors";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  NUTRIENTES, NUTRIENTE_LABEL, NUTRIENTE_UNIDAD, avisoAtwater, editarValoresIngrediente, escalarIngrediente, type Ingrediente,
} from "@/lib/nutri";
import { cn } from "@/lib/utils";

/** Edits one ingredient. Saving without changes returns the same object (no drift). */
export function IngredienteSheet({ ing, onClose, onSave, onDelete }: {
  ing: Ingrediente | null;
  onClose: () => void;
  onSave: (i: Ingrediente) => void;
  onDelete: (id: string) => void;
}) {
  const mobile = useIsMobile();
  const [draft, setDraft] = useState<Ingrediente | null>(ing);
  const [confirmar, setConfirmar] = useState(false);
  useEffect(() => setDraft(ing), [ing]);

  if (!ing || !draft) return null;
  const open = !!ing;
  const sinGramos = !(draft.gramos > 0);

  const cuerpo = (
    <div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 pb-4">
      <div className="space-y-1.5">
        <Label htmlFor="ing-nombre">Nombre</Label>
        <Textarea id="ing-nombre" rows={2} value={draft.nombre} maxLength={160} className="min-h-0 resize-none rounded-xl"
          onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} />
      </div>
      <div className="flex items-end gap-3">
        <div className="w-28 space-y-1.5">
          <Label htmlFor="ing-g">Gramos</Label>
          <NumberInput id="ing-g" value={draft.gramos} onChange={(g) => setDraft(escalarIngrediente(draft, g))} />
        </div>
        <div className="space-y-1.5">
          <Label>Categoría</Label>
          <CategoriaSelect value={draft.categoria} onChange={(categoria) => setDraft({ ...draft, categoria })} className="h-10" />
        </div>
      </div>
      {sinGramos && <p className="text-xs text-muted-foreground">Sin gramos: los valores se editan directamente, sin escalar.</p>}
      <div>
        <p className="mb-2 text-sm font-semibold">Valores de esta porción</p>
        <div className="grid grid-cols-2 gap-3">
          {NUTRIENTES.map((k) => (
            <div key={k} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{NUTRIENTE_LABEL[k]} ({NUTRIENTE_UNIDAD[k]})</Label>
              <NumberInput value={draft[k]} onChange={(n) => setDraft(editarValoresIngrediente(draft, { [k]: n }))} />
            </div>
          ))}
        </div>
      </div>
      {draft.editado_manual && avisoAtwater(draft) && (
        <p className="flex items-start gap-1.5 rounded-xl bg-carbs/15 p-2 text-xs text-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-carbs" />
          Las kcal no cierran con proteínas, carbohidratos y grasas (4/4/9). Lo dejamos como lo cargaste.
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <Button variant="ghost" className="flex-1 rounded-full" onClick={onClose}>Cancelar</Button>
        <Button className="flex-1 rounded-full" disabled={!draft.nombre.trim()}
          onClick={() => { onSave(draft === ing ? ing : { ...draft, nombre: draft.nombre.trim() }); onClose(); }}>
          Guardar
        </Button>
      </div>
      <Button variant="ghost" className="w-full rounded-full text-destructive" onClick={() => setConfirmar(true)}>
        <Trash2 className="size-4" /> Eliminar ingrediente
      </Button>
    </div>
  );

  return (
    <>
      {mobile ? (
        <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
          <DrawerContent>
            <DrawerHeader><DrawerTitle>Editar ingrediente</DrawerTitle></DrawerHeader>
            {cuerpo}
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
          <DialogContent className={cn("max-w-md rounded-3xl px-0")}>
            <DialogHeader className="px-4"><DialogTitle>Editar ingrediente</DialogTitle></DialogHeader>
            {cuerpo}
          </DialogContent>
        </Dialog>
      )}
      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent className="max-w-sm rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{ing.nombre}”?</AlertDialogTitle>
            <AlertDialogDescription>El total de la comida se actualiza al instante.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => { onDelete(ing.id); setConfirmar(false); onClose(); }}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
