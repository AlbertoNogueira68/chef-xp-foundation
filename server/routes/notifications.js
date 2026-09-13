import { Router } from "express";
import { query } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { notificationListSchema, notificationIdParamSchema } from "../schemas/index.js";
import { toNotification } from "../lib/mappers.js";

const router = Router();

router.use(requireAuth);

/**
 * A notificação não guarda texto: junta quem fez, o quê e sobre o quê, e a
 * frase é construída na interface. Um utilizador que mude de nome não fica com
 * notificações a dizer o nome antigo.
 */
const SELECT_NOTIFICATION = `
  SELECT
    n.id, n.kind, n.recipe_id, n.comment_id, n.read_at, n.created_at,
    a.id        AS actor_id,
    a.username  AS actor_username,
    a.photo_url AS actor_photo,
    a.level     AS actor_level,
    r.title     AS recipe_title,
    r.image_url AS recipe_image,
    c.body      AS comment_body
  FROM notifications n
  JOIN users a         ON a.id = n.actor_id
  LEFT JOIN recipes r  ON r.id = n.recipe_id
  LEFT JOIN comments c ON c.id = n.comment_id
  WHERE n.user_id = $1
`;

router.get(
  "/",
  validate({ query: notificationListSchema }),
  asyncHandler(async (req, res) => {
    const { limit, unreadOnly } = req.valid.query;

    const { rows } = await query(
      `${SELECT_NOTIFICATION}
         ${unreadOnly ? "AND n.read_at IS NULL" : ""}
       ORDER BY n.created_at DESC
       LIMIT $2`,
      [req.user.id, limit],
    );

    const { rows: counts } = await query(
      `SELECT count(*)::int AS unread FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
      [req.user.id],
    );

    res.json({
      notifications: rows.map(toNotification),
      unread: counts[0].unread,
    });
  }),
);

/** Só a contagem — é o que o sino precisa de saber a cada carregamento. */
router.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT count(*)::int AS unread FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
      [req.user.id],
    );
    res.json({ unread: rows[0].unread });
  }),
);

/** Marcar tudo como lido. É o que abrir a caixa significa. */
router.post(
  "/read",
  asyncHandler(async (req, res) => {
    const { rowCount } = await query(
      `UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`,
      [req.user.id],
    );
    res.json({ marked: rowCount, unread: 0 });
  }),
);

router.post(
  "/:id/read",
  validate({ params: notificationIdParamSchema }),
  asyncHandler(async (req, res) => {
    const { rowCount } = await query(
      `UPDATE notifications SET read_at = now()
        WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
      [req.valid.params.id, req.user.id],
    );

    // 404 também quando a notificação é de outra pessoa: quem pergunta não
    // fica a saber que ela existe.
    if (rowCount === 0) {
      const { rows } = await query(`SELECT 1 FROM notifications WHERE id = $1 AND user_id = $2`, [
        req.valid.params.id,
        req.user.id,
      ]);
      if (!rows[0]) return res.status(404).json({ error: "Notificação não encontrada" });
    }

    res.status(204).end();
  }),
);

export default router;
