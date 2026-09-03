import test from "node:test";
import assert from "node:assert/strict";

import {
  decodeJwtPayload,
  pickAvailableUsername,
  usernameFromEmail,
  validateIdTokenClaims,
} from "./oauth.js";

const CLIENT = "123.apps.googleusercontent.com";

function claims(overrides = {}) {
  return {
    iss: "https://accounts.google.com",
    aud: CLIENT,
    exp: Math.floor(Date.now() / 1000) + 600,
    sub: "10769150350006150715113082367",
    email: "alguem@gmail.com",
    email_verified: true,
    ...overrides,
  };
}

const ok = (over) => validateIdTokenClaims(claims(over), { clientId: CLIENT });

/* -------------------------------------------------------------------- */
/* Validação do id_token                                                */
/* -------------------------------------------------------------------- */

test("um token válido da Google é aceite", () => {
  assert.equal(ok().ok, true);
});

test("um email não verificado é recusado", () => {
  // A regra que impede alguém de entrar na conta de outra pessoa com uma
  // conta Google criada com o email dela.
  assert.equal(ok({ email_verified: false }).ok, false);
  assert.equal(ok({ email_verified: undefined }).ok, false);
  assert.match(ok({ email_verified: false }).reason, /não verificado/);
});

test("um token emitido para outra aplicação é recusado", () => {
  const result = ok({ aud: "outra-app.apps.googleusercontent.com" });
  assert.equal(result.ok, false);
  assert.match(result.reason, /outra aplicação/);
});

test("sem client id configurado nada é aceite", () => {
  assert.equal(validateIdTokenClaims(claims(), { clientId: "" }).ok, false);
});

test("um emissor diferente é recusado", () => {
  assert.equal(ok({ iss: "https://accounts.google.com.evil.test" }).ok, false);
  // A Google emite com e sem esquema; ambos são legítimos.
  assert.equal(ok({ iss: "accounts.google.com" }).ok, true);
});

test("um token expirado é recusado", () => {
  assert.equal(ok({ exp: Math.floor(Date.now() / 1000) - 1 }).ok, false);
  assert.equal(ok({ exp: "logo" }).ok, false);
});

test("faltar o sub ou o email é recusado", () => {
  assert.equal(ok({ sub: undefined }).ok, false);
  assert.equal(ok({ email: undefined }).ok, false);
});

test("um payload lixo não rebenta", () => {
  assert.equal(validateIdTokenClaims(null, { clientId: CLIENT }).ok, false);
  assert.equal(validateIdTokenClaims("texto", { clientId: CLIENT }).ok, false);
});

/* -------------------------------------------------------------------- */
/* Descodificação                                                       */
/* -------------------------------------------------------------------- */

test("decodeJwtPayload lê o payload e aguenta lixo", () => {
  const payload = { sub: "1", email: "a@b.c" };
  const token = `x.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.y`;
  assert.deepEqual(decodeJwtPayload(token), payload);

  assert.equal(decodeJwtPayload("sem-pontos"), null);
  assert.equal(decodeJwtPayload("a.nao-e-base64-json.c"), null);
  assert.equal(decodeJwtPayload(null), null);
});

/* -------------------------------------------------------------------- */
/* Nome de utilizador                                                   */
/* -------------------------------------------------------------------- */

test("o nome sai do email e respeita as regras do registo", () => {
  const valid = /^[a-z0-9_.]{3,30}$/;
  for (const email of [
    "alberto.nogueira@gmail.com",
    "ALBERTO@GMAIL.COM",
    "nome+compras@gmail.com",
    "a@b.c",
    "com-hifen@x.pt",
    "...pontos...@x.pt",
    "utilizador.com.um.nome.verdadeiramente.enorme@x.pt",
  ]) {
    const username = usernameFromEmail(email);
    assert.match(username, valid, `${email} deu "${username}"`);
  }
});

test("o +tag do Gmail não entra no nome", () => {
  assert.equal(usernameFromEmail("nome+compras@gmail.com"), "nome");
});

test("nomes ocupados ganham sufixo sem passar dos 30 caracteres", () => {
  assert.equal(pickAvailableUsername("chefdemo", []), "chefdemo");
  assert.equal(pickAvailableUsername("chefdemo", ["chefdemo"]), "chefdemo2");
  assert.equal(pickAvailableUsername("chefdemo", ["chefdemo", "chefdemo2"]), "chefdemo3");

  const longo = "a".repeat(30);
  const escolhido = pickAvailableUsername(longo, [longo]);
  assert.equal(escolhido.length, 30);
  assert.notEqual(escolhido, longo);
});
