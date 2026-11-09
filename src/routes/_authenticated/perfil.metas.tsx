import { createFileRoute, useBlocker, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Info, Loader2, Minus, Plus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/kcal/layout";
import { MACRO_LABEL, MacroRing } from "@/components/kcal/macro-ring";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { guardarMetasTipos, invalidarMetas, metasQuery, perfilQuery } from "@/lib/data";
import {
  KCAL_META_MAX, KCAL_META_MIN, MACRO_KEYS, PCT_MAX, PCT_MIN, PRESETS_PCT, fmt, formatPct, gramosDesdePct,
  kcalMacro, kcalMetaValida, pasoKcal, pctDeMetas, pctDesdeGramosInput, redistribuirPct, sumaPct,
  metasEntreno, modoValido, type MacroKey, type PctMacros, type TipoMetas,
} from "@/lib/nutri";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/perfil/metas")({
  head: () => ({
    meta: [
      { title: "Ajustar calorías y macros — KcalCountPal" },
      { name: "description", content: "Elegí tu límite diario de calorías y cómo repartirlo entre proteínas, carbohidratos y grasas." },
      { property: "og:title", content: "Ajustar calorías y macros — KcalCountPal" },
      { property: "og:description", content: "Elegí tu límite diario de calorías y cómo repartirlo entre macros." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { tipo?: "descanso" | "entreno" } => (s["tipo"] === "entreno" ? { tipo: "entreno" } : {}),
  component: AjustarMetas,
});

const SLIDER_CLASS: Record<MacroKey, string> = {
  proteinas: "[&>span:first-child>span]:bg-protein [&_[role=slider]]:border-protein",
  carbohidratos: "[&>span:first-child>span]:bg-carbs [&_[role=slider]]:border-carbs",
  grasas: "[&>span:first-child>span]:bg-fat [&_[role=slider]]:border-fat",
};

const parseNum = (t: string) => {
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return t.trim() === "" || !Number.isFinite(n) ? NaN : n;
};
const iguales = (a: PctMacros, b: PctMacros) => MACRO_KEYS.every((k) => a[k] === b[k]);

function AjustarMetas() {
  const metas = useQuery(metasQuery());
  const perfil = useQuery(perfilQuery());
  if (!metas.data || !perfil.data) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }
  const desc = pctDeMetas(metas.data);
  const ent = metasEntreno(metas.data);
  const entPct = ent ? pctDeMetas(ent) : null;
  return (
    <Editor
      descanso={{ kcal: Number(metas.data.calorias), pct: desc.pct, derivado: desc.derivado, guardado: true }}
      entreno={ent && entPct ? { kcal: Number(ent.calorias), pct: entPct.pct, derivado: entPct.derivado, guardado: true } : { kcal: Number(metas.data.calorias), pct: desc.pct, derivado: false, guardado: false }}
      conEntreno={modoValido(perfil.data.modo_entrenamiento) === "por_tipo_dia"}
    />
  );
}

type Inicial = { kcal: number; pct: PctMacros; derivado: boolean; guardado: boolean };

/** Independent draft for one goal type. A training draft that was never saved counts as dirty. */
function useBorrador(ini: Inicial) {
  const [inicial] = useState(ini);
  const [kcalTxt, setKcalTxt] = useState(String(ini.kcal));
  const [kcal, setKcal] = useState(ini.kcal);
  const [pct, setPct] = useState<PctMacros>(ini.pct);
  const snapshot = useRef<PctMacros | null>(null);
  const kcalNum = parseNum(kcalTxt);
  const kcalOk = kcalMetaValida(kcalNum);
  const dirty = !inicial.guardado || kcalNum !== inicial.kcal || !iguales(pct, inicial.pct);
  return { inicial, kcalTxt, setKcalTxt, kcal, setKcal, pct, setPct, snapshot, kcalNum, kcalOk, dirty, valido: kcalOk && sumaPct(pct) === 100 };
}
type Borrador = ReturnType<typeof useBorrador>;

function Editor({ descanso, entreno, conEntreno }: { descanso: Inicial; entreno: Inicial; conEntreno: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const { tipo: tipoUrl } = Route.useSearch();
  const [tab, setTab] = useState<TipoMetas>(conEntreno && tipoUrl === "entreno" ? "entreno" : "descanso");
  const bD = useBorrador(descanso);
  const bE = useBorrador(entreno);
  const [guardando, setGuardando] = useState(false);
  const guardadoOk = useRef(false);
  // Training draft only matters when the mode uses it.
  const cambios = [bD.dirty ? "descanso" : null, conEntreno && bE.dirty ? "entreno" : null].filter(Boolean) as TipoMetas[];
  const dirty = cambios.length > 0;
  const b = tab === "entreno" ? bE : bD;
  const todoValido = cambios.every((t) => (t === "entreno" ? bE : bD).valido);

  const blocker = useBlocker({
    shouldBlockFn: () => dirty && !guardadoOk.current,
    enableBeforeUnload: () => dirty && !guardadoOk.current,
    withResolver: true,
  });

  async function guardar() {
    if (!todoValido || !dirty) return;
    setGuardando(true);
    try {
      await guardarMetasTipos(cambios.map((t) => { const x = t === "entreno" ? bE : bD; return { tipo: t, kcal: x.kcalNum, pct: x.pct }; }));
      guardadoOk.current = true;
      await invalidarMetas(qc);
      toast.success("Ajustes guardados");
      navigate({ to: "/perfil" });
    } catch {
      toast.error("No se pudieron guardar los ajustes.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+7rem)]">
      <header className="mb-5 flex items-center gap-2">
        <button onClick={() => (window.history.length > 1 ? router.history.back() : navigate({ to: "/perfil" }))} className="-ml-2 rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Volver">
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="flex-1 text-xl font-bold">Ajustar calorías y macros</h1>
      </header>

      {conEntreno && (
        <div className="mb-4 flex rounded-full bg-muted p-1" role="tablist">
          {(["descanso", "entreno"] as TipoMetas[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={cn("flex-1 rounded-full py-2 text-sm font-semibold", tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
              {t === "descanso" ? "Descanso" : "Entrenamiento"}{(t === "entreno" ? bE : bD).dirty ? " •" : ""}
            </button>
          ))}
        </div>
      )}

      {tab === "entreno" && !entreno.guardado && (
        <div className="mb-4 flex gap-2 rounded-2xl bg-muted px-4 py-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p>Copiamos tus metas de descanso como punto de partida. Ajustalas y guardá.</p>
        </div>
      )}
      {tab === "entreno" && bE.kcalOk && bD.kcalOk && bE.kcalNum < bD.kcalNum && (
        <p className="mb-4 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">Tus calorías de entrenamiento quedaron por debajo de las de descanso. ¿Es lo que querés?</p>
      )}

      <Panel key={tab} b={b} />

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur">
        <div className="mx-auto flex max-w-md gap-2">
          <Button variant="ghost" className="rounded-full" onClick={() => restablecer(b)} disabled={guardando || !b.dirty}>
            Restablecer
          </Button>
          <Button className="flex-1 rounded-full" onClick={guardar} disabled={guardando || !dirty || !todoValido}>
            {guardando && <Loader2 className="size-4 animate-spin" />} Guardar ajustes
          </Button>
        </div>
      </div>

      <AlertDialog open={blocker.status === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Salir sin guardar?</AlertDialogTitle>
            <AlertDialogDescription>Vas a perder los cambios que hiciste en tus calorías y macros.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Seguir editando</AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.proceed?.()}>Salir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function restablecer(b: Borrador) {
  b.snapshot.current = null;
  b.setKcalTxt(String(b.inicial.kcal));
  b.setKcal(b.inicial.kcal);
  b.setPct(b.inicial.pct);
}

function Panel({ b }: { b: Borrador }) {
  const { kcalTxt, setKcalTxt, kcal, setKcal, pct, setPct, snapshot, kcalNum, kcalOk } = b;
  const gramos = useMemo(() => {
    const g = gramosDesdePct(kcal, pct);
    return { proteinas: g.proteinas_g, carbohidratos: g.carbohidratos_g, grasas: g.grasas_g };
  }, [kcal, pct]);
  const suma = sumaPct(pct);

  function cambiarKcalTxt(t: string) {
    const limpio = t.replace(/[^0-9]/g, "").slice(0, 5);
    setKcalTxt(limpio);
    const n = parseNum(limpio);
    if (kcalMetaValida(n)) setKcal(n);
  }
  function pasoK(dir: 1 | -1) {
    const n = pasoKcal(Number.isFinite(kcalNum) ? kcalNum : kcal, dir);
    setKcalTxt(String(n));
    setKcal(n);
  }
  function moverSlider(k: MacroKey, v: number) {
    const base = snapshot.current ?? pct;
    if (!snapshot.current) snapshot.current = pct;
    setPct(redistribuirPct(base, k, v));
  }
  function paso(k: MacroKey, dir: 1 | -1) {
    snapshot.current = null;
    const actual = pct[k];
    const destino = dir > 0 ? Math.floor(actual) + 1 : Math.ceil(actual) - 1;
    setPct(redistribuirPct(pct, k, destino));
  }
  function escribirGramos(k: MacroKey, g: number) {
    snapshot.current = null;
    const { pct: nuevo, ajustado } = pctDesdeGramosInput(kcal, k, g);
    if (ajustado) toast.message(`Ajustamos ${MACRO_LABEL[k].toLowerCase()} al límite de ${nuevo === PCT_MAX ? PCT_MAX : PCT_MIN} %.`);
    setPct(redistribuirPct(pct, k, nuevo));
  }

  return (
    <>
      {b.inicial.derivado && b.inicial.guardado && (
        <div className="mb-4 flex gap-2 rounded-2xl bg-muted px-4 py-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p>Ajustamos los porcentajes para que coincidan con tus calorías. Guardá para confirmar.</p>
        </div>
      )}
      <Card>
        <p className="text-sm font-medium text-muted-foreground">Límite diario de calorías</p>
        <div className="mt-3 flex items-center justify-center gap-3">
          <Button variant="secondary" size="icon" className="size-11 rounded-full" onClick={() => pasoK(-1)} aria-label="Restar 50 kcal">
            <Minus className="size-5" />
          </Button>
          <div className="flex items-baseline gap-1">
            <Input
              inputMode="numeric"
              value={kcalTxt}
              onChange={(e) => cambiarKcalTxt(e.target.value)}
              className="h-12 w-28 text-center text-2xl font-bold tabular-nums"
              aria-label="Límite diario de calorías"
            />
            <span className="text-sm text-muted-foreground">kcal</span>
          </div>
          <Button variant="secondary" size="icon" className="size-11 rounded-full" onClick={() => pasoK(1)} aria-label="Sumar 50 kcal">
            <Plus className="size-5" />
          </Button>
        </div>
        {!kcalOk && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Ingresá un valor entre {fmt(KCAL_META_MIN)} y {fmt(KCAL_META_MAX)} kcal.
          </p>
        )}
        {kcalOk && kcalNum < 1200 && (
          <p className="mt-2 text-center text-xs text-muted-foreground">Son estimaciones, no consejo médico.</p>
        )}
      </Card>

      <Card className="mt-4">
        <div className="flex justify-center">
          <MacroRing pct={pct} size={168} stroke={10} gap={3}>
            <p className={cn("text-2xl font-bold tabular-nums", suma === 100 ? "text-foreground" : "text-muted-foreground")}>{formatPct(suma)}</p>
          </MacroRing>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {PRESETS_PCT.map((p) => (
            <button
              key={p.nombre}
              onClick={() => { snapshot.current = null; setPct(p.pct); }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                iguales(p.pct, pct) ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {p.nombre}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-6">
          {MACRO_KEYS.map((k) => (
            <div key={k}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-semibold">{MACRO_LABEL[k]}</span>
                <span className="flex items-center gap-1 text-sm tabular-nums text-muted-foreground">
                  <GramosEditable valor={gramos[k]} onCommit={(g) => escribirGramos(k, g)} label={`Gramos de ${MACRO_LABEL[k].toLowerCase()}`} />
                  <span>· {formatPct(pct[k])} · {fmt(kcalMacro(kcal, pct[k]))} kcal</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="size-9 shrink-0 rounded-full" onClick={() => paso(k, -1)} disabled={pct[k] <= PCT_MIN} aria-label={`Bajar ${MACRO_LABEL[k]}`}>
                  <Minus className="size-4" />
                </Button>
                <Slider
                  value={[pct[k]]}
                  min={PCT_MIN}
                  max={PCT_MAX}
                  step={1}
                  onPointerDown={() => { snapshot.current = pct; }}
                  onValueChange={([v]) => moverSlider(k, v ?? pct[k])}
                  onValueCommit={() => { snapshot.current = null; }}
                  className={cn("flex-1", SLIDER_CLASS[k])}
                  aria-label={MACRO_LABEL[k]}
                />
                <Button variant="ghost" size="icon" className="size-9 shrink-0 rounded-full" onClick={() => paso(k, 1)} disabled={pct[k] >= PCT_MAX} aria-label={`Subir ${MACRO_LABEL[k]}`}>
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

    </>
  );
}

function GramosEditable({ valor, onCommit, label }: { valor: number; onCommit: (g: number) => void; label: string }) {
  const [editando, setEditando] = useState(false);
  const [txt, setTxt] = useState("");
  if (!editando) {
    return (
      <button
        onClick={() => { setTxt(String(valor)); setEditando(true); }}
        className="rounded-md px-1 font-semibold text-foreground underline decoration-dotted underline-offset-4"
        aria-label={`${label}: ${valor} g. Tocá para escribir`}
      >
        {valor} g
      </button>
    );
  }
  const terminar = () => {
    setEditando(false);
    const n = parseNum(txt);
    if (Number.isFinite(n) && n >= 0 && n !== valor) onCommit(n);
  };
  return (
    <span className="flex items-center gap-0.5">
      <Input
        autoFocus
        inputMode="numeric"
        value={txt}
        onChange={(e) => setTxt(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
        onBlur={terminar}
        onKeyDown={(e) => { if (e.key === "Enter") terminar(); if (e.key === "Escape") setEditando(false); }}
        className="h-7 w-14 px-1 text-right text-sm font-semibold"
        aria-label={label}
      />
      g
    </span>
  );
}
