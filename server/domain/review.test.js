import test from "node:test";
import assert from "node:assert/strict";

import {
  REVIEW_INTERVALS_DAYS,
  REVIEW_MASTERED_STREAK,
  REVIEW_SESSION_SIZE,
  REVIEW_XP,
  buildReviewQueue,
  countDue,
  daysBetween,
  intervalForStreak,
  isDue,
  isMastered,
  reviewXp,
} from "./review.js";
import { xpForLesson } from "./xp.js";

/** Uma data ISO a partir de um dia, para os testes se lerem como calendário. */
const dia = (iso) => new Date(`${iso}T12:00:00Z`);

/** Uma lição com as perguntas que se lhe derem, pelos ids. */
function licao(id, ...questionIds) {
  return {
    id,
    title: `Lição ${id}`,
    questions: questionIds.map((qid) => ({ id: qid, type: "choice", prompt: qid })),
  };
}

/** Uma entrada de histórico. */
function historico(
  lessonId,
  questionId,
  { lastAnsweredAt, lastCorrect = true, correctStreak = 1, attempts = 1 },
) {
  return { lessonId, questionId, attempts, lastAnsweredAt, lastCorrect, correctStreak };
}

/* ---------------------------------------------------------------- *
 * A escada de intervalos
 * ---------------------------------------------------------------- */

test("a escada de intervalos é estritamente crescente", () => {
  for (let i = 1; i < REVIEW_INTERVALS_DAYS.length; i += 1) {
    assert.ok(
      REVIEW_INTERVALS_DAYS[i] > REVIEW_INTERVALS_DAYS[i - 1],
      `o degrau ${i} devia ser maior do que o ${i - 1}`,
    );
  }
});

test("errar traz a pergunta de volta no mesmo dia", () => {
  assert.equal(intervalForStreak(0), 0);
  // Um streak negativo não devia existir, mas se aparecer é tratado como erro.
  assert.equal(intervalForStreak(-3), 0);
});

test("cada acerto seguido empurra a pergunta para mais longe", () => {
  assert.equal(intervalForStreak(1), 1);
  assert.equal(intervalForStreak(2), 3);
  assert.equal(intervalForStreak(3), 7);
});

test("acima do último degrau o intervalo não cresce mais", () => {
  const ultimo = REVIEW_INTERVALS_DAYS[REVIEW_INTERVALS_DAYS.length - 1];
  assert.equal(intervalForStreak(REVIEW_INTERVALS_DAYS.length), ultimo);
  assert.equal(intervalForStreak(999), ultimo);
});

test("uma pergunta sabida sai da rotação", () => {
  assert.equal(isMastered({ correctStreak: REVIEW_MASTERED_STREAK }), true);
  assert.equal(isMastered({ correctStreak: REVIEW_MASTERED_STREAK - 1 }), false);
  assert.equal(isMastered(undefined), false);
});

/* ---------------------------------------------------------------- *
 * Dias de calendário, não períodos de 24 horas
 * ---------------------------------------------------------------- */

test("responder à noite e voltar na manhã seguinte conta como um dia", () => {
  // Nove horas de intervalo, mas dois dias de calendário em Lisboa.
  const ontem = new Date("2026-03-10T23:00:00Z");
  const hoje = new Date("2026-03-11T08:00:00Z");
  assert.equal(daysBetween(ontem, hoje, "Europe/Lisbon"), 1);
});

test("o mesmo dia de calendário são zero dias, por muitas horas que passem", () => {
  const manha = new Date("2026-03-10T07:00:00Z");
  const noite = new Date("2026-03-10T22:00:00Z");
  assert.equal(daysBetween(manha, noite, "Europe/Lisbon"), 0);
});

test("o fuso de quem estuda é que decide a viragem do dia", () => {
  const instante = new Date("2026-03-10T23:30:00Z");
  const seguinte = new Date("2026-03-11T00:30:00Z");
  // Em Lisboa (UTC no inverno) virou o dia; em Los Angeles ainda é dia 10.
  assert.equal(daysBetween(instante, seguinte, "Europe/Lisbon"), 1);
  assert.equal(daysBetween(instante, seguinte, "America/Los_Angeles"), 0);
});

test("a mudança para a hora de verão não inventa nem perde um dia", () => {
  // Em Portugal os relógios adiantam na madrugada de 29 de março de 2026.
  const antes = new Date("2026-03-28T12:00:00Z");
  const depois = new Date("2026-03-29T12:00:00Z");
  assert.equal(daysBetween(antes, depois, "Europe/Lisbon"), 1);
});

/* ---------------------------------------------------------------- *
 * Quando é que uma pergunta está pronta
 * ---------------------------------------------------------------- */

test("uma pergunta nunca respondida não entra na revisão", () => {
  assert.equal(isDue(undefined, dia("2026-04-01")), false);
  assert.equal(isDue({ attempts: 0, correctStreak: 0 }, dia("2026-04-01")), false);
});

test("uma pergunta errada hoje está pronta hoje", () => {
  const h = historico("l1", "q1", {
    lastAnsweredAt: dia("2026-04-01"),
    lastCorrect: false,
    correctStreak: 0,
  });
  assert.equal(isDue(h, dia("2026-04-01")), true);
});

test("uma pergunta acertada ontem só volta amanhã", () => {
  const h = historico("l1", "q1", { lastAnsweredAt: dia("2026-04-01"), correctStreak: 1 });
  assert.equal(isDue(h, dia("2026-04-01")), false, "no mesmo dia ainda não");
  assert.equal(isDue(h, dia("2026-04-02")), true, "um dia depois, sim");
});

test("uma pergunta sabida não volta, por muito tempo que passe", () => {
  const h = historico("l1", "q1", {
    lastAnsweredAt: dia("2020-01-01"),
    correctStreak: REVIEW_MASTERED_STREAK,
  });
  assert.equal(isDue(h, dia("2026-04-01")), false);
});

/* ---------------------------------------------------------------- *
 * A sessão
 * ---------------------------------------------------------------- */

test("só entram perguntas de lições concluídas", () => {
  const fila = buildReviewQueue({
    lessons: [licao("l1", "q1"), licao("l2", "q2")],
    history: [
      historico("l1", "q1", { lastAnsweredAt: dia("2026-04-01"), correctStreak: 1 }),
      historico("l2", "q2", { lastAnsweredAt: dia("2026-04-01"), correctStreak: 1 }),
    ],
    completedLessonIds: ["l1"],
    now: dia("2026-04-05"),
  });

  assert.deepEqual(
    fila.map((i) => i.question.id),
    ["q1"],
  );
});

test("o que se errou na última vez vem primeiro", () => {
  const fila = buildReviewQueue({
    lessons: [licao("l1", "acertada", "errada")],
    history: [
      // A acertada está atrasadíssima; a errada é de hoje. Mesmo assim, a
      // errada vem à frente — errar é o sinal mais forte.
      historico("l1", "acertada", { lastAnsweredAt: dia("2026-01-01"), correctStreak: 1 }),
      historico("l1", "errada", {
        lastAnsweredAt: dia("2026-04-05"),
        lastCorrect: false,
        correctStreak: 0,
      }),
    ],
    completedLessonIds: ["l1"],
    now: dia("2026-04-05"),
  });

  assert.equal(fila[0].question.id, "errada");
  assert.equal(fila[1].question.id, "acertada");
});

test("entre duas acertadas, ganha a que está em atraso há mais tempo", () => {
  const fila = buildReviewQueue({
    lessons: [licao("l1", "antiga", "recente")],
    history: [
      historico("l1", "antiga", { lastAnsweredAt: dia("2026-01-01"), correctStreak: 1 }),
      historico("l1", "recente", { lastAnsweredAt: dia("2026-04-01"), correctStreak: 1 }),
    ],
    completedLessonIds: ["l1"],
    now: dia("2026-04-05"),
  });

  assert.equal(fila[0].question.id, "antiga");
});

test("a sessão não passa do tamanho pedido, e o resto fica para a próxima", () => {
  const ids = Array.from({ length: 30 }, (_, i) => `q${String(i).padStart(2, "0")}`);
  const argumentos = {
    lessons: [licao("l1", ...ids)],
    history: ids.map((id) =>
      historico("l1", id, { lastAnsweredAt: dia("2026-01-01"), correctStreak: 1 }),
    ),
    completedLessonIds: ["l1"],
    now: dia("2026-04-05"),
  };

  assert.equal(buildReviewQueue(argumentos).length, REVIEW_SESSION_SIZE);
  assert.equal(countDue(argumentos), 30, "a dívida toda continua a contar-se");
});

test("a mesma entrada dá sempre a mesma sessão", () => {
  const argumentos = {
    lessons: [licao("l1", "a", "b", "c")],
    history: ["a", "b", "c"].map((id) =>
      historico("l1", id, { lastAnsweredAt: dia("2026-01-01"), correctStreak: 1 }),
    ),
    completedLessonIds: ["l1"],
    now: dia("2026-04-05"),
  };

  const primeira = buildReviewQueue(argumentos).map((i) => i.question.id);
  const segunda = buildReviewQueue(argumentos).map((i) => i.question.id);
  assert.deepEqual(primeira, segunda);
});

test("sem histórico não há nada a rever", () => {
  assert.deepEqual(
    buildReviewQueue({ lessons: [licao("l1", "q1")], completedLessonIds: ["l1"] }),
    [],
  );
  assert.equal(countDue({}), 0);
});

/* ---------------------------------------------------------------- *
 * O XP
 * ---------------------------------------------------------------- */

test("uma sessão perfeita paga a base inteira mais o bónus", () => {
  assert.equal(reviewXp({ total: 8, correct: 8 }), REVIEW_XP.session + REVIEW_XP.perfect);
});

test("meia sessão certa paga cerca de metade, e sem bónus", () => {
  assert.equal(reviewXp({ total: 8, correct: 4 }), Math.round(REVIEW_XP.session / 2));
});

test("uma sessão sem acertos não paga nada", () => {
  assert.equal(reviewXp({ total: 8, correct: 0 }), 0);
});

test("rever vale menos do que aprender de novo", () => {
  // O ponto é de produto, não de aritmética: se a revisão pagasse mais, o
  // caminho mais rápido para subir de nível era nunca avançar no percurso.
  const licaoNormal = xpForLesson(50, 3);
  assert.ok(
    reviewXp({ total: 8, correct: 8 }) < licaoNormal,
    "a melhor revisão possível devia valer menos do que uma lição feita sem erros",
  );
});

test("números disparatados não pagam", () => {
  assert.equal(reviewXp({ total: 0, correct: 0 }), 0);
  assert.equal(reviewXp({ total: 8, correct: -2 }), 0);
});
