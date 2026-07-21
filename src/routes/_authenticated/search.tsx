import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({
    meta: [
      { title: "Pesquisa · ChefXP" },
      { name: "description", content: "Encontra receitas, chefs e desafios no ChefXP." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">Pesquisa</h1>
      <p className="text-sm text-muted-foreground">Em breve: pesquisa de receitas e chefs.</p>
    </section>
  );
}
