import { Link } from "@tanstack/react-router";
import { Camera, MessageSquareText, PenLine, Copy } from "lucide-react";
import type { Comida } from "@/lib/data";
import { fmt } from "@/lib/nutri";

const ICONO = { foto: Camera, texto: MessageSquareText, manual: PenLine, copia: Copy } as const;

export function MealRow({ c }: { c: Comida }) {
  const Icon = ICONO[c.origen as keyof typeof ICONO] ?? PenLine;
  return (
    <Link
      to="/comida/$id"
      params={{ id: c.id }}
      className="flex items-center gap-3 rounded-2xl px-1 py-2.5 transition-colors active:bg-muted"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{c.nombre}</p>
        <p className="text-xs text-muted-foreground tabular">
          <span className="text-protein">P {fmt(Number(c.proteinas_g))}</span> ·{" "}
          <span className="text-carbs">C {fmt(Number(c.carbohidratos_g))}</span> ·{" "}
          <span className="text-fat">G {fmt(Number(c.grasas_g))}</span>
        </p>
      </div>
      <span className="text-sm font-semibold tabular">
        {c.kcal_min != null ? "~" : ""}
        {fmt(Number(c.calorias))} <span className="text-xs font-normal text-muted-foreground">kcal</span>
      </span>
    </Link>
  );
}
