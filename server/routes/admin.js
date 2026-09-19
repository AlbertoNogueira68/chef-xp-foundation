import { Router } from "express";
import { getPool, query } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  adminAccountDeleteSchema,
  adminUserListSchema,
  idParamSchema,
  roleChangeSchema,
} from "../schemas/index.js";
import { requireAdmin } from "../lib/moderation.js";
import { accountDeletionRefusal, roleChangeRefusal } from "../domain/moderation.js";

const router = Router();

router.use(requireAuth, requireAdmin);

/* ---------------------------------------------------------------- *
 * Números da plataforma
 * ---------------------------------------------------------------- */

/**
 * Os números que hoje só se obtinham com SQL à mão.
 *
 * Contagens e mais nada: nenhuma destas linhas é um contador guardado que
 * alguém tenha de manter sincronizado — são todas somas feitas na hora sobre
 * as tabelas que já existem, pela mesma razão que o ranking não tem tabela
 * própria. A esta escala custa milissegundos, e uma segunda verdade para
 * manter custava sempre.
 *
 * `ativos7d` sai de `daily_activity`, que existe desde o streak: é gente que
 * ganhou XP nos últimos sete dias, e não gente que abriu a aplicação — esta
 * aplicação não segue ninguém para saber isso.
 */
router.get(
  "/metrics",
  asyncHandler(async (_req, res) => {
    const { rows } = await query(`
      SELECT
        (SELECT COUNT(*) FROM users)                                          AS contas,
        (SELECT COUNT(*) FROM users WHERE created_at > now() - interval '7 days') AS contas_7d,
        (SELECT COUNT(*) FROM users WHERE email_verified_at IS NOT NULL)      AS contas_confirmadas,
        (SELECT COUNT(*) FROM users WHERE role <> 'user')                     AS equipa,
        (SELECT COUNT(DISTINCT user_id) FROM daily_activity
          WHERE day > (now() - interval '7 days')::date)                      AS ativos_7d,
        (SELECT COUNT(*) FROM recipes)                                        AS receitas,
        (SELECT COUNT(*) FROM recipes WHERE created_at > now() - interval '7 days') AS receitas_7d,
        (SELECT COUNT(*) FROM comments)                                       AS comentarios,
        (SELECT COUNT(*) FROM recipe_likes)                                   AS gostos,
        (SELECT COUNT(*) FROM lesson_progress)                                AS licoes,
        (SELECT COUNT(*) FROM mission_runs WHERE status = 'completed')        AS missoes,
        (SELECT COUNT(*) FROM challenges WHERE ends_at > now())               AS desafios_ativos,
        (SELECT COUNT(*) FROM reports WHERE status = 'open')                  AS denuncias_abertas,
        (SELECT COUNT(*) FROM reports)                                        AS denuncias_total,
        (SELECT COUNT(*) FROM user_blocks)                                    AS bloqueios,
        (SELECT COALESCE(SUM(amount), 0) FROM xp_events)                      AS xp_distribuido
    `);

    const n = (value) => Number(value ?? 0);
    const row = rows[0];

    res.json({
      metrics: {
        contas: n(row.contas),
        contasUltimos7Dias: n(row.contas_7d),
        contasConfirmadas: n(row.contas_confirmadas),
        equipa: n(row.equipa),
        ativosUltimos7Dias: n(row.ativos_7d),
        receitas: n(row.receitas),
        receitasUltimos7Dias: n(row.receitas_7d),
        comentarios: n(row.comentarios),
        gostos: n(row.gostos),
        licoesConcluidas: n(row.licoes),
        missoesConcluidas: n(row.missoes),
        desafiosAtivos: n(row.desafios_ativos),
        denunciasAbertas: n(row.denuncias_abertas),
        denunciasTotal: n(row.denuncias_total),
        bloqueios: n(row.bloqueios),
        xpDistribuido: n(row.xp_distribuido),
      },
    });
  }),
);

/* ---------------------------------------------------------------- *
 * Contas e papéis
 * ---------------------------------------------------------------- */

/**
 * As contas, com o que decide uma promoção ao lado: há quanto tempo existem,
 * o que publicaram, e quantas denúncias já receberam. Promover alguém sem ver
 * isto era promover um nome.
 */
router.get(
  "/users",
  validate({ query: adminUserListSchema }),
  asyncHandler(async (req, res) => {
    const { q, role, limit } = req.valid.query;

    const params = [];
    const where = [];

    if (q) {
      params.push(`%${q}%`);
      where.push(`(u.username ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }

    if (role === "staff") where.push(`u.role <> 'user'`);
    else if (role !== "all") {
      params.push(role);
      where.push(`u.role = $${params.length}`);
    }

    params.push(limit);

    const { rows } = await query(
      `SELECT u.id, u.username, u.email, u.photo_url, u.level, u.xp, u.role,
              u.email_verified_at, u.created_at,
              (SELECT COUNT(*) FROM recipes r WHERE r.author_id = u.id) AS receitas,
              (SELECT COUNT(*) FROM reports rep
                WHERE rep.subject_type = 'user' AND rep.subject_id = u.id) AS denuncias
         FROM users u
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY (u.role <> 'user') DESC, u.created_at DESC
        LIMIT $${params.length}`,
      params,
    );

    res.json({
      users: rows.map((row) => ({
        id: row.id,
        username: row.username,
        email: row.email,
        photoUrl: row.photo_url ?? null,
        level: Number(row.level ?? 1),
        xp: Number(row.xp ?? 0),
        role: row.role,
        emailVerified: Boolean(row.email_verified_at),
        createdAt: row.created_at,
        recipes: Number(row.receitas),
        reportsReceived: Number(row.denuncias),
      })),
    });
  }),
);

/**
 * Promover e despromover.
 *
 * As recusas vivem em `domain/moderation.js` e são quatro: o meu próprio papel
 * não se muda por aqui, nenhum admin nasce dentro da aplicação, um admin não é
 * despromovido por outro a um clique, e um papel que não existe não se atribui.
 *
 * A mudança e o seu registo acontecem na mesma transação. Um registo de quem
 * promoveu quem que pudesse falhar sozinho valia tanto como não existir.
 */
router.patch(
  "/users/:id/role",
  validate({ params: idParamSchema, body: roleChangeSchema }),
  asyncHandler(async (req, res) => {
    const { rows } = await query(`SELECT id, username, role FROM users WHERE id = $1`, [
      req.valid.params.id,
    ]);
    const target = rows[0];
    if (!target) return res.status(404).json({ error: "User not found" });

    const refusal = roleChangeRefusal({
      actorId: req.user.id,
      actorRole: req.user.role,
      targetId: target.id,
      targetRole: target.role,
      newRole: req.valid.body.role,
    });
    if (refusal) return res.status(403).json({ error: refusal });

    if (target.role === req.valid.body.role) {
      return res.json({ user: { id: target.id, username: target.username, role: target.role } });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(`UPDATE users SET role = $2 WHERE id = $1`, [
        target.id,
        req.valid.body.role,
      ]);

      await client.query(
        `INSERT INTO role_changes (target_id, actor_id, from_role, to_role)
         VALUES ($1, $2, $3, $4)`,
        [target.id, req.user.id, target.role, req.valid.body.role],
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    res.json({
      user: { id: target.id, username: target.username, role: req.valid.body.role },
    });
  }),
);

/**
 * O historial de papéis de uma conta — quem a promoveu, quando, e a partir de
 * quê. `actor` a nulo é uma mudança feita na linha de comandos.
 */
router.get(
  "/users/:id/role-history",
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT rc.from_role, rc.to_role, rc.created_at, a.username AS actor
         FROM role_changes rc
         LEFT JOIN users a ON a.id = rc.actor_id
        WHERE rc.target_id = $1
        ORDER BY rc.created_at DESC
        LIMIT 50`,
      [req.valid.params.id],
    );

    res.json({
      changes: rows.map((row) => ({
        from: row.from_role,
        to: row.to_role,
        at: row.created_at,
        by: row.actor ?? null,
      })),
    });
  }),
);

/**
 * Apagar a conta de alguém.
 *
 * O que leva é o mesmo que o próprio leva ao apagar-se no perfil: a linha sai
 * e as chaves estrangeiras em cascata levam o resto. O que fica é uma linha em
 * `account_deletions` a dizer quem foi, e por mão de quem.
 *
 * FOR UPDATE na conta: sem ele, uma promoção a admin a meio deste pedido
 * passava pela verificação ainda como "user" e era apagada já como admin.
 */
router.delete(
  "/users/:id",
  validate({ params: idParamSchema, body: adminAccountDeleteSchema }),
  asyncHandler(async (req, res) => {
    const client = await getPool().connect();

    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        `SELECT id, username, role FROM users WHERE id = $1 FOR UPDATE`,
        [req.valid.params.id],
      );
      const target = rows[0];
      if (!target) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "User not found" });
      }

      const refusal = accountDeletionRefusal({
        actorId: req.user.id,
        actorRole: req.user.role,
        targetId: target.id,
        targetRole: target.role,
      });
      if (refusal) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: refusal });
      }

      if (req.valid.body.confirmUsername !== target.username) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "The name doesn't match the account's" });
      }

      await client.query(
        `INSERT INTO account_deletions (deleted_user_id, deleted_username, deleted_role, actor_id)
         VALUES ($1, $2, $3, $4)`,
        [target.id, target.username, target.role, req.user.id],
      );
      await client.query(`DELETE FROM users WHERE id = $1`, [target.id]);

      await client.query("COMMIT");
      res.json({ deleted: { id: target.id, username: target.username } });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

export default router;
