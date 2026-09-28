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
 * O token diz quem é; a base diz se ainda vale.
 *
 * A assinatura provava que o token saiu daqui, e mais nada — não havia como
 * o invalidar antes de expirar. Redefinir a password deixava aberta, durante
 * sete dias, a sessão de quem quer que a tivesse roubado, que é justamente o
 * motivo pelo qual alguém redefine uma password.
 *
 * `token_version` é o mais barato que resolve isto: um número por conta, que
 * vai dentro do token e é comparado a cada pedido. Incrementá-lo fecha todas
 * as sessões dessa conta de uma vez, sem manter uma lista de tokens revogados
 * nem um registo de sessões abertas.
 *
 * Custa uma consulta por chave primária em cada pedido autenticado. É o mesmo
 * preço que o `roleOf` já pagava nas rotas de moderação, e pela mesma razão:
 * o que decide se alguém pode entrar tem de ser lido agora, não há sete dias.
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
    const { rows } = await query(`SELECT token_version FROM users WHERE id = $1`, [decoded.sub]);

    // Sem linha, a conta foi apagada: o token continua bem assinado e já não
    // aponta para ninguém.
    if (!rows[0]) return res.status(401).json({ error: "Unauthorized" });

    // Tokens emitidos antes desta coluna existir não trazem `ver`; contam
    // como versão 0, que é o valor com que todas as contas nasceram.
    if (Number(decoded.ver ?? 0) !== Number(rows[0].token_version)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.user = { id: decoded.sub, email: decoded.email };
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
