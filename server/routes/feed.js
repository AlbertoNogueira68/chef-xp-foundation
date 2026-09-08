import { Router } from "express";
import { query } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  commentCreateSchema,
  feedListSchema,
  postCommentParamSchema,
  postParamSchema,
} from "../schemas/index.js";
import { decodeCursor, encodeCursor, toComment } from "../lib/mappers.js";
import { feedCursorFrom, isValidFeedCursor, nextOffset, toFeedItem } from "../domain/feed.js";

const router = Router();
router.use(requireAuth);

/**
 * O feed é a união de duas coisas com o mesmo peso: um cozinhado — uma missão
 * terminada e partilhada — e uma receita publicada.
 *
 * Até aqui lia só de `recipes`. Os posts eram escritos ao concluir uma missão
 * e nunca lidos fora do perfil, ou seja, a regra que o projeto defende — o
 * caminho para o feed é cozinhar — não estava visível em lado nenhum.
 *
 * As duas metades trazem exactamente as mesmas colunas para o UNION poder
 * existir; o que não se aplica a uma delas vem a NULL com o tipo declarado,
 * porque o Postgres não infere o tipo de um NULL num UNION.
 *
 * `$1` é sempre o utilizador autenticado: serve para saber se já gostou de
 * cada linha sem um segundo pedido.
 */
const FEED_UNION = `
  SELECT
    'cook'::text AS kind,
    p.id::text   AS item_id,
    p.created_at,
    p.user_id    AS author_id,
    u.username   AS author_username,
    u.level      AS author_level,
    u.photo_url  AS author_photo,
    p.image_url,
    p.caption,
    p.level_at,
    p.mission_id,
    p.run_id,
    mr.started_at,
    mr.completed_at,
    NULL::text AS title,
    NULL::text AS description,
    NULL::text AS ingredients,
    NULL::int  AS cook_time_min,
    NULL::text AS difficulty,
    NULL::int  AS xp_reward,
    (SELECT count(*) FROM post_likes pl    WHERE pl.post_id = p.id) AS likes_count,
    (SELECT count(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comments_count,
    EXISTS (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $1) AS liked_by_me
  FROM posts p
  JOIN users u        ON u.id = p.user_id
  JOIN mission_runs mr ON mr.id = p.run_id

  UNION ALL

  SELECT
    'recipe'::text AS kind,
    r.id::text     AS item_id,
    r.created_at,
    r.author_id,
    u.username     AS author_username,
    u.level        AS author_level,
    u.photo_url    AS author_photo,
    r.image_url,
    NULL::text        AS caption,
    NULL::int         AS level_at,
    NULL::text        AS mission_id,
    NULL::bigint      AS run_id,
    NULL::timestamptz AS started_at,
    NULL::timestamptz AS completed_at,
    r.title,
    r.description,
    r.ingredients,
    r.cook_time_min,
    r.difficulty,
    r.xp_reward,
    (SELECT count(*) FROM recipe_likes rl WHERE rl.recipe_id = r.id) AS likes_count,
    (SELECT count(*) FROM comments c      WHERE c.recipe_id = r.id)  AS comments_count,
    EXISTS (SELECT 1 FROM recipe_likes rl WHERE rl.recipe_id = r.id AND rl.user_id = $1) AS liked_by_me
  FROM recipes r
  JOIN users u ON u.id = r.author_id
`;

/**
 * Mesma popularidade que o feed de receitas já usava — gostos e comentários a
 * dividir por uma função da idade — mas agora aplicada às duas naturezas com a
 * mesma régua. Um cozinhado com 10 gostos há uma hora vence uma receita com 40
 * de há três dias, e vice-versa.
 */
const POPULAR_SCORE = `
  (f.likes_count + 2 * f.comments_count)::float
  / power(EXTRACT(EPOCH FROM (now() - f.created_at)) / 3600.0 + 2.0, 1.5)
`;

/**
 * A ordenação e o cursor têm de falar do mesmo tripleto. A data sozinha não
 * chega: dois cozinhados publicados no mesmo instante ficariam ambos de fora,
 * ou ambos repetidos, na página seguinte.
 */
const ORDER_BY_RECENT = "ORDER BY f.created_at DESC, f.kind DESC, f.item_id DESC";

router.get(
  "/",
  validate({ query: feedListSchema }),
  asyncHandler(async (req, res) => {
    const { scope, limit, cursor } = req.valid.query;

    const params = [req.user.id];
    const where = [];

    if (scope === "following") {
      where.push(`(
        f.author_id = $1
        OR EXISTS (SELECT 1 FROM follows fo WHERE fo.follower_id = $1 AND fo.followee_id = f.author_id)
      )`);
    }

    const parsedCursor = decodeCursor(cursor);
    let orderBy;
    let tail;

    if (scope === "popular") {
      // O score muda com o tempo, por isso não serve como chave de cursor:
      // esta metade pagina por deslocamento, como já acontecia nas receitas.
      const offset = Math.max(0, Number(parsedCursor?.offset ?? 0));
      orderBy = `ORDER BY ${POPULAR_SCORE} DESC, f.created_at DESC, f.kind DESC, f.item_id DESC`;
      params.push(limit + 1, offset);
      tail = `LIMIT $${params.length - 1} OFFSET $${params.length}`;
    } else {
      // Um cursor forjado ou de uma versão anterior é ignorado, não rejeitado:
      // devolve-se a primeira página em vez de partir o feed de quem tinha a
      // app aberta durante o deploy.
      if (isValidFeedCursor(parsedCursor)) {
        params.push(parsedCursor.createdAt, parsedCursor.kind, parsedCursor.id);
        where.push(
          `(f.created_at, f.kind, f.item_id) < ($${params.length - 2}::timestamptz, $${params.length - 1}, $${params.length})`,
        );
      }
      orderBy = ORDER_BY_RECENT;
      params.push(limit + 1);
      tail = `LIMIT $${params.length}`;
    }

    // O UNION é materializado antes de filtrar. À escala deste app é barato e
    // mantém a consulta legível; se um dia deixar de ser, o filtro desce para
    // dentro de cada metade.
    const { rows } = await query(
      `
      WITH f AS (${FEED_UNION})
      SELECT * FROM f
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ${orderBy}
      ${tail}
      `,
      params,
    );

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor = null;
    if (hasMore) {
      nextCursor =
        scope === "popular"
          ? encodeCursor({ offset: nextOffset(parsedCursor, limit) })
          : encodeCursor(feedCursorFrom(page[page.length - 1]));
    }

    res.json({ items: page.map(toFeedItem), nextCursor });
  }),
);

/* ---------------------------------------------------------------- *
 * Cozinhados: gostos e comentários
 *
 * Tabelas próprias, `post_likes` e `post_comments`. A alternativa era uma
 * coluna polimórfica em `recipe_likes`/`comments`, que obrigava a largar a
 * chave estrangeira — e é ela que garante que um gosto não sobrevive ao post.
 * ---------------------------------------------------------------- */

async function loadCook(userId, postId) {
  const { rows } = await query(
    `WITH f AS (${FEED_UNION})
     SELECT * FROM f WHERE f.kind = 'cook' AND f.item_id = $2`,
    [userId, String(postId)],
  );
  return rows[0] ? toFeedItem(rows[0]) : null;
}

async function respondWithCook(res, userId, postId) {
  const item = await loadCook(userId, postId);
  if (!item) return res.status(404).json({ error: "Cozinhado não encontrado" });
  return res.json({ item });
}

router.post(
  "/cooks/:postId/like",
  validate({ params: postParamSchema }),
  asyncHandler(async (req, res) => {
    const { postId } = req.valid.params;

    // Idempotente por construção: a chave primária composta não deixa haver
    // dois gostos da mesma pessoa no mesmo cozinhado.
    //
    // O `SELECT ... FROM posts` em vez de `VALUES` faz um post inexistente não
    // inserir nada em vez de rebentar na chave estrangeira — o 404 sai da
    // leitura a seguir, que é preciso na mesma para devolver a contagem.
    await query(
      `INSERT INTO post_likes (user_id, post_id)
       SELECT $1, id FROM posts WHERE id = $2
       ON CONFLICT DO NOTHING`,
      [req.user.id, postId],
    );

    return respondWithCook(res, req.user.id, postId);
  }),
);

router.delete(
  "/cooks/:postId/like",
  validate({ params: postParamSchema }),
  asyncHandler(async (req, res) => {
    await query(`DELETE FROM post_likes WHERE user_id = $1 AND post_id = $2`, [
      req.user.id,
      req.valid.params.postId,
    ]);
    return respondWithCook(res, req.user.id, req.valid.params.postId);
  }),
);

const SELECT_POST_COMMENT = `
  SELECT c.id, c.body, c.created_at, c.author_id,
         u.username  AS author_username,
         u.photo_url AS author_photo,
         u.level     AS author_level
  FROM post_comments c
  JOIN users u ON u.id = c.author_id
`;

router.get(
  "/cooks/:postId/comments",
  validate({ params: postParamSchema }),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `${SELECT_POST_COMMENT} WHERE c.post_id = $1 ORDER BY c.created_at ASC LIMIT 200`,
      [req.valid.params.postId],
    );
    res.json({ comments: rows.map(toComment) });
  }),
);

router.post(
  "/cooks/:postId/comments",
  validate({ params: postParamSchema, body: commentCreateSchema }),
  asyncHandler(async (req, res) => {
    const exists = await query(`SELECT 1 FROM posts WHERE id = $1`, [req.valid.params.postId]);
    if (exists.rowCount === 0) return res.status(404).json({ error: "Cozinhado não encontrado" });

    const { rows: inserted } = await query(
      `INSERT INTO post_comments (post_id, author_id, body) VALUES ($1, $2, $3) RETURNING id`,
      [req.valid.params.postId, req.user.id, req.valid.body.body],
    );

    const { rows } = await query(`${SELECT_POST_COMMENT} WHERE c.id = $1`, [inserted[0].id]);
    res.status(201).json({ comment: toComment(rows[0]) });
  }),
);

router.delete(
  "/cooks/:postId/comments/:commentId",
  validate({ params: postCommentParamSchema }),
  asyncHandler(async (req, res) => {
    const { rowCount } = await query(
      `DELETE FROM post_comments WHERE id = $1 AND author_id = $2 AND post_id = $3`,
      [req.valid.params.commentId, req.user.id, req.valid.params.postId],
    );
    if (rowCount === 0) return res.status(404).json({ error: "Comentário não encontrado" });
    res.status(204).end();
  }),
);

export default router;
