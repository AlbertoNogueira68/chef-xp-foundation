import { Router } from "express";
import { getPool } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  checkpointSchema,
  missionCompleteSchema,
  missionParamSchema,
  rescueSchema,
  runParamSchema,
  stepMoveSchema,
} from "../schemas/index.js";
import {
  MISSIONS,
  findRescueAnswer,
  getMission,
  getUnitOfMission,
  missionXp,
  toClientMission,
  validateStepMove,
} from "../domain/missions.js";
import { saveDataUrlImage } from "../lib/imageStore.js";
import { awardStreakBonus, awardXp, loadDailyState } from "../lib/xpLedger.js";

const router = Router();
router.use(requireAuth);

/* ------------------------------------------------------------------ */
/* Auxiliares                                                         */
/* ------------------------------------------------------------------ */

/**
 * A missão só abre quando todas as lições da unidade estão feitas. É a mesma
 * regra que o cartão do percurso desenha — mas quem a impõe é o servidor.
 */
async function isUnlocked(client, userId, missionId) {
  const unit = getUnitOfMission(missionId);
  if (!unit) return false;

  const { rows } = await client.query(
    `SELECT count(*)::int AS done
       FROM lesson_progress
      WHERE user_id = $1 AND lesson_id = ANY($2::text[])`,
    [userId, unit.lessons.map((lesson) => lesson.id)],
  );
  return rows[0].done >= unit.lessons.length;
}

async function loadRun(client, userId, runId) {
  const { rows } = await client.query(
    `SELECT * FROM mission_runs WHERE id = $1 AND user_id = $2`,
    [runId, userId],
  );
  return rows[0] ?? null;
}

async function runPayload(client, run) {
  const mission = getMission(run.mission_id);
  const { rows: checkpoints } = await client.query(
    `SELECT step_index, image_url, feedback FROM mission_checkpoints
      WHERE run_id = $1 ORDER BY step_index`,
    [run.id],
  );

  return {
    run: {
      id: Number(run.id),
      missionId: run.mission_id,
      status: run.status,
      currentStep: run.current_step,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      resultImage: run.result_image,
      shared: run.shared,
    },
    mission: toClientMission(mission),
    checkpoints: checkpoints.map((row) => ({
      stepIndex: row.step_index,
      imageUrl: row.image_url,
      feedback: row.feedback,
    })),
  };
}

async function logEvent(client, runId, stepIndex, kind, detail = null) {
  await client.query(
    `INSERT INTO mission_events (run_id, step_index, kind, detail) VALUES ($1, $2, $3, $4)`,
    [runId, stepIndex, kind, detail],
  );
}

/* ------------------------------------------------------------------ */
/* Listagem                                                           */
/* ------------------------------------------------------------------ */

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (mission_id) mission_id, id, status, current_step, completed_at
         FROM mission_runs WHERE user_id = $1
        ORDER BY mission_id, started_at DESC`,
      [req.user.id],
    );
    const byMission = new Map(rows.map((row) => [row.mission_id, row]));

    const missions = [];
    for (const mission of MISSIONS) {
      const last = byMission.get(mission.id);
      missions.push({
        ...toClientMission(mission),
        unlocked: await isUnlocked(pool, req.user.id, mission.id),
        lastRun: last
          ? {
              id: Number(last.id),
              status: last.status,
              currentStep: last.current_step,
              completedAt: last.completed_at,
            }
          : null,
      });
    }

    res.json({ missions });
  }),
);

/* ------------------------------------------------------------------ */
/* Arrancar e retomar                                                 */
/* ------------------------------------------------------------------ */

router.post(
  "/:id/start",
  validate({ params: missionParamSchema }),
  asyncHandler(async (req, res) => {
    const mission = getMission(req.valid.params.id);
    if (!mission) return res.status(404).json({ error: "Missão não encontrada" });

    const pool = getPool();
    if (!(await isUnlocked(pool, req.user.id, mission.id))) {
      return res.status(403).json({ error: "Termina as lições da unidade primeiro" });
    }

    // O índice parcial único garante uma run ativa por missão. Em vez de
    // devolver 409 e deixar o utilizador encravado, retomamos a que existe:
    // quem fechou a app a meio de cozinhar quer continuar, não recomeçar.
    const existing = await pool.query(
      `SELECT * FROM mission_runs
        WHERE user_id = $1 AND mission_id = $2 AND status = 'in_progress'`,
      [req.user.id, mission.id],
    );
    if (existing.rowCount > 0) {
      return res.status(200).json({ resumed: true, ...(await runPayload(pool, existing.rows[0])) });
    }

    const { rows } = await pool.query(
      `INSERT INTO mission_runs (user_id, mission_id) VALUES ($1, $2) RETURNING *`,
      [req.user.id, mission.id],
    );
    res.status(201).json({ resumed: false, ...(await runPayload(pool, rows[0])) });
  }),
);

router.get(
  "/:id/run",
  validate({ params: missionParamSchema }),
  asyncHandler(async (req, res) => {
    const mission = getMission(req.valid.params.id);
    if (!mission) return res.status(404).json({ error: "Missão não encontrada" });

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM mission_runs
        WHERE user_id = $1 AND mission_id = $2 AND status = 'in_progress'`,
      [req.user.id, mission.id],
    );
    if (rows.length === 0) return res.status(404).json({ error: "Sem missão a decorrer" });

    res.json(await runPayload(pool, rows[0]));
  }),
);

/* ------------------------------------------------------------------ */
/* Durante a missão                                                   */
/* ------------------------------------------------------------------ */

router.patch(
  "/runs/:runId/step",
  validate({ params: runParamSchema, body: stepMoveSchema }),
  asyncHandler(async (req, res) => {
    const pool = getPool();
    const run = await loadRun(pool, req.user.id, req.valid.params.runId);
    if (!run) return res.status(404).json({ error: "Missão não encontrada" });
    if (run.status !== "in_progress") {
      return res.status(409).json({ error: "Esta missão já terminou" });
    }

    const mission = getMission(run.mission_id);
    const next = req.valid.body.stepIndex;
    const move = validateStepMove(mission, run.current_step, next);
    if (!move.ok) return res.status(400).json({ error: move.reason });

    if (next < run.current_step) await logEvent(pool, run.id, next, "back");

    const { rows } = await pool.query(
      `UPDATE mission_runs SET current_step = $1 WHERE id = $2 RETURNING *`,
      [next, run.id],
    );
    res.json(await runPayload(pool, rows[0]));
  }),
);

/**
 * Pedir socorro. A resposta está guionada no currículo — e o pedido fica
 * registado, porque saber em que passo as pessoas se atrapalham vale mais do
 * que a resposta em si.
 */
router.post(
  "/runs/:runId/rescue",
  validate({ params: runParamSchema, body: rescueSchema }),
  asyncHandler(async (req, res) => {
    const pool = getPool();
    const run = await loadRun(pool, req.user.id, req.valid.params.runId);
    if (!run) return res.status(404).json({ error: "Missão não encontrada" });

    const mission = getMission(run.mission_id);
    const { stepIndex, kind } = req.valid.body;
    const answer = findRescueAnswer(mission, stepIndex, kind);
    if (!answer) return res.status(404).json({ error: "Sem resposta para este passo" });

    await logEvent(pool, run.id, stepIndex, "rescue", kind);
    res.json({ kind, stepIndex, answer });
  }),
);

router.post(
  "/runs/:runId/checkpoint",
  validate({ params: runParamSchema, body: checkpointSchema }),
  asyncHandler(async (req, res) => {
    const pool = getPool();
    const run = await loadRun(pool, req.user.id, req.valid.params.runId);
    if (!run) return res.status(404).json({ error: "Missão não encontrada" });
    if (run.status !== "in_progress") {
      return res.status(409).json({ error: "Esta missão já terminou" });
    }

    const { stepIndex, imageDataUrl } = req.valid.body;
    const mission = getMission(run.mission_id);
    if (!mission.steps[stepIndex]?.checkpoint) {
      return res.status(400).json({ error: "Este passo não pede foto" });
    }

    const imageUrl = await saveDataUrlImage(imageDataUrl);

    // Repetir a foto do mesmo passo substitui a anterior: quem tirou uma foto
    // tremida quer trocá-la, não ficar com as duas.
    const { rows } = await pool.query(
      `INSERT INTO mission_checkpoints (run_id, step_index, image_url)
       VALUES ($1, $2, $3)
       ON CONFLICT (run_id, step_index) DO UPDATE SET image_url = EXCLUDED.image_url
       RETURNING step_index, image_url`,
      [run.id, stepIndex, imageUrl],
    );

    res.status(201).json({ checkpoint: { stepIndex: rows[0].step_index, imageUrl } });
  }),
);

router.post(
  "/runs/:runId/abandon",
  validate({ params: runParamSchema }),
  asyncHandler(async (req, res) => {
    const pool = getPool();
    const run = await loadRun(pool, req.user.id, req.valid.params.runId);
    if (!run) return res.status(404).json({ error: "Missão não encontrada" });
    if (run.status !== "in_progress") {
      return res.status(409).json({ error: "Esta missão já terminou" });
    }

    await logEvent(pool, run.id, run.current_step, "abandon");
    await pool.query(`UPDATE mission_runs SET status = 'abandoned' WHERE id = $1`, [run.id]);
    res.json({ abandoned: true });
  }),
);

/* ------------------------------------------------------------------ */
/* Concluir                                                           */
/* ------------------------------------------------------------------ */

/**
 * Tudo numa transação, no mesmo padrão da conclusão de lição:
 * estado da run → XP (idempotente pelo run_id) → atividade diária →
 * prática das competências → bónus de streak → post, se partilhou.
 */
router.post(
  "/runs/:runId/complete",
  validate({ params: runParamSchema, body: missionCompleteSchema }),
  asyncHandler(async (req, res) => {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const { rows: runRows } = await client.query(
        `SELECT * FROM mission_runs WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [req.valid.params.runId, req.user.id],
      );
      const run = runRows[0];
      if (!run) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Missão não encontrada" });
      }
      if (run.status !== "in_progress") {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Esta missão já terminou" });
      }

      const mission = getMission(run.mission_id);
      const { rows: userRows } = await client.query(
        `SELECT time_zone, level FROM users WHERE id = $1 FOR UPDATE`,
        [req.user.id],
      );
      const timeZone = userRows[0]?.time_zone ?? "UTC";

      // A foto do passo de verificação é o que separa "cozinhei" de
      // "carreguei em seguinte seis vezes".
      const { rows: shots } = await client.query(
        `SELECT step_index, image_url FROM mission_checkpoints
          WHERE run_id = $1 ORDER BY step_index DESC LIMIT 1`,
        [run.id],
      );
      const resultImage = shots[0]?.image_url ?? null;
      if (!resultImage) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Falta a foto do passo de verificação" });
      }

      await client.query(
        `UPDATE mission_runs
            SET status = 'completed', completed_at = now(), result_image = $1, shared = $2
          WHERE id = $3`,
        [resultImage, req.valid.body.share, run.id],
      );

      // sourceRef = id da run, por isso concluir duas vezes nunca paga a dobrar.
      const award = await awardXp(client, {
        userId: req.user.id,
        source: "challenge",
        sourceRef: `mission:${run.id}`,
        amount: missionXp(mission),
        timeZone,
      });

      // `skill_practice` só cresce aqui. Acertar num quiz nunca conta como
      // praticado, por melhor que esteja escrito o ecrã.
      for (const skillId of mission.practices ?? []) {
        await client.query(
          `INSERT INTO skill_practice (user_id, skill_id, times, last_run_id)
           VALUES ($1, $2, 1, $3)
           ON CONFLICT (user_id, skill_id)
           DO UPDATE SET times = skill_practice.times + 1, last_run_id = EXCLUDED.last_run_id`,
          [req.user.id, skillId, run.id],
        );
      }

      const daily = await loadDailyState(client, req.user.id, { timeZone });
      const streakBonus = await awardStreakBonus(client, req.user.id, {
        streak: daily.streak,
        today: daily.today,
        timeZone,
      });

      let post = null;
      if (req.valid.body.share) {
        const { rows } = await client.query(
          `INSERT INTO posts (user_id, run_id, mission_id, image_url, caption, level_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (run_id) DO NOTHING
           RETURNING id, image_url, caption, created_at`,
          [
            req.user.id,
            run.id,
            run.mission_id,
            resultImage,
            req.valid.body.caption ?? null,
            streakBonus.level ?? award.level ?? userRows[0]?.level ?? 1,
          ],
        );
        post = rows[0] ? { id: Number(rows[0].id), imageUrl: rows[0].image_url } : null;
      }

      const { rows: practised } = await client.query(
        `SELECT skill_id, times FROM skill_practice WHERE user_id = $1`,
        [req.user.id],
      );

      await client.query("COMMIT");

      res.json({
        completed: true,
        resultImage,
        xpEarned: award.amount,
        streakBonus: streakBonus.amount ?? 0,
        streak: daily.streak,
        totalXp: streakBonus.xp ?? award.xp,
        level: streakBonus.level ?? award.level,
        practisedSkills: practised.map((row) => ({ skillId: row.skill_id, times: row.times })),
        post,
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
