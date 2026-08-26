import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { userService } from "@/features/profile/services/userService";
import type { UserStats } from "@/types/user";

export const userStatsQueryKey = (id: string | undefined) => ["userStats", id ?? ""] as const;
export const suggestedChefsQueryKey = ["suggestedChefs"] as const;

export function useUserStats(userId: string | undefined) {
  return useQuery({
    queryKey: userStatsQueryKey(userId),
    queryFn: () => userService.stats(userId as string),
    enabled: Boolean(userId),
    staleTime: 15_000,
  });
}

export function useSuggestedChefs() {
  return useQuery({
    queryKey: suggestedChefsQueryKey,
    queryFn: () => userService.suggestions(),
    staleTime: 60_000,
  });
}

/**
 * Seguir / deixar de seguir com atualização otimista dos contadores do perfil.
 */
export function useToggleFollow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, following }: { id: string; following: boolean }) =>
      following ? userService.unfollow(id) : userService.follow(id),

    onMutate: async ({ id, following }) => {
      const key = userStatsQueryKey(id);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<UserStats>(key);

      if (previous) {
        queryClient.setQueryData<UserStats>(key, {
          ...previous,
          isFollowing: !following,
          followers: Math.max(0, previous.followers + (following ? -1 : 1)),
        });
      }

      return { previous, key };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },

    onSettled: (_data, _error, { id }) => {
      queryClient.invalidateQueries({ queryKey: userStatsQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: suggestedChefsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["userStats"] });
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });
}
