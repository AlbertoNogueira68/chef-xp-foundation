import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/publish")({
  head: () => ({
    meta: [
      { title: "Publicar · ChefXP" },
      { name: "description", content: "Partilha uma nova receita com a comunidade." },
    ],
  }),
  component: PublishPage,
});

function PublishPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">Publicar</h1>
      <p className="text-sm text-muted-foreground">Em breve: publicação de novas receitas.</p>
    </section>
  );
}
