import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader } from "@/components/kcal/layout";
import { EstadisticasTab } from "@/components/kcal/estadisticas-tab";
import { PesoTab } from "@/components/kcal/peso-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/progreso")({
  head: () => ({
    meta: [
      { title: "Progreso — KcalCountPal" },
      { name: "description", content: "Tu evolución de peso y estadísticas de calorías, comidas y macros." },
      { property: "og:title", content: "Progreso — KcalCountPal" },
      { property: "og:description", content: "Tu evolución de peso y estadísticas de calorías, comidas y macros." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Progreso,
});

function Progreso() {
  return (
    <Page>
      <PageHeader title="Progreso" />
      <Tabs defaultValue="peso">
        <TabsList className="mb-4 grid h-11 w-full grid-cols-2 rounded-full p-1">
          <TabsTrigger value="peso" className="rounded-full">Peso</TabsTrigger>
          <TabsTrigger value="estadisticas" className="rounded-full">Estadísticas</TabsTrigger>
        </TabsList>
        <TabsContent value="peso"><PesoTab /></TabsContent>
        <TabsContent value="estadisticas"><EstadisticasTab /></TabsContent>
      </Tabs>
    </Page>
  );
}
