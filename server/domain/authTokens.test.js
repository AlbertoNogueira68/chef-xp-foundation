import test from "node:test";
import assert from "node:assert/strict";

import {
  EMAIL_VERIFICATION,
  PASSWORD_RESET,
  TTL_MINUTES,
  buildLink,
  checkToken,
  expiryFor,
  generateToken,
  hashToken,
} from "./authTokens.js";

const AGORA = new Date("2026-03-10T12:00:00Z");

function linha(overrides = {}) {
  return {
    token_hash: "abc",
    kind: PASSWORD_RESET,
    user_id: "11111111-1111-1111-1111-111111111111",
    email: "alguem@chef-xp.test",
    expires_at: new Date(AGORA.getTime() + 30 * 60_000),
    used_at: null,
    ...overrides,
  };
}

/* -------------------------------------------------------------------- */
/* Geração                                                              */
/* -------------------------------------------------------------------- */

test("o token tem 256 bits e o hash não é o token", () => {
  const { token, tokenHash } = generateToken();
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.equal(tokenHash, hashToken(token));
  assert.notEqual(tokenHash, token);
});

test("dois tokens seguidos não são iguais", () => {
  assert.notEqual(generateToken().token, generateToken().token);
});

test("o hash é estável — é assim que se encontra a linha na base", () => {
  assert.equal(hashToken("mesmo-valor"), hashToken("mesmo-valor"));
});

/* -------------------------------------------------------------------- */
/* Validade                                                             */
/* -------------------------------------------------------------------- */

test("a recuperação vale uma hora e a verificação um dia", () => {
  assert.equal(TTL_MINUTES[PASSWORD_RESET], 60);
  assert.equal(TTL_MINUTES[EMAIL_VERIFICATION], 60 * 24);

  assert.equal(expiryFor(PASSWORD_RESET, AGORA).toISOString(), "2026-03-10T13:00:00.000Z");
  assert.equal(expiryFor(EMAIL_VERIFICATION, AGORA).toISOString(), "2026-03-11T12:00:00.000Z");
});

test("um tipo desconhecido não recebe prazo nenhum", () => {
  assert.throws(() => expiryFor("qualquer-coisa"), /desconhecido/);
});

/* -------------------------------------------------------------------- */
/* Aceitar e recusar                                                    */
/* -------------------------------------------------------------------- */

test("um token dentro do prazo e por usar é aceite", () => {
  const resultado = checkToken(linha(), { kind: PASSWORD_RESET, now: AGORA });
  assert.equal(resultado.ok, true);
  assert.equal(resultado.userId, "11111111-1111-1111-1111-111111111111");
  assert.equal(resultado.email, "alguem@chef-xp.test");
});

test("um token que não existe é recusado", () => {
  assert.deepEqual(checkToken(undefined, { kind: PASSWORD_RESET, now: AGORA }), {
    ok: false,
    reason: "inexistente",
  });
});

test("um token já usado é recusado", () => {
  const resultado = checkToken(linha({ used_at: AGORA }), { kind: PASSWORD_RESET, now: AGORA });
  assert.equal(resultado.ok, false);
  assert.equal(resultado.reason, "já usado");
});

test("um token expirado é recusado", () => {
  const expirado = linha({ expires_at: new Date(AGORA.getTime() - 1000) });
  assert.equal(checkToken(expirado, { kind: PASSWORD_RESET, now: AGORA }).reason, "expirado");
});

test("o instante exato da expiração já não vale", () => {
  const limite = linha({ expires_at: AGORA });
  assert.equal(checkToken(limite, { kind: PASSWORD_RESET, now: AGORA }).ok, false);
});

test("um token de verificação não serve para redefinir a password", () => {
  const outro = linha({ kind: EMAIL_VERIFICATION });
  const resultado = checkToken(outro, { kind: PASSWORD_RESET, now: AGORA });
  assert.equal(resultado.ok, false);
  assert.equal(resultado.reason, "tipo errado");
});

/* -------------------------------------------------------------------- */
/* Link                                                                 */
/* -------------------------------------------------------------------- */

test("o link junta a base, o caminho e o token", () => {
  assert.equal(
    buildLink("http://localhost:5173", "/reset-password", "abc123"),
    "http://localhost:5173/reset-password?token=abc123",
  );
});

test("uma barra a mais na base não duplica na do caminho", () => {
  assert.equal(
    buildLink("https://chef-xp.pt/", "/verify-email", "abc"),
    "https://chef-xp.pt/verify-email?token=abc",
  );
});

test("sem base configurada, o link aponta para o Vite local", () => {
  assert.match(buildLink(undefined, "/reset-password", "abc"), /^http:\/\/localhost:5173\//);
});
