import test from "node:test";
import assert from "node:assert/strict";
import {
  canEnterChallenge,
  canLeaveChallenge,
  challengeDeletionRefusal,
  challengeEditRefusal,
  ENTRY_ERRORS,
} from "./challenges.js";

const now = new Date("2026-03-10T12:00:00Z");
const future = "2026-03-20T12:00:00Z";
const past = "2026-03-01T12:00:00Z";
const me = "user-1";

const base = {
  endsAt: future,
  recipeAuthorId: me,
  userId: me,
  entryCount: 0,
  maxEntries: 1,
  recipeEntered: false,
  now,
};

test("entra quem submete uma receita sua num desafio a decorrer", () => {
  assert.deepEqual(canEnterChallenge(base), { ok: true });
});

test("um desafio terminado não aceita participações", () => {
  const result = canEnterChallenge({ ...base, endsAt: past });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "ended");
});

test("o instante exato do fim já conta como terminado", () => {
  const result = canEnterChallenge({ ...base, endsAt: now.toISOString() });
  assert.equal(result.reason, "ended");
});

test("não se participa duas vezes num desafio de uma submissão", () => {
  const result = canEnterChallenge({ ...base, entryCount: 1 });
  assert.equal(result.reason, "alreadyEntered");
  assert.equal(result.message, ENTRY_ERRORS.alreadyEntered);
});

test("com mais submissões permitidas, entra-se até ao limite de quem criou", () => {
  const três = { ...base, maxEntries: 3 };
  assert.deepEqual(canEnterChallenge({ ...três, entryCount: 2 }), { ok: true });
  assert.equal(canEnterChallenge({ ...três, entryCount: 3 }).reason, "limitReached");
});

test("um desafio que ainda não começou não aceita submissões", () => {
  assert.equal(
    canEnterChallenge({ ...base, startsAt: "2026-03-15T00:00:00Z" }).reason,
    "notStarted",
  );
  assert.deepEqual(canEnterChallenge({ ...base, startsAt: past }), { ok: true });
});

test("a receita tem de ser de quem submete", () => {
  assert.equal(canEnterChallenge({ ...base, recipeAuthorId: "outro" }).reason, "notOwner");
  assert.equal(canEnterChallenge({ ...base, recipeAuthorId: null }).reason, "notOwner");
});

test("a mesma receita não entra em dois desafios", () => {
  assert.equal(canEnterChallenge({ ...base, recipeEntered: true }).reason, "recipeTaken");
});

test("o desafio terminado é verificado antes de tudo o resto", () => {
  const result = canEnterChallenge({
    ...base,
    endsAt: past,
    entryCount: 1,
    recipeAuthorId: "outro",
  });
  assert.equal(result.reason, "ended");
});

test("retira-se a participação enquanto o desafio corre, não depois", () => {
  assert.deepEqual(canLeaveChallenge({ endsAt: future, now }), { ok: true });
  assert.equal(canLeaveChallenge({ endsAt: past, now }).reason, "ended");
});

test("cada motivo de recusa tem mensagem própria", () => {
  const messages = Object.values(ENTRY_ERRORS);
  assert.equal(new Set(messages).size, messages.length);
  assert.ok(messages.every((m) => m.length > 0));
});

test("as regras de um desafio não mudam com gente lá dentro", () => {
  const corrente = { settled: false, hasEntries: true, endsAt: future, now };

  assert.equal(challengeEditRefusal({ ...corrente, changes: { title: "Outro" } }), null);
  assert.match(
    challengeEditRefusal({ ...corrente, changes: { xpReward: 500 } }),
    /Rules can't change/,
  );
  assert.equal(
    challengeEditRefusal({ ...corrente, hasEntries: false, changes: { xpReward: 500 } }),
    null,
  );
});

test("o prazo estica-se, não se encurta", () => {
  const corrente = { settled: false, hasEntries: true, endsAt: future, now };

  assert.equal(
    challengeEditRefusal({ ...corrente, changes: { endsAt: "2026-03-25T12:00:00Z" } }),
    null,
  );
  assert.match(
    challengeEditRefusal({ ...corrente, changes: { endsAt: "2026-03-12T12:00:00Z" } }),
    /extended, not shortened/,
  );
  assert.match(challengeEditRefusal({ ...corrente, changes: { endsAt: past } }), /in the future/);
});

test("um desafio liquidado não se edita nem se apaga", () => {
  assert.match(
    challengeEditRefusal({
      settled: true,
      hasEntries: false,
      changes: { title: "x" },
      endsAt: past,
      now,
    }),
    /closed/,
  );
  assert.match(challengeDeletionRefusal({ settled: true, hasEntries: false }), /closed/);
});

test("apaga-se um desafio enquanto ninguém submeteu nada", () => {
  assert.equal(challengeDeletionRefusal({ settled: false, hasEntries: false }), null);
  assert.match(
    challengeDeletionRefusal({ settled: false, hasEntries: true }),
    /already has entries/,
  );
});
