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
import { supabase } from "@/integrations/supabase/client";
import { MACRO_BG, MACRO_LABEL, MacroRing } from "@/components/kcal/macro-ring";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { guardarModoEntreno, guardarOtrosLimites, invalidarDia, metasQuery, perfilQuery, type Metas } from "@/lib/data";
import { CAMPOS_OTROS_LIMITES, MACRO_KEYS, fmt, formatPct, gramosDesdePct, metasEntreno, modoValido, pctDeMetas, type ModoEntreno, type TipoMetas } from "@/lib/nutri";
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

const MODOS: { v: ModoEntreno; t: string; d: string }[] = [
  { v: "fija", t: "Meta fija", d: "Las calorías quemadas se muestran, pero no modifican tu límite." },
  { v: "sumar_quemadas", t: "Sumar calorías quemadas", d: "Tu límite del día crece con lo que quemás entrenando." },
  { v: "por_tipo_dia", t: "Metas por tipo de día", d: "Tus metas de entrenamiento ya contemplan el gasto, por eso las calorías quemadas no se suman." },
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

  async function cambiarModo(modo: ModoEntreno) {
    if (!perfil.data) return;
    try {
      await guardarModoEntreno({ modo_entrenamiento: modo });
      invalidarDia(qc);
      if (modo === "por_tipo_dia" && metas.data && !metasEntreno(metas.data)) navigate({ to: "/perfil/metas", search: { tipo: "entreno" } });
    } catch { toast.error("No se pudo guardar la preferencia."); }
  }
  async function guardarUmbral(n: number) {
    const u = Math.min(2000, Math.max(0, Math.round(n || 0)));
    if (!perfil.data || u === perfil.data.umbral_entreno_kcal) return;
    try { await guardarModoEntreno({ umbral_entreno_kcal: u }); invalidarDia(qc); }
    catch { toast.error("No se pudo guardar el umbral."); }
  }

  const modo = modoValido(perfil.data?.modo_entrenamiento);

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
      <ResumenMacros metas={metas.data} conEntreno={modo === "por_tipo_dia"} />

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
      <Card className="space-y-2 p-2" role="radiogroup" aria-label="Modo de entrenamiento">
        {MODOS.map((o) => {
          const activo = modo === o.v;
          return (
            <button key={o.v} role="radio" aria-checked={activo} disabled={!perfil.data} onClick={() => !activo && cambiarModo(o.v)}
              className={cn("w-full rounded-2xl border px-4 py-3 text-left transition-colors", activo ? "border-primary bg-primary-soft" : "border-transparent hover:bg-muted")}>
              <p className="font-semibold">{o.t}</p>
              <p className="text-xs text-muted-foreground">{o.d}</p>
            </button>
          );
        })}
        {modo === "por_tipo_dia" && (
          <div className="flex items-center gap-3 px-3 pb-2 pt-1">
            <Label className="flex-1 text-sm">Contar como día de entrenamiento desde</Label>
            <NumberInput key={perfil.data?.umbral_entreno_kcal} value={perfil.data?.umbral_entreno_kcal ?? 0} onChange={(n) => guardarUmbral(n)} className="h-10 w-20 text-right" aria-label="Umbral de kcal quemadas" />
            <span className="text-sm text-muted-foreground">kcal</span>
          </div>
        )}
        {modo === "por_tipo_dia" && <p className="px-3 pb-2 text-xs text-muted-foreground">0 = cualquier entrenamiento. Máximo 2.000 kcal.</p>}
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

function ResumenMacros({ metas: base, conEntreno }: { metas: Metas | undefined; conEntreno: boolean }) {
  const [tipo, setTipo] = useState<TipoMetas>("descanso");
  if (!base) return <Card className="h-36 animate-pulse">{null}</Card>;
  const ent = metasEntreno(base);
  const verEntreno = conEntreno && tipo === "entreno";
  const metas = verEntreno && ent ? ent : base;
  const kcal = Number(metas.calorias);
  const { pct } = pctDeMetas(metas);
  const g = gramosDesdePct(kcal, pct);
  const gramos = { proteinas: g.proteinas_g, carbohidratos: g.carbohidratos_g, grasas: g.grasas_g };
  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="font-semibold">Calorías y macronutrientes</p>
        <Button asChild size="sm" variant="secondary" className="rounded-full">
          <Link to="/perfil/metas" search={verEntreno ? { tipo: "entreno" } : {}}>Ajustar</Link>
        </Button>
      </div>
      {conEntreno && (
        <div className="mt-3 flex rounded-full bg-muted p-1 text-xs">
          {(["descanso", "entreno"] as TipoMetas[]).map((t) => (
            <button key={t} onClick={() => setTipo(t)} aria-pressed={tipo === t}
              className={cn("flex-1 rounded-full py-1.5 font-semibold", tipo === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
              {t === "descanso" ? "Descanso" : "Entreno"}
            </button>
          ))}
        </div>
      )}
      {verEntreno && !ent && (
        <Link to="/perfil/metas" search={{ tipo: "entreno" }} className="mt-2 block text-xs font-medium text-primary underline underline-offset-2">Configurá tus metas de entrenamiento</Link>
      )}
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
