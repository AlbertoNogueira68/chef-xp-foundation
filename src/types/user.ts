/**
 * Domínio: User.
 *
 * Este é o tipo canónico usado por toda a UI. Nunca expor tipos do provider
 * (ex.: rows do Postgres em snake_case). Os mappers no data layer convertem
 * o formato de origem neste DTO.
 *
 * Os campos de progressão (`nextLevelXp`, `xpIntoLevel`, …) vêm calculados do
 * servidor: a curva de níveis vive em `server/domain/xp.js` e a UI nunca a
 * reimplementa.
 */
export interface User {
  id: string;
  username: string;
  email?: string;
  photoUrl: string | null;
  level: number;
  xp: number;
  levelFloorXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  percentToNextLevel: number;
  isMaxLevel: boolean;
  timeZone?: string;
  dailyXpGoal?: number;
  createdAt: string;
  updatedAt: string;
}

/** Utilizador sugerido para seguir, com contadores reais. */
export interface SuggestedUser extends User {
  followers: number;
  recipes: number;
}

/** Estatísticas de perfil — todas derivadas de tabelas, nenhuma inventada. */
export interface UserStats {
  recipes: number;
  followers: number;
  following: number;
  lessonsCompleted: number;
  /** Missões concluídas — vezes que esteve mesmo na cozinha. */
  cooked: number;
  likesReceived: number;
  streak: number;
  isFollowing: boolean;
  isMe: boolean;
  badges: string[];
}

/** Uma linha das listas de seguidores e de seguidos. */
export interface FollowListUser {
  id: string;
  username: string;
  photoUrl: string | null;
  level: number;
  /** Se eu — quem pede — sigo esta pessoa. Nunca o estado de outra pessoa. */
  isFollowing: boolean;
  isMe: boolean;
}

export interface UserUpdate {
  username?: string;
  photoUrl?: string | null;
  timeZone?: string;
  dailyXpGoal?: number;
}
