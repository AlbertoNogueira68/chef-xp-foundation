import { apiFetch } from "@/services/api";
import type { Leaderboard, LeaderboardScope } from "@/types/leaderboard";

export const leaderboardService = {
  get(scope: LeaderboardScope): Promise<Leaderboard> {
    return apiFetch<Leaderboard>(`/leaderboard?scope=${scope}`);
  },
};
