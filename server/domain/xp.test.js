import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_DAILY_XP_GOAL,
  MAX_HEARTS,
  MAX_LEVEL,
  XP_RULES,
  addDays,
  badgesFor,
  computeStreak,
  dayInTimeZone,
  levelForXp,
  progressForXp,
  streakBonusFor,
  xpForLesson,
  xpThreshold,
  xpToAdvance,
} from "./xp.js";

test("a curva de níveis é estritamente crescente", () => {
  for (let level = 1; level < MAX_LEVEL; level += 1) {
    assert.ok(
      xpThreshold(level + 1) > xpThreshold(level),
      `nível ${level + 1} devia exigir mais XP do que ${level}`,
    );
  }
});

test("nível 1 começa em zero e cada patamar bate certo com o passo", () => {
  assert.equal(xpThreshold(1), 0);
  assert.equal(xpThreshold(2), 100);
  assert.equal(xpThreshold(3), 250);
  assert.equal(xpThreshold(4), 450);
  assert.equal(xpToAdvance(1), 100);
  assert.equal(xpToAdvance(2), 150);
});

test("levelForXp devolve o nível certo nas fronteiras", () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(99), 1);
  assert.equal(levelForXp(100), 2, "exatamente no limiar já conta como o nível novo");
  assert.equal(levelForXp(249), 2);
  assert.equal(levelForXp(250), 3);
  assert.equal(levelForXp(420), 3);
});

test("levelForXp aguenta lixo à entrada sem rebentar", () => {
  assert.equal(levelForXp(-50), 1);
  assert.equal(levelForXp(null), 1);
  assert.equal(levelForXp(undefined), 1);
  assert.equal(levelForXp("abc"), 1);
  assert.equal(levelForXp(12.9), 1);
});

test("levelForXp satura no nível máximo em vez de crescer para sempre", () => {
  assert.equal(levelForXp(Number.MAX_SAFE_INTEGER), MAX_LEVEL);
});

test("progressForXp descreve a barra de progresso sem a UI saber a fórmula", () => {
  const p = progressForXp(420);
  assert.equal(p.level, 3);
  assert.equal(p.levelFloorXp, 250);
  assert.equal(p.nextLevelXp, 450);
  assert.equal(p.xpIntoLevel, 170);
  assert.equal(p.xpForNextLevel, 200);
  assert.equal(p.percentToNextLevel, 85);
  assert.equal(p.isMaxLevel, false);
});

test("no nível máximo a barra fica cheia e não divide por zero", () => {
  const p = progressForXp(10_000_000);
  assert.equal(p.isMaxLevel, true);
  assert.equal(p.percentToNextLevel, 100);
  assert.ok(Number.isFinite(p.xpIntoLevel));
});

test("uma lição sem erros vale o bónus de perfeição", () => {
  assert.equal(xpForLesson(25, MAX_HEARTS), 25 + XP_RULES.perfectLessonBonus);
  assert.equal(xpForLesson(25, MAX_HEARTS - 1), 25);
  assert.equal(xpForLesson(25, 1), 25);
});

/* ------------------------------------------------------------------ *
 * Datas e streaks — onde os bugs costumam viver
 * ------------------------------------------------------------------ */

test("addDays atravessa fim de mês e ano bissexto", () => {
  assert.equal(addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addDays("2024-03-01", -1), "2024-02-29");
  assert.equal(addDays("2025-12-31", 1), "2026-01-01");
});

test("dayInTimeZone usa o fuso do utilizador, não o do servidor", () => {
  // 23:30 UTC de 25 de agosto já é dia 26 em Tóquio e ainda é 25 em Lisboa.
  const instant = new Date("2026-08-25T23:30:00Z");
  assert.equal(dayInTimeZone(instant, "Asia/Tokyo"), "2026-08-26");
  assert.equal(dayInTimeZone(instant, "Europe/Lisbon"), "2026-08-26");
  assert.equal(dayInTimeZone(instant, "America/Sao_Paulo"), "2026-08-25");
});

test("dayInTimeZone cai para UTC se o fuso for inválido", () => {
  const instant = new Date("2026-08-25T23:30:00Z");
  assert.equal(dayInTimeZone(instant, "Nao/Existe"), "2026-08-25");
});

test("dias consecutivos a terminar hoje contam como streak", () => {
  const days = ["2026-08-26", "2026-08-25", "2026-08-24"];
  assert.equal(computeStreak(days, "2026-08-26"), 3);
});

test("o streak sobrevive à manhã seguinte antes de haver atividade", () => {
  // Ainda não cozinhou hoje, mas cozinhou ontem: o streak não pode quebrar já.
  const days = ["2026-08-25", "2026-08-24"];
  assert.equal(computeStreak(days, "2026-08-26"), 2);
});

test("um dia inteiro sem atividade quebra o streak", () => {
  const days = ["2026-08-24", "2026-08-23"];
  assert.equal(computeStreak(days, "2026-08-26"), 0);
});

test("buracos no meio não são contados", () => {
  const days = ["2026-08-26", "2026-08-25", "2026-08-22", "2026-08-21"];
  assert.equal(computeStreak(days, "2026-08-26"), 2);
});

test("dias repetidos ou desordenados não inflacionam o streak", () => {
  const days = ["2026-08-25", "2026-08-26", "2026-08-26", "2026-08-25"];
  assert.equal(computeStreak(days, "2026-08-26"), 2);
});

test("sem atividade nenhuma o streak é zero", () => {
  assert.equal(computeStreak([], "2026-08-26"), 0);
});

test("o streak atravessa a mudança de mês", () => {
  const days = ["2026-09-01", "2026-08-31", "2026-08-30"];
  assert.equal(computeStreak(days, "2026-09-01"), 3);
});

test("o bónus de streak só cai em múltiplos de sete", () => {
  assert.equal(streakBonusFor(6), 0);
  assert.equal(streakBonusFor(7), XP_RULES.streakMilestoneBonus);
  assert.equal(streakBonusFor(8), 0);
  assert.equal(streakBonusFor(14), XP_RULES.streakMilestoneBonus);
  assert.equal(streakBonusFor(0), 0);
});

/* ------------------------------------------------------------------ *
 * Badges
 * ------------------------------------------------------------------ */

test("badges são derivados do que o utilizador fez", () => {
  assert.deepEqual(badgesFor({}), []);
  assert.ok(badgesFor({ recipes: 1 }).includes("Primeira receita"));
  assert.ok(badgesFor({ streak: 7 }).includes("Semana ativa"));
  assert.ok(badgesFor({ level: 4 }).includes("Chef nível 4"));
  assert.ok(!badgesFor({ recipes: 9 }).includes("10 receitas"));
  assert.ok(badgesFor({ recipes: 10 }).includes("10 receitas"));
});

test("a meta diária tem um valor por omissão sensato", () => {
  assert.equal(DEFAULT_DAILY_XP_GOAL, 50);
});
