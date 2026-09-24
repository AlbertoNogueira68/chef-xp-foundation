import { apiFetch } from "@/services/api";
import type {
  Challenge,
  ChallengeDetail,
  ChallengeDraft,
  ChallengeEdit,
  ChallengeResult,
  ChallengeXpResult,
} from "@/types/challenge";

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

  /** Sem `entryId` retira todas as submissões; com ele, só aquela. */
  async leave(id: string, entryId?: string): Promise<Challenge> {
    const path = entryId ? `/challenges/${id}/entries/${entryId}` : `/challenges/${id}/entries`;
    const data = await apiFetch<{ challenge: Challenge }>(path, { method: "DELETE" });
    return data.challenge;
  },

  /* -------------------------------------------------------------- *
   * Moderação: criar e gerir
   * -------------------------------------------------------------- */

  async create(draft: ChallengeDraft): Promise<Challenge> {
    const data = await apiFetch<{ challenge: Challenge }>("/challenges", {
      method: "POST",
      body: JSON.stringify(draft),
    });
    return data.challenge;
  },

  async update(id: string, changes: ChallengeEdit): Promise<Challenge> {
    const data = await apiFetch<{ challenge: Challenge }>(`/challenges/${id}`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    });
    return data.challenge;
  },

  async remove(id: string): Promise<void> {
    await apiFetch<void>(`/challenges/${id}`, { method: "DELETE" });
  },

  /** Fecha à mão um desafio que já terminou, sem esperar pelo agendador. */
  async settle(id: string): Promise<{ challenge: Challenge; results: ChallengeResult[] }> {
    return apiFetch<{ challenge: Challenge; results: ChallengeResult[] }>(
      `/challenges/${id}/settle`,
      { method: "POST", body: JSON.stringify({}) },
    );
  },
};
