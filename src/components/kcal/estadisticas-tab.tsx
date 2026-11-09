import { useQuery } from "@tanstack/react-query";
import { BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Bar, ComposedChart, Cell, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Card } from "@/components/kcal/layout";
import { comidaANutrientes, comidasRangoQuery, entrenamientosRangoQuery, metasQuery, perfilQuery } from "@/lib/data";
import {
  MOMENTOS, caloriasPorCategoria, fechaLocal, fmt, fmtFechaNum, macrosEscalados, moverPeriodo,
  limitesPorDia, modoValido, promedioDiario, quemadasPorFecha, rangoPeriodo, sumar, topCategorias, type Periodo,
} from "@/lib/nutri";
import { cn } from "@/lib/utils";

const MOMENTO_COLOR: Record<string, string> = {
  desayuno: "var(--carbs)", almuerzo: "var(--primary)", merienda: "var(--accent)", cena: "var(--protein)", snack: "var(--cat-2)",
};
const CAT_COLORS = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const tick = { fontSize: 11, fill: "var(--muted-foreground)" };

export function EstadisticasTab() {
  const hoy = fechaLocal();
  const [tipo, setTipo] = useState<Periodo>("semana");
  const [ref, setRef] = useState(hoy);
  const { desde, hasta, dias } = rangoPeriodo(tipo, ref);
  const q = useQuery(comidasRangoQuery(desde, hasta));
  const metas = useQuery(metasQuery());
  const perfil = useQuery(perfilQuery());
  const ents = useQuery(entrenamientosRangoQuery(desde, hasta));
  const limites = metas.data
    ? limitesPorDia(dias, metas.data, modoValido(perfil.data?.modo_entrenamiento), perfil.data?.umbral_entreno_kcal ?? 0, quemadasPorFecha(ents.data ?? []))
    : dias.map(() => 2000);
  const limite = Math.max(...limites);
  const limMin = Math.min(...limites);
  const comidas = q.data ?? [];
  const mensual = tipo === "mes";

  const porDia = dias.map((f, i) => {
    const t = sumar(comidas.filter((c) => c.fecha === f).map(comidaANutrientes));
    const m = macrosEscalados(t);
    return { f, etiqueta: mensual ? String(i + 1) : fmtFechaNum(f).slice(0, 5), calorias: t.calorias, limite: limites[i], ...m };
  });
  const prom = promedioDiario(comidas.map((c) => ({ fecha: c.fecha, calorias: Number(c.calorias) })));
  const totalKcal = comidas.reduce((s, c) => s + Number(c.calorias), 0);

  const porMomento = MOMENTOS.map((m) => ({
    nombre: m.key === "snack" ? "Snack" : m.label, key: m.key,
    kcal: comidas.filter((c) => c.momento === m.key).reduce((s, c) => s + Number(c.calorias), 0),
  })).filter((x) => x.kcal > 0).map((x) => ({ ...x, pct: totalKcal ? (x.kcal / totalKcal) * 100 : 0 }));

  const cats = topCategorias(caloriasPorCategoria(comidas.map((c) => ({ calorias: Number(c.calorias), ingredientes: c.ingredientes }))), 5);

  const macroTot = porDia.reduce((s, d) => ({ p: s.p + d.proteinas, c: s.c + d.carbohidratos, g: s.g + d.grasas }), { p: 0, c: 0, g: 0 });
  const macroSum = macroTot.p + macroTot.c + macroTot.g;
  const pct = (v: number) => (macroSum ? (v / macroSum) * 100 : 0);

  const enCurso = hasta >= hoy;
  const titulo = mensual
    ? `${MESES[Number(desde.slice(5, 7)) - 1]} ${desde.slice(0, 4)}`
    : `${fmtFechaNum(desde).slice(0, 5)} – ${fmtFechaNum(hasta)}`;
  const ticksMes = mensual ? porDia.filter((_, i) => i === 0 || (i + 1) % 5 === 0).map((d) => d.etiqueta) : undefined;
  const vacio = !q.isLoading && comidas.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-full bg-muted p-1 text-sm">
        {([["semana", "Semana"], ["mes", "Mes"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => { setTipo(k); setRef(hoy); }}
            className={cn("flex-1 rounded-full py-1.5 font-medium", tipo === k ? "bg-card shadow-sm" : "text-muted-foreground")}>{l}</button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <button onClick={() => setRef(moverPeriodo(tipo, ref, -1))} className="rounded-full p-2 hover:bg-muted" aria-label="Período anterior"><ChevronLeft className="size-5" /></button>
        <span className="text-sm font-medium capitalize tabular">{titulo}</span>
        <button onClick={() => setRef(moverPeriodo(tipo, ref, 1))} disabled={enCurso} className="rounded-full p-2 hover:bg-muted disabled:opacity-30" aria-label="Período siguiente"><ChevronRight className="size-5" /></button>
      </div>

      <Card className="bg-primary-soft">
        <p className="text-sm text-muted-foreground">Promedio diario</p>
        <p className="font-display text-3xl font-extrabold text-primary tabular">{prom.dias ? `${fmt(prom.promedio)} kcal` : "—"}</p>
        <p className="text-sm text-muted-foreground">
          {prom.dias ? `Promedio de ${prom.dias} ${prom.dias === 1 ? "día registrado" : "días registrados"}` : "Sin días registrados en este período"}
        </p>
      </Card>

      {vacio ? (
        <Card className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
          <BarChart3 className="size-8 text-primary" />
          <p>No hay comidas en este período. Cuando registres, vas a ver tus gráficos acá.</p>
        </Card>
      ) : (
        <>
          <Card>
            <Titulo t="Ingesta de calorías" sub={limMin === limite ? `Límite ${fmt(limite)} kcal` : `Límite ${fmt(limMin)}–${fmt(limite)} kcal según el día`} />
            <div className="mt-4 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={porDia} margin={{ left: -16, right: 4, top: 8 }}>
                  <XAxis dataKey="etiqueta" {...(ticksMes ? { ticks: ticksMes } : {})} interval={0} tickLine={false} axisLine={false} tick={tick} />
                  <YAxis domain={[0, (max: number) => Math.ceil(Math.max(max, limite * 1.1) / 100) * 100]} tickLine={false} axisLine={false} tick={tick} tickFormatter={(n: number) => fmt(n)} />
                  <Bar dataKey="calorias" radius={[6, 6, 6, 6]} animationDuration={900}>
                    {porDia.map((d) => <Cell key={d.f} fill="var(--primary)" />)}
                  </Bar>
                  <Line dataKey="limite" type="step" stroke="var(--accent)" strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <Titulo t="Calorías por comida" />
            <Dona datos={porMomento.map((m) => ({ nombre: m.nombre, kcal: m.kcal, pct: m.pct, color: MOMENTO_COLOR[m.key]! }))} />
          </Card>

          <Card>
            <Titulo t="Calorías por categoría" />
            <Dona datos={cats.map((c, i) => ({ ...c, color: CAT_COLORS[i % CAT_COLORS.length]! }))} />
          </Card>

          <Card>
            <Titulo t="Ingesta nutricional" sub="kcal por macro" />
            <div className="mt-4 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={porDia} margin={{ left: -16, right: 4, top: 8 }}>
                  <XAxis dataKey="etiqueta" {...(ticksMes ? { ticks: ticksMes } : {})} interval={0} tickLine={false} axisLine={false} tick={tick} />
                  <YAxis tickLine={false} axisLine={false} tick={tick} tickFormatter={(n: number) => fmt(n)} />
                  <Bar dataKey="carbohidratos" stackId="m" fill="var(--carbs)" animationDuration={900} />
                  <Bar dataKey="proteinas" stackId="m" fill="var(--protein)" animationDuration={900} />
                  <Bar dataKey="grasas" stackId="m" fill="var(--fat)" radius={[6, 6, 0, 0]} animationDuration={900} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <Leyenda items={[
              { nombre: "Carbohidratos", color: "var(--carbs)", pct: pct(macroTot.c) },
              { nombre: "Proteínas", color: "var(--protein)", pct: pct(macroTot.p) },
              { nombre: "Grasas", color: "var(--fat)", pct: pct(macroTot.g) },
            ]} />
          </Card>
        </>
      )}
    </div>
  );
}

function Titulo({ t, sub }: { t: string; sub?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="font-bold">{t}</h2>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

function Leyenda({ items }: { items: { nombre: string; color: string; pct: number; kcal?: number }[] }) {
  return (
    <ul className="mt-3 space-y-1.5 text-sm">
      {items.map((i) => (
        <li key={i.nombre} className="flex items-center gap-2">
          <span className="size-3 shrink-0 rounded-full" style={{ background: i.color }} />
          <span className="flex-1 truncate">{i.nombre}</span>
          {i.kcal != null && <span className="text-xs text-muted-foreground tabular">{fmt(i.kcal)} kcal</span>}
          <span className="w-12 text-right font-semibold tabular">{fmt(i.pct)} %</span>
        </li>
      ))}
    </ul>
  );
}

function Dona({ datos }: { datos: { nombre: string; kcal: number; pct: number; color: string }[] }) {
  if (!datos.length) return <p className="py-6 text-center text-sm text-muted-foreground">Sin datos suficientes.</p>;
  return (
    <div className="mt-2 flex flex-col items-center gap-2 sm:flex-row">
      <div className="h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={datos} dataKey="kcal" nameKey="nombre" innerRadius="60%" outerRadius="95%" paddingAngle={datos.length > 1 ? 2 : 0} stroke="none" animationDuration={900}>
              {datos.map((d) => <Cell key={d.nombre} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-full"><Leyenda items={datos} /></div>
    </div>
  );
}
