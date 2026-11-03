import { NUTRIENTES, NUTRIENTE_LABEL, NUTRIENTE_UNIDAD, fmt, type Nutrientes } from "@/lib/nutri";
import { cn } from "@/lib/utils";

const COLOR: Partial<Record<keyof Nutrientes, string>> = {
  proteinas: "text-protein",
  carbohidratos: "text-carbs",
  grasas: "text-fat",
};

export function TotalesGrid({ t }: { t: Nutrientes }) {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-3">
      {NUTRIENTES.filter((k) => k !== "calorias").map((k) => (
        <div key={k}>
          <p className={cn("font-display text-lg font-bold tabular", COLOR[k])}>
            {fmt(t[k], k === "sodio_mg" ? 0 : 1)}
            <span className="ml-0.5 text-xs font-medium text-muted-foreground">{NUTRIENTE_UNIDAD[k]}</span>
          </p>
          <p className="text-[11px] leading-tight text-muted-foreground">{NUTRIENTE_LABEL[k]}</p>
        </div>
      ))}
    </div>
  );
}

const CONF = {
  alta: "bg-primary-soft text-primary",
  media: "bg-carbs/20 text-foreground",
  baja: "bg-fat/20 text-foreground",
} as const;

export function ConfianzaBadge({ c }: { c: string | null }) {
  if (!c) return null;
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", CONF[c as keyof typeof CONF])}>
      Confianza {c}
    </span>
  );
}
