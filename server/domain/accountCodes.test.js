import test from "node:test";
import assert from "node:assert/strict";
import {
  CODE_LENGTH,
  MAX_ATTEMPTS,
  checkCode,
  codeMatches,
  cooldownRemaining,
  expiryFor,
  generateCode,
  hashCode,
  isPurpose,
} from "./accountCodes.js";

const AGORA = new Date("2026-09-11T12:00:00.000Z");

function record(overrides = {}) {
  return {
    codeHash: hashCode("123456"),
    attempts: 0,
    expiresAt: new Date(AGORA.getTime() + 10 * 60_000).toISOString(),
    consumedAt: null,
    ...overrides,
  };
}

test("o código tem sempre seis dígitos, mesmo quando começa por zero", () => {
  for (let i = 0; i < 200; i += 1) {
    const code = generateCode();
    assert.equal(code.length, CODE_LENGTH);
    assert.match(code, /^[0-9]{6}$/);
  }
});

test("códigos seguidos não são todos iguais", () => {
  const amostra = new Set(Array.from({ length: 50 }, () => generateCode()));
  assert.ok(amostra.size > 40, "gerador sem variedade suficiente");
});

test("o código nunca é guardado em claro", () => {
  const hash = hashCode("123456");
  assert.notEqual(hash, "123456");
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test("só o código certo confere", () => {
  const hash = hashCode("123456");
  assert.equal(codeMatches("123456", hash), true);
  assert.equal(codeMatches("123457", hash), false);
  assert.equal(codeMatches("", hash), false);
  assert.equal(codeMatches("123456", null), false);
  // Um código numérico e a sua versão com espaços não são o mesmo segredo.
  assert.equal(codeMatches(" 123456", hash), false);
});

test("um código certo dentro da validade passa", () => {
  assert.deepEqual(checkCode(record(), "123456", AGORA), { ok: true });
});

test("um código expirado não passa, nem que esteja certo", () => {
  const expirado = record({ expiresAt: new Date(AGORA.getTime() - 1000).toISOString() });
  assert.deepEqual(checkCode(expirado, "123456", AGORA), { ok: false, reason: "expired" });
});

test("um código já usado não serve outra vez", () => {
  const usado = record({ consumedAt: AGORA.toISOString() });
  assert.deepEqual(checkCode(usado, "123456", AGORA), { ok: false, reason: "consumed" });
});

test("esgotadas as tentativas, nem o código certo entra", () => {
  // Seis dígitos são cem mil hipóteses: é o limite que faz disto um segredo.
  const gasto = record({ attempts: MAX_ATTEMPTS });
  assert.deepEqual(checkCode(gasto, "123456", AGORA), { ok: false, reason: "exhausted" });
});

test("não haver código nenhum é uma recusa e não um erro", () => {
  assert.deepEqual(checkCode(null, "123456", AGORA), { ok: false, reason: "missing" });
});

test("a validade é de quinze minutos a contar de agora", () => {
  const prazo = expiryFor("verify", AGORA);
  assert.equal(prazo.getTime() - AGORA.getTime(), 15 * 60_000);
});

test("o intervalo entre pedidos conta-se ao segundo e nunca é negativo", () => {
  const ha10s = new Date(AGORA.getTime() - 10_000);
  assert.equal(cooldownRemaining(ha10s, AGORA), 50);

  const ha5min = new Date(AGORA.getTime() - 5 * 60_000);
  assert.equal(cooldownRemaining(ha5min, AGORA), 0);

  // Sem pedido anterior não há espera nenhuma.
  assert.equal(cooldownRemaining(null, AGORA), 0);
});

test("só há dois propósitos", () => {
  assert.equal(isPurpose("verify"), true);
  assert.equal(isPurpose("reset"), true);
  assert.equal(isPurpose("admin"), false);
  assert.equal(isPurpose(""), false);
});
