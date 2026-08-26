import crypto from "node:crypto";
import { baseCookieOptions, csrfCookieName } from "../lib/cookies.js";
import { readToken } from "./auth.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const TTL_SECONDS = 7 * 24 * 60 * 60;

export function issueCsrfToken(res) {
  const token = crypto.randomBytes(32).toString("hex");
  res.cookie(csrfCookieName(), token, {
    ...baseCookieOptions(),
    httpOnly: false, // o cliente tem de o ler para o reenviar no header
    maxAge: TTL_SECONDS * 1000,
  });
  return token;
}

export function clearCsrfToken(res) {
  res.clearCookie(csrfCookieName(), baseCookieOptions());
}

/** Comparação em tempo constante, tolerante a comprimentos diferentes. */
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * CSRF double-submit.
 *
 * Só é aplicado a pedidos mutantes autenticados por cookie: sem cookie de
 * sessão não há autoridade ambiente para roubar, e o registo/login precisam de
 * poder acontecer antes de existir token. Decisão deliberada, não omissão.
 */
export function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  if (!readToken(req)) {
    return next();
  }

  const cookieToken = req.cookies?.[csrfCookieName()];
  const headerToken = req.get("X-CSRF-Token");

  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  return next();
}
