import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { recipeService } from "../services/recipeService";
import type { Recipe, RecipeCreateInput, RecipeListParams, RecipePage } from "@/types/recipe";
import { currentUserQueryKey } from "@/features/profile/hooks/useCurrentUser";
import { FEED_ROOT_KEY } from "./useFeed";

export const RECIPES_ROOT_KEY = "recipes";

export function recipesQueryKey(params: RecipeListParams = {}) {
  return [
    RECIPES_ROOT_KEY,
    {
      scope: params.scope ?? "all",
      q: params.q ?? "",
      difficulty: params.difficulty ?? null,
      maxTime: params.maxTime ?? null,
      authorId: params.authorId ?? null,
    },
  ] as const;
}

/**
 * Feed paginado por cursor. Substitui o `LIMIT 50` fixo: a lista cresce à
 * medida que o utilizador desce, e o cursor é estável mesmo que entrem
 * receitas novas no topo.
 */
export function useRecipes(params: RecipeListParams = {}) {
  const query = useInfiniteQuery({
    queryKey: recipesQueryKey(params),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => recipeService.list({ ...params, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const recipes = useMemo(
    () => query.data?.pages.flatMap((page) => page.recipes) ?? [],
    [query.data],
  );

  return { ...query, recipes };
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecipeCreateInput) => recipeService.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RECIPES_ROOT_KEY] });
      // A receita nova também entra no feed, que já não lê daqui.
      queryClient.invalidateQueries({ queryKey: [FEED_ROOT_KEY] });
      queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
      queryClient.invalidateQueries({ queryKey: ["userStats"] });
    },
  });
}

type RecipeCache = InfiniteData<RecipePage, string | null>;

/** Aplica uma alteração à mesma receita em todas as páginas em cache. */
function patchRecipeEverywhere(
  queryClient: ReturnType<typeof useQueryClient>,
  recipeId: string,
  patch: (recipe: Recipe) => Recipe,
) {
  queryClient.setQueriesData<RecipeCache>({ queryKey: [RECIPES_ROOT_KEY] }, (old) => {
    if (!old) return old;
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        recipes: page.recipes.map((recipe) => (recipe.id === recipeId ? patch(recipe) : recipe)),
      })),
    };
  });
}

/**
 * Gostar / deixar de gostar, com atualização otimista.
 * O coração muda de imediato; se o servidor recusar, o estado anterior volta.
 */
export function useToggleLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, liked }: { id: string; liked: boolean }) =>
      liked ? recipeService.unlike(id) : recipeService.like(id),

    onMutate: async ({ id, liked }) => {
      await queryClient.cancelQueries({ queryKey: [RECIPES_ROOT_KEY] });
      const snapshot = queryClient.getQueriesData<RecipeCache>({
        queryKey: [RECIPES_ROOT_KEY],
      });

      patchRecipeEverywhere(queryClient, id, (recipe) => ({
        ...recipe,
        likedByMe: !liked,
        likesCount: Math.max(0, recipe.likesCount + (liked ? -1 : 1)),
      }));

      return { snapshot };
    },

    onError: (_error, _variables, context) => {
      context?.snapshot?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },

    onSuccess: (recipe) => {
      // A contagem definitiva é a do servidor.
      patchRecipeEverywhere(queryClient, recipe.id, () => recipe);
    },
  });
}
