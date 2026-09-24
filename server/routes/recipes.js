import { Router } from "express";
import { getPool, query } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  commentCreateSchema,
  commentParamsSchema,
  idParamSchema,
  recipeCreateSchema,
  recipeListSchema,
  recipeUpdateSchema,
} from "../schemas/index.js";
import { decodeCursor, encodeCursor, toComment, toRecipe } from "../lib/mappers.js";
import { notBlockedSql } from "../lib/blocks.js";
import { roleOf } from "../lib/moderation.js";
import { commentDeleterRole } from "../domain/moderation.js";
import { resolveImageInput } from "../lib/imageStore.js";
import { awardXp, revokeXp } from "../lib/xpLedger.js";
import { notifyQuietly } from "../lib/notifications.js";
import { XP_RULES } from "../domain/xp.js";
import { canEnterChallenge } from "../domain/challenges.js";

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
    r.estimated_cost_eur, r.dietary_tags,
    u.username  AS author_username,
    u.level     AS author_level,
    u.photo_url AS author_photo,
    (SELECT COUNT(*) FROM recipe_likes rl WHERE rl.recipe_id = r.id) AS likes_count,
    (SELECT COUNT(*) FROM comments c       WHERE c.recipe_id = r.id) AS comments_count,
    EXISTS (
      SELECT 1 FROM recipe_likes rl WHERE rl.recipe_id = r.id AND rl.user_id = $1
    ) AS liked_by_me,
    ch.id    AS challenge_id,
    ch.title AS challenge_title
  FROM recipes r
  JOIN users u ON u.id = r.author_id
  -- O desafio a que a receita foi submetida, se foi a algum. LEFT JOIN e não
  -- subconsulta porque é no máximo uma linha: uma receita entra num desafio e
  -- só num, e quem a publica fá-lo já de dentro dele.
  LEFT JOIN challenge_entries ce ON ce.recipe_id = r.id
  LEFT JOIN challenges        ch ON ch.id = ce.challenge_id
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
    const { q, scope, difficulty, maxTime, maxCost, dietaryTags, authorId, limit, cursor } =
      req.valid.query;

    const params = [req.user.id];

    /**
     * O bloqueio não é um filtro entre outros: é a primeira condição e não
     * depende de nenhum parâmetro do pedido. Quem eu bloqueei, e quem me
     * bloqueou, não aparece — no feed, na pesquisa, nem na página do autor.
     */
    const where = [notBlockedSql("$1", "r.author_id")];

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

    if (maxCost !== undefined) {
      // Uma receita sem estimativa não passa por um filtro de orçamento: não
      // há como garantir que cabe no limite pedido.
      params.push(maxCost);
      where.push(`r.estimated_cost_eur IS NOT NULL AND r.estimated_cost_eur <= $${params.length}`);
    }

    if (dietaryTags?.length) {
      // Todas as etiquetas escolhidas têm de estar presentes — não basta uma.
      params.push(dietaryTags);
      where.push(`r.dietary_tags @> $${params.length}::text[]`);
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
    const { rows } = await query(
      // 404 e não 403 com bloqueio pelo meio: dizer "não podes ver esta" é
      // dizer que ela existe, e quem bloqueia não quer dar essa informação.
      `${SELECT_RECIPE} WHERE r.id = $2 AND ${notBlockedSql("$1", "r.author_id")}`,
      [req.user.id, req.valid.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Recipe not found" });
    res.json({ recipe: toRecipe(rows[0]) });
  }),
);

/**
 * Publicar uma receita — e, quando vem um `challengeId`, participar com ela.
 *
 * Participar num desafio é publicar. Não há um sítio onde se escolhe uma
 * receita já feita: quem entra num desafio cozinha para ele, e a receita que
 * daí sai é uma receita normal — aparece no feed, ganha gostos e comentários
 * como qualquer outra — com o desafio agarrado, que é o que o selo mostra.
 *
 * As duas coisas nascem na mesma transação. Se o desafio recusar a entrada
 * (acabou, ou a pessoa já gastou as submissões que lhe cabiam), a receita não
 * chega a ser publicada: quem carregou em "participar" não pediu para
 * publicar uma receita solta, e ficar com ela no feed sem estar no desafio
 * seria dar-lhe o contrário do que pediu.
 */
router.post(
  "/",
  validate({ body: recipeCreateSchema }),
  asyncHandler(async (req, res) => {
    const {
      title,
      description,
      ingredients,
      cookTimeMin,
      difficulty,
      estimatedCostEur,
      dietaryTags,
      imageDataUrl,
      challengeId,
    } = req.valid.body;

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

      /**
       * O desafio é trancado antes de a receita existir: é essa tranca que
       * faz a contagem de submissões valer alguma coisa. Sem ela, duas
       * publicações em paralelo passavam as duas o limite.
       */
      let challenge = null;
      if (challengeId) {
        const { rows: challengeRows } = await client.query(
          `SELECT id, title, starts_at, ends_at, xp_reward, max_entries_per_user
             FROM challenges WHERE id = $1 FOR UPDATE`,
          [challengeId],
        );
        challenge = challengeRows[0] ?? null;

        if (!challenge) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "Challenge not found" });
        }

        const { rows: counted } = await client.query(
          `SELECT COUNT(*)::int AS entry_count
             FROM challenge_entries WHERE challenge_id = $1 AND user_id = $2`,
          [challengeId, req.user.id],
        );

        const verdict = canEnterChallenge({
          startsAt: challenge.starts_at,
          endsAt: challenge.ends_at,
          // A receita é desta pessoa por construção: está a ser criada agora,
          // por ela, e ainda não está em desafio nenhum.
          recipeAuthorId: req.user.id,
          userId: req.user.id,
          entryCount: counted[0].entry_count,
          maxEntries: Number(challenge.max_entries_per_user ?? 1),
        });

        if (!verdict.ok) {
          await client.query("ROLLBACK");
          return res.status(409).json({ error: verdict.message });
        }
      }

      const { rows: created } = await client.query(
        `INSERT INTO recipes (author_id, title, description, ingredients, cook_time_min, difficulty, xp_reward, image_url, estimated_cost_eur, dietary_tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
          estimatedCostEur ?? null,
          dietaryTags ?? [],
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

      /**
       * O XP do desafio é pago com `source_ref = challengeId`, portanto é uma
       * vez por desafio e não por foto: quem publica as três que o desafio
       * permite ganha o XP de participação uma vez, e as três contam é para o
       * pódio no fim.
       */
      let challengeAward = null;
      if (challenge) {
        await client.query(
          `INSERT INTO challenge_entries (challenge_id, user_id, recipe_id)
           VALUES ($1, $2, $3)`,
          [challenge.id, req.user.id, recipeId],
        );

        challengeAward = await awardXp(client, {
          userId: req.user.id,
          source: "challenge",
          sourceRef: challenge.id,
          amount: Number(challenge.xp_reward ?? 0),
          timeZone,
        });
      }

      const { rows } = await client.query(`${SELECT_RECIPE} WHERE r.id = $2`, [
        req.user.id,
        recipeId,
      ]);

      await client.query("COMMIT");

      /**
       * Os dois ganhos somam-se numa resposta só: quem publicou dentro de um
       * desafio ganhou o XP da receita e o da participação ao mesmo tempo, e
       * a interface tem uma frase para dizer, não duas.
       */
      const earned = award.amount + (challengeAward?.amount ?? 0);
      const totals = challengeAward ?? award;

      res.status(201).json({
        recipe: toRecipe(rows[0]),
        xp: { earned, total: totals.xp, level: totals.level },
        challenge: challenge ? { id: challenge.id, title: challenge.title } : null,
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
    res.status(404).json({ error: "Recipe not found" });
    return null;
  }
  if (rows[0].author_id !== req.user.id) {
    res.status(403).json({ error: "This recipe isn't yours" });
    return null;
  }
  return rows[0];
}

router.patch(
  "/:id",
  validate({ params: idParamSchema, body: recipeUpdateSchema }),
  asyncHandler(async (req, res) => {
    if (!(await requireOwnRecipe(req, res))) return;

    const {
      title,
      description,
      ingredients,
      cookTimeMin,
      difficulty,
      estimatedCostEur,
      dietaryTags,
      imageDataUrl,
    } = req.valid.body;

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
    // `null` explícito retira a estimativa; ausente mantém a que lá está.
    if (estimatedCostEur !== undefined) set("estimated_cost_eur", estimatedCostEur);
    if (dietaryTags !== undefined) set("dietary_tags", dietaryTags);
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
  const { rows } = await query(
    `${SELECT_RECIPE} WHERE r.id = $2 AND ${notBlockedSql("$1", "r.author_id")}`,
    [userId, recipeId],
  );
  if (!rows[0]) return res.status(404).json({ error: "Recipe not found" });
  return res.json({ recipe: toRecipe(rows[0]) });
}

router.post(
  "/:id/like",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT r.author_id FROM recipes r
        WHERE r.id = $2 AND ${notBlockedSql("$1", "r.author_id")}`,
      [req.user.id, req.valid.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Recipe not found" });

    await query(
      `INSERT INTO recipe_likes (user_id, recipe_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.user.id, req.valid.params.id],
    );

    // Depois do gosto estar registado: se a notificação falhar, o gosto fica.
    await notifyQuietly(getPool(), {
      userId: rows[0].author_id,
      actorId: req.user.id,
      kind: "like",
      recipeId: req.valid.params.id,
    });

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
      `${SELECT_COMMENT}
        WHERE c.recipe_id = $2 AND ${notBlockedSql("$1", "c.author_id")}
        ORDER BY c.created_at ASC LIMIT 200`,
      [req.user.id, req.valid.params.id],
    );
    res.json({ comments: rows.map(toComment) });
  }),
);

router.post(
  "/:id/comments",
  validate({ params: idParamSchema, body: commentCreateSchema }),
  asyncHandler(async (req, res) => {
    const { rows: recipeRows } = await query(
      `SELECT r.author_id FROM recipes r
        WHERE r.id = $2 AND ${notBlockedSql("$1", "r.author_id")}`,
      [req.user.id, req.valid.params.id],
    );
    if (!recipeRows[0]) return res.status(404).json({ error: "Recipe not found" });

    const { rows: inserted } = await query(
      `INSERT INTO comments (recipe_id, author_id, body) VALUES ($1, $2, $3) RETURNING id`,
      [req.valid.params.id, req.user.id, req.valid.body.body],
    );

    // Cada comentário é um acontecimento novo, por isso leva o seu id: dois
    // comentários da mesma pessoa são duas notificações.
    await notifyQuietly(getPool(), {
      userId: recipeRows[0].author_id,
      actorId: req.user.id,
      kind: "comment",
      recipeId: req.valid.params.id,
      commentId: inserted[0].id,
    });

    const { rows } = await query(`${SELECT_COMMENT} WHERE c.id = $1`, [inserted[0].id]);
    res.status(201).json({ comment: toComment(rows[0]) });
  }),
);

/**
 * Apagar um comentário — três direitos diferentes, não um.
 *
 * O autor apaga o que escreveu. O dono da receita limpa a própria página: era
 * isto que não existia, e sem isso quem publicava não tinha maneira nenhuma de
 * tirar um insulto de baixo da sua fotografia — só lhe restava apagar a
 * receita inteira e perder o XP com ela. O moderador apaga o que lhe chega por
 * denúncia.
 *
 * A distinção entre 404 e 403 é deliberada: não existe é 404, existe mas não é
 * teu é 403. O 404 para tudo, que era o que estava, escondia o erro de quem
 * tentava apagar o comentário certo sem ter direito a ele.
 */
router.delete(
  "/:id/comments/:commentId",
  validate({ params: commentParamsSchema }),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT c.author_id, r.author_id AS recipe_author_id
         FROM comments c
         JOIN recipes r ON r.id = c.recipe_id
        WHERE c.id = $1 AND c.recipe_id = $2`,
      [req.valid.params.commentId, req.valid.params.id],
    );

    const comment = rows[0];
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    const deleter = commentDeleterRole({
      userId: req.user.id,
      role: await roleOf(req.user.id),
      commentAuthorId: comment.author_id,
      recipeAuthorId: comment.recipe_author_id,
    });

    if (!deleter) {
      return res.status(403).json({ error: "This comment isn't yours" });
    }

    await query(`DELETE FROM comments WHERE id = $1`, [req.valid.params.commentId]);
    res.status(204).end();
  }),
);

export default router;
