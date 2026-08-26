import { Router } from "express";
import { getPool } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { lessonCompleteSchema, lessonParamSchema } from "../schemas/index.js";
import {
  LEARNING_CURRICULUM,
  gradeAnswers,
  getLesson,
  getLessonIndex,
  getLessonOrder,
  toClientLesson,
} from "../domain/curriculum.js";
import { MAX_HEARTS, xpForLesson } from "../domain/xp.js";
import { awardStreakBonus, awardXp, loadDailyState } from "../lib/xpLedger.js";

const router = Router();

router.use(requireAuth);

async function loadCompletedIds(client, userId) {
  const { rows } = await client.query(
    `SELECT lesson_id FROM lesson_progress WHERE user_id = $1`,
    [userId],
  );
  return new Set(rows.map((row) => row.lesson_id));
}

/**
 * Estados do percurso: tudo o que já foi feito é "completed", a primeira por
 * fazer é "current", as seguintes ficam trancadas. A ordem é a do currículo.
 */
function buildStatuses(completed) {
  const statuses = new Map();
  let foundCurrent = false;

  for (const lessonId of getLessonOrder()) {
    if (completed.has(lessonId)) {
      statuses.set(lessonId, "completed");
    } else if (!foundCurrent) {
      statuses.set(lessonId, "current");
      foundCurrent = true;
    } else {
      statuses.set(lessonId, "locked");
    }
  }
  return statuses;
}

async function buildPath(client, userId) {
  const { rows: userRows } = await client.query(
    `SELECT time_zone, daily_xp_goal FROM users WHERE id = $1`,
    [userId],
  );
  const timeZone = userRows[0]?.time_zone ?? "UTC";
  const dailyXpGoal = Number(userRows[0]?.daily_xp_goal ?? 50);

  const completed = await loadCompletedIds(client, userId);
  const statuses = buildStatuses(completed);
  const daily = await loadDailyState(client, userId, { timeZone });

  const units = LEARNING_CURRICULUM.map((unit) => ({
    id: unit.id,
    title: unit.title,
    subtitle: unit.subtitle,
    color: unit.color,
    lessons: unit.lessons.map((lesson) => ({
      ...toClientLesson(lesson),
      status: statuses.get(lesson.id) ?? "locked",
    })),
  }));

  return {
    units,
    progress: {
      completedLessonIds: [...completed],
      dailyXp: daily.dailyXp,
      dailyXpGoal,
      streak: daily.streak,
      lastActiveDate: daily.activeDays[0] ?? null,
    },
  };
}

router.get(
  "/path",
  asyncHandler(async (req, res) => {
    res.json(await buildPath(getPool(), req.user.id));
  }),
);

router.get(
  "/progress",
  asyncHandler(async (req, res) => {
    const path = await buildPath(getPool(), req.user.id);
    res.json({ progress: path.progress });
  }),
);

router.get(
  "/lessons/:id",
  validate({ params: lessonParamSchema }),
  asyncHandler(async (req, res) => {
    const lesson = getLesson(req.valid.params.id);
    if (!lesson) return res.status(404).json({ error: "Lição não encontrada" });

    const completed = await loadCompletedIds(getPool(), req.user.id);
    const status = buildStatuses(completed).get(lesson.id);
    if (status === "locked") {
      return res.status(403).json({ error: "Termina as lições anteriores primeiro" });
    }

    // Sem `correctAnswer` nem `explanation`: o cliente não recebe o gabarito.
    res.json({ lesson: toClientLesson(lesson), status });
  }),
);

/**
 * Corrige uma resposta. É o servidor que decide se está certa — o cliente
 * limita-se a mostrar o resultado.
 */
router.post(
  "/lessons/:id/answer",
  validate({ params: lessonParamSchema }),
  asyncHandler(async (req, res) => {
    const lesson = getLesson(req.valid.params.id);
    if (!lesson) return res.status(404).json({ error: "Lição não encontrada" });

    const questionId = String(req.body?.questionId ?? "");
    const question = lesson.questions.find((q) => q.id === questionId);
    if (!question) return res.status(400).json({ error: "Pergunta inválida" });

    const answer = req.body?.answer;
    res.json({
      questionId,
      correct: answer === question.correctAnswer,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
    });
  }),
);

/**
 * Conclui uma lição. Tudo numa transação:
 * grava o progresso, lança o evento de XP, atualiza a atividade diária,
 * recalcula XP e nível, e paga o bónus de streak se for devido.
 */
router.post(
  "/lessons/:id/complete",
  validate({ params: lessonParamSchema, body: lessonCompleteSchema }),
  asyncHandler(async (req, res) => {
    const lesson = getLesson(req.valid.params.id);
    if (!lesson) return res.status(404).json({ error: "Lição não encontrada" });

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const { rows: userRows } = await client.query(
        `SELECT time_zone FROM users WHERE id = $1 FOR UPDATE`,
        [req.user.id],
      );
      const timeZone = userRows[0]?.time_zone ?? "UTC";

      const completed = await loadCompletedIds(client, req.user.id);

      // Não se salta lições: todas as anteriores têm de estar feitas.
      const index = getLessonIndex(lesson.id);
      const previous = getLessonOrder().slice(0, index);
      const missing = previous.filter((id) => !completed.has(id));
      if (missing.length > 0) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Termina as lições anteriores primeiro" });
      }

      // O servidor volta a corrigir: o `heartsLeft` que o cliente mostrou não
      // é aceite como facto.
      const grading = gradeAnswers(lesson, req.valid.body.answers);
      const heartsLeft = MAX_HEARTS - grading.wrong;

      if (heartsLeft <= 0) {
        await client.query("ROLLBACK");
        return res.json({
          passed: false,
          heartsLeft: 0,
          results: grading.results,
          xpEarned: 0,
        });
      }

      const alreadyDone = completed.has(lesson.id);
      const xpEarned = xpForLesson(lesson.xpReward, heartsLeft);

      await client.query(
        `INSERT INTO lesson_progress (user_id, lesson_id, xp_earned, hearts_left)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, lesson_id) DO NOTHING`,
        [req.user.id, lesson.id, xpEarned, heartsLeft],
      );

      // sourceRef = id da lição, por isso repetir a lição nunca paga duas vezes.
      const award = await awardXp(client, {
        userId: req.user.id,
        source: "lesson",
        sourceRef: lesson.id,
        amount: xpEarned,
        timeZone,
      });

      const daily = await loadDailyState(client, req.user.id, { timeZone });
      const streakBonus = await awardStreakBonus(client, req.user.id, {
        streak: daily.streak,
        today: daily.today,
        timeZone,
      });

      const path = await buildPath(client, req.user.id);

      await client.query("COMMIT");

      res.json({
        passed: true,
        alreadyCompleted: alreadyDone,
        heartsLeft,
        results: grading.results,
        xpEarned: award.amount,
        streakBonus: streakBonus.amount ?? 0,
        streak: daily.streak,
        totalXp: streakBonus.xp ?? award.xp,
        level: streakBonus.level ?? award.level,
        path,
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
