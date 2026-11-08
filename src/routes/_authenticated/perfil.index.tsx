import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, Page, PageHeader } from "@/components/kcal/layout";
import { NumberInput } from "@/components/kcal/editors";
import { MisProductos } from "@/components/kcal/mis-productos";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { MACRO_BG, MACRO_LABEL, MacroRing } from "@/components/kcal/macro-ring";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { guardarOtrosLimites, metasQuery, perfilQuery, type Metas } from "@/lib/data";
import { CAMPOS_OTROS_LIMITES, MACRO_KEYS, fmt, formatPct, gramosDesdePct, pctDeMetas } from "@/lib/nutri";
import { aplicarTema, leerTema, type Tema } from "@/lib/tema";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/perfil/")({
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

const CAMPOS: { k: (typeof CAMPOS_OTROS_LIMITES)[number]; label: string; unidad: string }[] = [
  { k: "grasas_saturadas_g", label: "Grasas saturadas", unidad: "g" },
  { k: "fibra_g", label: "Fibra", unidad: "g" },
  { k: "azucares_g", label: "Azúcares", unidad: "g" },
  { k: "sodio_mg", label: "Sodio", unidad: "mg" },
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
    setGuardando(true);
    try {
      await guardarOtrosLimites(v);
      qc.invalidateQueries({ queryKey: ["metas"] });
      toast.success("Límites guardados");
    } catch {
      toast.error("No se pudieron guardar los límites.");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarSumar(valor: boolean) {
    if (!perfil.data) return;
    const { error } = await supabase.from("profiles").update({ sumar_quemadas: valor }).eq("id", perfil.data.id);
    if (error) { toast.error("No se pudo guardar la preferencia."); return; }
    qc.invalidateQueries({ queryKey: ["perfil"] });
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
      <ResumenMacros metas={metas.data} />

      <Collapsible className="mt-3">
        <Card className="p-0">
          <CollapsibleTrigger className="group flex w-full items-center justify-between px-5 py-4 text-left font-semibold">
            Otros límites (opcional)
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 px-5 pb-5">
            <p className="text-xs text-muted-foreground">Dejá en 0 para no usar.</p>
            {CAMPOS.map((c) => (
              <div key={c.k} className="flex items-center justify-between gap-3">
                <Label className="flex-1">{c.label}</Label>
                <NumberInput value={v[c.k] ?? 0} onChange={(n) => setV({ ...v, [c.k]: n })} className="h-10 w-24 text-right" aria-label={c.label} />
                <span className="w-8 text-sm text-muted-foreground">{c.unidad}</span>
              </div>
            ))}
            <Button className="mt-2 w-full rounded-full" onClick={guardar} disabled={guardando || !metas.data}>
              {guardando && <Loader2 className="size-4 animate-spin" />} Guardar límites
            </Button>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <h2 className="mb-2 mt-6 px-1 text-sm font-semibold text-muted-foreground">Entrenamientos</h2>
      <Card>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="sumar-quemadas" className="flex-1">Sumar calorías quemadas a mi límite</Label>
          <Switch id="sumar-quemadas" checked={perfil.data?.sumar_quemadas ?? true} disabled={!perfil.data} onCheckedChange={cambiarSumar} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Si tu límite ya incluye tu actividad física, desactivalo para no contar dos veces.</p>
      </Card>

      <h2 className="mb-2 mt-6 px-1 text-sm font-semibold text-muted-foreground">Mis productos</h2>
      <MisProductos />

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

function ResumenMacros({ metas }: { metas: Metas | undefined }) {
  if (!metas) return <Card className="h-36 animate-pulse">{null}</Card>;
  const kcal = Number(metas.calorias);
  const { pct } = pctDeMetas(metas);
  const g = gramosDesdePct(kcal, pct);
  const gramos = { proteinas: g.proteinas_g, carbohidratos: g.carbohidratos_g, grasas: g.grasas_g };
  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="font-semibold">Calorías y macronutrientes</p>
        <Button asChild size="sm" variant="secondary" className="rounded-full">
          <Link to="/perfil/metas">Ajustar</Link>
        </Button>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <MacroRing pct={pct} size={76} stroke={9}>
          <div className="text-center leading-tight">
            <p className="text-sm font-bold">{fmt(kcal, 0)}</p>
            <p className="text-[10px] text-muted-foreground">kcal</p>
          </div>
        </MacroRing>
        <ul className="flex-1 space-y-1.5 text-sm">
          {MACRO_KEYS.map((k) => (
            <li key={k} className="flex items-center gap-2">
              <span className={cn("size-2.5 rounded-full", MACRO_BG[k])} />
              <span className="flex-1">{MACRO_LABEL[k]}</span>
              <span className="tabular-nums text-muted-foreground">{formatPct(pct[k])}</span>
              <span className="w-14 text-right font-medium tabular-nums">{gramos[k]} g</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
