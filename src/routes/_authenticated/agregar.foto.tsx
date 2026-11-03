import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader } from "@/components/kcal/layout";
import { AnalizarFlow } from "@/components/kcal/analizar";
import { momentoSearch } from "@/lib/search";
import { horaLocal, momentoPorHora } from "@/lib/nutri";

export const Route = createFileRoute("/_authenticated/agregar/foto")({
  validateSearch: momentoSearch,
  head: () => ({
    meta: [
      { title: "Foto con IA — KcalCountPal" },
      { name: "description", content: "Sacale una foto a tu comida y la IA estima calorías y nutrientes." },
      { property: "og:title", content: "Foto con IA — KcalCountPal" },
      { property: "og:description", content: "Sacale una foto a tu comida y la IA estima calorías y nutrientes." },
    ],
  }),
  component: () => {
    const { momento } = Route.useSearch();
    return (
      <Page>
        <PageHeader title="Foto con IA" back />
        <AnalizarFlow conFoto momento={momento ?? momentoPorHora(horaLocal())} />
      </Page>
    );
  },
});
