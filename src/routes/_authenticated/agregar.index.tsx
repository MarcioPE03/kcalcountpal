import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CopyPlus, Flame, ScanBarcode, Loader2, MessageSquareText, PenLine } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Card, Page, PageHeader } from "@/components/kcal/layout";
import { MomentoPicker } from "@/components/kcal/editors";
import { EntrenamientoDialog } from "@/components/kcal/entrenamientos";
import { supabase } from "@/integrations/supabase/client";
import { copiaDe, crearComida, recientesQuery, uid } from "@/lib/data";
import { fechaLocal, fmt, fmtFechaCorta, horaLocal, momentoPorHora, sumarDias, type Momento } from "@/lib/nutri";
import { useFechaSeleccionada } from "@/lib/stores";

const search = z.object({ momento: z.enum(["desayuno", "almuerzo", "merienda", "cena", "snack"]).optional() });

export const Route = createFileRoute("/_authenticated/agregar/")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Agregar comida — KcalCountPal" },
      { name: "description", content: "Registrá una comida con foto, voz, texto o a mano, o un entrenamiento." },
      { property: "og:title", content: "Agregar comida — KcalCountPal" },
      { property: "og:description", content: "Registrá una comida con foto, voz, texto o a mano, o un entrenamiento." },
    ],
  }),
  component: Agregar,
});

function Agregar() {
  const { momento: mInicial } = Route.useSearch();
  const [fecha] = useFechaSeleccionada();
  const [momento, setMomento] = useState<Momento>(mInicial ?? momentoPorHora(horaLocal()));
  const qc = useQueryClient();
  const navigate = useNavigate();
  const recientes = useQuery(recientesQuery());
  const [entOpen, setEntOpen] = useState(false);

  const repetir = useMutation({
    mutationFn: async (id: string) => {
      const c = recientes.data?.find((r) => r.id === id);
      if (!c) throw new Error();
      return crearComida(copiaDe(c, fecha, momento));
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["comidas"] });
      qc.invalidateQueries({ queryKey: ["comidas-rango"] });
      toast.success(`${c.nombre} agregada`);
      navigate({ to: "/" });
    },
    onError: () => toast.error("No se pudo agregar."),
  });

  const copiarAyer = useMutation({
    mutationFn: async (soloMomento: boolean) => {
      await uid();
      let q = supabase.from("comidas").select("*").eq("fecha", sumarDias(fecha, -1));
      if (soloMomento) q = q.eq("momento", momento);
      const { data, error } = await q;
      if (error) throw error;
      if (!data.length) return 0;
      for (const c of data) await crearComida(copiaDe(c, fecha));
      return data.length;
    },
    onSuccess: (n) => {
      if (!n) { toast.info("No hay comidas para copiar del día anterior."); return; }
      qc.invalidateQueries({ queryKey: ["comidas"] });
      qc.invalidateQueries({ queryKey: ["comidas-rango"] });
      toast.success(`${n} ${n === 1 ? "comida copiada" : "comidas copiadas"}`);
      navigate({ to: "/" });
    },
    onError: () => toast.error("No se pudo copiar."),
  });

  const opciones = [
    { to: "/agregar/foto", icon: Camera, titulo: "Foto con IA", desc: "Sacá o subí una foto del plato", destacado: true },
    { to: "/agregar/codigo", icon: ScanBarcode, titulo: "Escanear código", desc: "Productos envasados con código de barras" },
    { to: "/agregar/describir", icon: MessageSquareText, titulo: "Describir", desc: "Contalo con texto o voz" },
    { to: "/agregar/manual", icon: PenLine, titulo: "Carga manual", desc: "Calorías y nutrientes a mano" },
  ] as const;

  return (
    <Page>
      <PageHeader title="Agregar comida" />
      <p className="-mt-3 mb-4 text-sm text-muted-foreground capitalize">
        {fecha === fechaLocal() ? "Hoy" : fmtFechaCorta(fecha)}
      </p>
      <div className="mb-5">
        <MomentoPicker value={momento} onChange={setMomento} />
      </div>

      <div className="grid gap-3">
        {opciones.map((o) => (
          <Link
            key={o.to}
            to={o.to}
            search={{ momento }}
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
      </div>

      <button
        onClick={() => setEntOpen(true)}
        className="mt-3 flex w-full items-center gap-4 rounded-3xl bg-card p-5 text-left shadow-soft transition-transform active:scale-[0.98]"
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Flame className="size-6" />
        </span>
        <div>
          <p className="font-display text-lg font-bold">Entrenamiento</p>
          <p className="text-sm text-muted-foreground">Sumá las calorías que quemaste</p>
        </div>
      </button>
      <EntrenamientoDialog open={entOpen} onOpenChange={setEntOpen} fecha={fecha} onGuardado={() => navigate({ to: "/" })} />

      <Card className="mt-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">Copiar del día anterior</h2>
          <CopyPlus className="size-5 text-muted-foreground" />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            disabled={copiarAyer.isPending}
            onClick={() => copiarAyer.mutate(true)}
            className="flex-1 rounded-full bg-primary-soft px-3 py-2 text-sm font-medium text-primary disabled:opacity-50"
          >
            Solo este momento
          </button>
          <button
            disabled={copiarAyer.isPending}
            onClick={() => copiarAyer.mutate(false)}
            className="flex-1 rounded-full border px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            Todo el día
          </button>
        </div>
      </Card>

      <Card className="mt-3">
        <h2 className="font-bold">Recientes</h2>
        <p className="text-xs text-muted-foreground">Tocá para volver a registrarla, sin IA.</p>
        <div className="mt-2 divide-y divide-border/60">
          {recientes.isLoading && <p className="py-3 text-sm text-muted-foreground">Cargando…</p>}
          {recientes.data?.length === 0 && <p className="py-3 text-sm text-muted-foreground">Todavía no registraste comidas.</p>}
          {recientes.data?.map((c) => (
            <button
              key={c.id}
              disabled={repetir.isPending}
              onClick={() => repetir.mutate(c.id)}
              className="flex w-full items-center justify-between gap-3 py-3 text-left disabled:opacity-50"
            >
              <span className="min-w-0 truncate font-medium">{c.nombre}</span>
              <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground tabular">
                {fmt(Number(c.calorias))} kcal
                {repetir.isPending && repetir.variables === c.id ? <Loader2 className="size-4 animate-spin" /> : <span className="text-lg text-primary">+</span>}
              </span>
            </button>
          ))}
        </div>
      </Card>
    </Page>
  );
}
