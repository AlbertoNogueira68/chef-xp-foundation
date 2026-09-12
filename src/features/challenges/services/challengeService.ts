import { apiFetch } from "@/services/api";
import type { Challenge, ChallengeDetail, ChallengeXpResult } from "@/types/challenge";

export const challengeService = {
  async list(): Promise<Challenge[]> {
    const data = await apiFetch<{ challenges: Challenge[] }>("/challenges");
    return data.challenges;
  },

  async get(id: string): Promise<ChallengeDetail> {
    return apiFetch<ChallengeDetail>(`/challenges/${id}`);
  },

  /** Submete uma receita própria. O XP do desafio é pago no servidor. */
  async enter(
    id: string,
    recipeId: string,
  ): Promise<{ challenge: Challenge; xp: ChallengeXpResult }> {
    return apiFetch<{ challenge: Challenge; xp: ChallengeXpResult }>(`/challenges/${id}/entries`, {
      method: "POST",
      body: JSON.stringify({ recipeId }),
    });
  },

  async leave(id: string): Promise<Challenge> {
    const data = await apiFetch<{ challenge: Challenge }>(`/challenges/${id}/entries`, {
      method: "DELETE",
    });
    return data.challenge;
  },
};
