export const THEME_CLARO = "#3f9a7c";
export const THEME_OSCURO = "#1f5644";
export type Tema = "claro" | "oscuro" | "sistema";

export function leerTema(): Tema {
  if (typeof window === "undefined") return "claro";
  return (localStorage.getItem("tema") as Tema) || "claro";
}

export function aplicarTema(t: Tema = leerTema()) {
  if (typeof window === "undefined") return;
  localStorage.setItem("tema", t);
  const oscuro = t === "oscuro" || (t === "sistema" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", oscuro);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", oscuro ? THEME_OSCURO : THEME_CLARO);
}
