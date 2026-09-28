import crypto from "node:crypto";
import { baseCookieOptions, csrfCookieName } from "../lib/cookies.js";

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
 * CSRF double-submit, em todas as escritas.
 *
 * Durante muito tempo o registo e o login ficavam de fora, com o argumento de
 * que sem cookie de sessão não há autoridade ambiente para roubar. É verdade
 * para a vítima — e não é o único ataque. Sem esta proteção, um site
 * terceiro podia iniciar sessão no browser de alguém **com as credenciais do
 * atacante**, e essa pessoa passava a cozinhar, a publicar e a somar XP dentro
 * de uma conta que não era dela sem dar por isso. Em produção o
 * `SameSite=Strict` do cookie já o travava; em desenvolvimento, com `lax`,
 * não travava, e um controlo que só funciona numa configuração é um controlo
 * que se esquece de valer quando a configuração muda.
 *
 * Não custa nada a quem chega: o cliente pede `GET /api/auth/csrf` antes da
 * primeira escrita, que é o que já fazia para todas as outras.
 *
 * Fica de fora o que o browser faz sem JavaScript nosso — os métodos seguros,
 * e só eles.
 */
export function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const cookieToken = req.cookies?.[csrfCookieName()];
  const headerToken = req.get("X-CSRF-Token");

  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  return next();
}
