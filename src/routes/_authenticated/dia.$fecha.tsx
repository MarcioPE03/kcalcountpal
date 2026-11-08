import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, Page, PageHeader } from "@/components/kcal/layout";
import { MacroBar } from "@/components/kcal/progress";
import { comidasDiaQuery, entrenamientosDiaQuery, metasQuery, totalDia, totalQuemadas } from "@/lib/data";
import { EntrenamientoDialog, WorkoutRow } from "@/components/kcal/entrenamientos";
import { useState } from "react";
import { NUTRIENTES, NUTRIENTE_LABEL, NUTRIENTE_UNIDAD, fmt, fmtFechaCorta, type NutrienteKey } from "@/lib/nutri";

export const Route = createFileRoute("/_authenticated/dia/$fecha")({
  head: () => ({
    meta: [
      { title: "Nutrientes del día — KcalCountPal" },
      { name: "description", content: "Todos los nutrientes del día con su progreso." },
      { property: "og:title", content: "Nutrientes del día — KcalCountPal" },
      { property: "og:description", content: "Todos los nutrientes del día con su progreso." },
    ],
  }),
  component: Dia,
});

const COLOR: Record<NutrienteKey, "primary" | "protein" | "carbs" | "fat" | "accent"> = {
  calorias: "primary", proteinas: "protein", carbohidratos: "carbs", grasas: "fat",
  grasas_saturadas: "fat", fibra: "primary", azucares: "accent", sodio_mg: "accent",
};

function Dia() {
  const { fecha } = Route.useParams();
  const comidas = useQuery(comidasDiaQuery(fecha));
  const metas = useQuery(metasQuery());
  const entrenamientos = useQuery(entrenamientosDiaQuery(fecha));
  const [editar, setEditar] = useState<NonNullable<typeof entrenamientos.data>[number] | null>(null);
  const t = totalDia(comidas.data ?? []);
  const m = metas.data;
  const meta: Record<NutrienteKey, number | null> = {
    calorias: m?.calorias ?? null,
    proteinas: m ? Number(m.proteinas_g) : null,
    carbohidratos: m ? Number(m.carbohidratos_g) : null,
    grasas: m ? Number(m.grasas_g) : null,
    grasas_saturadas: m?.grasas_saturadas_g != null ? Number(m.grasas_saturadas_g) : null,
    fibra: m?.fibra_g != null ? Number(m.fibra_g) : null,
    azucares: m?.azucares_g != null ? Number(m.azucares_g) : null,
    sodio_mg: m?.sodio_mg != null ? Number(m.sodio_mg) : null,
  };
  return (
    <Page>
      <PageHeader title="Nutrientes" back />
      <p className="-mt-3 mb-4 text-sm capitalize text-muted-foreground">{fmtFechaCorta(fecha)} · {comidas.data?.length ?? 0} comidas</p>
      <Card className="space-y-5">
        {NUTRIENTES.map((k) => (
          <MacroBar key={k} label={NUTRIENTE_LABEL[k]} valor={t[k]} meta={meta[k]} unidad={NUTRIENTE_UNIDAD[k]} color={COLOR[k]} />
        ))}
      </Card>
      {entrenamientos.data?.length ? (
        <Card className="mt-4 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Entrenamientos</h2>
            <span className="text-sm text-muted-foreground tabular">{fmt(totalQuemadas(entrenamientos.data))} kcal</span>
          </div>
          <div className="mt-1 divide-y divide-border/60">
            {entrenamientos.data.map((e) => <WorkoutRow key={e.id} e={e} onClick={() => setEditar(e)} />)}
          </div>
        </Card>
      ) : null}
      <EntrenamientoDialog onOpenChange={(o) => !o && setEditar(null)} entrenamiento={editar} />
      <p className="mt-4 px-1 text-xs text-muted-foreground">Podés fijar metas de fibra, azúcares, saturadas y sodio en tu perfil.</p>
    </Page>
  );
}
