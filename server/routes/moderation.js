import { Router } from "express";
import { getPool, query } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { reportIdParamSchema, reportListSchema, reportResolveSchema } from "../schemas/index.js";
import { requireModerator } from "../lib/moderation.js";
import { resolutionOf } from "../domain/moderation.js";
import { revokeXp } from "../lib/xpLedger.js";

const router = Router();

router.use(requireAuth, requireModerator);

/**
 * A fila de moderação.
 *
 * Uma denúncia sem ninguém do outro lado é um formulário que não faz nada, e
 * era isso que a alternativa seria: guardar denúncias numa tabela que ninguém
 * lê. Isto é o outro lado.
 *
 * Cada linha traz o conteúdo denunciado junto — título da receita, corpo do
 * comentário, nome de quem foi denunciado —, porque uma fila que obriga a
 * abrir outra página para perceber cada caso não se trata até ao fim. Quando o
 * conteúdo já não existe, `subject` vem a `null`: a denúncia sobrevive ao que
 * a originou, de propósito.
 */
const SELECT_REPORT = `
  SELECT
    rep.id, rep.subject_type, rep.subject_id, rep.reason, rep.details,
    rep.status, rep.resolution, rep.created_at, rep.resolved_at,
    quem.username      AS reporter_username,
    moderador.username AS resolver_username,
    rec.title          AS recipe_title,
    rec.image_url      AS recipe_image,
    autor.username     AS recipe_author,
    com.body           AS comment_body,
    comautor.username  AS comment_author,
    alvo.username      AS user_username,
    (SELECT COUNT(*) FROM reports outras
      WHERE outras.subject_type = rep.subject_type
        AND outras.subject_id = rep.subject_id) AS reports_on_subject
  FROM reports rep
  JOIN users quem            ON quem.id = rep.reporter_id
  LEFT JOIN users moderador  ON moderador.id = rep.resolved_by
  LEFT JOIN recipes rec      ON rep.subject_type = 'recipe'  AND rec.id = rep.subject_id
  LEFT JOIN users autor      ON autor.id = rec.author_id
  LEFT JOIN comments com     ON rep.subject_type = 'comment' AND com.id = rep.subject_id
  LEFT JOIN users comautor   ON comautor.id = com.author_id
  LEFT JOIN users alvo       ON rep.subject_type = 'user'    AND alvo.id = rep.subject_id
`;

function toReport(row) {
  const subject =
    row.subject_type === "recipe" && row.recipe_title
      ? {
          kind: "recipe",
          title: row.recipe_title,
          imageUrl: row.recipe_image ?? null,
          author: row.recipe_author,
        }
      : row.subject_type === "comment" && row.comment_body
        ? { kind: "comment", body: row.comment_body, author: row.comment_author }
        : row.subject_type === "user" && row.user_username
          ? { kind: "user", username: row.user_username }
          : null;

  return {
    id: String(row.id),
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    reason: row.reason,
    details: row.details ?? null,
    status: row.status,
    resolution: row.resolution ?? null,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? null,
    resolvedBy: row.resolver_username ?? null,
    reportedBy: row.reporter_username,
    reportsOnSubject: Number(row.reports_on_subject),
    subject,
  };
}

router.get(
  "/reports",
  validate({ query: reportListSchema }),
  asyncHandler(async (req, res) => {
    const { status, limit } = req.valid.query;

    const { rows } = await query(
      `${SELECT_REPORT}
        ${status === "all" ? "" : "WHERE rep.status = $2"}
        ORDER BY rep.created_at DESC
        LIMIT $1`,
      status === "all" ? [limit] : [limit, status],
    );

    const { rows: counts } = await query(
      `SELECT COUNT(*)::int AS open FROM reports WHERE status = 'open'`,
    );

    res.json({ reports: rows.map(toReport), open: counts[0].open });
  }),
);

/**
 * Fechar uma denúncia: apagar o conteúdo, ou arquivar sem lhe tocar.
 *
 * Apagar uma receita aqui tem de fazer o mesmo que o autor a apagar na sua
 * página — incluindo retirar-lhe o XP que a publicação pagou. Sem isso, a
 * moderação seria uma forma de ficar com os pontos de uma receita que já não
 * existe, e o livro-razão deixava de bater certo com o que está publicado.
 *
 * Contas não se apagam por aqui, e isso é deliberado: apagar a conta de
 * outra pessoa é irreversível e leva-lhe tudo atrás. Uma denúncia sobre uma
 * pessoa serve para reunir o que ela fez e para agir sobre o conteúdo dela,
 * uma peça de cada vez.
 */
router.post(
  "/reports/:id/resolve",
  validate({ params: reportIdParamSchema, body: reportResolveSchema }),
  asyncHandler(async (req, res) => {
    const decision = resolutionOf(req.valid.body.action);
    if (!decision) return res.status(400).json({ error: "Unknown action" });

    const { rows } = await query(`SELECT * FROM reports WHERE id = $1`, [req.valid.params.id]);
    const report = rows[0];
    if (!report) return res.status(404).json({ error: "Report not found" });
    if (report.status !== "open") {
      return res.status(409).json({ error: "This report has already been handled" });
    }

    if (decision.resolution === "removido" && report.subject_type === "user") {
      return res.status(400).json({
        error: "Accounts aren't deleted from the queue — handle their content, one piece at a time",
      });
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      if (decision.resolution === "removido") {
        if (report.subject_type === "recipe") {
          const { rows: donos } = await client.query(
            `SELECT r.author_id, u.time_zone
               FROM recipes r JOIN users u ON u.id = r.author_id
              WHERE r.id = $1
              FOR UPDATE OF u`,
            [report.subject_id],
          );

          if (donos[0]) {
            await client.query(`DELETE FROM recipes WHERE id = $1`, [report.subject_id]);
            await revokeXp(client, {
              userId: donos[0].author_id,
              source: "recipe",
              sourceRef: report.subject_id,
              timeZone: donos[0].time_zone ?? "UTC",
            });
          }
        } else {
          await client.query(`DELETE FROM comments WHERE id = $1`, [report.subject_id]);
        }
      }

      /**
       * Fecha todas as denúncias abertas sobre o mesmo alvo, e não só esta:
       * cinco pessoas a denunciar a mesma fotografia são cinco linhas e uma
       * decisão só. Deixar as outras abertas dava uma fila que voltava a pedir
       * a mesma coisa quatro vezes.
       */
      const { rows: fechadas } = await client.query(
        `UPDATE reports
            SET status = $1, resolution = $2, resolved_by = $3, resolved_at = now()
          WHERE status = 'open'
            AND subject_type = $4
            AND subject_id = $5
        RETURNING id`,
        [decision.status, decision.resolution, req.user.id, report.subject_type, report.subject_id],
      );

      await client.query("COMMIT");

      res.json({
        resolved: fechadas.length,
        status: decision.status,
        resolution: decision.resolution,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

export default router;
