import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Card, Page, PageHeader } from "@/components/kcal/layout";
import { comidaANutrientes, comidasRangoQuery, metasQuery } from "@/lib/data";
import { fechaLocal, fmt, fmtDiaSemana, fmtFechaNum, inicioSemana, sumar, sumarDias } from "@/lib/nutri";

export const Route = createFileRoute("/_authenticated/progreso")({
  head: () => ({
    meta: [
      { title: "Progreso semanal — KcalCountPal" },
      { name: "description", content: "Tus calorías de la semana frente a tu límite y el promedio de macros." },
      { property: "og:title", content: "Progreso semanal — KcalCountPal" },
      { property: "og:description", content: "Tus calorías de la semana frente a tu límite y el promedio de macros." },
    ],
  }),
  component: Progreso,
});

function Progreso() {
  const hoy = fechaLocal();
  const [inicio, setInicio] = useState(inicioSemana(hoy));
  const fin = sumarDias(inicio, 6);
  const q = useQuery(comidasRangoQuery(inicio, fin));
  const metas = useQuery(metasQuery());
  const limite = metas.data?.calorias ?? 2000;

  const dias = Array.from({ length: 7 }, (_, i) => {
    const f = sumarDias(inicio, i);
    const t = sumar((q.data ?? []).filter((c) => c.fecha === f).map(comidaANutrientes));
    return { f, dia: fmtDiaSemana(f), ...t };
  });
  const conDatos = dias.filter((d) => d.calorias > 0);
  const n = conDatos.length || 1;
  const prom = {
    calorias: conDatos.reduce((s, d) => s + d.calorias, 0) / n,
    proteinas: conDatos.reduce((s, d) => s + d.proteinas, 0) / n,
    carbohidratos: conDatos.reduce((s, d) => s + d.carbohidratos, 0) / n,
    grasas: conDatos.reduce((s, d) => s + d.grasas, 0) / n,
  };

  return (
    <Page>
      <PageHeader title="Progreso" />
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => setInicio(sumarDias(inicio, -7))} className="rounded-full p-2 hover:bg-muted" aria-label="Semana anterior"><ChevronLeft className="size-5" /></button>
        <span className="text-sm font-medium tabular">{fmtFechaNum(inicio).slice(0, 5)} – {fmtFechaNum(fin)}</span>
        <button onClick={() => setInicio(sumarDias(inicio, 7))} disabled={fin >= hoy} className="rounded-full p-2 hover:bg-muted disabled:opacity-30" aria-label="Semana siguiente"><ChevronRight className="size-5" /></button>
      </div>

      <Card>
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">Calorías</h2>
          <span className="text-xs text-muted-foreground">Límite {fmt(limite)} kcal</span>
        </div>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dias} margin={{ left: -18, right: 4, top: 8 }}>
              <XAxis dataKey="dia" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <ReferenceLine y={limite} stroke="var(--accent)" strokeDasharray="4 4" />
              <Bar dataKey="calorias" radius={[8, 8, 8, 8]} animationDuration={900}>
                {dias.map((d) => (
                  <Cell key={d.f} fill={d.calorias > limite ? "var(--over)" : "var(--primary)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Promedio: <b className="text-foreground tabular">{fmt(prom.calorias)} kcal</b> por día registrado
        </p>
      </Card>

      <Card className="mt-4">
        <h2 className="font-bold">Promedio diario de macros</h2>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            { k: "Proteínas", v: prom.proteinas, meta: metas.data?.proteinas_g, c: "text-protein" },
            { k: "Carbohidratos", v: prom.carbohidratos, meta: metas.data?.carbohidratos_g, c: "text-carbs" },
            { k: "Grasas", v: prom.grasas, meta: metas.data?.grasas_g, c: "text-fat" },
          ].map((x) => (
            <div key={x.k} className="rounded-2xl bg-muted p-3">
              <p className={`font-display text-2xl font-bold tabular ${x.c}`}>{fmt(x.v)}<span className="text-sm"> g</span></p>
              <p className="text-[11px] text-muted-foreground">{x.k}</p>
              {x.meta != null && <p className="text-[11px] text-muted-foreground tabular">meta {fmt(Number(x.meta))} g</p>}
            </div>
          ))}
        </div>
        {conDatos.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Sin registros esta semana.</p>}
      </Card>
    </Page>
  );
}
