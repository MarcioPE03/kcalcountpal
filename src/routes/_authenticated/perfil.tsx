import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Loader2, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, Page, PageHeader } from "@/components/kcal/layout";
import { NumberInput } from "@/components/kcal/editors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { metasQuery, perfilQuery, type Metas } from "@/lib/data";
import { aplicarTema, leerTema, type Tema } from "@/lib/tema";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil y metas — KcalCountPal" },
      { name: "description", content: "Configurá tu límite de calorías y objetivos de macros." },
      { property: "og:title", content: "Perfil y metas — KcalCountPal" },
      { property: "og:description", content: "Configurá tu límite de calorías y objetivos de macros." },
    ],
  }),
  component: Perfil,
});

type Campo = { k: keyof Metas; label: string; unidad: string; opcional?: boolean };
const CAMPOS: Campo[] = [
  { k: "calorias", label: "Calorías", unidad: "kcal" },
  { k: "proteinas_g", label: "Proteínas", unidad: "g" },
  { k: "carbohidratos_g", label: "Carbohidratos", unidad: "g" },
  { k: "grasas_g", label: "Grasas", unidad: "g" },
  { k: "grasas_saturadas_g", label: "Grasas saturadas", unidad: "g", opcional: true },
  { k: "fibra_g", label: "Fibra", unidad: "g", opcional: true },
  { k: "azucares_g", label: "Azúcares", unidad: "g", opcional: true },
  { k: "sodio_mg", label: "Sodio", unidad: "mg", opcional: true },
];

function Perfil() {
  const metas = useQuery(metasQuery());
  const perfil = useQuery(perfilQuery());
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [v, setV] = useState<Record<string, number>>({});
  const [guardando, setGuardando] = useState(false);
  const [tema, setTema] = useState<Tema>("sistema");
  const [email, setEmail] = useState("");

  useEffect(() => {
    setTema(leerTema());
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);
  useEffect(() => {
    if (metas.data) {
      const o: Record<string, number> = {};
      for (const c of CAMPOS) o[c.k] = Number(metas.data[c.k] ?? 0);
      setV(o);
    }
  }, [metas.data]);

  async function guardar() {
    if (!metas.data) return;
    setGuardando(true);
    const upd: Record<string, number | null> = {};
    for (const c of CAMPOS) upd[c.k] = c.opcional && !v[c.k] ? null : Math.round(v[c.k] ?? 0);
    const { error } = await supabase
      .from("metas_diarias")
      .update({ ...upd, updated_at: new Date().toISOString() })
      .eq("user_id", metas.data.user_id);
    setGuardando(false);
    if (error) return toast.error("No se pudieron guardar las metas.");
    qc.invalidateQueries({ queryKey: ["metas"] });
    toast.success("Metas guardadas");
  }

  async function salir() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Page>
      <PageHeader title="Perfil" />
      <Card>
        <p className="font-semibold">{perfil.data?.nombre || "Tu cuenta"}</p>
        <p className="text-sm text-muted-foreground">{email}</p>
        <Link to="/onboarding" className="mt-3 flex items-center justify-between rounded-2xl bg-muted px-4 py-3 text-sm font-medium">
          Recalcular metas con mis datos <ChevronRight className="size-4" />
        </Link>
      </Card>

      <h2 className="mb-2 mt-6 px-1 text-sm font-semibold text-muted-foreground">Metas diarias</h2>
      <Card className="space-y-3">
        {CAMPOS.map((c, i) => (
          <div key={c.k}>
            {i === 4 && <p className="mb-3 mt-5 text-xs text-muted-foreground">Opcionales (dejá en 0 para no usar)</p>}
            <div className="flex items-center justify-between gap-3">
              <Label className="flex-1">{c.label}</Label>
              <NumberInput value={v[c.k] ?? 0} onChange={(n) => setV({ ...v, [c.k]: n })} className="h-10 w-24 text-right" aria-label={c.label} />
              <span className="w-8 text-sm text-muted-foreground">{c.unidad}</span>
            </div>
          </div>
        ))}
        <Button className="mt-3 w-full rounded-full" onClick={guardar} disabled={guardando || !metas.data}>
          {guardando && <Loader2 className="size-4 animate-spin" />} Guardar metas
        </Button>
      </Card>

      <h2 className="mb-2 mt-6 px-1 text-sm font-semibold text-muted-foreground">Apariencia</h2>
      <Card className="flex gap-2 p-2">
        {(["claro", "oscuro", "sistema"] as Tema[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTema(t); aplicarTema(t); }}
            className={cn("flex-1 rounded-2xl py-2.5 text-sm font-medium capitalize", tema === t ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
          >
            {t}
          </button>
        ))}
      </Card>

      <Button variant="ghost" className="mt-6 w-full rounded-full text-muted-foreground" onClick={salir}>
        <LogOut className="size-4" /> Cerrar sesión
      </Button>
    </Page>
  );
}
