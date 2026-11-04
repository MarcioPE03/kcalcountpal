import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader } from "@/components/kcal/layout";
import { AnalizarFlow } from "@/components/kcal/analizar";
import { describirSearch } from "@/lib/search";
import { horaLocal, momentoPorHora } from "@/lib/nutri";

export const Route = createFileRoute("/_authenticated/agregar/describir")({
  validateSearch: describirSearch,
  head: () => ({
    meta: [
      { title: "Describir comida — KcalCountPal" },
      { name: "description", content: "Contá lo que comiste con texto o voz y la IA lo calcula." },
      { property: "og:title", content: "Describir comida — KcalCountPal" },
      { property: "og:description", content: "Contá lo que comiste con texto o voz y la IA lo calcula." },
    ],
  }),
  component: () => {
    const { momento, texto } = Route.useSearch();
    return (
      <Page>
        <PageHeader title="Describir" back />
        <AnalizarFlow conFoto={false} descInicial={texto} momento={momento ?? momentoPorHora(horaLocal())} />
      </Page>
    );
  },
});
