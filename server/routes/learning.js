import { Router } from "express";
import { getPool } from "../db/index.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { answerSubmitSchema, lessonCompleteSchema, lessonParamSchema } from "../schemas/index.js";
import {
  gradeAnswers,
  isAnswerCorrect,
  getLesson,
  getLessonIndex,
  getLessonOrder,
  toClientLesson,
  curriculumFor,
  trailExists,
  DEFAULT_TRAIL,
} from "../domain/curriculum.js";
import { MAX_HEARTS, xpForLesson } from "../domain/xp.js";
import { awardStreakBonus, awardXp, loadDailyState } from "../lib/xpLedger.js";
import {
  getAllAvailableTrails,
  getTrailCurriculum,
  getUserTrails,
  isTrailPublished,
  startUserTrail,
  deleteUserTrail,
} from "../services/trailService.js";

const router = Router();

router.use(requireAuth);

/**
 * Resolve `?trailId=` uma vez por pedido.
 *
 * `curriculumFor` atira num trilho desconhecido — de propósito, para nunca
 * servir o currículo errado em silêncio — por isso um id vindo de fora tem de
 * ser recusado aqui, com 404, antes de chegar ao domínio. Um rascunho por
 * publicar também não se serve: publicar é o que o torna visível, e sem esta
 * verificação bastava adivinhar o id para ler conteúdo que ainda não saiu.
 */
const resolveTrail = asyncHandler(async (req, res, next) => {
  const trailId = req.query.trailId ?? DEFAULT_TRAIL;

  if (!trailExists(trailId)) {
    return res.status(404).json({ error: "Trail not found" });
  }

  if (trailId !== DEFAULT_TRAIL && req.user.role === "user") {
    if (!(await isTrailPublished(getPool(), trailId))) {
      return res.status(404).json({ error: "Trail not found" });
    }
  }

  req.trailId = trailId;
  next();
});

router.use(resolveTrail);

async function loadCompletedIds(client, userId, trailId = DEFAULT_TRAIL) {
  const { rows } = await client.query(
    `SELECT lesson_id FROM lesson_progress WHERE user_id = $1 AND trail_id = $2`,
    [userId, trailId],
  );
  return new Set(rows.map((row) => row.lesson_id));
}

/**
 * Estados do percurso: tudo o que já foi feito é "completed", a primeira por
 * fazer é "current", as seguintes ficam trancadas. A ordem é a do currículo.
 */
function buildStatuses(completed, trailId = DEFAULT_TRAIL) {
  const statuses = new Map();
  let foundCurrent = false;

  for (const lessonId of getLessonOrder(trailId)) {
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

async function buildPath(client, userId, lang = "en", trailId = DEFAULT_TRAIL) {
  const { rows: userRows } = await client.query(
    `SELECT time_zone, daily_xp_goal FROM users WHERE id = $1`,
    [userId],
  );
  const timeZone = userRows[0]?.time_zone ?? "UTC";
  const dailyXpGoal = Number(userRows[0]?.daily_xp_goal ?? 50);

  const completed = await loadCompletedIds(client, userId, trailId);
  const statuses = buildStatuses(completed, trailId);
  const daily = await loadDailyState(client, userId, { timeZone });

  const {
    units: unidades,
    missions,
    skills,
    lessons: todasAsLicoes,
  } = curriculumFor(lang, trailId);

  const units = unidades.map((unit) => ({
    id: unit.id,
    title: unit.title,
    subtitle: unit.subtitle,
    color: unit.color,
    // A missão é o que fecha a unidade. Sem ela no percurso, o utilizador vê
    // seis lições e nenhuma razão para as fazer.
    mission: missions.find((mission) => mission.id === unit.missionId) ?? null,
    lessons: unit.lessons.map((lesson) => ({
      ...toClientLesson(lesson),
      status: statuses.get(lesson.id) ?? "locked",
    })),
  }));

  // As competências que as lições já concluídas ensinaram. É a diferença
  // entre "fizeste 3 lições" e "sabes segurar uma faca".
  const learnedSkills = [
    ...new Set(
      todasAsLicoes
        .filter((lesson) => completed.has(lesson.id))
        .flatMap((lesson) => lesson.teaches ?? []),
    ),
  ];

  return {
    units,
    // Catálogo de competências: o cliente tem os ids nas lições, mas não os
    // nomes legíveis.
    skills: skills.map(({ id, name, category, description }) => ({
      id,
      name,
      category,
      description,
    })),
    progress: {
      completedLessonIds: [...completed],
      learnedSkills,
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
    const trailId = req.trailId;
    res.json(await buildPath(getPool(), req.user.id, req.lang, trailId));
  }),
);

router.get(
  "/progress",
  asyncHandler(async (req, res) => {
    const trailId = req.trailId;
    const path = await buildPath(getPool(), req.user.id, req.lang, trailId);
    res.json({ progress: path.progress });
  }),
);

router.get(
  "/lessons/:id",
  validate({ params: lessonParamSchema }),
  asyncHandler(async (req, res) => {
    const trailId = req.trailId;
    const lesson = getLesson(req.valid.params.id, req.lang, trailId);
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });

    const completed = await loadCompletedIds(getPool(), req.user.id, trailId);
    const status = buildStatuses(completed, trailId).get(lesson.id);
    if (status === "locked") {
      return res.status(403).json({ error: "Finish the earlier lessons first" });
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
  validate({ params: lessonParamSchema, body: answerSubmitSchema }),
  asyncHandler(async (req, res) => {
    const trailId = req.trailId;
    const lesson = getLesson(req.valid.params.id, req.lang, trailId);
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });

    const { questionId, answer } = req.valid.body;
    const question = lesson.questions.find((q) => q.id === questionId);
    if (!question) return res.status(400).json({ error: "Invalid question" });

    const correct = isAnswerCorrect(question, answer);

    res.json({
      questionId,
      correct,
      // `order` não tem uma resposta única em texto: o que se devolve é a
      // sequência certa, para o cliente a poder mostrar lado a lado.
      correctAnswer: question.type === "order" ? question.correctOrder : question.correctAnswer,
      explanation: question.explanation,
      // Só aparece quando se erra. É a diferença entre corrigir e ensinar.
      explainWrong: correct ? null : question.explainWrong,
      skills: question.skills ?? [],
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
    const trailId = req.trailId;
    const lesson = getLesson(req.valid.params.id, req.lang, trailId);
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const { rows: userRows } = await client.query(
        `SELECT time_zone FROM users WHERE id = $1 FOR UPDATE`,
        [req.user.id],
      );
      const timeZone = userRows[0]?.time_zone ?? "UTC";

      const completed = await loadCompletedIds(client, req.user.id, trailId);

      // Não se salta lições: todas as anteriores têm de estar feitas.
      const index = getLessonIndex(lesson.id, trailId);
      const previous = getLessonOrder(trailId).slice(0, index);
      const missing = previous.filter((id) => !completed.has(id));
      if (missing.length > 0) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Finish the earlier lessons first" });
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
        `INSERT INTO lesson_progress (user_id, lesson_id, trail_id, xp_earned, hearts_left)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, lesson_id) DO NOTHING`,
        [req.user.id, lesson.id, trailId, xpEarned, heartsLeft],
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

      const path = await buildPath(client, req.user.id, req.lang, trailId);

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

/* ---------------------------------------------------------------- *
 * Trilhos
 * ---------------------------------------------------------------- */

/** Os trilhos que dá para escolher: publicados e com currículo carregado. */
router.get(
  "/trails",
  asyncHandler(async (req, res) => {
    const [trails, mine] = await Promise.all([
      getAllAvailableTrails(getPool()),
      getUserTrails(getPool(), req.user.id),
    ]);

    // Sem isto o cliente tinha de cruzar duas listas para saber em quais já
    // anda — e o cartão pisca entre "Começar" e "Continuar" enquanto a
    // segunda não chega.
    const started = new Set(mine.map((trail) => trail.id));
    res.json({ trails: trails.map((trail) => ({ ...trail, started: started.has(trail.id) })) });
  }),
);

router.get(
  "/my-trails",
  asyncHandler(async (req, res) => {
    res.json({ trails: await getUserTrails(getPool(), req.user.id) });
  }),
);

/** O currículo em bruto de um trilho, para o painel e para pré-visualizar. */
router.get(
  "/trails/:trailId",
  asyncHandler(async (req, res) => {
    const { trailId } = req.params;

    if (req.user.role === "user" && !(await isTrailPublished(getPool(), trailId))) {
      return res.status(404).json({ error: "Trail not found" });
    }

    const loaded = getTrailCurriculum(trailId, req.lang);
    if (!loaded) return res.status(404).json({ error: "Trail not found" });

    res.json({ trail: trailId, curriculum: loaded.curriculum });
  }),
);

router.post(
  "/trails/:trailId/start",
  asyncHandler(async (req, res) => {
    const progress = await startUserTrail(getPool(), req.user.id, req.params.trailId);
    if (!progress) return res.status(404).json({ error: "Trail not found" });
    res.json({ progress });
  }),
);

/**
 * Sair de um trilho. Tira-o da lista de "os meus" e nada mais: as lições
 * feitas ficam em `lesson_progress`, para quem volta não recomeçar do zero.
 */
router.delete(
  "/trails/:trailId",
  asyncHandler(async (req, res) => {
    const removed = await deleteUserTrail(getPool(), req.user.id, req.params.trailId);
    if (!removed) return res.status(404).json({ error: "You are not on that trail" });
    res.json({ left: req.params.trailId });
  }),
);

export default router;
