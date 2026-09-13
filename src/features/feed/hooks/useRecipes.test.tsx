import { describe, expect, test, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createTestQueryClient, makeRecipe } from "@/test/utils";
import { recipeQueryKey, RECIPES_ROOT_KEY, useToggleLike } from "@/features/feed/hooks/useRecipes";
import { recipeService } from "@/features/feed/services/recipeService";

vi.mock("@/features/feed/services/recipeService", () => ({
  recipeService: { like: vi.fn(), unlike: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * O gosto tem de mudar em dois sítios: nas páginas do feed e na receita
 * sozinha da página de detalhe.
 *
 * A segunda vive debaixo da mesma raiz de cache — de propósito, para um
 * comentário novo refazer as duas — e por isso cai no mesmo `setQueriesData`.
 * Só que não tem `pages`, e a primeira versão deste código assumia que tinha.
 * Era um erro à espera do primeiro gosto dado a partir do detalhe.
 */
describe("gostar de uma receita", () => {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    client.clear();
    vi.mocked(recipeService.like).mockReset();
    vi.mocked(recipeService.unlike).mockReset();
  });

  test("atualiza o feed e o detalhe ao mesmo tempo", async () => {
    const recipe = makeRecipe({ likesCount: 2, likedByMe: false });

    client.setQueryData([RECIPES_ROOT_KEY, { scope: "all" }], {
      pages: [{ recipes: [recipe], nextCursor: null }],
      pageParams: [null],
    });
    client.setQueryData(recipeQueryKey(recipe.id), recipe);

    vi.mocked(recipeService.like).mockResolvedValue({
      ...recipe,
      likesCount: 3,
      likedByMe: true,
    });

    const { result } = renderHook(() => useToggleLike(), { wrapper });
    result.current.mutate({ id: recipe.id, liked: false });

    await waitFor(() => {
      const detalhe = client.getQueryData(recipeQueryKey(recipe.id)) as typeof recipe;
      expect(detalhe.likesCount).toBe(3);
      expect(detalhe.likedByMe).toBe(true);
    });

    const feed = client.getQueryData([RECIPES_ROOT_KEY, { scope: "all" }]) as {
      pages: Array<{ recipes: Array<typeof recipe> }>;
    };
    expect(feed.pages[0].recipes[0].likesCount).toBe(3);
  });

  test("gostar a partir do detalhe, sem o feed carregado, não rebenta", async () => {
    const recipe = makeRecipe({ likesCount: 0, likedByMe: false });
    // É o caso de quem abre um link partilhado: só existe a query de detalhe.
    client.setQueryData(recipeQueryKey(recipe.id), recipe);

    vi.mocked(recipeService.like).mockResolvedValue({
      ...recipe,
      likesCount: 1,
      likedByMe: true,
    });

    const { result } = renderHook(() => useToggleLike(), { wrapper });
    result.current.mutate({ id: recipe.id, liked: false });

    await waitFor(() => {
      const detalhe = client.getQueryData(recipeQueryKey(recipe.id)) as typeof recipe;
      expect(detalhe.likesCount).toBe(1);
    });
  });

  test("o coração muda antes da resposta do servidor", async () => {
    const recipe = makeRecipe({ likesCount: 5, likedByMe: false });
    client.setQueryData(recipeQueryKey(recipe.id), recipe);

    let resolver: (valor: typeof recipe) => void = () => {};
    vi.mocked(recipeService.like).mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve;
      }),
    );

    const { result } = renderHook(() => useToggleLike(), { wrapper });
    result.current.mutate({ id: recipe.id, liked: false });

    await waitFor(() => {
      const otimista = client.getQueryData(recipeQueryKey(recipe.id)) as typeof recipe;
      expect(otimista.likedByMe).toBe(true);
      expect(otimista.likesCount).toBe(6);
    });

    resolver({ ...recipe, likesCount: 6, likedByMe: true });
  });

  test("se o servidor recusar, o estado anterior volta", async () => {
    const recipe = makeRecipe({ likesCount: 5, likedByMe: false });
    client.setQueryData(recipeQueryKey(recipe.id), recipe);

    vi.mocked(recipeService.like).mockRejectedValue(new Error("500"));

    const { result } = renderHook(() => useToggleLike(), { wrapper });
    result.current.mutate({ id: recipe.id, liked: false });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const depois = client.getQueryData(recipeQueryKey(recipe.id)) as typeof recipe;
    expect(depois.likedByMe).toBe(false);
    expect(depois.likesCount).toBe(5);
  });
});
