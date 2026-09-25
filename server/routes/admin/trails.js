import { Router } from "express";
import { getPool } from "../../db/index.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { trailExists, trailTextFor } from "../../domain/curriculum.js";
import { getTrailMetadata } from "../../services/trailService.js";

/**
 * Gerir trilhos pelo painel.
 *
 * O currículo — unidades, lições, missões — vive em `shared/trails/<id>.json`
 * e é código versionado: muda-se no repositório, com deploy. O que o painel
 * controla são os metadados que já estão na base de dados (nome, ícone,
 * dificuldade, ordem) e, sobretudo, se um trilho está publicado.
 *
 * A autenticação e o `requireAdmin` vêm do router pai (`routes/admin.js`).
 */
const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows } = await getPool().query(
      `SELECT id, name, description, icon, color, difficulty, order_index,
              published_at, published_by, created_at, updated_at
         FROM trails
        ORDER BY order_index ASC, name ASC`,
    );
    // O nome vem do JSON na língua de quem está a ver, como no catálogo. Aqui
    // ninguém o edita — a coluna guarda o canónico e o painel é só de leitura.
    res.json({
      trails: rows.map((row) => ({
        ...row,
        ...trailTextFor(req.lang, row.id),
        loaded: trailExists(row.id),
      })),
    });
  }),
);

router.get(
  "/:trailId/stats",
  asyncHandler(async (req, res) => {
    const trail = await getTrailMetadata(getPool(), req.params.trailId);
    if (!trail) return res.status(404).json({ error: "Trail not found" });

    const { rows } = await getPool().query(
      `SELECT
         (SELECT COUNT(*) FROM user_trail_progress WHERE trail_id = $1)                          AS inscritos,
         (SELECT COUNT(*) FROM user_trail_progress WHERE trail_id = $1 AND completed_at IS NOT NULL) AS concluidos,
         (SELECT COUNT(DISTINCT user_id) FROM lesson_progress WHERE trail_id = $1)               AS com_progresso,
         (SELECT COUNT(*) FROM lesson_progress WHERE trail_id = $1)                              AS licoes_concluidas,
         (SELECT COALESCE(SUM(xp_earned), 0) FROM lesson_progress WHERE trail_id = $1)           AS xp_distribuido`,
      [trail.id],
    );

    const n = (value) => Number(value ?? 0);
    const row = rows[0];

    res.json({
      trail,
      stats: {
        inscritos: n(row.inscritos),
        concluidos: n(row.concluidos),
        comProgresso: n(row.com_progresso),
        licoesConcluidas: n(row.licoes_concluidas),
        xpDistribuido: n(row.xp_distribuido),
      },
    });
  }),
);

/**
 * Publicar é o que torna um trilho visível. Exige um currículo carregado:
 * publicar uma linha sem percurso punha um cartão no ecrã que dava erro ao
 * ser aberto.
 */
router.post(
  "/:trailId/publish",
  asyncHandler(async (req, res) => {
    const trail = await getTrailMetadata(getPool(), req.params.trailId);
    if (!trail) return res.status(404).json({ error: "Trail not found" });

    if (!trailExists(trail.id)) {
      return res.status(409).json({ error: "Trail has no loadable curriculum, cannot publish" });
    }

    const { rows } = await getPool().query(
      `UPDATE trails
          SET published_at = COALESCE(published_at, now()),
              published_by = COALESCE(published_by, $2),
              updated_at   = now()
        WHERE id = $1
        RETURNING *`,
      [trail.id, req.user.id],
    );
    res.json({ trail: rows[0] });
  }),
);

router.post(
  "/:trailId/unpublish",
  asyncHandler(async (req, res) => {
    const trail = await getTrailMetadata(getPool(), req.params.trailId);
    if (!trail) return res.status(404).json({ error: "Trail not found" });

    const { rows } = await getPool().query(
      `UPDATE trails SET published_at = NULL, published_by = NULL, updated_at = now()
        WHERE id = $1 RETURNING *`,
      [trail.id],
    );
    res.json({ trail: rows[0] });
  }),
);

export default router;
