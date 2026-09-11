import jwt from "jsonwebtoken";
import { baseCookieOptions, tokenCookieName } from "../lib/cookies.js";
import { query } from "../db/index.js";

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

/**
 * Autentica pelo cookie e confirma que a sessão ainda é válida.
 *
 * O token é um JWT de sete dias e nada no servidor o podia cancelar. Isso
 * fazia da recuperação de password um gesto vazio: quem tivesse entrado numa
 * conta continuava lá dentro durante uma semana depois de a password ter sido
 * mudada precisamente para o expulsar.
 *
 * O `session_epoch` resolve-o. Cada pedido autenticado lê-o e compara com o
 * que vem no token; mudar a password incrementa-o e todos os tokens emitidos
 * antes deixam de valer. Custa uma leitura por chave primária a cada pedido —
 * é o preço de um token que se pode revogar, e é um preço que se paga.
 */
export async function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { rows } = await query(
      `SELECT id, email, session_epoch, email_verified_at FROM users WHERE id = $1`,
      [decoded.sub],
    );
    const user = rows[0];

    // Conta apagada, ou token de antes de a password mudar.
    if (!user || Number(user.session_epoch) !== Number(decoded.epoch ?? 0)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.user = {
      id: user.id,
      email: user.email,
      emailVerified: user.email_verified_at !== null,
    };
    return next();
  } catch (error) {
    return next(error);
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
