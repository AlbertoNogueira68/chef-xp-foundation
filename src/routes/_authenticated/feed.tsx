import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({
    meta: [
      { title: "Feed · ChefXP" },
      { name: "description", content: "Descobre o que a comunidade ChefXP anda a cozinhar." },
    ],
  }),
  component: FeedPage,
});

function FeedPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">Feed</h1>
      <p className="text-sm text-muted-foreground">
        Em breve: receitas partilhadas pela comunidade.
      </p>
    </section>
  );
}
