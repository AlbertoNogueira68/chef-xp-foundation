import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const curriculumPath = path.resolve(__dirname, "../../shared/curriculum.json");

/** @type {Array<{id:string,title:string,subtitle:string,color:string,lessons:any[]}>} */
export const LEARNING_CURRICULUM = JSON.parse(fs.readFileSync(curriculumPath, "utf8"));

const allLessons = LEARNING_CURRICULUM.flatMap((unit) => unit.lessons);
const lessonsById = new Map(allLessons.map((lesson) => [lesson.id, lesson]));
const lessonOrder = allLessons.map((lesson) => lesson.id);

export function getAllLessons() {
  return allLessons;
}

export function getLesson(id) {
  return lessonsById.get(id) ?? null;
}

export function getLessonIndex(id) {
  return lessonOrder.indexOf(id);
}

export function getLessonOrder() {
  return [...lessonOrder];
}

/**
 * Versão da lição segura para enviar ao cliente: sem `correctAnswer` e sem
 * `explanation`. As respostas certas nunca saem do servidor antes de o
 * utilizador responder.
 */
export function toClientLesson(lesson) {
  return {
    ...lesson,
    questions: lesson.questions.map(({ correctAnswer, explanation, ...rest }) => rest),
  };
}

/**
 * Corrige um conjunto de respostas. Devolve, por pergunta, se estava certa e
 * a explicação — que só agora é revelada.
 */
export function gradeAnswers(lesson, answers) {
  const given = new Map(
    (Array.isArray(answers) ? answers : []).map((a) => [String(a?.questionId), a?.answer]),
  );

  const results = lesson.questions.map((question) => {
    const answer = given.get(question.id);
    return {
      questionId: question.id,
      answer: answer ?? null,
      correct: answer === question.correctAnswer,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
    };
  });

  const wrong = results.filter((r) => !r.correct).length;
  return { results, wrong, correct: results.length - wrong, total: results.length };
}
