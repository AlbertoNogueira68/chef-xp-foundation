import { Router } from "express";
import { getPool, query } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  commentCreateSchema,
  idParamSchema,
  recipeCreateSchema,
  recipeListSchema,
  recipeUpdateSchema,
} from "../schemas/index.js";
import { decodeCursor, encodeCursor, toComment, toRecipe } from "../lib/mappers.js";
import { resolveImageInput } from "../lib/imageStore.js";
import { awardXp, revokeXp } from "../lib/xpLedger.js";
import { XP_RULES } from "../domain/xp.js";

const router = Router();

router.use(requireAuth);

/**
 * `$1` é sempre o utilizador autenticado: serve para saber se ele já gostou
 * da receita sem um segundo pedido.
 */
const SELECT_RECIPE = `
  SELECT
    r.id, r.author_id, r.title, r.description, r.ingredients,
    r.cook_time_min, r.difficulty, r.xp_reward, r.image_url, r.created_at,
    u.username  AS author_username,
    u.level     AS author_level,
    u.photo_url AS author_photo,
    (SELECT COUNT(*) FROM recipe_likes rl WHERE rl.recipe_id = r.id) AS likes_count,
    (SELECT COUNT(*) FROM comments c       WHERE c.recipe_id = r.id) AS comments_count,
    EXISTS (
      SELECT 1 FROM recipe_likes rl WHERE rl.recipe_id = r.id AND rl.user_id = $1
    ) AS liked_by_me
  FROM recipes r
  JOIN users u ON u.id = r.author_id
`;

/**
 * Popularidade com decaimento no tempo: gostos e comentários a dividir por uma
 * função da idade do post. Uma receita com 10 gostos há uma hora vence uma com
 * 40 gostos de há três dias. Simples de explicar e suficiente à escala do app.
 */
const POPULAR_SCORE = `
  (
    (SELECT COUNT(*) FROM recipe_likes rl WHERE rl.recipe_id = r.id)
    + 2 * (SELECT COUNT(*) FROM comments c WHERE c.recipe_id = r.id)
  )::float
  / power(EXTRACT(EPOCH FROM (now() - r.created_at)) / 3600.0 + 2.0, 1.5)
`;

router.get(
  "/",
  validate({ query: recipeListSchema }),
  asyncHandler(async (req, res) => {
    const { q, scope, difficulty, maxTime, authorId, limit, cursor } = req.valid.query;

    const params = [req.user.id];
    const where = [];

    if (scope === "following") {
      where.push(`(
        r.author_id = $1
        OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followee_id = r.author_id)
      )`);
    }

    if (q) {
      params.push(`%${q}%`);
      const i = params.length;
      // Coberto pelos índices GIN trigram criados na migration 003.
      where.push(`(r.title ILIKE $${i} OR r.description ILIKE $${i} OR u.username ILIKE $${i})`);
    }

    if (difficulty) {
      params.push(difficulty);
      where.push(`r.difficulty = $${params.length}`);
    }

    if (maxTime) {
      params.push(maxTime);
      where.push(`r.cook_time_min <= $${params.length}`);
    }

    if (authorId) {
      params.push(authorId);
      where.push(`r.author_id = $${params.length}`);
    }

    const parsedCursor = decodeCursor(cursor);
    let orderBy;
    let tail;

    if (scope === "popular") {
      // Ordenação por score não é monotónica no tempo, por isso pagina por
      // deslocamento em vez de cursor de chave.
      const offset = Math.max(0, Number(parsedCursor?.offset ?? 0));
      orderBy = `ORDER BY ${POPULAR_SCORE} DESC, r.created_at DESC, r.id DESC`;
      params.push(limit + 1, offset);
      tail = `LIMIT $${params.length - 1} OFFSET $${params.length}`;
    } else {
      if (parsedCursor?.createdAt && parsedCursor?.id) {
        params.push(parsedCursor.createdAt, parsedCursor.id);
        where.push(
          `(r.created_at, r.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`,
        );
      }
      orderBy = "ORDER BY r.created_at DESC, r.id DESC";
      params.push(limit + 1);
      tail = `LIMIT $${params.length}`;
    }

    const sql = `
      ${SELECT_RECIPE}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ${orderBy}
      ${tail}
    `;

    const { rows } = await query(sql, params);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const recipes = page.map(toRecipe);

    let nextCursor = null;
    if (hasMore) {
      if (scope === "popular") {
        const offset = Math.max(0, Number(parsedCursor?.offset ?? 0));
        nextCursor = encodeCursor({ offset: offset + limit });
      } else {
        const last = page[page.length - 1];
        nextCursor = encodeCursor({ createdAt: last.created_at, id: last.id });
      }
    }

    res.json({ recipes, nextCursor });
  }),
);

router.get(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const { rows } = await query(`${SELECT_RECIPE} WHERE r.id = $2`, [
      req.user.id,
      req.valid.params.id,
    ]);
    if (!rows[0]) return res.status(404).json({ error: "Receita não encontrada" });
    res.json({ recipe: toRecipe(rows[0]) });
  }),
);

router.post(
  "/",
  validate({ body: recipeCreateSchema }),
  asyncHandler(async (req, res) => {
    const { title, description, ingredients, cookTimeMin, difficulty, imageDataUrl } =
      req.valid.body;

    // Grava a imagem antes de abrir a transação: I/O de disco não pertence
    // dentro de uma transação de base de dados.
    const imageUrl = await resolveImageInput(imageDataUrl ?? null);

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const { rows: userRows } = await client.query(
        `SELECT time_zone FROM users WHERE id = $1 FOR UPDATE`,
        [req.user.id],
      );
      const timeZone = userRows[0]?.time_zone ?? "UTC";

      const { rows: created } = await client.query(
        `INSERT INTO recipes (author_id, title, description, ingredients, cook_time_min, difficulty, xp_reward, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          req.user.id,
          title,
          description,
          ingredients,
          cookTimeMin,
          difficulty,
          XP_RULES.recipePublished,
          imageUrl,
        ],
      );

      const recipeId = created[0].id;

      // XP e receita na mesma transação: ou acontecem as duas, ou nenhuma.
      const award = await awardXp(client, {
        userId: req.user.id,
        source: "recipe",
        sourceRef: recipeId,
        amount: XP_RULES.recipePublished,
        timeZone,
      });

      const { rows } = await client.query(`${SELECT_RECIPE} WHERE r.id = $2`, [
        req.user.id,
        recipeId,
      ]);

      await client.query("COMMIT");

      res.status(201).json({
        recipe: toRecipe(rows[0]),
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

/* ---------------------------------------------------------------- *
 * Editar e apagar — só o autor
 * ---------------------------------------------------------------- */

/**
 * Confirma que a receita existe e é de quem pede.
 * Responde e devolve `null` quando não é, para a rota poder sair já.
 */
async function requireOwnRecipe(req, res, client = null) {
  const run = client ? (text, params) => client.query(text, params) : query;
  const { rows } = await run(`SELECT author_id FROM recipes WHERE id = $1`, [req.valid.params.id]);

  if (!rows[0]) {
    res.status(404).json({ error: "Receita não encontrada" });
    return null;
  }
  if (rows[0].author_id !== req.user.id) {
    res.status(403).json({ error: "Esta receita não é tua" });
    return null;
  }
  return rows[0];
}

router.patch(
  "/:id",
  validate({ params: idParamSchema, body: recipeUpdateSchema }),
  asyncHandler(async (req, res) => {
    if (!(await requireOwnRecipe(req, res))) return;

    const { title, description, ingredients, cookTimeMin, difficulty, imageDataUrl } =
      req.valid.body;

    const fields = [];
    const values = [];
    const set = (column, value) => {
      values.push(value);
      fields.push(`${column} = $${values.length}`);
    };

    if (title !== undefined) set("title", title);
    if (description !== undefined) set("description", description);
    if (ingredients !== undefined) set("ingredients", ingredients);
    if (cookTimeMin !== undefined) set("cook_time_min", cookTimeMin);
    if (difficulty !== undefined) set("difficulty", difficulty);
    if (imageDataUrl !== undefined) {
      // Como na publicação: a imagem é gravada fora de qualquer transação, e
      // `null` retira a fotografia em vez de a manter.
      set("image_url", imageDataUrl === null ? null : await resolveImageInput(imageDataUrl));
    }

    values.push(req.valid.params.id);
    await query(`UPDATE recipes SET ${fields.join(", ")} WHERE id = $${values.length}`, values);

    return respondWithRecipe(res, req.user.id, req.valid.params.id);
  }),
);

/**
 * Apagar leva o XP atrás.
 *
 * Gostos, comentários e participações em desafios caem por `ON DELETE
 * CASCADE`; o XP não, porque `xp_events.source_ref` é texto e não uma chave
 * estrangeira. Sem o revogar à mão, publicar e apagar em ciclo era uma forma
 * de somar XP por receitas que já não existem.
 */
router.delete(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      if (!(await requireOwnRecipe(req, res, client))) {
        await client.query("ROLLBACK");
        return;
      }

      const { rows: userRows } = await client.query(
        `SELECT time_zone FROM users WHERE id = $1 FOR UPDATE`,
        [req.user.id],
      );

      await client.query(`DELETE FROM recipes WHERE id = $1`, [req.valid.params.id]);

      const revoked = await revokeXp(client, {
        userId: req.user.id,
        source: "recipe",
        sourceRef: req.valid.params.id,
        timeZone: userRows[0]?.time_zone ?? "UTC",
      });

      await client.query("COMMIT");

      res.json({ xp: { revoked: revoked.amount, total: revoked.xp, level: revoked.level } });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

/* ---------------------------------------------------------------- *
 * Gostos — idempotentes por construção (PK composta)
 * ---------------------------------------------------------------- */

async function respondWithRecipe(res, userId, recipeId) {
  const { rows } = await query(`${SELECT_RECIPE} WHERE r.id = $2`, [userId, recipeId]);
  if (!rows[0]) return res.status(404).json({ error: "Receita não encontrada" });
  return res.json({ recipe: toRecipe(rows[0]) });
}

router.post(
  "/:id/like",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const exists = await query(`SELECT 1 FROM recipes WHERE id = $1`, [req.valid.params.id]);
    if (exists.rowCount === 0) return res.status(404).json({ error: "Receita não encontrada" });

    await query(
      `INSERT INTO recipe_likes (user_id, recipe_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.user.id, req.valid.params.id],
    );
    return respondWithRecipe(res, req.user.id, req.valid.params.id);
  }),
);

router.delete(
  "/:id/like",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await query(`DELETE FROM recipe_likes WHERE user_id = $1 AND recipe_id = $2`, [
      req.user.id,
      req.valid.params.id,
    ]);
    return respondWithRecipe(res, req.user.id, req.valid.params.id);
  }),
);

/* ---------------------------------------------------------------- *
 * Comentários
 * ---------------------------------------------------------------- */

const SELECT_COMMENT = `
  SELECT c.id, c.body, c.created_at, c.author_id,
         u.username AS author_username,
         u.photo_url AS author_photo,
         u.level AS author_level
  FROM comments c
  JOIN users u ON u.id = c.author_id
`;

router.get(
  "/:id/comments",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `${SELECT_COMMENT} WHERE c.recipe_id = $1 ORDER BY c.created_at ASC LIMIT 200`,
      [req.valid.params.id],
    );
    res.json({ comments: rows.map(toComment) });
  }),
);

router.post(
  "/:id/comments",
  validate({ params: idParamSchema, body: commentCreateSchema }),
  asyncHandler(async (req, res) => {
    const exists = await query(`SELECT 1 FROM recipes WHERE id = $1`, [req.valid.params.id]);
    if (exists.rowCount === 0) return res.status(404).json({ error: "Receita não encontrada" });

    const { rows: inserted } = await query(
      `INSERT INTO comments (recipe_id, author_id, body) VALUES ($1, $2, $3) RETURNING id`,
      [req.valid.params.id, req.user.id, req.valid.body.body],
    );

    const { rows } = await query(`${SELECT_COMMENT} WHERE c.id = $1`, [inserted[0].id]);
    res.status(201).json({ comment: toComment(rows[0]) });
  }),
);

router.delete(
  "/:id/comments/:commentId",
  asyncHandler(async (req, res) => {
    const { rowCount } = await query(
      `DELETE FROM comments WHERE id = $1 AND author_id = $2 AND recipe_id = $3`,
      [req.params.commentId, req.user.id, req.params.id],
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: "Comentário não encontrado" });
    }
    res.status(204).end();
  }),
);

export default router;
