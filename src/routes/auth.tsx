import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Leaf, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Ingresar — KcalCountPal" },
      { name: "description", content: "Ingresá o creá tu cuenta para registrar comidas y calorías con IA." },
      { property: "og:title", content: "Ingresar — KcalCountPal" },
      { property: "og:description", content: "Contá calorías y nutrientes con una foto o tu voz." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<"ingresar" | "registro">("ingresar");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [cargando, setCargando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    try {
      if (modo === "ingresar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: pass,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) setEnviado(true);
      }
    } catch (err) {
      const msg = (err as Error).message;
      toast.error(
        msg.includes("Invalid login") ? "Email o contraseña incorrectos." :
        msg.includes("already registered") ? "Ese email ya tiene cuenta. Ingresá." :
        msg.includes("Password") ? "La contraseña debe tener al menos 6 caracteres." : msg,
      );
    } finally {
      setCargando(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("No pudimos ingresar con Google.");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Leaf className="size-7" />
        </div>
        <h1 className="text-3xl font-extrabold">KcalCountPal</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sacale una foto a tu plato y listo.</p>
      </div>

      {enviado ? (
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h2 className="text-lg font-bold">Revisá tu email</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Te mandamos un link a <b>{email}</b> para confirmar tu cuenta.
          </p>
        </div>
      ) : (
        <>
          <Button variant="outline" className="h-12 w-full rounded-full text-base" onClick={google}>
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
              <path fill="currentColor" d="M21.35 11.1H12v2.9h5.35c-.25 1.5-1.7 4.3-5.35 4.3-3.2 0-5.85-2.65-5.85-5.9S8.8 6.5 12 6.5c1.85 0 3.05.8 3.75 1.45l2.55-2.45C16.7 4 14.55 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.65-3.65 8.65-8.8 0-.6-.05-1.05-.3-1.1z" />
            </svg>
            Continuar con Google
          </Button>
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> o con email <div className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={enviar} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-2xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pass">Contraseña</Label>
              <Input id="pass" type="password" required minLength={6} value={pass} onChange={(e) => setPass(e.target.value)} className="h-12 rounded-2xl" />
            </div>
            <Button type="submit" className="h-12 w-full rounded-full text-base" disabled={cargando}>
              {cargando && <Loader2 className="size-4 animate-spin" />}
              {modo === "ingresar" ? "Ingresar" : "Crear cuenta"}
            </Button>
          </form>
          <button
            className="mt-5 w-full text-center text-sm text-muted-foreground"
            onClick={() => setModo(modo === "ingresar" ? "registro" : "ingresar")}
          >
            {modo === "ingresar" ? "¿No tenés cuenta? " : "¿Ya tenés cuenta? "}
            <span className="font-semibold text-primary">{modo === "ingresar" ? "Registrate" : "Ingresá"}</span>
          </button>
        </>
      )}
    </main>
  );
}
