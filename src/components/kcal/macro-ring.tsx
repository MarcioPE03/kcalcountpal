import type { ReactNode } from "react";
import { MACRO_KEYS, type PctMacros } from "@/lib/nutri";
import { cn } from "@/lib/utils";

const COLOR: Record<string, string> = {
  proteinas: "var(--protein)",
  carbohidratos: "var(--carbs)",
  grasas: "var(--fat)",
};

/** Three-segment ring; segments proportional to each macro's kcal share. */
export function MacroRing({ pct, size = 64, stroke = 8, gap = 2, children, className }: { pct: PctMacros; size?: number; stroke?: number; gap?: number; children?: ReactNode; className?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = MACRO_KEYS.reduce((s, k) => s + Math.max(0, pct[k]), 0) || 1;
  let offset = 0;
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        {MACRO_KEYS.map((k) => {
          const len = (Math.max(0, pct[k]) / total) * c;
          const seg = (
            <circle
              key={k}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={COLOR[k]}
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
              strokeDashoffset={-offset}
              className="transition-all duration-300"
            />
          );
          offset += len;
          return seg;
        })}
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}

export const MACRO_LABEL: Record<string, string> = { proteinas: "Proteínas", carbohidratos: "Carbohidratos", grasas: "Grasas" };
export const MACRO_BG: Record<string, string> = { proteinas: "bg-protein", carbohidratos: "bg-carbs", grasas: "bg-fat" };
