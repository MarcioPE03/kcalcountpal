import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, Page, PageHeader } from "@/components/kcal/layout";
import { MacroBar } from "@/components/kcal/progress";
import { comidasDiaQuery, metasQuery, totalDia } from "@/lib/data";
import { NUTRIENTES, NUTRIENTE_LABEL, NUTRIENTE_UNIDAD, fmtFechaCorta, type NutrienteKey } from "@/lib/nutri";

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
      <p className="mt-4 px-1 text-xs text-muted-foreground">Podés fijar metas de fibra, azúcares, saturadas y sodio en tu perfil.</p>
    </Page>
  );
}
