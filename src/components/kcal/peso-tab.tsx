import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Scale, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Card } from "@/components/kcal/layout";
import { NumberInput } from "@/components/kcal/editors";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actualizarPeso, borrarPeso, guardarPeso, guardarPesoMeta, perfilQuery, pesosQuery, type Peso } from "@/lib/data";
import {
  PESO_MAX, PESO_MIN, diaNumero, diferenciaPeso, dominioPeso, fechaLocal, filtrarRangoPeso, fmt,
  fmtDiferencia, fmtFechaNum, validarPeso, ymdDeDiaNumero,
} from "@/lib/nutri";
import { cn } from "@/lib/utils";

type Rango = "1m" | "3m" | "todo";
type Reg = Omit<Peso, "peso_kg"> & { peso_kg: number };

export function PesoTab() {
  const hoy = fechaLocal();
  const pesos = useQuery(pesosQuery());
  const perfil = useQuery(perfilQuery());
  const qc = useQueryClient();
  const [rango, setRango] = useState<Rango>("3m");
  const [dialogo, setDialogo] = useState<{ reg?: Reg } | null>(null);
  const [borrar, setBorrar] = useState<Reg | null>(null);
  const [editMeta, setEditMeta] = useState(false);

  const regs = (pesos.data ?? []) as Reg[];
  const ultimo = regs[regs.length - 1];
  const meta = perfil.data?.peso_meta_kg != null ? Number(perfil.data.peso_meta_kg) : null;
  const visibles = filtrarRangoPeso(regs, rango, hoy);
  const dif = diferenciaPeso(visibles);
  const datos = visibles.map((r) => ({ x: diaNumero(r.fecha), peso: r.peso_kg }));
  const [yMin, yMax] = dominioPeso(visibles.map((r) => r.peso_kg), meta);

  const refrescar = () => qc.invalidateQueries({ queryKey: ["pesos"] });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-muted-foreground">Peso actual</p>
          <p className="font-display text-2xl font-bold tabular">{ultimo ? `${fmt(ultimo.peso_kg, 1)} kg` : "—"}</p>
          <p className="text-[11px] text-muted-foreground">{ultimo ? fmtFechaNum(ultimo.fecha) : "Sin registros"}</p>
        </Card>
        <button type="button" onClick={() => setEditMeta(true)} className="text-left">
          <Card className="h-full">
            <p className="flex items-center justify-between text-xs text-muted-foreground">Peso meta <Pencil className="size-3" /></p>
            <p className="font-display text-2xl font-bold text-primary tabular">{meta != null ? `${fmt(meta, 1)} kg` : "Definir"}</p>
            {meta != null && ultimo && (
              <p className="text-[11px] text-muted-foreground tabular">
                {Math.abs(ultimo.peso_kg - meta) < 0.05 ? "¡Llegaste!" : `Faltan ${fmt(Math.abs(ultimo.peso_kg - meta), 1)} kg`}
              </p>
            )}
          </Card>
        </button>
      </div>

      <Button className="h-12 w-full rounded-full" onClick={() => setDialogo({})}>
        <Plus className="size-4" /> Actualizar mi peso
      </Button>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Evolución</h2>
          {dif != null && (
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold tabular", "bg-primary-soft text-primary")}>
              {fmtDiferencia(dif)}
            </span>
          )}
        </div>
        <div className="mt-3 flex gap-1 rounded-full bg-muted p-1 text-xs">
          {([["1m", "1 mes"], ["3m", "3 meses"], ["todo", "Todo"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setRango(k)}
              className={cn("flex-1 rounded-full py-1.5 font-medium", rango === k ? "bg-card shadow-sm" : "text-muted-foreground")}>
              {l}
            </button>
          ))}
        </div>
        {datos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Scale className="size-8 text-primary" />
            <p>{regs.length ? "No hay registros en este rango." : "Todavía no cargaste tu peso. Registralo y vas a ver tu evolución acá."}</p>
          </div>
        ) : (
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={datos} margin={{ left: -16, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gPeso" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="x" type="number" scale="time" domain={["dataMin", "dataMax"]}
                  tickFormatter={(n: number) => fmtFechaNum(ymdDeDiaNumero(n)).slice(0, 5)}
                  tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} minTickGap={24} />
                <YAxis domain={[yMin, yMax]} tickLine={false} axisLine={false} allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(n: number) => fmt(n)} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                  labelFormatter={(n) => fmtFechaNum(ymdDeDiaNumero(Number(n)))}
                  formatter={(v) => [`${fmt(Number(v), 1)} kg`, "Peso"]} />
                {meta != null && (
                  <ReferenceLine y={meta} stroke="var(--accent)" strokeDasharray="5 5"
                    label={{ value: `Meta ${fmt(meta, 1)}`, position: "insideTopRight", fontSize: 11, fill: "var(--accent)" }} />
                )}
                <Area type="monotone" dataKey="peso" stroke="var(--primary)" strokeWidth={2.5} fill="url(#gPeso)"
                  dot={{ r: 3, fill: "var(--primary)" }} animationDuration={900} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {regs.length > 0 && (
        <Card>
          <h2 className="mb-2 font-bold">Registros</h2>
          <ul className="divide-y">
            {[...regs].reverse().map((r) => (
              <li key={r.id} className="flex items-center gap-2 py-2">
                <span className="flex-1 text-sm tabular">{fmtFechaNum(r.fecha)}</span>
                <span className="font-semibold tabular">{fmt(r.peso_kg, 1)} kg</span>
                <button onClick={() => setDialogo({ reg: r })} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Editar registro"><Pencil className="size-4" /></button>
                <button onClick={() => setBorrar(r)} className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Borrar registro"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {dialogo && (
        <PesoDialog reg={dialogo.reg} inicial={ultimo?.peso_kg ?? 70} hoy={hoy}
          onClose={() => setDialogo(null)}
          onSaved={() => { setDialogo(null); refrescar(); toast.success("Peso guardado"); }} />
      )}
      {editMeta && (
        <MetaDialog meta={meta} inicial={meta ?? ultimo?.peso_kg ?? 70} onClose={() => setEditMeta(false)}
          onSaved={() => { setEditMeta(false); qc.invalidateQueries({ queryKey: ["perfil"] }); toast.success("Peso meta guardado"); }} />
      )}

      <AlertDialog open={!!borrar} onOpenChange={(o) => !o && setBorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar este registro?</AlertDialogTitle>
            <AlertDialogDescription>
              {borrar && `${fmt(borrar.peso_kg, 1)} kg del ${fmtFechaNum(borrar.fecha)}. No se puede deshacer.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!borrar) return;
                try { await borrarPeso(borrar.id); refrescar(); toast.success("Registro borrado"); }
                catch { toast.error("No se pudo borrar."); }
                setBorrar(null);
              }}>Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PesoDialog({ reg, inicial, hoy, onClose, onSaved }: { reg?: Reg; inicial: number; hoy: string; onClose: () => void; onSaved: () => void }) {
  const [fecha, setFecha] = useState(reg?.fecha ?? hoy);
  const [kg, setKg] = useState(reg?.peso_kg ?? inicial);
  const [guardando, setGuardando] = useState(false);
  const error = validarPeso(kg, fecha, hoy);
  async function guardar() {
    if (error) return;
    setGuardando(true);
    try {
      if (reg) await actualizarPeso(reg.id, fecha, kg);
      else await guardarPeso(fecha, kg);
      onSaved();
    } catch {
      toast.error("No se pudo guardar. ¿Ya hay un registro en esa fecha?");
    } finally { setGuardando(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl">
        <DialogHeader><DialogTitle>{reg ? "Editar peso" : "Actualizar mi peso"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="peso-fecha">Fecha</Label>
            <Input id="peso-fecha" type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="peso-kg">Peso (kg)</Label>
            <NumberInput id="peso-kg" value={kg} onChange={setKg} />
            <p className="text-xs text-muted-foreground">Entre {PESO_MIN} y {PESO_MAX} kg.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button className="w-full rounded-full" disabled={!!error || guardando} onClick={guardar}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetaDialog({ meta, inicial, onClose, onSaved }: { meta: number | null; inicial: number; onClose: () => void; onSaved: () => void }) {
  const [kg, setKg] = useState(inicial);
  useEffect(() => setKg(inicial), [inicial]);
  const valido = kg >= PESO_MIN && kg <= PESO_MAX;
  async function guardar(v: number | null) {
    try { await guardarPesoMeta(v); onSaved(); } catch { toast.error("No se pudo guardar."); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl">
        <DialogHeader><DialogTitle>Peso meta</DialogTitle></DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="meta-kg">Peso meta (kg)</Label>
          <NumberInput id="meta-kg" value={kg} onChange={setKg} />
          {!valido && <p className="text-sm text-destructive">Ingresá un peso entre {PESO_MIN} y {PESO_MAX} kg.</p>}
        </div>
        <DialogFooter className="gap-2">
          {meta != null && <Button variant="ghost" onClick={() => guardar(null)}>Quitar meta</Button>}
          <Button className="rounded-full" disabled={!valido} onClick={() => guardar(kg)}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
