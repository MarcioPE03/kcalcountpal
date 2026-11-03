import { cn } from "@/lib/utils";
import { caloriasRestantes, fmt } from "@/lib/nutri";

export function CalorieRing({ consumidas, limite, size = 208 }: { consumidas: number; limite: number; size?: number }) {
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = limite > 0 ? Math.min(consumidas / limite, 1) : 0;
  const { restante, excedido } = caloriasRestantes(consumidas, limite);
  const over = excedido > 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-track" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={cn(
            "transition-[stroke-dashoffset,stroke] duration-1000 ease-out",
            over ? "stroke-over" : "stroke-primary",
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={cn("font-display text-4xl font-bold tabular", over && "text-over")}>
          {fmt(over ? excedido : restante)}
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          {over ? "kcal de más" : "kcal restantes"}
        </span>
        <span className="mt-1 text-[11px] text-muted-foreground tabular">
          {fmt(consumidas)} / {fmt(limite)}
        </span>
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
  const over = meta ? valor > meta : false;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn("font-medium", compact ? "text-xs" : "text-sm")}>{label}</span>
        <span className="text-xs text-muted-foreground tabular">
          <span className={cn("font-semibold text-foreground", over && "text-over")}>{fmt(valor, unidad === "mg" ? 0 : 1)}</span>
          {meta ? ` / ${fmt(meta)} ${unidad}` : ` ${unidad}`}
        </span>
      </div>
      {meta ? (
        <div className="h-2 overflow-hidden rounded-full bg-track">
          <div
            className={cn("h-full rounded-full transition-[width] duration-1000 ease-out", over ? "bg-over" : COLOR[color])}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
