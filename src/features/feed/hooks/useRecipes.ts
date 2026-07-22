import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { recipeService } from "../services/recipeService";
import type { RecipeCreateInput } from "@/types/recipe";
import { currentUserQueryKey } from "@/features/profile/hooks/useCurrentUser";

export const recipesQueryKey = ["recipes"] as const;

export function useRecipes(q?: string) {
  return useQuery({
    queryKey: [...recipesQueryKey, q ?? ""],
    queryFn: () => recipeService.list(q),
  });
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecipeCreateInput) => recipeService.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recipesQueryKey });
      queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
    },
  });
}

export function useLikeRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recipeService.like(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recipesQueryKey });
    },
  });
}
