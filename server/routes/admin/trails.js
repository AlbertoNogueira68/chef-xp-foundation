import { Router } from "express";
import { getPool } from "../../db/index.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import {
  curriculumFor,
  registerTrail,
  unregisterTrail,
  trailExists,
} from "../../domain/curriculum.js";
import { syncCurriculum } from "../../scripts/sync-curriculum.js";
import { getTrailMetadata } from "../../services/trailService.js";

/**
 * Criar trilhos pelo painel, sem deploy.
 *
 * O currículo entra por aqui em JSON e fica em `trails.curriculum_json`.
 * Passa pela mesma validação dos trilhos de ficheiro: é o que impede publicar
 * um percurso que exige uma competência que nenhuma lição ensina.
 *
 * Um trilho válido é instalado logo, mesmo em rascunho — é assim que o
 * administrador o consegue pré-visualizar. O que `publish` muda é quem o vê.
 *
 * A autenticação e o `requireAdmin` vêm do router pai (`routes/admin.js`).
 */
const router = Router();

const DIFFICULTIES = ["beginner", "intermediate", "advanced"];
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** `{en: {...}}` ou um currículo só, que se assume inglês. */
function asLanguageMap(curriculum) {
  return curriculum?.en ? curriculum : { en: curriculum };
}

/**
 * Instala o trilho e leva as competências dele para a tabela `skills`.
 * Sem o sync, a primeira missão concluída rebentava na chave estrangeira de
 * `skill_practice`.
 */
async function installTrail(trailId, curriculum) {
  const { ok, errors } = registerTrail(trailId, asLanguageMap(curriculum));
  if (!ok) return { ok, errors };

  await syncCurriculum(getPool());
  return { ok: true, errors: [] };
}

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const { rows } = await getPool().query(
      `SELECT id, name, description, icon, color, difficulty, order_index,
              published_at, published_by, created_at, updated_at,
              (curriculum_json IS NOT NULL) AS admin_authored
         FROM trails
        ORDER BY order_index ASC, name ASC`,
    );
    res.json({ trails: rows.map((row) => ({ ...row, loaded: trailExists(row.id) })) });
  }),
);

router.get(
  "/:trailId",
  asyncHandler(async (req, res) => {
    const trail = await getTrailMetadata(getPool(), req.params.trailId);
    if (!trail) return res.status(404).json({ error: "Trail not found" });

    // Um trilho cuja linha existe mas cujo currículo não carregou tem de o
    // dizer, em vez de devolver metade da verdade.
    const curriculum = trailExists(trail.id) ? curriculumFor("en", trail.id).curriculum : null;
    res.json({ trail, curriculum, loaded: curriculum !== null });
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

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { id, name, description, icon, color, difficulty, orderIndex, curriculum } = req.body;

    if (!ID_PATTERN.test(id ?? "")) {
      return res.status(400).json({ error: "id must be lowercase words joined by hyphens" });
    }
    if (!name?.trim()) return res.status(400).json({ error: "name is required" });
    if (!DIFFICULTIES.includes(difficulty)) {
      return res
        .status(400)
        .json({ error: `difficulty must be one of ${DIFFICULTIES.join(", ")}` });
    }
    if (trailExists(id)) {
      return res.status(409).json({ error: "A trail with that id already exists" });
    }

    // Validar antes de gravar: uma linha criada e um currículo recusado
    // deixava um trilho que nunca se conseguia publicar nem perceber porquê.
    if (curriculum) {
      const check = registerTrail(id, asLanguageMap(curriculum), { dryRun: true });
      if (!check.ok)
        return res.status(400).json({ error: "Invalid curriculum", details: check.errors });
    }

    const { rows } = await getPool().query(
      `INSERT INTO trails (id, name, description, icon, color, difficulty, order_index, curriculum_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING
       RETURNING *`,
      [
        id,
        name.trim(),
        description ?? null,
        icon ?? null,
        color ?? "slate",
        difficulty,
        orderIndex ?? 0,
        curriculum ? JSON.stringify(asLanguageMap(curriculum)) : null,
      ],
    );

    if (rows.length === 0) {
      return res.status(409).json({ error: "A trail with that id already exists" });
    }

    if (curriculum) await installTrail(id, curriculum);

    res.status(201).json({ trail: rows[0] });
  }),
);

router.put(
  "/:trailId",
  asyncHandler(async (req, res) => {
    const trail = await getTrailMetadata(getPool(), req.params.trailId);
    if (!trail) return res.status(404).json({ error: "Trail not found" });

    const { name, description, icon, color, difficulty, orderIndex, curriculum } = req.body;

    if (difficulty !== undefined && !DIFFICULTIES.includes(difficulty)) {
      return res
        .status(400)
        .json({ error: `difficulty must be one of ${DIFFICULTIES.join(", ")}` });
    }
    if (name !== undefined && !name?.trim()) {
      return res.status(400).json({ error: "name cannot be empty" });
    }
    // O currículo dos trilhos de ficheiro é código versionado: muda-se no
    // repositório, não por aqui, ou o próximo deploy desfazia a alteração.
    if (curriculum !== undefined && trail.curriculum_json === null) {
      return res.status(409).json({ error: "This trail's curriculum lives in the repository" });
    }
    if (curriculum !== undefined) {
      const check = registerTrail(trail.id, asLanguageMap(curriculum), { dryRun: true });
      if (!check.ok)
        return res.status(400).json({ error: "Invalid curriculum", details: check.errors });
    }

    const { rows } = await getPool().query(
      `UPDATE trails
          SET name            = COALESCE($2, name),
              description     = COALESCE($3, description),
              icon            = COALESCE($4, icon),
              color           = COALESCE($5, color),
              difficulty      = COALESCE($6, difficulty),
              order_index     = COALESCE($7, order_index),
              curriculum_json = COALESCE($8, curriculum_json),
              updated_at      = now()
        WHERE id = $1
        RETURNING *`,
      [
        trail.id,
        name?.trim() ?? null,
        description ?? null,
        icon ?? null,
        color ?? null,
        difficulty ?? null,
        orderIndex ?? null,
        curriculum ? JSON.stringify(asLanguageMap(curriculum)) : null,
      ],
    );

    if (curriculum !== undefined) await installTrail(trail.id, curriculum);

    res.json({ trail: rows[0] });
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

/**
 * Apagar só enquanto ninguém lá anda. Depois disso o caminho é despublicar:
 * apagar levava com ele o progresso de quem já tinha feito lições.
 */
router.delete(
  "/:trailId",
  asyncHandler(async (req, res) => {
    const trail = await getTrailMetadata(getPool(), req.params.trailId);
    if (!trail) return res.status(404).json({ error: "Trail not found" });

    const { rows } = await getPool().query(
      `SELECT COUNT(*)::int AS inscritos FROM user_trail_progress WHERE trail_id = $1`,
      [trail.id],
    );
    if (rows[0].inscritos > 0) {
      return res.status(409).json({
        error: `${rows[0].inscritos} learner(s) are on this trail. Unpublish it instead.`,
      });
    }
    if (trail.curriculum_json === null) {
      return res.status(409).json({ error: "This trail lives in the repository" });
    }

    await getPool().query(`DELETE FROM trails WHERE id = $1`, [trail.id]);
    unregisterTrail(trail.id);
    await syncCurriculum(getPool());

    res.json({ deleted: trail.id });
  }),
);

export default router;
