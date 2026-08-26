import test from "node:test";
import assert from "node:assert/strict";

import {
  LEARNING_CURRICULUM,
  gradeAnswers,
  getAllLessons,
  getLesson,
  getLessonIndex,
  getLessonOrder,
  toClientLesson,
} from "./curriculum.js";

const lessons = getAllLessons();

test("o currículo carrega e tem conteúdo", () => {
  assert.ok(LEARNING_CURRICULUM.length > 0);
  assert.ok(lessons.length > 0);
});

test("os ids das lições são únicos", () => {
  const ids = lessons.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("cada lição está completa e é jogável", () => {
  for (const lesson of lessons) {
    assert.ok(lesson.title, `${lesson.id} sem título`);
    assert.ok(lesson.xpReward > 0, `${lesson.id} sem XP`);
    assert.ok(lesson.preparationSteps.length > 0, `${lesson.id} sem passos de preparação`);
    assert.ok(lesson.questions.length > 0, `${lesson.id} sem perguntas`);
  }
});

test("a resposta certa está sempre entre as opções", () => {
  for (const lesson of lessons) {
    for (const question of lesson.questions) {
      if (!question.options) continue;
      assert.ok(
        question.options.includes(question.correctAnswer),
        `${lesson.id}/${question.id}: a resposta certa não está nas opções`,
      );
    }
  }
});

test("toClientLesson não deixa escapar o gabarito", () => {
  const payload = JSON.stringify(toClientLesson(getLesson(lessons[0].id)));
  assert.ok(!payload.includes("correctAnswer"));
  assert.ok(!payload.includes("explanation"));
});

test("a ordem das lições é estável e conhecida", () => {
  const order = getLessonOrder();
  assert.equal(order.length, lessons.length);
  assert.equal(getLessonIndex(order[0]), 0);
  assert.equal(getLessonIndex("nao-existe"), -1);
});

test("respostas todas certas dão zero erros", () => {
  const lesson = lessons[0];
  const answers = lesson.questions.map((q) => ({
    questionId: q.id,
    answer: q.correctAnswer,
  }));
  const result = gradeAnswers(lesson, answers);
  assert.equal(result.wrong, 0);
  assert.equal(result.correct, lesson.questions.length);
});

test("não responder conta como errado — não se ganha XP por silêncio", () => {
  const lesson = lessons[0];
  const result = gradeAnswers(lesson, []);
  assert.equal(result.wrong, lesson.questions.length);
});

test("gradeAnswers ignora perguntas que não pertencem à lição", () => {
  const lesson = lessons[0];
  const result = gradeAnswers(lesson, [{ questionId: "inventada", answer: "x" }]);
  assert.equal(result.total, lesson.questions.length);
});

test("gradeAnswers aguenta entrada malformada", () => {
  const lesson = lessons[0];
  assert.doesNotThrow(() => gradeAnswers(lesson, null));
  assert.doesNotThrow(() => gradeAnswers(lesson, [null]));
});
