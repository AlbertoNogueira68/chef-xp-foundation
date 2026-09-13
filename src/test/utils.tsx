import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { Recipe } from "@/types/recipe";
import type { User } from "@/types/user";

/**
 * Um `QueryClient` por teste, sem repetições nem cache entre eles.
 *
 * `retry: false` é essencial: por omissão o React Query repete três vezes com
 * espera exponencial, e um teste de erro passava a demorar segundos em vez de
 * milissegundos.
 *
 * `gcTime: Infinity` é igualmente essencial, por um motivo menos óbvio: com
 * `gcTime: 0`, uma query escrita à mão com `setQueryData` é recolhida no mesmo
 * instante por não ter observadores, e o teste passa a ler `undefined`.
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  {
    route = "/",
    client = createTestQueryClient(),
    ...options
  }: RenderOptions & {
    route?: string;
    client?: QueryClient;
  } = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return { client, ...render(ui, { wrapper: Wrapper, ...options }) };
}

/* ------------------------------------------------------------------ *
 * Fabricantes de dados. Os testes dizem só o que é relevante para eles.
 * ------------------------------------------------------------------ */

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    username: "chefdemo",
    email: "demo@chef-xp.test",
    photoUrl: null,
    level: 3,
    xp: 250,
    levelFloorXp: 200,
    nextLevelXp: 400,
    xpIntoLevel: 50,
    xpForNextLevel: 200,
    percentToNextLevel: 25,
    isMaxLevel: false,
    timeZone: "Europe/Lisbon",
    dailyXpGoal: 50,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: "recipe-1",
    title: "Arroz de tomate",
    description: "Tomate maduro e arroz solto.",
    ingredients: "arroz\ntomate",
    cookTimeMin: 25,
    difficulty: "facil",
    xpReward: 25,
    imageUrl: null,
    likesCount: 2,
    commentsCount: 0,
    likedByMe: false,
    createdAt: "2026-03-01T10:00:00.000Z",
    author: { id: "user-1", username: "chefdemo", level: 3, photoUrl: null },
    ...overrides,
  };
}
