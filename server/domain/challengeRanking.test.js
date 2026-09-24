import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PODIUM_XP, podiumOf, rankChallenge } from "./challengeRanking.js";

const podium = [300, 200, 100];

test("o pódio segue os gostos, do primeiro ao terceiro", () => {
  const ranked = rankChallenge(
    [
      { userId: "b", likes: 5 },
      { userId: "a", likes: 9 },
      { userId: "c", likes: 1 },
    ],
    podium,
  );

  assert.deepEqual(
    ranked.map((r) => [r.userId, r.place, r.xp]),
    [
      ["a", 1, 300],
      ["b", 2, 200],
      ["c", 3, 100],
    ],
  );
});

test("um empate paga o mesmo aos dois e consome o lugar seguinte", () => {
  const ranked = rankChallenge(
    [
      { userId: "a", likes: 7 },
      { userId: "b", likes: 7 },
      { userId: "c", likes: 3 },
    ],
    podium,
  );

  assert.deepEqual(
    ranked.map((r) => [r.place, r.xp]),
    [
      [1, 300],
      [1, 300],
      [3, 100],
    ],
  );
});

test("as submissões da mesma pessoa somam os gostos", () => {
  const ranked = rankChallenge(
    [
      { userId: "a", likes: 4 },
      { userId: "a", likes: 4 },
      { userId: "b", likes: 7 },
    ],
    podium,
  );

  assert.deepEqual(ranked[0], { userId: "a", likes: 8, place: 1, xp: 300 });
  assert.equal(ranked[1].userId, "b");
});

test("quem não teve um único gosto não sobe ao pódio", () => {
  const ranked = rankChallenge([{ userId: "sozinho", likes: 0 }], podium);
  assert.deepEqual(ranked, [{ userId: "sozinho", likes: 0, place: 1, xp: 0 }]);
});

test("fora do pódio fica-se na lista, sem XP", () => {
  const ranked = rankChallenge(
    [1, 2, 3, 4, 5].map((n) => ({ userId: `u${n}`, likes: n })),
    podium,
  );

  assert.equal(ranked.length, 5);
  assert.deepEqual(
    ranked.map((r) => r.xp),
    [300, 200, 100, 0, 0],
  );
});

test("um desafio sem participantes não devolve ranking nenhum", () => {
  assert.deepEqual(rankChallenge([], podium), []);
  assert.deepEqual(rankChallenge(undefined, podium), []);
});

test("um pódio de zeros não paga, e os lugares continuam a existir", () => {
  const ranked = rankChallenge(
    [
      { userId: "a", likes: 9 },
      { userId: "b", likes: 2 },
    ],
    [0, 0, 0],
  );

  assert.deepEqual(
    ranked.map((r) => [r.place, r.xp]),
    [
      [1, 0],
      [2, 0],
    ],
  );
});

test("gostos inválidos contam como zero em vez de envenenarem a ordem", () => {
  const ranked = rankChallenge(
    [
      { userId: "a", likes: "3" },
      { userId: "b", likes: null },
      { userId: "c", likes: -8 },
    ],
    podium,
  );

  assert.deepEqual(
    ranked.map((r) => [r.userId, r.likes, r.xp]),
    [
      ["a", 3, 300],
      ["b", 0, 0],
      ["c", 0, 0],
    ],
  );
});

test("o pódio de um desafio sai das colunas, com as omissões do módulo", () => {
  assert.deepEqual(podiumOf({ first_place_xp: 500, second_place_xp: 250, third_place_xp: 50 }), [
    500, 250, 50,
  ]);
  assert.deepEqual(podiumOf({}), [...DEFAULT_PODIUM_XP]);
});
