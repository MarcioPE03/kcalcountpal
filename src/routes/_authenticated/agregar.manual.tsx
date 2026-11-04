import { createFileRoute, redirect } from "@tanstack/react-router";
import { momentoSearch } from "@/lib/search";

// Old manual-entry URL: now the "Registro rápido" tab of Mis comidas.
export const Route = createFileRoute("/_authenticated/agregar/manual")({
  validateSearch: momentoSearch,
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/agregar/mis-comidas", search: { tab: "rapido", momento: search.momento } });
  },
});
