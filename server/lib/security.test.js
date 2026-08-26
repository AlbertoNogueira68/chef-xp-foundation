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
  assert.throws(
    () => validateEnv({ ...baseEnv, NODE_ENV: "production" }),
    /FRONTEND_URL/,
  );
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
