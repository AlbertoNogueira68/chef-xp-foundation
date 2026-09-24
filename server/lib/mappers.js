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
    // `emailVerified` acompanha o email: só faz sentido para o próprio, e
    // ninguém precisa de saber quem confirmou a conta e quem não confirmou.
    ...(includeEmail
      ? {
          timeZone: row.time_zone ?? "Europe/Lisbon",
          dailyXpGoal: row.daily_xp_goal ?? 50,
          emailVerified: Boolean(row.email_verified_at),
          // O papel acompanha o email pela mesma razão: é do próprio. Quem
          // modera não anda com um crachá à frente dos outros utilizadores.
          role: row.role ?? "user",
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
    estimatedCostEur: row.estimated_cost_eur == null ? null : Number(row.estimated_cost_eur),
    dietaryTags: row.dietary_tags ?? [],
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
    /**
     * O desafio a que esta receita foi submetida, quando há um.
     *
     * Vai em todas as receitas e não só nas do desafio: uma receita publicada
     * para um desafio aparece no feed como qualquer outra, e é o selo que
     * explica porque é que ela existe. Sem isto, a interface tinha de ir
     * perguntar desafio a desafio a quem pertencia cada receita.
     */
    challenge: row.challenge_id
      ? { id: row.challenge_id, title: row.challenge_title }
      : null,
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
  const startsAt = row.starts_at ?? row.created_at;
  const endsAt = row.ends_at;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    xpReward: Number(row.xp_reward ?? 0),
    imageUrl: row.image_url ?? null,
    startsAt,
    endsAt,
    createdAt: row.created_at,
    // Os dias que quem criou o desafio escolheu, reconstruídos a partir das
    // duas pontas: a duração não é uma coluna porque seria uma terceira
    // verdade a ter de bater certo com as outras duas.
    durationDays: durationInDays(startsAt, endsAt),
    active: new Date(endsAt) > new Date(),
    maxEntriesPerUser: Number(row.max_entries_per_user ?? 1),
    // O pódio: o que vale cada lugar, escolhido por quem criou o desafio.
    podiumXp: [
      Number(row.first_place_xp ?? 0),
      Number(row.second_place_xp ?? 0),
      Number(row.third_place_xp ?? 0),
    ],
    // `settledAt` é o que separa "acabou" de "acabou e já pagou": entre os
    // dois há a janela do agendador, e nessa janela o pódio ainda não existe.
    settledAt: row.settled_at ?? null,
    entriesCount: Number(row.entries_count ?? 0),
    participantsCount: Number(row.participants_count ?? row.entries_count ?? 0),
    createdBy: row.created_by
      ? { id: row.created_by, username: row.created_by_username ?? null }
      : null,
    // Quantas submissões quem está a pedir já tem aqui. Poupa um segundo
    // pedido só para saber se o botão diz "Participar" ou "Já participaste".
    myEntriesCount: Number(row.my_entries_count ?? 0),
  };
}

function durationInDays(startsAt, endsAt) {
  const dias = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 86_400_000;
  return Math.max(1, Math.round(dias));
}

/** Uma linha do pódio congelado, já com quem a ocupa. */
export function toChallengeResult(row) {
  return {
    place: Number(row.place),
    likes: Number(row.likes ?? 0),
    xp: Number(row.xp_awarded ?? 0),
    user: {
      id: row.user_id,
      username: row.username,
      photoUrl: row.photo_url ?? null,
      level: Number(row.level ?? 1),
    },
  };
}

/** Uma participação: a receita submetida mais quem a submeteu. */
export function toChallengeEntry(row) {
  return {
    id: String(row.entry_id),
    createdAt: row.entered_at,
    userId: row.author_id,
    recipe: toRecipe(row),
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

/**
 * Uma notificação para a interface. Sem texto pronto: a frase é montada lá,
 * a partir do tipo e de quem fez — e assim muda com o nome de quem a fez.
 */
export function toNotification(row) {
  return {
    id: String(row.id),
    kind: row.kind,
    read: row.read_at !== null,
    createdAt: row.created_at,
    actor: {
      id: row.actor_id,
      username: row.actor_username,
      photoUrl: row.actor_photo ?? null,
      level: Number(row.actor_level ?? 1),
    },
    recipe: row.recipe_id
      ? { id: row.recipe_id, title: row.recipe_title, imageUrl: row.recipe_image ?? null }
      : null,
    commentBody: row.comment_body ?? null,
  };
}
