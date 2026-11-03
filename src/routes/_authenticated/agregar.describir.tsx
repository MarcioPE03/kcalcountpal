import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader } from "@/components/kcal/layout";
import { AnalizarFlow } from "@/components/kcal/analizar";
import { momentoSearch } from "@/lib/search";
import { horaLocal, momentoPorHora } from "@/lib/nutri";

export const Route = createFileRoute("/_authenticated/agregar/describir")({
  validateSearch: momentoSearch,
  head: () => ({
    meta: [
      { title: "Describir comida — KcalCountPal" },
      { name: "description", content: "Contá lo que comiste con texto o voz y la IA lo calcula." },
      { property: "og:title", content: "Describir comida — KcalCountPal" },
      { property: "og:description", content: "Contá lo que comiste con texto o voz y la IA lo calcula." },
    ],
  }),
  component: () => {
    const { momento } = Route.useSearch();
    return (
      <Page>
        <PageHeader title="Describir" back />
        <AnalizarFlow conFoto={false} momento={momento ?? momentoPorHora(horaLocal())} />
      </Page>
    );
  },
});
