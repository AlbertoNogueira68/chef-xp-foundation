import { useDeferredValue, useState } from "react";
import { Search, UserPlus, UserCheck } from "lucide-react";
import { RecipeMasonryCard } from "@/components/RecipeMasonryCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useRecipes } from "@/features/feed/hooks/useRecipes";
import { useSuggestedChefs, useToggleFollow } from "@/features/profile/hooks/useUserStats";
import type { RecipeDifficulty } from "@/types/recipe";

/**
 * Filtros reais em vez das hashtags fictícias que estavam em demo.ts:
 * cada um corresponde a um parâmetro que a API sabe aplicar.
 */
const FILTERS: Array<{
  id: string;
  label: string;
  difficulty?: RecipeDifficulty;
  maxTime?: number;
}> = [
  { id: "rapido", label: "Até 20 min", maxTime: 20 },
  { id: "meia-hora", label: "Até 30 min", maxTime: 30 },
  { id: "facil", label: "Fácil", difficulty: "facil" },
  { id: "medio", label: "Médio", difficulty: "medio" },
  { id: "dificil", label: "Difícil", difficulty: "dificil" },
];

export function SearchPage() {
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const deferredQ = useDeferredValue(q);

  const filter = FILTERS.find((f) => f.id === activeFilter);
  const { recipes, isFetching } = useRecipes({
    q: deferredQ || undefined,
    difficulty: filter?.difficulty,
    maxTime: filter?.maxTime,
    limit: 20,
  });

  const chefs = useSuggestedChefs();
  const toggleFollow = useToggleFollow();

  return (
    <section className="space-y-5">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Receitas, chefs, ingredientes…"
          className="rounded-full border-border/60 bg-muted/50 pl-10"
          autoComplete="off"
          aria-label="Pesquisar"
        />
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Filtros
        </h2>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2">
            {FILTERS.map((item) => {
              const active = activeFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveFilter(active ? null : item.id)}
                  className="shrink-0"
                >
                  <Badge
                    variant={active ? "default" : "secondary"}
                    className="rounded-full px-3 py-1.5 text-xs font-medium"
                  >
                    {item.label}
                  </Badge>
                </button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" className="hidden" />
        </ScrollArea>
      </div>

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Chefs sugeridos
        </h2>
        <div className="space-y-2">
          {chefs.data?.map((chef) => (
            <div
              key={chef.id}
              className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3"
            >
              <div className="flex items-center gap-3">
                <Avatar className="size-11 ring-2 ring-amber-500/20">
                  <AvatarImage src={chef.photoUrl ?? undefined} />
                  <AvatarFallback>{chef.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold">{chef.username}</p>
                  <p className="text-xs text-muted-foreground">
                    Nv. {chef.level} · {chef.recipes} {chef.recipes === 1 ? "receita" : "receitas"}{" "}
                    · {chef.followers} {chef.followers === 1 ? "seguidor" : "seguidores"}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full text-xs"
                disabled={toggleFollow.isPending}
                onClick={() => toggleFollow.mutate({ id: chef.id, following: false })}
              >
                <UserPlus className="mr-1 size-3" /> Seguir
              </Button>
            </div>
          ))}

          {chefs.data?.length === 0 && (
            <p className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
              <UserCheck className="mx-auto mb-1 size-4" />
              Já segues toda a gente por aqui.
            </p>
          )}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Descobrir
          </h2>
          {isFetching && <span className="text-xs text-muted-foreground">A pesquisar…</span>}
        </div>

        {!isFetching && recipes.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {deferredQ
              ? `Nenhum resultado para “${deferredQ}”.`
              : "Sem receitas para estes filtros."}
          </p>
        )}

        <div className="columns-2 gap-3">
          {recipes.map((recipe) => (
            <RecipeMasonryCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      </div>
    </section>
  );
}
