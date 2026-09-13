import { Router } from "express";
import { query } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { leaderboardSchema } from "../schemas/index.js";

const router = Router();

router.use(requireAuth);

/**
 * Rankings.
 *
 * Não há contadores novos: o ranking global é a soma do livro-razão que já
 * está em `users.xp`, e o semanal soma `daily_activity`, que existe desde o
 * streak. Um ranking que precisasse de uma tabela própria seria mais uma
 * verdade para manter sincronizada.
 *
 * `RANK()` e não `ROW_NUMBER()`: quem tem o mesmo XP fica na mesma posição.
 * Duas pessoas empatadas em primeiro são as duas primeiras.
 */
const GLOBAL = `
  SELECT
    u.id, u.username, u.photo_url, u.level,
    u.xp::int                        AS score,
    RANK() OVER (ORDER BY u.xp DESC) AS rank
  FROM users u
`;

/**
 * Semanal: os últimos sete dias de `daily_activity`.
 *
 * O dia de cada linha já foi gravado no fuso de quem a ganhou — é a mesma
 * data que decide o streak dessa pessoa. A janela é contada em dias civis,
 * não em 168 horas, porque é assim que uma semana é entendida por quem a vive.
 */
const WEEKLY = `
  WITH semana AS (
    SELECT user_id, SUM(xp)::int AS score
      FROM daily_activity
     WHERE day >= (current_date - INTERVAL '6 days')
     GROUP BY user_id
    HAVING SUM(xp) > 0
  )
  SELECT
    u.id, u.username, u.photo_url, u.level,
    s.score,
    RANK() OVER (ORDER BY s.score DESC) AS rank
  FROM semana s
  JOIN users u ON u.id = s.user_id
`;

function toRow(row, meId) {
  return {
    rank: Number(row.rank),
    score: Number(row.score ?? 0),
    isMe: row.id === meId,
    user: {
      id: row.id,
      username: row.username,
      photoUrl: row.photo_url ?? null,
      level: Number(row.level ?? 1),
    },
  };
}

router.get(
  "/",
  validate({ query: leaderboardSchema }),
  asyncHandler(async (req, res) => {
    const { scope, limit } = req.valid.query;
    const base = scope === "weekly" ? WEEKLY : GLOBAL;

    const { rows } = await query(
      `WITH classificados AS (${base})
       SELECT * FROM classificados ORDER BY rank, username LIMIT $1`,
      [limit],
    );

    // A minha linha vai à parte: quem está em 84.º quer ver onde está sem ter
    // de descer uma lista inteira — e pode nem sequer estar nela.
    const { rows: minhas } = await query(
      `WITH classificados AS (${base})
       SELECT * FROM classificados WHERE id = $1`,
      [req.user.id],
    );

    res.json({
      scope,
      entries: rows.map((row) => toRow(row, req.user.id)),
      me: minhas[0] ? toRow(minhas[0], req.user.id) : null,
    });
  }),
);

export default router;
