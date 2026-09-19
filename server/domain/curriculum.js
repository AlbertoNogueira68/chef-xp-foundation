import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateCurriculum } from "./curriculumValidation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const caminhos = {
  en: path.resolve(__dirname, "../../shared/curriculum.json"),
  pt: path.resolve(__dirname, "../../shared/curriculum.pt.json"),
};

export const LANGUAGES = Object.keys(caminhos);
export const DEFAULT_LANGUAGE = "en";

/**
 * O currículo existe nas duas línguas, com os **mesmos ids**.
 *
 * Isso é o que permite servir português sem tocar em lógica nenhuma: o
 * progresso, o XP e a ordem das lições andam sobre ids, e a língua só decide
 * qual dos dois textos sai. E como a correção das respostas compara o que o
 * utilizador escolheu com o gabarito da mesma versão, uma opção em português
 * é comparada com a resposta certa em português.
 */
function carregar(caminho) {
  const raw = JSON.parse(fs.readFileSync(caminho, "utf8"));

  /**
   * Um erro no currículo é um erro de código: falha no arranque, tal como o
   * `validateEnv`. Um percurso que exige uma competência ainda não ensinada é
   * pior do que um servidor que não sobe.
   */
  const check = validateCurriculum(raw);
  if (!check.ok) {
    throw new Error(
      `Currículo inválido (${path.basename(caminho)}):\n  - ${check.errors.join("\n  - ")}`,
    );
  }

  const units = raw.units;
  const lessons = units.flatMap((unit) => unit.lessons);

  return {
    curriculum: raw,
    skills: raw.skills,
    missions: raw.missions,
    units,
    lessons,
    lessonsById: new Map(lessons.map((lesson) => [lesson.id, lesson])),
    lessonOrder: lessons.map((lesson) => lesson.id),
    skillsById: new Map(raw.skills.map((skill) => [skill.id, skill])),
    missionsById: new Map(raw.missions.map((mission) => [mission.id, mission])),
    unitByLessonId: new Map(
      units.flatMap((unit) => unit.lessons.map((lesson) => [lesson.id, unit])),
    ),
  };
}

const POR_LINGUA = Object.fromEntries(
  Object.entries(caminhos).map(([lingua, caminho]) => [lingua, carregar(caminho)]),
);

/** O conjunto do currículo numa língua. Uma língua desconhecida cai no inglês. */
export function curriculumFor(lang = DEFAULT_LANGUAGE) {
  return POR_LINGUA[lang] ?? POR_LINGUA[DEFAULT_LANGUAGE];
}

/*
 * As versões sem língua são as inglesas, e são as que o resto do servidor usa
 * quando o texto não vai para o ecrã de ninguém — a sincronização com a base
 * de dados, por exemplo.
 */
const ingles = POR_LINGUA[DEFAULT_LANGUAGE];
export const CURRICULUM = ingles.curriculum;
export const SKILLS = ingles.skills;
export const MISSIONS = ingles.missions;

/** Compatibilidade: o resto do servidor trata o currículo como lista de unidades. */
export const LEARNING_CURRICULUM = ingles.units;

export function getAllLessons(lang) {
  return curriculumFor(lang).lessons;
}

export function getLesson(id, lang) {
  return curriculumFor(lang).lessonsById.get(id) ?? null;
}

export function getLessonIndex(id) {
  return ingles.lessonOrder.indexOf(id);
}

export function getLessonOrder() {
  return [...ingles.lessonOrder];
}

export function getSkill(id, lang) {
  return curriculumFor(lang).skillsById.get(id) ?? null;
}

export function getUnitOfLesson(id, lang) {
  return curriculumFor(lang).unitByLessonId.get(id) ?? null;
}

/** Competências que uma lição ensina, já resolvidas em objetos. */
export function getLessonSkills(lesson, lang) {
  const { skillsById } = curriculumFor(lang);
  return {
    teaches: (lesson.teaches ?? []).map((id) => skillsById.get(id)).filter(Boolean),
    requires: (lesson.requires ?? []).map((id) => skillsById.get(id)).filter(Boolean),
  };
}

/**
 * Baralha de forma determinística: a mesma pergunta dá sempre a mesma ordem.
 * Sem isto, recarregar a página remexia os passos e parecia um bug — mas a
 * ordem também não pode ser a de autoria, senão o gabarito ia no payload.
 */
function seededShuffle(items, seed) {
  let state = 0;
  for (let i = 0; i < seed.length; i += 1) {
    state = (state * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Versão do exercício segura para o cliente. Sai tudo o que revela a resposta:
 * `correctAnswer`, `correctOrder`, `explanation` e `explainWrong`. Nos
 * exercícios de ordenar, os passos vão baralhados — enviá-los pela ordem de
 * autoria era entregar o gabarito na mesma.
 */
function toClientQuestion(question) {
  const { correctAnswer, correctOrder, explanation, explainWrong, ...rest } = question;

  if (question.type === "order") {
    return { ...rest, items: seededShuffle(correctOrder, question.id) };
  }
  return rest;
}

export function toClientLesson(lesson) {
  return {
    ...lesson,
    questions: lesson.questions.map(toClientQuestion),
  };
}

/**
 * Uma resposta por tipo. `choice` e `judge` comparam texto; `order` compara a
 * sequência inteira; `estimate` aceita qualquer valor dentro da tolerância —
 * ninguém acerta 180 ml de água ao mililitro, e exigi-lo ensinaria a decorar
 * em vez de estimar.
 */
export function isAnswerCorrect(question, answer) {
  switch (question.type) {
    case "choice":
    case "judge":
      return answer === question.correctAnswer;

    case "order": {
      if (!Array.isArray(answer)) return false;
      if (answer.length !== question.correctOrder.length) return false;
      return answer.every((step, i) => step === question.correctOrder[i]);
    }

    case "estimate": {
      const given = Number(answer);
      if (!Number.isFinite(given)) return false;
      return Math.abs(given - question.correctAnswer) <= question.tolerance;
    }

    default:
      return false;
  }
}

/**
 * Corrige um conjunto de respostas. Devolve, por pergunta, se estava certa, a
 * explicação, e — quando errou — o `explainWrong`, que diz *porquê*.
 */
export function gradeAnswers(lesson, answers) {
  const given = new Map(
    (Array.isArray(answers) ? answers : []).map((a) => [String(a?.questionId), a?.answer]),
  );

  const results = lesson.questions.map((question) => {
    const answer = given.has(question.id) ? given.get(question.id) : null;
    const correct = answer === null ? false : isAnswerCorrect(question, answer);

    return {
      questionId: question.id,
      answer: answer ?? null,
      correct,
      correctAnswer: question.type === "order" ? question.correctOrder : question.correctAnswer,
      explanation: question.explanation,
      explainWrong: correct ? null : question.explainWrong,
      skills: question.skills ?? [],
    };
  });

  const wrong = results.filter((r) => !r.correct).length;
  return { results, wrong, correct: results.length - wrong, total: results.length };
}
