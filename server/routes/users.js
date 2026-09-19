import { Router } from "express";
import { getPool, query } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  accountDeleteSchema,
  followListSchema,
  idParamSchema,
  userPatchSchema,
} from "../schemas/index.js";
import { toPublicUser } from "../lib/mappers.js";
import { blockExistsBetween, notBlockedSql } from "../lib/blocks.js";
import { loadDailyState } from "../lib/xpLedger.js";
import bcrypt from "bcryptjs";
import { badgesFor } from "../domain/xp.js";
import { resolveImageInput } from "../lib/imageStore.js";
import { notifyQuietly } from "../lib/notifications.js";
import { clearAuthCookie } from "../middleware/auth.js";
import { clearCsrfToken } from "../middleware/csrf.js";

const router = Router();

router.use(requireAuth);

const SELECT_USER = `
  SELECT id, username, email, photo_url, level, xp, time_zone, daily_xp_goal, email_verified_at, role, created_at, updated_at
  FROM users
`;

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const { rows } = await query(`${SELECT_USER} WHERE id = $1`, [req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: "User not found" });
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
         RETURNING id, username, email, photo_url, level, xp, time_zone, daily_xp_goal, email_verified_at, role, created_at, updated_at`,
        values,
      );
      if (!rows[0]) return res.status(404).json({ error: "User not found" });
      res.json({ user: toPublicUser(rows[0], { includeEmail: true }) });
    } catch (error) {
      if (error?.code === "23505") {
        return res.status(409).json({ error: "That username is already taken" });
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
          AND ${notBlockedSql("$1", "u.id")}
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
    if (!rows[0]) return res.status(404).json({ error: "User not found" });
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
         (SELECT COUNT(*) FROM mission_runs mr
           WHERE mr.user_id = u.id AND mr.status = 'completed')             AS cooked,
         (SELECT COUNT(*) FROM recipe_likes rl
            JOIN recipes r2 ON r2.id = rl.recipe_id
           WHERE r2.author_id = u.id)                                       AS likes_received,
         EXISTS (
           SELECT 1 FROM follows f WHERE f.follower_id = $2 AND f.followee_id = u.id
         ) AS is_following,
         -- Só o meu lado do bloqueio. Que a outra pessoa me tenha bloqueado
         -- não se diz a ninguém: era transformar o bloqueio num aviso.
         EXISTS (
           SELECT 1 FROM user_blocks b WHERE b.blocker_id = $2 AND b.blocked_id = u.id
         ) AS is_blocked
       FROM users u WHERE u.id = $1`,
      [userId, req.user.id],
    );

    const row = rows[0];
    if (!row) return res.status(404).json({ error: "User not found" });

    const daily = await loadDailyState(getPool(), userId, { timeZone: row.time_zone });

    const stats = {
      recipes: Number(row.recipes),
      followers: Number(row.followers),
      following: Number(row.following),
      lessonsCompleted: Number(row.lessons),
      cooked: Number(row.cooked),
      likesReceived: Number(row.likes_received),
      streak: daily.streak,
      isFollowing: Boolean(row.is_following),
      isBlocked: Boolean(row.is_blocked),
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
 * A minha conta: levar os dados e ir embora
 * ---------------------------------------------------------------- */

/**
 * Tudo o que a aplicação sabe sobre mim, num ficheiro.
 *
 * Não é um resumo bonito: é o conteúdo das tabelas, incluindo o livro-razão
 * do XP. Quem exporta os dados quer os dados, não uma vista deles — e é isso
 * que o direito de portabilidade significa.
 */
router.get(
  "/me/export",
  asyncHandler(async (req, res) => {
    const id = req.user.id;

    const um = async (text) => (await query(text, [id])).rows;

    const [perfil, receitas, comentarios, gostos, seguidores, seguindo, licoes, missoes, xp, desafios, notificacoes, identidades, atividade, bloqueados, denuncias] =
      await Promise.all([
        um(`SELECT id, username, email, photo_url, level, xp, time_zone, daily_xp_goal, role, created_at
              FROM users WHERE id = $1`),
        um(`SELECT id, title, description, ingredients, cook_time_min, difficulty, image_url, created_at
              FROM recipes WHERE author_id = $1 ORDER BY created_at`),
        um(`SELECT id, recipe_id, body, created_at FROM comments WHERE author_id = $1 ORDER BY created_at`),
        um(`SELECT recipe_id FROM recipe_likes WHERE user_id = $1`),
        um(`SELECT u.username, f.created_at FROM follows f JOIN users u ON u.id = f.follower_id
             WHERE f.followee_id = $1`),
        um(`SELECT u.username, f.created_at FROM follows f JOIN users u ON u.id = f.followee_id
             WHERE f.follower_id = $1`),
        um(`SELECT lesson_id, xp_earned, hearts_left, completed_at FROM lesson_progress
             WHERE user_id = $1 ORDER BY completed_at`),
        um(`SELECT id, mission_id, status, current_step, started_at, completed_at, shared
              FROM mission_runs WHERE user_id = $1 ORDER BY started_at`),
        um(`SELECT source, source_ref, amount, created_at FROM xp_events WHERE user_id = $1
             ORDER BY created_at`),
        um(`SELECT challenge_id, recipe_id, created_at FROM challenge_entries WHERE user_id = $1`),
        um(`SELECT kind, recipe_id, read_at, created_at FROM notifications WHERE user_id = $1
             ORDER BY created_at`),
        um(`SELECT provider, email, created_at, last_login_at FROM auth_identities WHERE user_id = $1`),
        um(`SELECT to_char(day, 'YYYY-MM-DD') AS day, xp, goal_met FROM daily_activity
             WHERE user_id = $1 ORDER BY day`),
        um(`SELECT u.username, b.created_at FROM user_blocks b JOIN users u ON u.id = b.blocked_id
             WHERE b.blocker_id = $1 ORDER BY b.created_at`),
        // As denúncias que eu fiz. As que outros fizeram sobre mim não saem
        // aqui: dá-las era entregar-me quem me denunciou.
        um(`SELECT subject_type, reason, details, status, created_at FROM reports
             WHERE reporter_id = $1 ORDER BY created_at`),
      ]);

    // Um nome com data, para quem exportar duas vezes não ficar com dois
    // ficheiros iguais na pasta das transferências.
    const dia = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Disposition", `attachment; filename="chefxp-${perfil[0]?.username ?? "dados"}-${dia}.json"`);

    res.json({
      exportadoEm: new Date().toISOString(),
      perfil: perfil[0] ?? null,
      identidadesExternas: identidades,
      receitas,
      comentarios,
      gostosQueDei: gostos.map((row) => row.recipe_id),
      seguidores,
      seguindo,
      progressoLicoes: licoes,
      missoes,
      participacoesEmDesafios: desafios,
      livroRazaoXp: xp,
      atividadeDiaria: atividade,
      notificacoes,
      bloqueados,
      denunciasQueFiz: denuncias,
    });
  }),
);

/**
 * Apagar a conta, a sério.
 *
 * Não há coluna `deleted_at` nenhuma: a linha desaparece e as chaves
 * estrangeiras em cascata levam receitas, comentários, gostos, missões,
 * progresso e livro-razão consigo. Uma conta "apagada" que continua na base
 * de dados não é uma conta apagada.
 *
 * O que fica de propósito: nada. As notificações que eu causei a outras
 * pessoas também caem, porque `actor_id` é uma chave estrangeira minha.
 */
router.delete(
  "/me",
  validate({ body: accountDeleteSchema }),
  asyncHandler(async (req, res) => {
    const { confirmUsername, password } = req.valid.body;

    const { rows } = await query(`SELECT username, password_hash FROM users WHERE id = $1`, [
      req.user.id,
    ]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    if (confirmUsername !== user.username) {
      return res.status(400).json({ error: "The username doesn't match" });
    }

    // Contas com password confirmam com ela; as de SSO não têm nenhuma para
    // dar, e o nome escrito à mão é o que resta como travão.
    if (user.password_hash !== null) {
      const ok = password ? await bcrypt.compare(password, user.password_hash) : false;
      // 403 e não 401: a sessão é válida, o que falta é a confirmação. Com 401
      // o cliente tratava isto como sessão expirada e expulsava para o ecrã de
      // entrada quem só se enganou a escrever a password.
      if (!ok) return res.status(403).json({ error: "Wrong password" });
    }

    await query(`DELETE FROM users WHERE id = $1`, [req.user.id]);

    clearAuthCookie(res);
    clearCsrfToken(res);
    res.status(204).end();
  }),
);

/* ---------------------------------------------------------------- *
 * Quem me segue, quem eu sigo
 * ---------------------------------------------------------------- */

const SELECT_FOLLOW_LIST = `
  SELECT u.id, u.username, u.photo_url, u.level, u.xp,
         EXISTS (
           SELECT 1 FROM follows f2 WHERE f2.follower_id = $2 AND f2.followee_id = u.id
         ) AS is_following
    FROM follows f
    JOIN users u ON u.id = %ID%
   WHERE f.%FILTER% = $1
     AND ${notBlockedSql("$2", "u.id")}
   ORDER BY f.created_at DESC
   LIMIT $3
`;

function followListQuery(kind) {
  return kind === "followers"
    ? SELECT_FOLLOW_LIST.replace("%ID%", "f.follower_id").replace("%FILTER%", "followee_id")
    : SELECT_FOLLOW_LIST.replace("%ID%", "f.followee_id").replace("%FILTER%", "follower_id");
}

async function respondWithFollowList(req, res, kind) {
  const { rows } = await query(followListQuery(kind), [
    req.valid.params.id,
    req.user.id,
    req.valid.query.limit,
  ]);

  res.json({
    users: rows.map((row) => ({
      id: row.id,
      username: row.username,
      photoUrl: row.photo_url ?? null,
      level: Number(row.level ?? 1),
      // Falso para mim próprio: seguir-me a mim não existe, e mostrar o botão
      // seria oferecer o que o servidor recusa.
      isFollowing: row.id === req.user.id ? false : Boolean(row.is_following),
      isMe: row.id === req.user.id,
    })),
  });
}

router.get(
  "/:id/followers",
  validate({ params: idParamSchema, query: followListSchema }),
  asyncHandler((req, res) => respondWithFollowList(req, res, "followers")),
);

router.get(
  "/:id/following",
  validate({ params: idParamSchema, query: followListSchema }),
  asyncHandler((req, res) => respondWithFollowList(req, res, "following")),
);

/* ---------------------------------------------------------------- *
 * Seguir / deixar de seguir
 * ---------------------------------------------------------------- */

router.post(
  "/:id/follow",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    if (req.valid.params.id === req.user.id) {
      return res.status(400).json({ error: "You can't follow yourself" });
    }

    const target = await query(`SELECT 1 FROM users WHERE id = $1`, [req.valid.params.id]);
    if (target.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Seguir por cima de um bloqueio desfazia o bloqueio pela porta do lado:
    // voltava a pôr a pessoa no meu feed "a seguir".
    if (await blockExistsBetween(req.user.id, req.valid.params.id)) {
      return res.status(403).json({ error: "You can't follow this person" });
    }

    await query(
      `INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.user.id, req.valid.params.id],
    );

    await notifyQuietly(getPool(), {
      userId: req.valid.params.id,
      actorId: req.user.id,
      kind: "follow",
    });

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

/* ---------------------------------------------------------------- *
 * Bloquear
 * ---------------------------------------------------------------- */

/**
 * Bloquear alguém.
 *
 * O bloqueio não é só um filtro para o futuro: desfaz o que já existia entre
 * as duas pessoas. Os dois sentidos do "seguir" caem, e as notificações que
 * uma causou à outra são apagadas — deixá-las era manter o nome e a fotografia
 * de quem se acabou de bloquear no sino, que é precisamente o sítio onde não
 * se quer voltar a vê-los.
 *
 * O que fica: os gostos e os comentários já escritos. Apagá-los era mudar os
 * contadores das receitas de terceiros por causa de uma decisão privada entre
 * dois. Eles deixam de me aparecer, que é o que o bloqueio promete.
 *
 * Idempotente: bloquear duas vezes é o mesmo que bloquear uma.
 */
router.post(
  "/:id/block",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    if (req.valid.params.id === req.user.id) {
      return res.status(400).json({ error: "You can't block yourself" });
    }

    const target = await query(`SELECT 1 FROM users WHERE id = $1`, [req.valid.params.id]);
    if (target.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [req.user.id, req.valid.params.id],
      );

      await client.query(
        `DELETE FROM follows
          WHERE (follower_id = $1 AND followee_id = $2)
             OR (follower_id = $2 AND followee_id = $1)`,
        [req.user.id, req.valid.params.id],
      );

      await client.query(
        `DELETE FROM notifications
          WHERE (user_id = $1 AND actor_id = $2)
             OR (user_id = $2 AND actor_id = $1)`,
        [req.user.id, req.valid.params.id],
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    res.json({ blocked: true });
  }),
);

/**
 * Desbloquear repõe a visibilidade e mais nada: quem se seguia antes não
 * volta a seguir-se sozinho.
 */
router.delete(
  "/:id/block",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await query(`DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`, [
      req.user.id,
      req.valid.params.id,
    ]);
    res.json({ blocked: false });
  }),
);

/**
 * A minha lista de bloqueados — só o meu lado.
 *
 * Sem ela, bloquear era uma porta sem maçaneta do lado de dentro: a pessoa
 * desaparecia do ecrã e não havia sítio nenhum onde a voltar a encontrar para
 * desfazer o bloqueio.
 */
router.get(
  "/me/blocks",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT u.id, u.username, u.photo_url, u.level, b.created_at
         FROM user_blocks b
         JOIN users u ON u.id = b.blocked_id
        WHERE b.blocker_id = $1
        ORDER BY b.created_at DESC`,
      [req.user.id],
    );

    res.json({
      users: rows.map((row) => ({
        id: row.id,
        username: row.username,
        photoUrl: row.photo_url ?? null,
        level: Number(row.level ?? 1),
        blockedAt: row.created_at,
      })),
    });
  }),
);

export default router;
