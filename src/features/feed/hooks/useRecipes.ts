import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { recipeService } from "../services/recipeService";
import type {
  Recipe,
  RecipeCreateInput,
  RecipeListParams,
  RecipePage,
  RecipeUpdateInput,
} from "@/types/recipe";
import { currentUserQueryKey } from "@/features/profile/hooks/useCurrentUser";

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
 * A receita sozinha vive debaixo da mesma raiz que as listas, de propósito:
 * um `invalidateQueries([RECIPES_ROOT_KEY])` depois de um comentário refaz as
 * duas sem ninguém se lembrar da segunda.
 */
export function recipeQueryKey(id: string) {
  return [RECIPES_ROOT_KEY, "detail", id] as const;
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
  // A página de detalhe guarda a receita sozinha, fora das páginas do feed.
  queryClient.setQueryData<Recipe>(recipeQueryKey(recipeId), (old) => (old ? patch(old) : old));

  queryClient.setQueriesData<RecipeCache>({ queryKey: [RECIPES_ROOT_KEY] }, (old) => {
    // A query de detalhe cai neste prefixo mas não tem páginas; já foi tratada
    // acima e aqui tem de passar ao lado.
    if (!old?.pages) return old;
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

/**
 * Uma receita sozinha, para a página de detalhe.
 *
 * A cache do feed é por página e por filtro; abrir uma receita a partir de um
 * link direto não tem nenhuma dessas páginas carregada, portanto a query é
 * própria. O `like` continua a atualizar as duas — ver `useToggleLike`.
 */
export function useRecipe(id: string | undefined) {
  return useQuery({
    queryKey: recipeQueryKey(id ?? ""),
    queryFn: () => recipeService.getById(id as string),
    enabled: Boolean(id),
  });
}

export function useUpdateRecipe(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: RecipeUpdateInput) => recipeService.update(id, patch),
    onSuccess: (recipe) => {
      queryClient.setQueryData(recipeQueryKey(recipe.id), recipe);
      queryClient.invalidateQueries({ queryKey: [RECIPES_ROOT_KEY] });
      toast.success("Receita atualizada");
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível guardar"),
  });
}

/**
 * Apagar leva o XP atrás, portanto o perfil e o cabeçalho têm de recarregar.
 */
export function useDeleteRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => recipeService.remove(id),
    onSuccess: ({ revoked }, id) => {
      queryClient.removeQueries({ queryKey: recipeQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: [RECIPES_ROOT_KEY] });
      queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
      queryClient.invalidateQueries({ queryKey: ["userStats"] });
      queryClient.invalidateQueries({ queryKey: ["challenges"] });
      toast.success(revoked > 0 ? `Receita apagada · −${revoked} XP` : "Receita apagada");
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível apagar"),
  });
}
