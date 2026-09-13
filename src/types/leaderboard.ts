export type LeaderboardScope = "global" | "weekly";

export interface LeaderboardEntry {
  /** Posição com empates: dois em primeiro são os dois `rank: 1`. */
  rank: number;
  score: number;
  isMe: boolean;
  user: {
    id: string;
    username: string;
    photoUrl: string | null;
    level: number;
  };
}

export interface Leaderboard {
  scope: LeaderboardScope;
  entries: LeaderboardEntry[];
  /** A minha linha, mesmo quando fico fora do top. `null` se não pontuei. */
  me: LeaderboardEntry | null;
}
