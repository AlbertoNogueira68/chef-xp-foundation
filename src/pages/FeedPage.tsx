import { FeedPost } from "@/components/FeedPost";
import { StoriesRow } from "@/components/StoriesRow";
import { Skeleton } from "@/components/ui/skeleton";
import { DEMO_STORIES } from "@/constants/demo";
import { useLikeRecipe, useRecipes } from "@/features/feed/hooks/useRecipes";

export function FeedPage() {
  const { data: recipes, isLoading, isError } = useRecipes();
  const like = useLikeRecipe();

  return (
    <section className="space-y-4">
      <StoriesRow stories={DEMO_STORIES} />

      {isLoading && (
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
      )}

      {isError && (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Não foi possível carregar o feed.
        </p>
      )}

      <div className="space-y-5">
        {recipes?.map((recipe) => (
          <FeedPost
            key={recipe.id}
            recipe={recipe}
            liking={like.isPending}
            onLike={(id) => like.mutate(id)}
          />
        ))}
      </div>
    </section>
  );
}
