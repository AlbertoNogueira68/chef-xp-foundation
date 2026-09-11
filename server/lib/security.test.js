import test from "node:test";
import assert from "node:assert/strict";

import { validateEnv, MIN_SECRET_LENGTH } from "./validateEnv.js";
import {
  baseCookieOptions,
  csrfCookieName,
  tokenCookieName,
  useSecureCookies,
} from "./cookies.js";
import { detectImageType } from "./imageStore.js";

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
  // O SMTP vai completo para este caso isolar a regra do CORS: produção passou
  // a exigir os dois, e sem isto o teste passava pela razão errada.
  const prod = {
    ...baseEnv,
    NODE_ENV: "production",
    SMTP_HOST: "smtp.exemplo.pt",
    SMTP_USER: "conta",
    SMTP_PASSWORD: "segredo",
  };

  assert.throws(() => validateEnv(prod), /FRONTEND_URL/);
  assert.doesNotThrow(() => validateEnv({ ...prod, FRONTEND_URL: "https://chefxp.pt" }));
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
  assert.throws(() => validateEnv({ ...baseEnv, GOOGLE_CLIENT_ID: "x.apps.googleusercontent.com" }), /GOOGLE_CLIENT/);
  assert.throws(() => validateEnv({ ...baseEnv, GOOGLE_CLIENT_SECRET: "segredo" }), /GOOGLE_CLIENT/);
  assert.doesNotThrow(() =>
    validateEnv({
      ...baseEnv,
      GOOGLE_CLIENT_ID: "x.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "segredo",
    }),
  );
});

/* ------------------------------------------------------------------ */
/* SMTP                                                               */
/* ------------------------------------------------------------------ */

test("SMTP meio configurado não arranca", () => {
  // O registo prometia um código e o envio rebentava já depois de a pessoa se
  // ter registado — o mesmo erro que o SSO da Google já evitava.
  assert.throws(
    () =>
      validateEnv({
        DATABASE_URL: "postgres://x",
        JWT_SECRET: "a".repeat(32),
        SMTP_HOST: "smtp.exemplo.pt",
      }),
    /SMTP meio configurado/,
  );
});

test("sem SMTP nenhum, fora de produção, arranca na mesma", () => {
  // Quem está a desenvolver vê o código na consola e não precisa de servidor.
  assert.doesNotThrow(() =>
    validateEnv({ DATABASE_URL: "postgres://x", JWT_SECRET: "a".repeat(32) }),
  );
});

test("em produção sem SMTP não arranca", () => {
  assert.throws(
    () =>
      validateEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://x",
        JWT_SECRET: "b".repeat(40),
        FRONTEND_URL: "https://exemplo.pt",
      }),
    /SMTP é obrigatório/,
  );
});

test("em produção com SMTP completo arranca", () => {
  assert.doesNotThrow(() =>
    validateEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://x",
      JWT_SECRET: "b".repeat(40),
      FRONTEND_URL: "https://exemplo.pt",
      SMTP_HOST: "smtp.exemplo.pt",
      SMTP_USER: "conta",
      SMTP_PASSWORD: "segredo",
    }),
  );
});
