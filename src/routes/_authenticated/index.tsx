import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ChevronRight as Arrow } from "lucide-react";
import { useEffect, useState } from "react";
import { EntrenamientoDialog, EntrenamientosSheet, WorkoutRow } from "@/components/kcal/entrenamientos";
import { Card, FabAgregar, Page } from "@/components/kcal/layout";
import { CalorieRing, MacroColumna } from "@/components/kcal/progress";
import { SelectorFecha } from "@/components/kcal/selector-fecha";
import { Flame, Utensils } from "lucide-react";
import { MealRow } from "@/components/kcal/meal";
import { Skeleton } from "@/components/ui/skeleton";
import { comidasDiaQuery, entrenamientosDiaQuery, metasQuery, perfilQuery, totalDia, totalQuemadas } from "@/lib/data";
import { balanceDia, fechaLocal, ordenarComidas, fmt, fmtFechaCorta, sumarDias, tituloLista } from "@/lib/nutri";
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
  const entrenamientos = useQuery(entrenamientosDiaQuery(fecha));
  const [editar, setEditar] = useState<NonNullable<typeof entrenamientos.data>[number] | null>(null);

  useEffect(() => {
    if (perfil.data && !perfil.data.onboarding_completo) navigate({ to: "/onboarding" });
  }, [perfil.data, navigate]);

  const t = totalDia(comidas.data ?? []);
  const m = metas.data;
  const quemadas = totalQuemadas(entrenamientos.data ?? []);
  const balance = m ? balanceDia({ consumidas: t.calorias, limite: m.calorias, quemadas, sumarQuemadas: perfil.data?.sumar_quemadas ?? true }) : null;
  const etiqueta = fecha === hoy ? "Hoy" : fecha === sumarDias(hoy, -1) ? "Ayer" : fmtFechaCorta(fecha);

  return (
    <>
      <div className="bg-top pt-safe pb-14 text-white">
        <div className="mx-auto w-full max-w-md px-4">
          <header className="mb-3 flex items-center justify-between text-shadow-top">
            <button onClick={() => setFecha(sumarDias(fecha, -1))} className="rounded-full p-2 hover:bg-white/15" aria-label="Día anterior">
              <ChevronLeft className="size-5" />
            </button>
            <div className="text-center">
              <SelectorFecha fecha={fecha} hoy={hoy} onChange={setFecha}>
                <h1 className="text-xl font-bold capitalize">{etiqueta}</h1>
              </SelectorFecha>
              {fecha !== hoy ? (
                <button onClick={() => setFecha(hoy)} className="text-xs font-semibold underline underline-offset-2">Volver a hoy</button>
              ) : (
                <p className="text-xs font-medium capitalize text-white/90">{fmtFechaCorta(fecha)}</p>
              )}
            </div>
            <button
              onClick={() => setFecha(sumarDias(fecha, 1))}
              disabled={fecha >= hoy}
              className="rounded-full p-2 hover:bg-white/15 disabled:opacity-30"
              aria-label="Día siguiente"
            >
              <ChevronRight className="size-5" />
            </button>
          </header>

          <div className="flex items-center justify-between gap-1">
            <div className="w-[4.5rem] text-center text-shadow-top">
              <p className="font-display text-xl font-extrabold tabular">{fmt(t.calorias)}</p>
              <p className="text-[11px] font-semibold text-white/90">Consumidas</p>
            </div>
            {balance ? (
              <CalorieRing {...balance} />
            ) : (
              <Skeleton className="size-[168px] rounded-full bg-white/20" />
            )}
            <EntrenamientosSheet fecha={fecha}>
              <button className="w-[4.5rem] rounded-2xl py-1 text-center text-shadow-top hover:bg-white/15" aria-label="Ver entrenamientos">
                <p className="font-display text-xl font-extrabold tabular">{fmt(quemadas)}</p>
                <p className="flex items-center justify-center gap-0.5 text-[11px] font-semibold text-white/90">
                  <Flame className="size-3" /> Quemadas
                </p>
              </button>
            </EntrenamientosSheet>
          </div>
        </div>
      </div>

    <Page className="-mt-12 pb-fab pt-0">
      <Card className="px-5 pb-4 pt-5">
        <div className="flex gap-4">
          <MacroColumna label="Proteínas" valor={t.proteinas} meta={m ? Number(m.proteinas_g) : null} color="protein" />
          <MacroColumna label="Carbos" valor={t.carbohidratos} meta={m ? Number(m.carbohidratos_g) : null} color="carbs" />
          <MacroColumna label="Grasas" valor={t.grasas} meta={m ? Number(m.grasas_g) : null} color="fat" />
        </div>
        <Link to="/dia/$fecha" params={{ fecha }} className="mt-4 flex items-center justify-center gap-1 text-sm font-medium text-primary">
          Ver todos los nutrientes <Arrow className="size-4" />
        </Link>
      </Card>

      <Card className="mt-5 px-4 py-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">{tituloLista(fecha, hoy)}</h2>
          <span className="text-sm text-muted-foreground tabular">{t.calorias ? `${fmt(t.calorias)} kcal` : ""}</span>
        </div>
        {comidas.isLoading ? (
          <Skeleton className="mt-2 h-10 w-full rounded-xl" />
        ) : comidas.data?.length ? (
          <div className="mt-1 divide-y divide-border/60">
            {ordenarComidas(comidas.data).map((c) => <MealRow key={c.id} c={c} />)}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Utensils className="size-5" />
            </span>
            <p className="font-medium">Todavía no registraste comidas</p>
            <p className="text-sm text-muted-foreground">Sacale una foto a tu plato o contanos qué comiste.</p>
            <Link to="/agregar" className="mt-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Agregar comida
            </Link>
          </div>
        )}
      </Card>

      {entrenamientos.data?.length ? (
        <Card className="mt-3 px-4 py-3">
          <h2 className="text-base font-bold">Entrenamientos</h2>
          <div className="mt-1 divide-y divide-border/60">
            {entrenamientos.data.map((e) => <WorkoutRow key={e.id} e={e} onClick={() => setEditar(e)} />)}
          </div>
        </Card>
      ) : null}
      <EntrenamientoDialog onOpenChange={(o) => !o && setEditar(null)} entrenamiento={editar} />
      <FabAgregar />
    </Page>
    </>
  );
}
