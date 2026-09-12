import type { Recipe } from "@/types/recipe";

export interface ChallengeEntrySummary {
  /** A receita com que o utilizador autenticado participou. */
  recipeId: string;
  createdAt: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  imageUrl: string | null;
  endsAt: string;
  createdAt: string;
  active: boolean;
  entriesCount: number;
  /** `null` quando ainda não participei. Vem do servidor, não do estado local. */
  myEntry: ChallengeEntrySummary | null;
}

export interface ChallengeEntry {
  id: string;
  createdAt: string;
  recipe: Recipe;
}

export interface ChallengeDetail {
  challenge: Challenge;
  entries: ChallengeEntry[];
}

export interface ChallengeXpResult {
  earned: number;
  total: number;
  level: number;
}
