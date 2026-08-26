/**
 * Fonte única de verdade da progressão do ChefXP.
 *
 * Módulo puro, sem I/O e sem dependências: é o que permite testá-lo com
 * `node --test` e o que garante que cliente e servidor nunca discordam sobre
 * quanto XP vale alguma coisa.
 */

export const MAX_LEVEL = 50;
export const MAX_HEARTS = 3;
export const DEFAULT_DAILY_XP_GOAL = 50;

/** XP fixo atribuído por cada tipo de ação. */
export const XP_RULES = {
  recipePublished: 25,
  perfectLessonBonus: 10,
  streakMilestoneBonus: 20, // a cada 7 dias consecutivos
};

const BASE_STEP = 100;
const STEP_GROWTH = 50;

/** XP necessário para passar de `level` para `level + 1`. */
export function xpToAdvance(level) {
  return BASE_STEP + Math.max(0, level - 1) * STEP_GROWTH;
}

/** XP acumulado necessário para *estar* em `level`. Nível 1 = 0 XP. */
export function xpThreshold(level) {
  if (level <= 1) return 0;
  const n = Math.min(level, MAX_LEVEL) - 1;
  return BASE_STEP * n + (STEP_GROWTH * n * (n - 1)) / 2;
}

export function levelForXp(xp) {
  const safe = Math.max(0, Math.floor(Number(xp) || 0));
  let level = 1;
  while (level < MAX_LEVEL && xpThreshold(level + 1) <= safe) {
    level += 1;
  }
  return level;
}

/**
 * Tudo o que a UI precisa para desenhar a barra de progresso, derivado de um
 * único número. A UI nunca recalcula a curva por si.
 */
export function progressForXp(xp) {
  const total = Math.max(0, Math.floor(Number(xp) || 0));
  const level = levelForXp(total);
  const floor = xpThreshold(level);
  const isMax = level >= MAX_LEVEL;
  const ceiling = isMax ? floor : xpThreshold(level + 1);
  const span = Math.max(1, ceiling - floor);
  const into = total - floor;

  return {
    xp: total,
    level,
    isMaxLevel: isMax,
    levelFloorXp: floor,
    nextLevelXp: isMax ? floor : ceiling,
    xpIntoLevel: into,
    xpForNextLevel: isMax ? 0 : ceiling - floor,
    percentToNextLevel: isMax ? 100 : Math.min(100, Math.round((into / span) * 100)),
  };
}

/** XP de uma lição: recompensa base + bónus por não perder corações. */
export function xpForLesson(baseReward, heartsLeft, maxHearts = MAX_HEARTS) {
  const base = Math.max(0, Math.floor(Number(baseReward) || 0));
  if (heartsLeft >= maxHearts) return base + XP_RULES.perfectLessonBonus;
  return base;
}

/* ------------------------------------------------------------------ *
 * Datas e streaks
 * ------------------------------------------------------------------ */

/**
 * Dia civil (YYYY-MM-DD) no fuso do utilizador.
 * O streak tem de ser calculado no fuso dele, não no do servidor nem no do
 * browser — senão viajar muda o resultado.
 */
export function dayInTimeZone(date = new Date(), timeZone = "UTC") {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }
}

export function addDays(day, amount) {
  const [y, m, d] = day.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);
  const moved = new Date(base + amount * 86_400_000);
  return moved.toISOString().slice(0, 10);
}

/**
 * Conta dias consecutivos de atividade a terminar hoje (ou ontem — o streak só
 * quebra depois de um dia inteiro sem atividade, senão perdia-se todas as
 * manhãs antes de a pessoa cozinhar).
 */
export function computeStreak(activeDays, today) {
  const set = new Set(activeDays);
  let cursor = today;

  if (!set.has(cursor)) {
    cursor = addDays(today, -1);
    if (!set.has(cursor)) return 0;
  }

  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Bónus de XP quando o streak atinge um múltiplo de 7. */
export function streakBonusFor(streak) {
  if (streak > 0 && streak % 7 === 0) return XP_RULES.streakMilestoneBonus;
  return 0;
}

/* ------------------------------------------------------------------ *
 * Badges — derivados, nunca guardados desatualizados
 * ------------------------------------------------------------------ */

export function badgesFor({ recipes = 0, lessons = 0, streak = 0, level = 1, likes = 0 } = {}) {
  const badges = [];
  if (recipes >= 1) badges.push("Primeira receita");
  if (recipes >= 10) badges.push("10 receitas");
  if (lessons >= 1) badges.push("Primeira lição");
  if (lessons >= 7) badges.push("Semana de lições");
  if (streak >= 7) badges.push("Semana ativa");
  if (streak >= 30) badges.push("Mês ativo");
  if (level >= 3) badges.push(`Chef nível ${level}`);
  if (likes >= 100) badges.push("100 gostos");
  return badges;
}
