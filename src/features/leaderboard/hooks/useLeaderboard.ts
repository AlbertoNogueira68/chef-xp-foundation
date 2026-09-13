import { useQuery } from "@tanstack/react-query";
import { leaderboardService } from "../services/leaderboardService";
import type { LeaderboardScope } from "@/types/leaderboard";

export const leaderboardQueryKey = (scope: LeaderboardScope) => ["leaderboard", scope] as const;

export function useLeaderboard(scope: LeaderboardScope) {
  return useQuery({
    queryKey: leaderboardQueryKey(scope),
    queryFn: () => leaderboardService.get(scope),
    staleTime: 30_000,
  });
}
