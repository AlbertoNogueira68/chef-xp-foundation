import { useState, useDeferredValue } from "react";
import { Search } from "lucide-react";
import { RecipeMasonryCard } from "@/components/RecipeMasonryCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { DEMO_CHEFS, DEMO_TRENDING } from "@/constants/demo";
import { useRecipes } from "@/features/feed/hooks/useRecipes";

export function SearchPage() {
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const { data: recipes, isFetching } = useRecipes(deferredQ);

  return (
    <section className="space-y-5">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Receitas, chefs, ingredientes…"
          className="rounded-full border-border/60 bg-muted/50 pl-10"
          autoComplete="off"
        />
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Em alta
        </h2>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2">
            {DEMO_TRENDING.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => setQ(tag.label.replace("#", ""))}
                className="shrink-0"
              >
                <Badge
                  variant="secondary"
                  className="rounded-full px-3 py-1.5 text-xs font-medium"
                >
                  {tag.label}
                  <span className="ml-1.5 text-muted-foreground">
                    {(tag.posts / 1000).toFixed(1)}k
                  </span>
                </Badge>
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="hidden" />
        </ScrollArea>
      </div>

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Chefs sugeridos
        </h2>
        <div className="space-y-2">
          {DEMO_CHEFS.map((chef) => (
            <div
              key={chef.id}
              className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3"
            >
              <div className="flex items-center gap-3">
                <Avatar className="size-11 ring-2 ring-amber-500/20">
                  <AvatarImage src={chef.avatarUrl} />
                  <AvatarFallback>{chef.username.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold">{chef.username}</p>
                  <p className="text-xs text-muted-foreground">
                    {chef.specialty} · Nv. {chef.level}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="rounded-full text-xs">
                Seguir
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Descobrir
          </h2>
          {isFetching && <span className="text-xs text-muted-foreground">A pesquisar…</span>}
        </div>

        {!isFetching && recipes?.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum resultado para “{deferredQ}”.
          </p>
        )}

        <div className="columns-2 gap-3">
          {recipes?.map((recipe) => (
            <RecipeMasonryCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      </div>
    </section>
  );
}
