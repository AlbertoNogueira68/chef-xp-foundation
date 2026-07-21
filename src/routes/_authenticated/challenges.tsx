import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/challenges")({
  head: () => ({
    meta: [
      { title: "Desafios · ChefXP" },
      { name: "description", content: "Participa em desafios culinários e ganha XP." },
    ],
  }),
  component: ChallengesPage,
});

function ChallengesPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">Desafios</h1>
      <p className="text-sm text-muted-foreground">Em breve: desafios semanais.</p>
    </section>
  );
}
