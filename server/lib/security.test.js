import test from "node:test";
import assert from "node:assert/strict";

import { validateEnv, MIN_SECRET_LENGTH } from "./validateEnv.js";
import { baseCookieOptions, csrfCookieName, tokenCookieName, useSecureCookies } from "./cookies.js";
import { UPLOAD_DIR, deleteStoredImage, detectImageType, isStoredImagePath } from "./imageStore.js";
import { notBlockedSql } from "./blocks.js";
import { translate } from "./i18n.js";

const GOOD_SECRET = "a".repeat(MIN_SECRET_LENGTH);
const baseEnv = { DATABASE_URL: "postgres://x", JWT_SECRET: GOOD_SECRET };

/* ------------------------------------------------------------------ *
 * validateEnv: falhar no arranque > arrancar mal configurado
 * ------------------------------------------------------------------ */

test("uma configuração válida passa", () => {
  assert.doesNotThrow(() => validateEnv({ ...baseEnv }));
});

test("sem DATABASE_URL não arranca", () => {
  assert.throws(() => validateEnv({ JWT_SECRET: GOOD_SECRET }), /DATABASE_URL/);
});

test("sem JWT_SECRET não arranca — nem em desenvolvimento", () => {
  assert.throws(() => validateEnv({ DATABASE_URL: "postgres://x" }), /JWT_SECRET/);
});

test("um JWT_SECRET curto é recusado", () => {
  assert.throws(() => validateEnv({ ...baseEnv, JWT_SECRET: "curto" }), /pelo menos/);
});

test("o segredo de exemplo do .env é permitido em desenvolvimento", () => {
  assert.doesNotThrow(() =>
    validateEnv({
      ...baseEnv,
      JWT_SECRET: "dev-only-insecure-jwt-secret-min-32-chars",
    }),
  );
});

test("o segredo de exemplo do .env é recusado em produção", () => {
  assert.throws(
    () =>
      validateEnv({
        ...baseEnv,
        NODE_ENV: "production",
        FRONTEND_URL: "https://chefxp.pt",
        JWT_SECRET: "dev-only-insecure-jwt-secret-min-32-chars",
      }),
    /exemplo/,
  );
});

test("em produção é preciso declarar a origem do frontend", () => {
  assert.throws(() => validateEnv({ ...baseEnv, NODE_ENV: "production" }), /FRONTEND_URL/);
  assert.doesNotThrow(() =>
    validateEnv({ ...baseEnv, NODE_ENV: "production", FRONTEND_URL: "https://chefxp.pt" }),
  );
});

/* ------------------------------------------------------------------ *
 * Cookies
 * ------------------------------------------------------------------ */

test("em desenvolvimento os cookies são simples e sem prefixo", () => {
  const env = { NODE_ENV: "development" };
  assert.equal(useSecureCookies(env), false);
  assert.equal(tokenCookieName(env), "token");
  assert.equal(csrfCookieName(env), "csrf");
  assert.equal(baseCookieOptions(env).sameSite, "lax");
});

test("em produção os cookies são __Host-, Secure e SameSite=strict", () => {
  const env = { NODE_ENV: "production" };
  assert.equal(tokenCookieName(env), "__Host-token");
  assert.equal(csrfCookieName(env), "__Host-csrf");

  const options = baseCookieOptions(env);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, "strict");
  // O prefixo __Host- exige Path=/ e ausência de Domain.
  assert.equal(options.path, "/");
  assert.equal(options.domain, undefined);
});

test("COOKIE_SECURE tem prioridade sobre o NODE_ENV", () => {
  assert.equal(useSecureCookies({ NODE_ENV: "production", COOKIE_SECURE: "false" }), false);
  assert.equal(useSecureCookies({ NODE_ENV: "development", COOKIE_SECURE: "true" }), true);
});

/* ------------------------------------------------------------------ *
 * Imagens: o tipo vem dos bytes, não do que o cliente diz
 * ------------------------------------------------------------------ */

test("reconhece JPEG, PNG e WebP pela assinatura", () => {
  assert.equal(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "jpg");
  assert.equal(
    detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])),
    "png",
  );
  const webp = Buffer.concat([
    Buffer.from("RIFF", "ascii"),
    Buffer.from([0, 0, 0, 0]),
    Buffer.from("WEBP", "ascii"),
  ]);
  assert.equal(detectImageType(webp), "webp");
});

test("um script disfarçado de imagem é rejeitado", () => {
  assert.equal(detectImageType(Buffer.from("<?php system($_GET[0]); ?>", "utf8")), null);
  assert.equal(detectImageType(Buffer.from("GIF89a", "ascii")), null);
  assert.equal(detectImageType(Buffer.alloc(0)), null);
});

test("GOOGLE_CLIENT_ID sem GOOGLE_CLIENT_SECRET não arranca", () => {
  // Meio configurado é o pior dos mundos: o botão aparece e o fluxo falha
  // depois de o utilizador já ter saído da app para a Google.
  assert.throws(
    () => validateEnv({ ...baseEnv, GOOGLE_CLIENT_ID: "x.apps.googleusercontent.com" }),
    /GOOGLE_CLIENT/,
  );
  assert.throws(
    () => validateEnv({ ...baseEnv, GOOGLE_CLIENT_SECRET: "segredo" }),
    /GOOGLE_CLIENT/,
  );
  assert.doesNotThrow(() =>
    validateEnv({
      ...baseEnv,
      GOOGLE_CLIENT_ID: "x.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "segredo",
    }),
  );
});

/* ------------------------------------------------------------------ *
 * SMTP: metade configurado é pior do que nada                        *
 * ------------------------------------------------------------------ */

test("SMTP_USER sem SMTP_PASSWORD não arranca", () => {
  assert.throws(() => validateEnv({ ...baseEnv, SMTP_USER: "chef@exemplo.pt" }), /SMTP_USER/);
  assert.throws(() => validateEnv({ ...baseEnv, SMTP_PASSWORD: "abc" }), /SMTP_USER/);
});

test("SMTP_AUTH=none dispensa credenciais mas exige host e remetente", () => {
  const semAutenticacao = { ...baseEnv, SMTP_AUTH: "none" };

  assert.throws(() => validateEnv({ ...semAutenticacao, MAIL_FROM: "x@y" }), /SMTP_HOST/);
  assert.throws(() => validateEnv({ ...semAutenticacao, SMTP_HOST: "mailpit" }), /MAIL_FROM/);
  assert.doesNotThrow(() =>
    validateEnv({
      ...semAutenticacao,
      SMTP_HOST: "mailpit",
      MAIL_FROM: "Chef XP <chef-xp@localhost>",
    }),
  );
});

test("SMTP_AUTH só aceita login ou none", () => {
  assert.throws(() => validateEnv({ ...baseEnv, SMTP_AUTH: "oauth2" }), /SMTP_AUTH/);
});

test("credenciais ganham ao SMTP_AUTH=none do compose, em vez de serem ignoradas", () => {
  // O caso de quem tem o Gmail no `.env` e nunca ouviu falar do Mailpit: o
  // arranque avisa, mas não se recusa a arrancar por um valor que a pessoa
  // não escreveu.
  assert.doesNotThrow(() =>
    validateEnv({
      ...baseEnv,
      SMTP_AUTH: "none",
      SMTP_HOST: "smtp.gmail.com",
      SMTP_USER: "chef@exemplo.pt",
      SMTP_PASSWORD: "password-de-aplicacao",
    }),
  );
});

/* ------------------------------------------------------------------ *
 * Caminhos de imagem: só os que esta aplicação gerou
 * ------------------------------------------------------------------ */

const UUID_EXEMPLO = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

test("um caminho gerado por nós é reconhecido", () => {
  for (const ext of ["jpg", "png", "webp"]) {
    assert.equal(isStoredImagePath(`/uploads/${UUID_EXEMPLO}.${ext}`), true, ext);
  }
});

test("tudo o resto é recusado — incluindo o que parece nosso", () => {
  const recusados = [
    "/uploads/../../etc/passwd",
    "/uploads/../api/auth/csrf",
    "/uploads/qualquer-coisa.png",
    `/uploads/${UUID_EXEMPLO}.svg`,
    `/uploads/${UUID_EXEMPLO}.png.html`,
    `/uploads/sub/${UUID_EXEMPLO}.png`,
    "https://exemplo.pt/imagem.png",
    "",
    null,
    undefined,
    42,
  ];

  for (const valor of recusados) {
    assert.equal(isStoredImagePath(valor), false, `devia recusar ${JSON.stringify(valor)}`);
  }
});

test("apagar recusa-se a tocar no que não é um ficheiro nosso", async () => {
  // Não há aqui nenhum ficheiro para apagar: o que se prova é que a função
  // devolve `false` sem sequer tentar, para nenhum destes caminhos.
  for (const valor of ["/uploads/../../etc/passwd", "/etc/passwd", "/uploads/x.png", null]) {
    assert.equal(await deleteStoredImage(valor), false, String(valor));
  }
});

test("apagar um ficheiro que não existe não atira", async () => {
  assert.equal(await deleteStoredImage(`/uploads/${UUID_EXEMPLO}.png`), false);
  // E a pasta continua a ser a que o resto da aplicação usa.
  assert.ok(UPLOAD_DIR.endsWith("uploads"));
});

/* ------------------------------------------------------------------ *
 * Fragmentos de SQL montados à mão
 * ------------------------------------------------------------------ */

test("notBlockedSql aceita um placeholder e uma coluna", () => {
  const sql = notBlockedSql("$1", "r.author_id");
  assert.match(sql, /NOT EXISTS/);
  assert.match(sql, /b\.blocker_id = \$1/);
});

test("notBlockedSql recusa tudo o que não seja um placeholder e uma coluna", () => {
  // Os dois argumentos entram no SQL em cru. Hoje todos os sítios que a
  // chamam passam literais; isto é para o dia em que alguém passar uma coluna
  // que veio de um pedido.
  assert.throws(() => notBlockedSql("1 OR 1=1", "r.author_id"), /placeholder/);
  assert.throws(() => notBlockedSql("$1", "r.author_id) OR (1=1"), /coluna/);
  assert.throws(() => notBlockedSql("$1", "(SELECT 1)"), /coluna/);
});

/* ------------------------------------------------------------------ *
 * O dicionário de traduções não herda nada
 * ------------------------------------------------------------------ */

test("uma chave herdada de Object.prototype devolve texto, não uma função", () => {
  for (const chave of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
    assert.equal(translate(chave, "pt"), chave, chave);
  }
});

test("uma tradução que existe continua a sair traduzida", () => {
  assert.equal(translate("User not found", "pt"), "Utilizador não encontrado");
  assert.equal(translate("User not found", "en"), "User not found");
});
