import type { Recipe } from "@/types/recipe";

export interface Challenge {
  id: string;
  title: string;
  description: string;
  /** XP que se ganha por participar, uma vez por desafio. */
  xpReward: number;
  imageUrl: string | null;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  /** Os dias que quem criou o desafio escolheu. */
  durationDays: number;
  active: boolean;
  /** Quantas fotos/receitas cada pessoa pode publicar neste desafio. */
  maxEntriesPerUser: number;
  /** O que vale cada lugar do pódio: [1.º, 2.º, 3.º]. */
  podiumXp: [number, number, number] | number[];
  /** Nulo até o ranking fechar e o pódio ser pago. */
  settledAt: string | null;
  entriesCount: number;
  participantsCount: number;
  createdBy: { id: string; username: string | null } | null;
  /** Quantas submissões eu já tenho aqui. */
  myEntriesCount: number;
}

export interface ChallengeEntry {
  id: string;
  createdAt: string;
  userId: string;
  recipe: Recipe;
}

/** Uma linha do pódio, congelada no fim do desafio. */
export interface ChallengeResult {
  place: number;
  likes: number;
  xp: number;
  user: {
    id: string;
    username: string;
    photoUrl: string | null;
    level: number;
  };
}

export interface ChallengeDetail {
  challenge: Challenge;
  entries: ChallengeEntry[];
  /** Vazio enquanto o desafio não fechar. */
  results: ChallengeResult[];
}

export interface ChallengeXpResult {
  earned: number;
  total: number;
  level: number;
}

/** O que quem cria um desafio escolhe. */
export interface ChallengeDraft {
  title: string;
  description: string;
  xpReward: number;
  maxEntriesPerUser: number;
  durationDays: number;
  firstPlaceXp: number;
  secondPlaceXp: number;
  thirdPlaceXp: number;
  imageDataUrl?: string | null;
}

/** Editar: tudo opcional, e o prazo passa a ser uma data em vez de dias. */
export type ChallengeEdit = Partial<Omit<ChallengeDraft, "durationDays">> & {
  endsAt?: string;
};
