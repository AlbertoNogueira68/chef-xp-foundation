import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { recipeService } from "../services/recipeService";
import { RECIPES_ROOT_KEY } from "./useRecipes";

export const commentsQueryKey = (recipeId: string) => ["comments", recipeId] as const;

export function useComments(recipeId: string, enabled = true) {
  return useQuery({
    queryKey: commentsQueryKey(recipeId),
    queryFn: () => recipeService.comments(recipeId),
    enabled,
  });
}

export function useAddComment(recipeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => recipeService.addComment(recipeId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey(recipeId) });
      queryClient.invalidateQueries({ queryKey: [RECIPES_ROOT_KEY] });
    },
  });
}

export function useDeleteComment(recipeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => recipeService.deleteComment(recipeId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey(recipeId) });
      queryClient.invalidateQueries({ queryKey: [RECIPES_ROOT_KEY] });
    },
  });
}
