import { apiFetch } from "@/services/api";
import type { Challenge } from "@/types/challenge";

export const challengeService = {
  async list(): Promise<Challenge[]> {
    const data = await apiFetch<{ challenges: Challenge[] }>("/challenges");
    return data.challenges;
  },
};
