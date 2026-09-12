import { Router } from "express";
import { getPool, query } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { challengeEntrySchema, idParamSchema } from "../schemas/index.js";
import { toChallenge, toChallengeEntry } from "../lib/mappers.js";
import { canEnterChallenge, canLeaveChallenge } from "../domain/challenges.js";
import { awardXp } from "../lib/xpLedger.js";

const router = Router();

router.use(requireAuth);

/**
 * `$1` é o utilizador autenticado: traz a contagem de participações e a
 * participação dele, para o cartão não ter de fazer um segundo pedido só para
 * saber se o botão diz "Participar" ou "Retirar".
 */
const SELECT_CHALLENGE = `
  SELECT
    c.id, c.title, c.description, c.xp_reward, c.image_url, c.ends_at, c.created_at,
    (SELECT COUNT(*) FROM challenge_entries e WHERE e.challenge_id = c.id) AS entries_count,
    mine.recipe_id  AS my_entry_recipe_id,
    mine.created_at AS my_entry_created_at
  FROM challenges c
  LEFT JOIN challenge_entries mine
         ON mine.challenge_id = c.id AND mine.user_id = $1
`;

/** As participações de um desafio, já com a receita e o autor. */
const SELECT_ENTRIES = `
  SELECT
    e.id AS entry_id, e.created_at AS entered_at,
    r.id, r.author_id, r.title, r.description, r.ingredients,
    r.cook_time_min, r.difficulty, r.xp_reward, r.image_url, r.created_at,
    u.username  AS author_username,
    u.level     AS author_level,
    u.photo_url AS author_photo,
    (SELECT COUNT(*) FROM recipe_likes rl WHERE rl.recipe_id = r.id) AS likes_count,
    (SELECT COUNT(*) FROM comments cm     WHERE cm.recipe_id = r.id) AS comments_count,
    EXISTS (
      SELECT 1 FROM recipe_likes rl WHERE rl.recipe_id = r.id AND rl.user_id = $1
    ) AS liked_by_me
  FROM challenge_entries e
  JOIN recipes r ON r.id = e.recipe_id
  JOIN users   u ON u.id = r.author_id
  WHERE e.challenge_id = $2
  ORDER BY e.created_at DESC
  LIMIT 100
`;

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `${SELECT_CHALLENGE}
        ORDER BY (c.ends_at > now()) DESC, c.ends_at ASC
        LIMIT 50`,
      [req.user.id],
    );
    res.json({ challenges: rows.map(toChallenge) });
  }),
);

router.get(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const { rows } = await query(`${SELECT_CHALLENGE} WHERE c.id = $2`, [
      req.user.id,
      req.valid.params.id,
    ]);
    if (!rows[0]) return res.status(404).json({ error: "Desafio não encontrado" });

    const { rows: entries } = await query(SELECT_ENTRIES, [req.user.id, req.valid.params.id]);

    res.json({
      challenge: toChallenge(rows[0]),
      entries: entries.map(toChallengeEntry),
    });
  }),
);

/* ---------------------------------------------------------------- *
 * Participação
 * ---------------------------------------------------------------- */

/**
 * Submeter uma receita própria a um desafio a decorrer.
 *
 * O XP é atribuído pelo livro-razão com `source_ref = challengeId`, o que faz
 * duas coisas de uma vez: repetir o pedido não paga outra vez, e sair e voltar
 * a entrar também não. O prémio é por desafio, não por submissão.
 */
router.post(
  "/:id/entries",
  validate({ params: idParamSchema, body: challengeEntrySchema }),
  asyncHandler(async (req, res) => {
    const challengeId = req.valid.params.id;
    const { recipeId } = req.valid.body;

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // FOR UPDATE no desafio: duas submissões em paralelo do mesmo
      // utilizador serializam aqui em vez de bater no UNIQUE.
      const { rows: challengeRows } = await client.query(
        `SELECT id, ends_at, xp_reward FROM challenges WHERE id = $1 FOR UPDATE`,
        [challengeId],
      );
      if (!challengeRows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Desafio não encontrado" });
      }

      const { rows: facts } = await client.query(
        `SELECT
           (SELECT author_id FROM recipes WHERE id = $1)                        AS recipe_author_id,
           EXISTS (SELECT 1 FROM challenge_entries
                    WHERE challenge_id = $2 AND user_id = $3)                   AS already_entered,
           EXISTS (SELECT 1 FROM challenge_entries WHERE recipe_id = $1)        AS recipe_entered,
           (SELECT time_zone FROM users WHERE id = $3)                          AS time_zone`,
        [recipeId, challengeId, req.user.id],
      );

      const verdict = canEnterChallenge({
        endsAt: challengeRows[0].ends_at,
        recipeAuthorId: facts[0].recipe_author_id,
        userId: req.user.id,
        alreadyEntered: facts[0].already_entered,
        recipeEntered: facts[0].recipe_entered,
      });

      if (!verdict.ok) {
        await client.query("ROLLBACK");
        const status = verdict.reason === "notOwner" ? 403 : 409;
        return res.status(status).json({ error: verdict.message });
      }

      await client.query(
        `INSERT INTO challenge_entries (challenge_id, user_id, recipe_id)
         VALUES ($1, $2, $3)`,
        [challengeId, req.user.id, recipeId],
      );

      const award = await awardXp(client, {
        userId: req.user.id,
        source: "challenge",
        sourceRef: challengeId,
        amount: Number(challengeRows[0].xp_reward ?? 0),
        timeZone: facts[0].time_zone ?? "UTC",
      });

      const { rows } = await client.query(`${SELECT_CHALLENGE} WHERE c.id = $2`, [
        req.user.id,
        challengeId,
      ]);

      await client.query("COMMIT");

      res.status(201).json({
        challenge: toChallenge(rows[0]),
        xp: { earned: award.amount, total: award.xp, level: award.level },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

/**
 * Retirar a participação enquanto o desafio corre.
 *
 * O evento de XP fica no livro-razão de propósito: o ponto já foi ganho e o
 * livro-razão regista o que aconteceu, não o que é verdade agora. O efeito
 * lateral é bom — voltar a entrar não volta a pagar.
 */
router.delete(
  "/:id/entries",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const challengeId = req.valid.params.id;

    const { rows: challengeRows } = await query(`SELECT ends_at FROM challenges WHERE id = $1`, [
      challengeId,
    ]);
    if (!challengeRows[0]) return res.status(404).json({ error: "Desafio não encontrado" });

    const verdict = canLeaveChallenge({ endsAt: challengeRows[0].ends_at });
    if (!verdict.ok) return res.status(409).json({ error: verdict.message });

    const removed = await query(
      `DELETE FROM challenge_entries WHERE challenge_id = $1 AND user_id = $2`,
      [challengeId, req.user.id],
    );
    if (removed.rowCount === 0) {
      return res.status(404).json({ error: "Não estás a participar neste desafio" });
    }

    const { rows } = await query(`${SELECT_CHALLENGE} WHERE c.id = $2`, [req.user.id, challengeId]);
    res.json({ challenge: toChallenge(rows[0]) });
  }),
);

export default router;
