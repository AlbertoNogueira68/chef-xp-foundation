import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateCurriculum } from "./curriculumValidation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRAILS_DIR = path.resolve(__dirname, "../../shared/trails");

export const LANGUAGES = ["en", "pt"];
export const DEFAULT_LANGUAGE = "en";
export const DEFAULT_TRAIL = "main-course";

/**
 * O currículo existe nas duas línguas, com os **mesmos ids**.
 *
 * Isso é o que permite servir português sem tocar em lógica nenhuma: o
 * progresso, o XP e a ordem das lições andam sobre ids, e a língua só decide
 * qual dos dois textos sai. E como a correção das respostas compara o que o
 * utilizador escolheu com o gabarito da mesma versão, uma opção em português
 * é comparada com a resposta certa em português.
 */
/** Constrói os índices por id. Assume um currículo já validado. */
function indexar(raw) {
  const units = raw.units;
  const lessons = units.flatMap((unit) => unit.lessons);
  const missions = raw.missions ?? [];

  return {
    curriculum: raw,
    skills: raw.skills,
    missions,
    units,
    lessons,
    lessonsById: new Map(lessons.map((lesson) => [lesson.id, lesson])),
    lessonOrder: lessons.map((lesson) => lesson.id),
    skillsById: new Map(raw.skills.map((skill) => [skill.id, skill])),
    missionsById: new Map(missions.map((mission) => [mission.id, mission])),
    unitByLessonId: new Map(
      units.flatMap((unit) => unit.lessons.map((lesson) => [lesson.id, unit])),
    ),
  };
}

function carregar(caminho, { inheritedSkills = [] } = {}) {
  const raw = JSON.parse(fs.readFileSync(caminho, "utf8"));

  /**
   * Um erro num currículo de ficheiro é um erro de código: falha no arranque,
   * tal como o `validateEnv`. Um percurso que exige uma competência ainda não
   * ensinada é pior do que um servidor que não sobe.
   */
  const check = validateCurriculum(raw, { inheritedSkills });
  if (!check.ok) {
    throw new Error(
      `Currículo inválido (${path.basename(caminho)}):\n  - ${check.errors.join("\n  - ")}`,
    );
  }

  return indexar(raw);
}

/**
 * O trilho fundacional vive em `shared/curriculum.json`, onde sempre viveu.
 * Os especializados vivem em `shared/trails/<id>.json`, com a variante
 * portuguesa em `<id>.pt.json`. O id do trilho é o nome do ficheiro — é ele
 * que casa com `trails.id` na base de dados, e um id que viesse de dentro do
 * JSON podia divergir do ficheiro sem ninguém dar por isso.
 */
const mainCoursePaths = {
  en: path.resolve(__dirname, "../../shared/curriculum.json"),
  pt: path.resolve(__dirname, "../../shared/curriculum.pt.json"),
};

const TRAILS_BY_ID = {};

const mainCourseByLang = Object.fromEntries(
  Object.entries(mainCoursePaths).map(([lingua, caminho]) => [lingua, carregar(caminho)]),
);
TRAILS_BY_ID[DEFAULT_TRAIL] = mainCourseByLang;

/**
 * Um trilho especializado herda as competências do fundacional: o de cozinha
 * italiana exige `calor.lume-brando` para reduzir um tomate sem a reensinar.
 * Sem isto, ou cada trilho repetia os fundamentos ou o validador recusava-os.
 */
const FOUNDATIONAL_SKILL_IDS = mainCourseByLang[DEFAULT_LANGUAGE].skills.map((skill) => skill.id);

/** `italian.json` → `{ id: "italian", lang: "en" }`; `italian.pt.json` → `pt`. */
function parseTrailFile(filename) {
  const match = filename.match(/^([a-z0-9-]+)(?:\.([a-z]{2}))?\.json$/i);
  if (!match) return null;

  const [, id, lang = DEFAULT_LANGUAGE] = match;
  if (!LANGUAGES.includes(lang)) return null;
  if (id === DEFAULT_TRAIL) return null;
  return { id, lang };
}

function loadAllTrails() {
  if (!fs.existsSync(TRAILS_DIR)) return;

  for (const filename of fs.readdirSync(TRAILS_DIR).sort()) {
    const parsed = parseTrailFile(filename);
    if (!parsed) continue;

    const caminho = path.resolve(TRAILS_DIR, filename);
    // Um trilho inválido rebenta o arranque, tal como o fundacional: servir
    // meio trilho é pior do que não subir.
    const loaded = carregar(caminho, { inheritedSkills: FOUNDATIONAL_SKILL_IDS });

    TRAILS_BY_ID[parsed.id] ??= {};
    TRAILS_BY_ID[parsed.id][parsed.lang] = loaded;
  }

  for (const trailId of Object.keys(TRAILS_BY_ID)) {
    const colisao = lessonIdCollision(trailId, TRAILS_BY_ID[trailId][DEFAULT_LANGUAGE].lessonOrder);
    if (colisao) throw new Error(colisao);
  }
}

/**
 * Ids de lição repetidos entre trilhos tornariam `lesson_skills` ambíguo e
 * fariam duas lições diferentes partilhar a mesma linha de progresso — é por
 * eles serem únicos que `lesson_progress` não precisa do trilho na chave. O
 * validador só vê um trilho de cada vez, por isso a colisão deteta-se aqui.
 */
function lessonIdCollision(trailId, lessonOrder) {
  for (const [outroId, porLingua] of Object.entries(TRAILS_BY_ID)) {
    if (outroId === trailId) continue;

    const outras = new Set(porLingua[DEFAULT_LANGUAGE]?.lessonOrder ?? []);
    const repetida = lessonOrder.find((lessonId) => outras.has(lessonId));
    if (repetida) {
      return `Lição ${repetida} aparece em dois trilhos (${outroId} e ${trailId}): os ids têm de ser únicos.`;
    }
  }
  return null;
}

loadAllTrails();

/** Os ids de todos os trilhos carregados, com o fundacional à cabeça. */
export function getAllTrailIds() {
  return Object.keys(TRAILS_BY_ID);
}

export function trailExists(trailId) {
  return Object.hasOwn(TRAILS_BY_ID, trailId);
}

/**
 * O conjunto do currículo de um trilho numa língua.
 *
 * Um trilho desconhecido atira. Devolver o fundacional em silêncio era o pior
 * dos mundos: quem pedisse o trilho italiano recebia as lições dos
 * fundamentos e nada no caminho dizia que estava a ver outra coisa. Quem
 * aceita um id vindo de fora chama `trailExists` primeiro e responde 404.
 */
export function curriculumFor(lang = DEFAULT_LANGUAGE, trailId = DEFAULT_TRAIL) {
  const trail = TRAILS_BY_ID[trailId];
  if (!trail) throw new Error(`Trilho desconhecido: ${trailId}`);
  return trail[lang] ?? trail[DEFAULT_LANGUAGE];
}

/**
 * O nome e a descrição de um trilho, na língua pedida.
 *
 * Vivem no JSON do currículo, que existe por língua. A linha da base de dados
 * guarda o *estado* do trilho — se está publicado, em que ordem aparece — e
 * não o texto: uma coluna só não tem onde pôr as duas línguas, e era por isso
 * que o catálogo aparecia em inglês a quem tinha a app em português.
 *
 * Devolve só os campos que o JSON traz. Um trilho que não os declare mantém o
 * que estiver na base de dados, em vez de ficar sem nome.
 */
export function trailTextFor(lang = DEFAULT_LANGUAGE, trailId = DEFAULT_TRAIL) {
  if (!trailExists(trailId)) return {};

  const { curriculum } = curriculumFor(lang, trailId);
  const texto = {};
  for (const campo of ["name", "description"]) {
    if (typeof curriculum?.[campo] === "string" && curriculum[campo].trim() !== "") {
      texto[campo] = curriculum[campo];
    }
  }
  return texto;
}

/*
 * As versões sem língua são as inglesas, e são as que o resto do servidor usa
 * quando o texto não vai para o ecrã de ninguém — a sincronização com a base
 * de dados, por exemplo.
 */
const ingles = mainCourseByLang[DEFAULT_LANGUAGE];
export const CURRICULUM = ingles.curriculum;
export const SKILLS = ingles.skills;
export const MISSIONS = ingles.missions;

/** Compatibilidade: o resto do servidor trata o currículo como lista de unidades. */
export const LEARNING_CURRICULUM = ingles.units;

export function getAllLessons(lang = DEFAULT_LANGUAGE, trailId = DEFAULT_TRAIL) {
  return curriculumFor(lang, trailId).lessons;
}

export function getLesson(id, lang = DEFAULT_LANGUAGE, trailId = DEFAULT_TRAIL) {
  return curriculumFor(lang, trailId).lessonsById.get(id) ?? null;
}

/*
 * A ordem das lições é a mesma em qualquer língua — os ids não se traduzem —
 * por isso estas duas leem sempre a versão inglesa do trilho.
 */
export function getLessonIndex(id, trailId = DEFAULT_TRAIL) {
  return curriculumFor(DEFAULT_LANGUAGE, trailId).lessonOrder.indexOf(id);
}

export function getLessonOrder(trailId = DEFAULT_TRAIL) {
  return [...curriculumFor(DEFAULT_LANGUAGE, trailId).lessonOrder];
}

export function getSkill(id, lang = DEFAULT_LANGUAGE, trailId = DEFAULT_TRAIL) {
  return curriculumFor(lang, trailId).skillsById.get(id) ?? null;
}

export function getUnitOfLesson(id, lang = DEFAULT_LANGUAGE, trailId = DEFAULT_TRAIL) {
  return curriculumFor(lang, trailId).unitByLessonId.get(id) ?? null;
}

/** Competências que uma lição ensina, já resolvidas em objetos. */
export function getLessonSkills(lesson, lang = DEFAULT_LANGUAGE, trailId = DEFAULT_TRAIL) {
  const { skillsById } = curriculumFor(lang, trailId);
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
