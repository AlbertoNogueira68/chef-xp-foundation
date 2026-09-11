import { progressForXp } from "../domain/xp.js";

/**
 * DTO público de utilizador. A curva de níveis é resolvida aqui, no servidor:
 * a UI recebe `nextLevelXp` em vez de recalcular a fórmula por si.
 */
export function toPublicUser(row, { includeEmail = false } = {}) {
  if (!row) return null;
  const progress = progressForXp(row.xp);

  return {
    id: row.id,
    username: row.username,
    ...(includeEmail ? { email: row.email } : {}),
    photoUrl: row.photo_url ?? null,
    level: progress.level,
    xp: progress.xp,
    levelFloorXp: progress.levelFloorXp,
    nextLevelXp: progress.nextLevelXp,
    xpIntoLevel: progress.xpIntoLevel,
    xpForNextLevel: progress.xpForNextLevel,
    percentToNextLevel: progress.percentToNextLevel,
    isMaxLevel: progress.isMaxLevel,
    ...(includeEmail
      ? {
          timeZone: row.time_zone ?? "Europe/Lisbon",
          dailyXpGoal: row.daily_xp_goal ?? 50,
          // Só para o próprio: se outra pessoa confirmou o email não lhe diz
          // respeito, e é informação sobre uma conta alheia.
          emailVerified: row.email_verified_at != null,
          hasPassword: row.password_hash !== null && row.password_hash !== undefined,
        }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toRecipe(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    ingredients: row.ingredients,
    cookTimeMin: row.cook_time_min,
    difficulty: row.difficulty,
    xpReward: row.xp_reward,
    imageUrl: row.image_url ?? null,
    likesCount: Number(row.likes_count ?? 0),
    commentsCount: Number(row.comments_count ?? 0),
    likedByMe: Boolean(row.liked_by_me),
    createdAt: row.created_at,
    author: {
      id: row.author_id,
      username: row.author_username,
      level: Number(row.author_level ?? 1),
      photoUrl: row.author_photo ?? null,
    },
  };
}

export function toComment(row) {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    author: {
      id: row.author_id,
      username: row.author_username,
      photoUrl: row.author_photo ?? null,
      level: Number(row.author_level ?? 1),
    },
  };
}

export function toChallenge(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    xpReward: row.xp_reward,
    imageUrl: row.image_url ?? null,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    active: new Date(row.ends_at) > new Date(),
  };
}

export function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeCursor(value) {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
