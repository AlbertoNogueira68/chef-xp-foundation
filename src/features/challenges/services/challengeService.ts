import type { Challenge } from "@/types/challenge";
import { delay, getDemoChallenges } from "@/constants/demo";

export const challengeService = {
  async list(): Promise<Challenge[]> {
    await delay();
    return getDemoChallenges();
  },
};
