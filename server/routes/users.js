import { Router } from "express";
import { getPool, query } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { idParamSchema, userPatchSchema } from "../schemas/index.js";
import { toPublicUser } from "../lib/mappers.js";
import { loadDailyState } from "../lib/xpLedger.js";
import { badgesFor } from "../domain/xp.js";
import { resolveImageInput } from "../lib/imageStore.js";

const router = Router();

router.use(requireAuth);

const SELECT_USER = `
  SELECT id, username, email, photo_url, level, xp, time_zone, daily_xp_goal, created_at, updated_at
  FROM users
`;

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const { rows } = await query(`${SELECT_USER} WHERE id = $1`, [req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: "Utilizador não encontrado" });
    res.json({ user: toPublicUser(rows[0], { includeEmail: true }) });
  }),
);

router.patch(
  "/me",
  validate({ body: userPatchSchema }),
  asyncHandler(async (req, res) => {
    const { username, photoUrl, timeZone, dailyXpGoal } = req.valid.body;

    const fields = [];
    const values = [];

    if (username !== undefined) {
      values.push(username);
      fields.push(`username = $${values.length}`);
    }
    if (photoUrl !== undefined) {
      const resolved = photoUrl === null ? null : await resolveImageInput(photoUrl);
      values.push(resolved);
      fields.push(`photo_url = $${values.length}`);
    }
    if (timeZone !== undefined) {
      values.push(timeZone);
      fields.push(`time_zone = $${values.length}`);
    }
    if (dailyXpGoal !== undefined) {
      values.push(dailyXpGoal);
      fields.push(`daily_xp_goal = $${values.length}`);
    }

    values.push(req.user.id);

    try {
      const { rows } = await query(
        `UPDATE users SET ${fields.join(", ")} WHERE id = $${values.length}
         RETURNING id, username, email, photo_url, level, xp, time_zone, daily_xp_goal, created_at, updated_at`,
        values,
      );
      if (!rows[0]) return res.status(404).json({ error: "Utilizador não encontrado" });
      res.json({ user: toPublicUser(rows[0], { includeEmail: true }) });
    } catch (error) {
      if (error?.code === "23505") {
        return res.status(409).json({ error: "Esse nome de utilizador já está em uso" });
      }
      throw error;
    }
  }),
);

/**
 * Chefs a sugerir: quem o utilizador ainda não segue, ordenado por número de
 * seguidores. Substitui a lista fixa que estava em constants/demo.ts.
 */
router.get(
  "/suggestions",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT u.id, u.username, u.email, u.photo_url, u.level, u.xp, u.created_at, u.updated_at,
              (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id) AS followers,
              (SELECT COUNT(*) FROM recipes r WHERE r.author_id = u.id)   AS recipes
         FROM users u
        WHERE u.id <> $1
          AND NOT EXISTS (
            SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followee_id = u.id
          )
        ORDER BY followers DESC, u.xp DESC
        LIMIT 8`,
      [req.user.id],
    );

    res.json({
      users: rows.map((row) => ({
        ...toPublicUser(row),
        followers: Number(row.followers),
        recipes: Number(row.recipes),
      })),
    });
  }),
);

router.get(
  "/:id",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const isMe = req.valid.params.id === req.user.id;
    const { rows } = await query(`${SELECT_USER} WHERE id = $1`, [req.valid.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Utilizador não encontrado" });
    res.json({ user: toPublicUser(rows[0], { includeEmail: isMe }) });
  }),
);

/**
 * Estatísticas de perfil — todas derivadas de tabelas reais.
 * Substitui DEMO_PROFILE_STATS.
 */
router.get(
  "/:id/stats",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const userId = req.valid.params.id;

    const { rows } = await query(
      `SELECT
         u.id, u.level, u.xp, u.time_zone,
         (SELECT COUNT(*) FROM recipes r        WHERE r.author_id = u.id)   AS recipes,
         (SELECT COUNT(*) FROM follows f        WHERE f.followee_id = u.id) AS followers,
         (SELECT COUNT(*) FROM follows f        WHERE f.follower_id = u.id) AS following,
         (SELECT COUNT(*) FROM lesson_progress l WHERE l.user_id = u.id)    AS lessons,
         (SELECT COUNT(*) FROM recipe_likes rl
            JOIN recipes r2 ON r2.id = rl.recipe_id
           WHERE r2.author_id = u.id)                                       AS likes_received,
         EXISTS (
           SELECT 1 FROM follows f WHERE f.follower_id = $2 AND f.followee_id = u.id
         ) AS is_following
       FROM users u WHERE u.id = $1`,
      [userId, req.user.id],
    );

    const row = rows[0];
    if (!row) return res.status(404).json({ error: "Utilizador não encontrado" });

    const daily = await loadDailyState(getPool(), userId, { timeZone: row.time_zone });

    const stats = {
      recipes: Number(row.recipes),
      followers: Number(row.followers),
      following: Number(row.following),
      lessonsCompleted: Number(row.lessons),
      likesReceived: Number(row.likes_received),
      streak: daily.streak,
      isFollowing: Boolean(row.is_following),
      isMe: userId === req.user.id,
    };

    res.json({
      stats: {
        ...stats,
        badges: badgesFor({
          recipes: stats.recipes,
          lessons: stats.lessonsCompleted,
          streak: stats.streak,
          level: Number(row.level),
          likes: stats.likesReceived,
        }),
      },
    });
  }),
);

/* ---------------------------------------------------------------- *
 * Seguir / deixar de seguir
 * ---------------------------------------------------------------- */

router.post(
  "/:id/follow",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    if (req.valid.params.id === req.user.id) {
      return res.status(400).json({ error: "Não te podes seguir a ti próprio" });
    }

    const target = await query(`SELECT 1 FROM users WHERE id = $1`, [req.valid.params.id]);
    if (target.rowCount === 0) {
      return res.status(404).json({ error: "Utilizador não encontrado" });
    }

    await query(
      `INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.user.id, req.valid.params.id],
    );
    res.json({ following: true });
  }),
);

router.delete(
  "/:id/follow",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await query(`DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2`, [
      req.user.id,
      req.valid.params.id,
    ]);
    res.json({ following: false });
  }),
);

export default router;
