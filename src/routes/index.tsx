import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ChefXP · Cozinha, ganha XP, sobe de nível" },
      {
        name: "description",
        content:
          "ChefXP é a plataforma social gamificada para quem cozinha: descobre receitas, aceita desafios e evolui como chef.",
      },
      { property: "og:title", content: "ChefXP · Cozinha, ganha XP, sobe de nível" },
      {
        property: "og:description",
        content:
          "ChefXP é a plataforma social gamificada para quem cozinha: descobre receitas, aceita desafios e evolui como chef.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-xl text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-primary">
          Projeto Final de Licenciatura
        </p>
        <h1 className="mt-3 text-5xl font-bold tracking-tight text-foreground">ChefXP</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Uma plataforma social gamificada para quem quer cozinhar mais, descobrir novas
          receitas e criar hábitos alimentares mais saudáveis.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Começar</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
