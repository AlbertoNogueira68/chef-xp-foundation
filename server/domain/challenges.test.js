import test from "node:test";
import assert from "node:assert/strict";
import { canEnterChallenge, canLeaveChallenge, ENTRY_ERRORS } from "./challenges.js";

const now = new Date("2026-03-10T12:00:00Z");
const future = "2026-03-20T12:00:00Z";
const past = "2026-03-01T12:00:00Z";
const me = "user-1";

const base = {
  endsAt: future,
  recipeAuthorId: me,
  userId: me,
  alreadyEntered: false,
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

test("não se participa duas vezes no mesmo desafio", () => {
  assert.equal(canEnterChallenge({ ...base, alreadyEntered: true }).reason, "alreadyEntered");
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
    alreadyEntered: true,
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
