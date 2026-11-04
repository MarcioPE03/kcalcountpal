import { cn } from "@/lib/utils";
import { fmt } from "@/lib/nutri";

/** White ring on the top gradient. Never changes color, not even over the limit. */
export function CalorieRing({ restante, excedido, progreso, leyenda, size = 168 }: { restante: number; excedido: number; progreso: number; leyenda: string; size?: number }) {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-white/30" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progreso)}
          className="stroke-white transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white text-shadow-top">
        <span className="font-display text-4xl font-extrabold tabular">{fmt(excedido > 0 ? excedido : restante)}</span>
        <span className="text-xs font-semibold">{leyenda}</span>
      </div>
    </div>
  );
}

const COLOR = {
  protein: "bg-protein",
  carbs: "bg-carbs",
  fat: "bg-fat",
  primary: "bg-primary",
  accent: "bg-accent",
} as const;

export function MacroBar({
  label,
  valor,
  meta,
  unidad = "g",
  color,
  compact,
}: {
  label: string;
  valor: number;
  meta?: number | null;
  unidad?: string;
  color: keyof typeof COLOR;
  compact?: boolean;
}) {
  const pct = meta ? Math.min((valor / meta) * 100, 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn("font-medium", compact ? "text-xs" : "text-sm")}>{label}</span>
        <span className="text-xs text-muted-foreground tabular">
          <span className={"font-semibold text-foreground"}>{fmt(valor, unidad === "mg" ? 0 : 1)}</span>
          {meta ? ` / ${fmt(meta)} ${unidad}` : ` ${unidad}`}
        </span>
      </div>
      {meta ? (
        <div className="h-2 overflow-hidden rounded-full bg-track">
          <div
            className={cn("h-full rounded-full transition-[width] duration-1000 ease-out", COLOR[color])}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function MacroColumna({ label, valor, meta, color }: { label: string; valor: number; meta?: number | null; color: "protein" | "carbs" | "fat" }) {
  const pct = meta ? Math.min((valor / meta) * 100, 100) : 0;
  return (
    <div className="min-w-0 flex-1 text-center">
      <p className="text-xs font-semibold">{label}</p>
      <div className="my-2 h-1.5 overflow-hidden rounded-full bg-track">
        <div className={cn("h-full rounded-full transition-[width] duration-1000 ease-out", COLOR[color])} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground tabular">
        <span className={"font-semibold text-foreground"}>{fmt(valor)}</span>/{meta ? fmt(meta) : "–"} g
      </p>
    </div>
  );
}
