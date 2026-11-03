import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Card, Page, PageHeader } from "@/components/kcal/layout";
import { MomentoPicker, NutrientesForm } from "@/components/kcal/editors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { crearComida, nutrientesAColumnas } from "@/lib/data";
import { horaLocal, momentoPorHora, vacio, type Momento } from "@/lib/nutri";
import { momentoSearch } from "@/lib/search";
import { useFechaSeleccionada } from "@/lib/stores";

export const Route = createFileRoute("/_authenticated/agregar/manual")({
  validateSearch: momentoSearch,
  head: () => ({
    meta: [
      { title: "Carga manual — KcalCountPal" },
      { name: "description", content: "Cargá calorías y nutrientes de una comida a mano." },
      { property: "og:title", content: "Carga manual — KcalCountPal" },
      { property: "og:description", content: "Cargá calorías y nutrientes de una comida a mano." },
    ],
  }),
  component: Manual,
});

function Manual() {
  const { momento: m0 } = Route.useSearch();
  const [fecha] = useFechaSeleccionada();
  const [nombre, setNombre] = useState("");
  const [momento, setMomento] = useState<Momento>(m0 ?? momentoPorHora(horaLocal()));
  const [v, setV] = useState(vacio());
  const [guardando, setGuardando] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function guardar() {
    setGuardando(true);
    try {
      await crearComida({ fecha, momento, nombre: nombre.trim(), origen: "manual", ...nutrientesAColumnas(v) });
      qc.invalidateQueries({ queryKey: ["comidas"] });
      qc.invalidateQueries({ queryKey: ["comidas-rango"] });
      qc.invalidateQueries({ queryKey: ["recientes"] });
      toast.success("Comida guardada");
      navigate({ to: "/" });
    } catch {
      toast.error("No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Page>
      <PageHeader title="Carga manual" back />
      <Card className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre</Label>
          <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Yogur con granola" />
        </div>
        <div className="space-y-1.5">
          <Label>Momento</Label>
          <MomentoPicker value={momento} onChange={setMomento} />
        </div>
        <NutrientesForm value={v} onChange={setV} />
      </Card>
      <Button className="mt-6 h-13 w-full rounded-full text-base" disabled={!nombre.trim() || guardando} onClick={guardar}>
        {guardando && <Loader2 className="size-4 animate-spin" />} Guardar
      </Button>
    </Page>
  );
}
