import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { feedService } from "../services/feedService";
import { bumpCommentCount } from "./useFeed";
import type { FeedTarget } from "@/types/feed";

export const commentsQueryKey = (target: FeedTarget) =>
  ["comments", target.kind, target.id] as const;

/**
 * Comentários de um item do feed, seja ele um cozinhado ou uma receita. Quem
 * chama não precisa de saber em que tabela vivem.
 */
export function useComments(target: FeedTarget, enabled = true) {
  return useQuery({
    queryKey: commentsQueryKey(target),
    queryFn: () => feedService.comments(target),
    enabled,
  });
}

export function useAddComment(target: FeedTarget, itemKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => feedService.addComment(target, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey(target) });
      // Mexer só na contagem em vez de invalidar o feed: recarregá-lo fechava
      // a caixa de comentários e mandava a lista para o topo.
      bumpCommentCount(queryClient, itemKey, 1);
    },
  });
}

export function useDeleteComment(target: FeedTarget, itemKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => feedService.deleteComment(target, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey(target) });
      bumpCommentCount(queryClient, itemKey, -1);
    },
  });
}
