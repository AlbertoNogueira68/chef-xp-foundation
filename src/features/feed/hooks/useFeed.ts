import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { feedService } from "../services/feedService";
import type { FeedItem, FeedListParams, FeedPage, FeedTarget } from "@/types/feed";

export const FEED_ROOT_KEY = "feed";

export function feedQueryKey(params: FeedListParams = {}) {
  return [FEED_ROOT_KEY, { scope: params.scope ?? "all" }] as const;
}

export function targetOf(item: FeedItem): FeedTarget {
  return { kind: item.kind, id: item.id };
}

/**
 * O feed inteiro: cozinhados e receitas na mesma lista, paginados por cursor.
 */
export function useFeed(params: FeedListParams = {}) {
  const query = useInfiniteQuery({
    queryKey: feedQueryKey(params),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => feedService.list({ ...params, cursor: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);

  return { ...query, items };
}

type FeedCache = InfiniteData<FeedPage, string | null>;

/** Aplica uma alteração ao mesmo item em todas as páginas em cache. */
function patchItemEverywhere(
  queryClient: ReturnType<typeof useQueryClient>,
  key: string,
  patch: (item: FeedItem) => FeedItem,
) {
  queryClient.setQueriesData<FeedCache>({ queryKey: [FEED_ROOT_KEY] }, (old) => {
    if (!old) return old;
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        items: page.items.map((item) => (item.key === key ? patch(item) : item)),
      })),
    };
  });
}

/**
 * Gostar / deixar de gostar, com atualização otimista.
 * O coração muda de imediato; se o servidor recusar, o estado anterior volta.
 */
export function useToggleFeedLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ item }: { item: FeedItem }) =>
      item.likedByMe ? feedService.unlike(targetOf(item)) : feedService.like(targetOf(item)),

    onMutate: async ({ item }) => {
      await queryClient.cancelQueries({ queryKey: [FEED_ROOT_KEY] });
      const snapshot = queryClient.getQueriesData<FeedCache>({ queryKey: [FEED_ROOT_KEY] });

      patchItemEverywhere(queryClient, item.key, (current) => ({
        ...current,
        likedByMe: !item.likedByMe,
        likesCount: Math.max(0, current.likesCount + (item.likedByMe ? -1 : 1)),
      }));

      return { snapshot };
    },

    onError: (_error, _variables, context) => {
      context?.snapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },

    onSuccess: (counts, { item }) => {
      // A contagem definitiva é a do servidor.
      patchItemEverywhere(queryClient, item.key, (current) => ({ ...current, ...counts }));
    },
  });
}

/** Um comentário novo muda a contagem do cartão, não só a lista aberta. */
export function bumpCommentCount(
  queryClient: ReturnType<typeof useQueryClient>,
  key: string,
  delta: number,
) {
  patchItemEverywhere(queryClient, key, (item) => ({
    ...item,
    commentsCount: Math.max(0, item.commentsCount + delta),
  }));
}
