import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ChevronRight as Arrow } from "lucide-react";
import { useEffect } from "react";
import { Card, Page } from "@/components/kcal/layout";
import { CalorieRing, MacroBar } from "@/components/kcal/progress";
import { MealRow } from "@/components/kcal/meal";
import { Skeleton } from "@/components/ui/skeleton";
import { comidasDiaQuery, metasQuery, perfilQuery, totalDia } from "@/lib/data";
import { MOMENTOS, fechaLocal, fmt, fmtFechaCorta, sumarDias } from "@/lib/nutri";
import { useFechaSeleccionada } from "@/lib/stores";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Hoy — KcalCountPal" },
      { name: "description", content: "Tus calorías y macros del día, de un vistazo." },
      { property: "og:title", content: "Hoy — KcalCountPal" },
      { property: "og:description", content: "Tus calorías y macros del día, de un vistazo." },
    ],
  }),
  component: Hoy,
});

function Hoy() {
  const [fecha, setFecha] = useFechaSeleccionada();
  const hoy = fechaLocal();
  const navigate = useNavigate();
  const perfil = useQuery(perfilQuery());
  const metas = useQuery(metasQuery());
  const comidas = useQuery(comidasDiaQuery(fecha));

  useEffect(() => {
    if (perfil.data && !perfil.data.onboarding_completo) navigate({ to: "/onboarding" });
  }, [perfil.data, navigate]);

  const t = totalDia(comidas.data ?? []);
  const m = metas.data;
  const etiqueta = fecha === hoy ? "Hoy" : fecha === sumarDias(hoy, -1) ? "Ayer" : fmtFechaCorta(fecha);

  return (
    <Page>
      <header className="mb-4 flex items-center justify-between">
        <button onClick={() => setFecha(sumarDias(fecha, -1))} className="rounded-full p-2 hover:bg-muted" aria-label="Día anterior">
          <ChevronLeft className="size-5" />
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold capitalize">{etiqueta}</h1>
          {fecha !== hoy ? (
            <button onClick={() => setFecha(hoy)} className="text-xs font-medium text-primary">Volver a hoy</button>
          ) : (
            <p className="text-xs text-muted-foreground capitalize">{fmtFechaCorta(fecha)}</p>
          )}
        </div>
        <button
          onClick={() => setFecha(sumarDias(fecha, 1))}
          disabled={fecha >= hoy}
          className="rounded-full p-2 hover:bg-muted disabled:opacity-30"
          aria-label="Día siguiente"
        >
          <ChevronRight className="size-5" />
        </button>
      </header>

      <Card className="flex flex-col items-center gap-6">
        {m ? <CalorieRing consumidas={t.calorias} limite={m.calorias} /> : <Skeleton className="size-52 rounded-full" />}
        <div className="grid w-full gap-4">
          <MacroBar label="Proteínas" valor={t.proteinas} meta={m ? Number(m.proteinas_g) : null} color="protein" />
          <MacroBar label="Carbohidratos" valor={t.carbohidratos} meta={m ? Number(m.carbohidratos_g) : null} color="carbs" />
          <MacroBar label="Grasas" valor={t.grasas} meta={m ? Number(m.grasas_g) : null} color="fat" />
        </div>
        <Link to="/dia/$fecha" params={{ fecha }} className="flex items-center gap-1 text-sm font-medium text-primary">
          Ver todos los nutrientes <Arrow className="size-4" />
        </Link>
      </Card>

      <div className="mt-5 space-y-3">
        {MOMENTOS.map((mo) => {
          const items = (comidas.data ?? []).filter((c) => c.momento === mo.key);
          const kcal = items.reduce((s, c) => s + Number(c.calorias), 0);
          return (
            <Card key={mo.key} className="px-4 py-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">{mo.label}</h2>
                <span className="text-sm text-muted-foreground tabular">{kcal ? `${fmt(kcal)} kcal` : ""}</span>
              </div>
              {comidas.isLoading ? (
                <Skeleton className="mt-2 h-10 w-full rounded-xl" />
              ) : items.length ? (
                <div className="mt-1 divide-y divide-border/60">
                  {items.map((c) => <MealRow key={c.id} c={c} />)}
                </div>
              ) : (
                <Link to="/agregar" search={{ momento: mo.key }} className="mt-1 block py-1 text-sm text-muted-foreground">
                  + Agregar {mo.label.toLowerCase()}
                </Link>
              )}
            </Card>
          );
        })}
      </div>
    </Page>
  );
}
