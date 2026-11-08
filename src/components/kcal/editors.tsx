import { Mic, Plus, Square, Loader2 } from "lucide-react";
import { IngredienteSheet } from "@/components/kcal/ingrediente-sheet";
import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDictado } from "@/hooks/use-dictado";
import { cn } from "@/lib/utils";
import {
  CATEGORIAS,
  MOMENTOS,
  normalizarCategoria,
  NUTRIENTES,
  NUTRIENTE_LABEL,
  NUTRIENTE_UNIDAD,
  crearIngrediente,
  fmt,
  vacio,
  type Ingrediente,
  type Momento,
  type Nutrientes,
} from "@/lib/nutri";

export function CategoriaSelect({ value, onChange, className }: { value?: string | undefined; onChange: (c: string) => void; className?: string }) {
  return (
    <Select value={normalizarCategoria(value)} onValueChange={onChange}>
      <SelectTrigger className={cn("h-8 w-auto gap-1 rounded-full text-xs", className)} aria-label="Categoría">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CATEGORIAS.map((c) => (
          <SelectItem key={c} value={c}>{c}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function MomentoPicker({ value, onChange }: { value: Momento; onChange: (m: Momento) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {MOMENTOS.map((m) => (
        <button
          key={m.key}
          type="button"
          onClick={() => onChange(m.key)}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            value === m.key ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

export function DescripcionInput({
  value,
  onChange,
  placeholder,
  maxLength = 1000,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  const { estado, iniciar, detener, activo } = useDictado((t) =>
    onChange(((value ? value.trimEnd() + " " : "") + t).slice(0, maxLength)),
  );
  return (
    <div className="relative">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Ej: 200 g de pollo a la plancha, arroz, cocinado con poco aceite"}
        className="min-h-28 rounded-2xl bg-card pr-14 text-base"
        maxLength={maxLength}
      />
      <button
        type="button"
        onClick={activo ? detener : iniciar}
        disabled={estado === "transcribiendo"}
        aria-label={activo ? "Detener dictado" : "Dictar por voz"}
        className={cn(
          "absolute bottom-3 right-3 flex size-10 items-center justify-center rounded-full transition-colors",
          activo ? "bg-accent text-accent-foreground animate-pulse-soft" : "bg-primary-soft text-primary",
        )}
      >
        {estado === "transcribiendo" ? (
          <Loader2 className="size-5 animate-spin" />
        ) : activo ? (
          <Square className="size-4" fill="currentColor" />
        ) : (
          <Mic className="size-5" />
        )}
      </button>
      {activo && (
        <p className="mt-1.5 text-xs text-accent">
          {estado === "escuchando" ? "Escuchando… hablá normalmente" : "Grabando… tocá para terminar"}
        </p>
      )}
      {estado === "transcribiendo" && <p className="mt-1.5 text-xs text-muted-foreground">Transcribiendo…</p>}
    </div>
  );
}

const num = (s: string) => {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function NumberInput({
  value,
  onChange,
  className,
  ...rest
}: { value: number; onChange: (n: number) => void; className?: string } & Omit<
  ComponentProps<"input">,
  "value" | "onChange"
>) {
  const [txt, setTxt] = useState(fmt(value, 1).replace(/\./g, ""));
  const [last, setLast] = useState(value);
  if (value !== last && num(txt) !== value) {
    setLast(value);
    setTxt(fmt(value, 1).replace(/\./g, ""));
  }
  return (
    <Input
      inputMode="decimal"
      value={txt}
      onChange={(e) => {
        const v = e.target.value.replace(/[^0-9.,]/g, "");
        setTxt(v);
        const n = num(v);
        setLast(n);
        onChange(n);
      }}
      className={cn("tabular", className)}
      {...rest}
    />
  );
}

export function IngredientesEditor({
  items,
  onChange,
}: {
  items: Ingrediente[];
  onChange: (items: Ingrediente[]) => void;
}) {
  const [nuevo, setNuevo] = useState(false);
  const [editar, setEditar] = useState<Ingrediente | null>(null);
  return (
    <div className="space-y-2">
      {items.map((ing) => (
        <button
          key={ing.id}
          type="button"
          onClick={() => setEditar(ing)}
          className={cn("block w-full rounded-2xl border bg-card p-3 text-left transition-colors active:bg-muted", ing.descartable && "border-carbs bg-carbs/10")}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="line-clamp-2 font-medium">{ing.nombre}</p>
            <span className="shrink-0 text-sm tabular text-muted-foreground">{ing.gramos > 0 ? `${fmt(ing.gramos)} g` : "—"}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground tabular">
              <span className="font-semibold text-foreground">{fmt(ing.calorias)} kcal</span> · <span className="text-protein">P {fmt(ing.proteinas, 1)}</span> ·{" "}
              <span className="text-carbs">C {fmt(ing.carbohidratos, 1)}</span> · <span className="text-fat">G {fmt(ing.grasas, 1)}</span>
            </p>
            <span className="text-xs text-muted-foreground">{normalizarCategoria(ing.categoria)}{ing.editado_manual ? " · editado" : ""}</span>
          </div>
          {ing.descartable && <p className="mt-1.5 text-xs font-medium text-foreground">¿La comiste? Si la dejaste, eliminala.</p>}
        </button>
      ))}
      <IngredienteSheet
        ing={editar}
        onClose={() => setEditar(null)}
        onSave={(n) => { if (n !== editar) onChange(items.map((i) => (i.id === n.id ? n : i))); }}
        onDelete={(id) => onChange(items.filter((i) => i.id !== id))}
      />
      {nuevo ? (
        <NuevoIngrediente
          onCancel={() => setNuevo(false)}
          onAdd={(ing) => {
            onChange([...items, ing]);
            setNuevo(false);
          }}
        />
      ) : (
        <Button type="button" variant="outline" className="w-full rounded-2xl" onClick={() => setNuevo(true)}>
          <Plus className="size-4" /> Agregar ingrediente
        </Button>
      )}
    </div>
  );
}

function NuevoIngrediente({ onAdd, onCancel }: { onAdd: (i: Ingrediente) => void; onCancel: () => void }) {
  const [nombre, setNombre] = useState("");
  const [gramos, setGramos] = useState(100);
  const [v, setV] = useState<Nutrientes>(vacio());
  const [categoria, setCategoria] = useState("Otros");
  return (
    <div className="space-y-3 rounded-2xl border border-dashed bg-card p-3">
      <div className="flex gap-2">
        <Input placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <NumberInput value={gramos} onChange={setGramos} className="w-24" aria-label="Gramos" />
      </div>
      <div className="flex items-center gap-2"><Label className="text-xs text-muted-foreground">Categoría</Label><CategoriaSelect value={categoria} onChange={setCategoria} /></div>
      <NutrientesForm value={v} onChange={setV} compacto />
      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="flex-1" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={!nombre.trim()}
          onClick={() => onAdd(crearIngrediente(crypto.randomUUID(), nombre.trim(), gramos, v, categoria))}
        >
          Agregar
        </Button>
      </div>
    </div>
  );
}

export function NutrientesForm({
  value,
  onChange,
  compacto,
  resaltar,
}: {
  value: Nutrientes;
  onChange: (v: Nutrientes) => void;
  compacto?: boolean;
  /** Fields shown in amber (missing data the user should complete). */
  resaltar?: readonly string[];
}) {
  return (
    <div className={cn("grid gap-3", compacto ? "grid-cols-2" : "grid-cols-2")}>
      {NUTRIENTES.map((k) => (
        <div key={k} className={cn("space-y-1", resaltar?.includes(k) && "rounded-xl bg-carbs/15 p-1.5 ring-1 ring-carbs")}>
          <Label className={cn("text-xs text-muted-foreground", resaltar?.includes(k) && "font-semibold text-foreground")}>
            {NUTRIENTE_LABEL[k]} ({NUTRIENTE_UNIDAD[k]})
          </Label>
          <NumberInput value={value[k]} onChange={(n) => onChange({ ...value, [k]: n })} />
        </div>
      ))}
    </div>
  );
}
