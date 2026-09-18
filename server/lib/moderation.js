import { query } from "../db/index.js";
import { canAdminister, canModerate } from "../domain/moderation.js";

/**
 * O lado com base de dados da moderação. As regras puras estão em
 * `server/domain/moderation.js`.
 */

/**
 * O papel de quem está a pedir, lido da base a cada pedido.
 *
 * Não vai no token de propósito: um papel dentro do JWT ficava congelado até o
 * cookie expirar, e retirar permissões a alguém passava a demorar uma semana.
 * É uma consulta por chave primária, e só nas rotas que precisam dela.
 */
export async function roleOf(userId) {
  const { rows } = await query(`SELECT role FROM users WHERE id = $1`, [userId]);
  return rows[0]?.role ?? "user";
}

/**
 * Barra a porta a quem não tem o papel — e deixa o papel em `req.user.role`,
 * para a rota não o ir buscar outra vez.
 *
 * São dois guardas e não um `requireRole("x")` genérico porque só há dois
 * degraus acima do utilizador comum, e a escada está em `domain/moderation.js`.
 */
function guard(permitido, recusa) {
  return async (req, res, next) => {
    try {
      const role = await roleOf(req.user.id);
      if (!permitido(role)) return res.status(403).json({ error: recusa });
      req.user.role = role;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

/** A fila de denúncias: moderadores e administradores. */
export const requireModerator = guard(canModerate, "Isto é da moderação");

/** Papéis e números da plataforma: só administradores. */
export const requireAdmin = guard(canAdminister, "Isto é da administração");

/**
 * De quem é o conteúdo denunciado — e existe sequer?
 *
 * Devolve `null` quando o alvo não existe, para a rota responder 404 em vez de
 * guardar uma denúncia sobre um identificador inventado.
 */
export async function subjectOwner(subjectType, subjectId) {
  const sql = {
    recipe: `SELECT author_id AS owner FROM recipes WHERE id = $1`,
    comment: `SELECT author_id AS owner FROM comments WHERE id = $1`,
    user: `SELECT id AS owner FROM users WHERE id = $1`,
  }[subjectType];

  if (!sql) return null;
  const { rows } = await query(sql, [subjectId]);
  return rows[0]?.owner ?? null;
}
