import jwt from "jsonwebtoken";
import { baseCookieOptions, tokenCookieName } from "../lib/cookies.js";

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // validateEnv() já corre no arranque; isto é a segunda linha de defesa.
    throw new Error("JWT_SECRET não está definida");
  }
  return secret;
}

export function signToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_TTL_SECONDS });
}

export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

export function readToken(req) {
  return req.cookies?.[tokenCookieName()] ?? null;
}

export function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const decoded = verifyToken(token);
    req.user = { id: decoded.sub, email: decoded.email };
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

export function setAuthCookie(res, token) {
  res.cookie(tokenCookieName(), token, {
    ...baseCookieOptions(),
    httpOnly: true,
    maxAge: TOKEN_TTL_SECONDS * 1000,
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(tokenCookieName(), {
    ...baseCookieOptions(),
    httpOnly: true,
  });
}
