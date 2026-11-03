import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, BarChart3, Home, Plus, User } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const item = "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground transition-colors";
  const active = { className: "text-primary" };
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur pb-safe">
      <div className="mx-auto flex max-w-md items-end px-2">
        <Link to="/" className={item} activeProps={active} activeOptions={{ exact: true }}>
          <Home className="size-5" /> Hoy
        </Link>
        <Link to="/progreso" className={item} activeProps={active}>
          <BarChart3 className="size-5" /> Progreso
        </Link>
        <Link to="/agregar" className="flex flex-1 flex-col items-center -mt-6" aria-label="Agregar comida">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-fab transition-transform active:scale-95">
            <Plus className="size-7" strokeWidth={2.5} />
          </span>
          <span className="mt-0.5 text-[11px] font-semibold text-primary">Agregar</span>
        </Link>
        <Link to="/perfil" className={item} activeProps={active}>
          <User className="size-5" /> Perfil
        </Link>
      </div>
    </nav>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cn("mx-auto w-full max-w-md px-4 pb-32 pt-4", className)}>{children}</main>;
}

export function PageHeader({ title, back, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const router = useRouter();
  return (
    <header className="mb-5 flex items-center gap-2">
      {back && (
        <button
          onClick={() => router.history.back()}
          className="-ml-2 rounded-full p-2 text-muted-foreground hover:bg-muted"
          aria-label="Volver"
        >
          <ArrowLeft className="size-5" />
        </button>
      )}
      <h1 className="flex-1 text-2xl font-bold">{title}</h1>
      {right}
    </header>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-3xl bg-card p-5 shadow-soft", className)}>{children}</section>;
}
