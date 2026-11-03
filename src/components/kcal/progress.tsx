import { cn } from "@/lib/utils";
import { caloriasRestantes, fmt } from "@/lib/nutri";

export function CalorieRing({ consumidas, limite, size = 208, hero }: { consumidas: number; limite: number; size?: number; hero?: boolean }) {
  const stroke = hero ? 20 : 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = limite > 0 ? Math.min(consumidas / limite, 1) : 0;
  const { restante, excedido } = caloriasRestantes(consumidas, limite);
  const over = excedido > 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={hero ? "stroke-[var(--ring-track)]" : "stroke-track"} />
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
            over ? "stroke-over" : hero ? "stroke-[var(--ring-progress)]" : "stroke-primary",
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={cn("font-display font-extrabold tabular", hero ? "text-5xl text-hero-foreground text-shadow-hero" : "text-4xl", over && (hero ? "rounded-full bg-over px-3 text-4xl text-hero-foreground" : "text-over"))}>
          {fmt(over ? excedido : restante)}
        </span>
        <span className={cn("text-xs font-semibold", hero ? "text-hero-foreground text-shadow-hero" : "text-muted-foreground")}>
          {over ? "kcal de más" : "kcal restantes"}
        </span>
        <span className={cn("mt-1 text-[11px] tabular", hero ? "font-medium text-hero-foreground/90 text-shadow-hero" : "text-muted-foreground")}>
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

export function MacroColumna({ label, valor, meta, color }: { label: string; valor: number; meta?: number | null; color: "protein" | "carbs" | "fat" }) {
  const pct = meta ? Math.min((valor / meta) * 100, 100) : 0;
  const over = meta ? valor > meta : false;
  return (
    <div className="min-w-0 flex-1 text-center">
      <p className="text-xs font-semibold">{label}</p>
      <div className="my-2 h-1.5 overflow-hidden rounded-full bg-track">
        <div className={cn("h-full rounded-full transition-[width] duration-1000 ease-out", over ? "bg-over" : COLOR[color])} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground tabular">
        <span className={cn("font-semibold text-foreground", over && "text-over")}>{fmt(valor)}</span>/{meta ? fmt(meta) : "–"} g
      </p>
    </div>
  );
}
