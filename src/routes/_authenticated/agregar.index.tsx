import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, Flame, Heart, MessageSquareText, ScanBarcode } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Page, PageHeader } from "@/components/kcal/layout";
import { MomentoPicker } from "@/components/kcal/editors";
import { fechaLocal, fmtFechaCorta, horaLocal, momentoPorHora, type Momento } from "@/lib/nutri";
import { useFechaSeleccionada } from "@/lib/stores";

const search = z.object({ momento: z.enum(["desayuno", "almuerzo", "merienda", "cena", "snack"]).optional() });

export const Route = createFileRoute("/_authenticated/agregar/")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Agregar — KcalCountPal" },
      { name: "description", content: "Registrá una comida con foto, voz, código de barras o tus comidas guardadas, o un entrenamiento." },
      { property: "og:title", content: "Agregar — KcalCountPal" },
      { property: "og:description", content: "Registrá una comida con foto, voz, código de barras o tus comidas guardadas, o un entrenamiento." },
    ],
  }),
  component: Agregar,
});

function Agregar() {
  const { momento: mInicial } = Route.useSearch();
  const [fecha] = useFechaSeleccionada();
  const [momento, setMomento] = useState<Momento>(mInicial ?? momentoPorHora(horaLocal()));

  const opciones = [
    { to: "/agregar/foto", icon: Camera, titulo: "Foto con IA", desc: "Sacá o subí una foto del plato", destacado: true },
    { to: "/agregar/describir", icon: MessageSquareText, titulo: "Describir", desc: "Contalo con texto o voz" },
    { to: "/agregar/codigo", icon: ScanBarcode, titulo: "Escanear código", desc: "Productos envasados con código de barras" },
    { to: "/agregar/mis-comidas", icon: Heart, titulo: "Mis comidas", desc: "Recientes, favoritos y registro rápido, sin IA" },
  ] as const;

  return (
    <Page>
      <PageHeader title="Agregar" />
      <p className="-mt-3 mb-4 text-sm text-muted-foreground">
        ¿Qué querés registrar? · <span className="capitalize">{fecha === fechaLocal() ? "Hoy" : fmtFechaCorta(fecha)}</span>
      </p>
      <div className="mb-5">
        <MomentoPicker value={momento} onChange={setMomento} />
      </div>

      <div className="grid gap-3">
        {opciones.map((o) => (
          <Link
            key={o.to}
            to={o.to}
            search={o.to === "/agregar/mis-comidas" ? { momento, fecha } : { momento }}
            className={
              "flex items-center gap-4 rounded-3xl p-5 shadow-soft transition-transform active:scale-[0.98] " +
              ("destacado" in o ? "bg-primary text-primary-foreground" : "bg-card")
            }
          >
            <span className={"flex size-12 items-center justify-center rounded-2xl " + ("destacado" in o ? "bg-primary-foreground/15" : "bg-primary-soft text-primary")}>
              <o.icon className="size-6" />
            </span>
            <div>
              <p className="font-display text-lg font-bold">{o.titulo}</p>
              <p className={"text-sm " + ("destacado" in o ? "opacity-85" : "text-muted-foreground")}>{o.desc}</p>
            </div>
          </Link>
        ))}
        <Link
          to="/agregar/entrenamiento"
          search={{ fecha }}
          className="flex items-center gap-4 rounded-3xl bg-card p-5 shadow-soft transition-transform active:scale-[0.98]"
        >
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <Flame className="size-6" />
          </span>
          <div>
            <p className="font-display text-lg font-bold">Entrenamiento</p>
            <p className="text-sm text-muted-foreground">Recientes, favoritos o uno nuevo</p>
          </div>
        </Link>
      </div>
    </Page>
  );
}
