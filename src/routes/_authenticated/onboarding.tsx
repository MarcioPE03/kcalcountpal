import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, Page, PageHeader } from "@/components/kcal/layout";
import { NumberInput } from "@/components/kcal/editors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { perfilQuery, uid } from "@/lib/data";
import { fmt, metasSugeridas, type DatosPerfil } from "@/lib/nutri";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Tus metas — KcalCountPal" },
      { name: "description", content: "Contanos un poco de vos y te sugerimos metas diarias." },
      { property: "og:title", content: "Tus metas — KcalCountPal" },
      { property: "og:description", content: "Contanos un poco de vos y te sugerimos metas diarias." },
    ],
  }),
  component: Onboarding,
});

function Opciones<T extends string>({ value, onChange, opts }: { value: T; onChange: (v: T) => void; opts: [T, string][] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map(([k, l]) => (
        <button key={k} type="button" onClick={() => onChange(k)}
          className={cn("rounded-full border px-3.5 py-1.5 text-sm font-medium", value === k ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}>
          {l}
        </button>
      ))}
    </div>
  );
}

function Onboarding() {
  const perfil = useQuery(perfilQuery());
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [d, setD] = useState<DatosPerfil>({ peso_kg: 70, altura_cm: 170, edad: 30, sexo: "mujer", nivel_actividad: "ligero", objetivo: "mantener" });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const p = perfil.data;
    if (!p) return;
    ultimoPeso().then((peso) => {
      if (peso == null && !p.altura_cm) return;
      setD({
        peso_kg: peso ?? 70, altura_cm: Number(p.altura_cm ?? 170), edad: p.edad ?? 30,
        sexo: (p.sexo as DatosPerfil["sexo"]) ?? "mujer",
        nivel_actividad: (p.nivel_actividad as DatosPerfil["nivel_actividad"]) ?? "ligero",
        objetivo: (p.objetivo as DatosPerfil["objetivo"]) ?? "mantener",
      });
    });
  }, [perfil.data]);

  const valido = d.peso_kg >= PESO_MIN && d.peso_kg <= 300 && d.altura_cm >= 120 && d.altura_cm <= 230 && d.edad >= 14 && d.edad <= 100;
  const s = valido ? metasSugeridas(d) : null;

  async function terminar(usar: boolean) {
    setGuardando(true);
    try {
      const id = await uid();
      const { peso_kg, ...resto } = d;
      const { error } = await supabase.from("profiles").update(
        usar ? { ...resto, onboarding_completo: true } : { onboarding_completo: true },
      ).eq("id", id);
      if (error) throw error;
      if (usar) await guardarPeso(fechaLocal(), peso_kg);
      qc.invalidateQueries({ queryKey: ["pesos"] });
      if (usar && s) {
        const { error: e2 } = await supabase.from("metas_diarias").upsert({ user_id: id, ...s, updated_at: new Date().toISOString() });
        if (e2) throw e2;
      }
      qc.invalidateQueries({ queryKey: ["perfil"] });
      qc.invalidateQueries({ queryKey: ["metas"] });
      navigate({ to: usar ? "/perfil" : "/" });
      if (usar) toast.success("Metas listas. Podés ajustarlas cuando quieras.");
    } catch {
      toast.error("No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Page>
      <PageHeader title="Armemos tus metas" />
      <p className="-mt-3 mb-5 text-sm text-muted-foreground">Unos datos rápidos para sugerirte calorías y macros.</p>
      <Card className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          {([["peso_kg", "Peso (kg)"], ["altura_cm", "Altura (cm)"], ["edad", "Edad"]] as const).map(([k, l]) => (
            <div key={k} className="space-y-1.5">
              <Label className="text-xs">{l}</Label>
              <NumberInput value={d[k]} onChange={(n) => setD({ ...d, [k]: n })} />
            </div>
          ))}
        </div>
        <div className="space-y-1.5"><Label>Sexo</Label>
          <Opciones value={d.sexo} onChange={(sexo) => setD({ ...d, sexo })} opts={[["mujer", "Mujer"], ["hombre", "Hombre"]]} />
        </div>
        <div className="space-y-1.5"><Label>Actividad</Label>
          <Opciones value={d.nivel_actividad} onChange={(nivel_actividad) => setD({ ...d, nivel_actividad })}
            opts={[["sedentario", "Sedentaria"], ["ligero", "Ligera"], ["moderado", "Moderada"], ["alto", "Alta"]]} />
        </div>
        <div className="space-y-1.5"><Label>Objetivo</Label>
          <Opciones value={d.objetivo} onChange={(objetivo) => setD({ ...d, objetivo })}
            opts={[["bajar", "Bajar de peso"], ["mantener", "Mantener"], ["subir", "Ganar masa"]]} />
        </div>
      </Card>

      {s && (
        <Card className="mt-4 bg-primary-soft">
          <p className="text-sm font-medium text-muted-foreground">Te sugerimos</p>
          <p className="font-display text-3xl font-extrabold text-primary tabular">{fmt(s.calorias)} kcal</p>
          <p className="mt-1 text-sm tabular">
            <span className="text-protein font-semibold">P {s.proteinas_g} g</span> ·{" "}
            <span className="text-carbs font-semibold">C {s.carbohidratos_g} g</span> ·{" "}
            <span className="text-fat font-semibold">G {s.grasas_g} g</span>
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Son estimaciones, no reemplazan el consejo de un profesional de la salud. Siempre podés editarlas.
          </p>
        </Card>
      )}

      <Button className="mt-6 h-12 w-full rounded-full text-base" disabled={!s || guardando} onClick={() => terminar(true)}>
        {guardando && <Loader2 className="size-4 animate-spin" />} Usar estas metas
      </Button>
      <Button variant="ghost" className="mt-2 w-full rounded-full" disabled={guardando} onClick={() => terminar(false)}>
        Saltear por ahora
      </Button>
    </Page>
  );
}
