import { useState } from "react";
import { FeedPost } from "@/components/FeedPost";
import { ChefsToFollowRow } from "@/components/ChefsToFollowRow";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRecipes, useToggleLike } from "@/features/feed/hooks/useRecipes";
import type { FeedScope } from "@/types/recipe";

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <div key={i} className="space-y-3 rounded-2xl border p-3">
          <div className="flex gap-2">
            <Skeleton className="size-9 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-16" />
            </div>
          </div>
          <Skeleton className="aspect-square w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export function FeedPage() {
  const [scope, setScope] = useState<FeedScope>("all");

  const { recipes, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useRecipes({ scope });
  const toggleLike = useToggleLike();

  return (
    <section className="space-y-4">
      <ChefsToFollowRow />

      <Tabs value={scope} onValueChange={(value) => setScope(value as FeedScope)}>
        <TabsList className="grid w-full grid-cols-3 rounded-full bg-muted/80 p-1">
          <TabsTrigger value="all" className="rounded-full text-xs">
            Recentes
          </TabsTrigger>
          <TabsTrigger value="following" className="rounded-full text-xs">
            A seguir
          </TabsTrigger>
          <TabsTrigger value="popular" className="rounded-full text-xs">
            Em alta
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && <FeedSkeleton />}

      {isError && (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Não foi possível carregar o feed.
        </p>
      )}

      {!isLoading && !isError && recipes.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {scope === "following"
            ? "Ainda não segues ninguém que tenha publicado. Segue alguns chefs aqui em cima."
            : "Ainda não há receitas. Sê o primeiro a publicar."}
        </p>
      )}

      <div className="space-y-5">
        {recipes.map((recipe) => (
          <FeedPost
            key={recipe.id}
            recipe={recipe}
            pending={toggleLike.isPending}
            onToggleLike={(target) => toggleLike.mutate({ id: target.id, liked: target.likedByMe })}
          />
        ))}
      </div>

      {hasNextPage && (
        <Button
          variant="outline"
          className="w-full rounded-full"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? "A carregar…" : "Carregar mais"}
        </Button>
      )}
    </section>
  );
}
