/**
 * Validação de integridade do currículo.
 *
 * Módulo puro: recebe um objeto de currículo e devolve a lista de problemas.
 * Não lê ficheiros nem toca na base de dados, para que os testes possam
 * alimentá-lo com currículos inválidos de propósito e provar que as regras
 * apanham mesmo o erro — um validador que só corre sobre conteúdo bom não
 * prova nada.
 */

import { DIETARY_TAGS } from "./dietaryTags.js";

// `organizacao` não estava no plano, mas mise en place, sequenciar e empratar
// não são faca nem calor nem tempero nem ponto — e enfiá-las em "seguranca"
// tornava a categoria uma gaveta de tudo.
export const SKILL_CATEGORIES = ["faca", "calor", "tempero", "ponto", "seguranca", "organizacao"];
export const QUESTION_TYPES = ["choice", "order", "judge", "estimate"];
export const LESSON_DIFFICULTIES = ["facil", "medio", "dificil"];

/**
 * Três é o mínimo para um trilho valer a pena: quem chega ao fim de duas
 * receitas ainda não cozinhou nada que se pareça com um repertório. O público
 * são estudantes universitários, e um trilho de duas missões lê-se como uma
 * demonstração em vez de um percurso.
 */
export const MIN_MISSIONS_PER_TRAIL = 3;

/** Os quatro botões do painel de socorro, na ordem em que aparecem. */
export const RESCUE_KINDS = ["queimei", "cola", "falta", "pronto"];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function duplicates(ids) {
  const seen = new Set();
  const dupes = new Set();
  for (const id of ids) {
    if (seen.has(id)) dupes.add(id);
    seen.add(id);
  }
  return [...dupes];
}

/**
 * Deteção de ciclos no grafo de pré-requisitos por DFS com três cores.
 * Cinzento = na pilha atual; encontrar uma aresta para cinzento é uma
 * back-edge, ou seja, um ciclo.
 */
export function findSkillCycles(skills) {
  const edges = new Map(skills.map((s) => [s.id, s.requires ?? []]));
  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const color = new Map(skills.map((s) => [s.id, WHITE]));
  const cycles = [];
  const stack = [];

  function visit(id) {
    color.set(id, GREY);
    stack.push(id);

    for (const next of edges.get(id) ?? []) {
      if (!color.has(next)) continue; // competência inexistente: outra regra trata disso
      if (color.get(next) === GREY) {
        const from = stack.indexOf(next);
        cycles.push([...stack.slice(from), next].join(" → "));
      } else if (color.get(next) === WHITE) {
        visit(next);
      }
    }

    stack.pop();
    color.set(id, BLACK);
  }

  for (const skill of skills) {
    if (color.get(skill.id) === WHITE) visit(skill.id);
  }
  return cycles;
}

function validateSkills(curriculum, errors, inherited) {
  const skills = curriculum.skills ?? [];
  if (skills.length === 0) errors.push("o currículo não declara competências");

  for (const id of duplicates(skills.map((s) => s.id))) {
    errors.push(`competência duplicada: ${id}`);
  }

  const known = new Set([...skills.map((s) => s.id), ...inherited]);

  for (const skill of skills) {
    if (!isNonEmptyString(skill.id)) errors.push("competência sem id");
    if (!isNonEmptyString(skill.name)) errors.push(`competência ${skill.id}: sem nome`);
    if (!isNonEmptyString(skill.description)) {
      errors.push(`competência ${skill.id}: sem descrição`);
    }
    if (!SKILL_CATEGORIES.includes(skill.category)) {
      errors.push(`competência ${skill.id}: categoria inválida (${skill.category})`);
    }
    for (const req of skill.requires ?? []) {
      if (req === skill.id) errors.push(`competência ${skill.id}: exige-se a si própria`);
      else if (!known.has(req)) {
        errors.push(`competência ${skill.id}: pré-requisito inexistente (${req})`);
      }
    }
  }

  for (const cycle of findSkillCycles(skills)) {
    errors.push(`ciclo de pré-requisitos: ${cycle}`);
  }

  return known;
}

function validateQuestion(lesson, question, knownSkills, errors) {
  const where = `${lesson.id}/${question.id}`;

  if (!QUESTION_TYPES.includes(question.type)) {
    errors.push(`${where}: tipo de exercício inválido (${question.type})`);
  }
  if (!isNonEmptyString(question.prompt)) errors.push(`${where}: sem enunciado`);

  // A regra que separa ensinar de avaliar.
  if (!isNonEmptyString(question.explainWrong)) {
    errors.push(`${where}: sem explainWrong — um erro sem explicação não ensina nada`);
  }
  if (!isNonEmptyString(question.explanation)) errors.push(`${where}: sem explanation`);

  const skills = question.skills ?? [];
  if (skills.length === 0) {
    errors.push(`${where}: não mapeia nenhuma competência`);
  }
  for (const skillId of skills) {
    if (!knownSkills.has(skillId)) {
      errors.push(`${where}: competência inexistente (${skillId})`);
    }
  }

  switch (question.type) {
    case "choice":
    case "judge": {
      const options = question.options ?? [];
      if (options.length < 2) errors.push(`${where}: precisa de pelo menos 2 opções`);
      if (duplicates(options).length > 0) errors.push(`${where}: opções repetidas`);
      if (!options.includes(question.correctAnswer)) {
        errors.push(`${where}: a resposta certa não está entre as opções`);
      }
      if (question.type === "judge" && !isNonEmptyString(question.imageUrl)) {
        errors.push(`${where}: um exercício de julgar precisa de imagem`);
      }
      break;
    }
    case "order": {
      const order = question.correctOrder ?? [];
      if (order.length < 3) errors.push(`${where}: ordenar precisa de pelo menos 3 passos`);
      if (duplicates(order).length > 0) errors.push(`${where}: passos repetidos`);
      break;
    }
    case "estimate": {
      if (typeof question.correctAnswer !== "number") {
        errors.push(`${where}: estimar exige uma resposta numérica`);
      }
      if (typeof question.tolerance !== "number" || question.tolerance <= 0) {
        errors.push(`${where}: estimar exige uma tolerância positiva`);
      }
      if (!isNonEmptyString(question.unit)) errors.push(`${where}: estimar exige uma unidade`);
      break;
    }
    default:
      break;
  }
}

/**
 * Uma missão sem passos é uma promessa por cumprir: aparece no percurso e não
 * tem nada para correr. E um passo sem socorros deixa o principiante sozinho
 * exatamente no momento em que desiste.
 */
/**
 * O mesmo par que uma receita tem — `estimated_cost_eur` e `dietary_tags` — só
 * que aqui é o conteúdo do trilho a declará-lo, não quem publica. Ambos
 * opcionais: um prato sem estimativa de custo não é um erro, só uma missão
 * ainda por classificar.
 */
function validateMissionTags(mission, errors) {
  const where = `missão ${mission.id}`;

  if (mission.estimatedCostEur !== undefined) {
    if (typeof mission.estimatedCostEur !== "number" || mission.estimatedCostEur < 0) {
      errors.push(`${where}: estimatedCostEur tem de ser um número não negativo`);
    }
  }

  const tags = mission.dietaryTags ?? [];
  for (const id of duplicates(tags)) {
    errors.push(`${where}: etiqueta alimentar repetida (${id})`);
  }
  for (const tag of tags) {
    if (!DIETARY_TAGS.includes(tag)) {
      errors.push(`${where}: etiqueta alimentar desconhecida (${tag})`);
    }
  }
}

function validateMissionSteps(mission, errors) {
  const where = `missão ${mission.id}`;
  const steps = mission.steps ?? [];

  if ((mission.ingredients ?? []).length === 0) errors.push(`${where}: sem ingredientes`);
  if (steps.length < 3) errors.push(`${where}: precisa de pelo menos 3 passos`);

  for (const id of duplicates(steps.map((s) => s.id))) {
    errors.push(`${where}: passo duplicado (${id})`);
  }

  // Sem checkpoint não há verificação nenhuma do que foi cozinhado — a missão
  // passava a ser um temporizador com texto.
  if (!steps.some((s) => s.checkpoint)) {
    errors.push(`${where}: nenhum passo pede foto de verificação`);
  }

  for (const step of steps) {
    const at = `${where}/${step.id}`;
    if (!isNonEmptyString(step.title)) errors.push(`${at}: sem título`);
    if (!isNonEmptyString(step.description)) errors.push(`${at}: sem descrição`);
    if (step.durationSec !== undefined && !(step.durationSec > 0)) {
      errors.push(`${at}: duração inválida`);
    }

    const rescues = step.rescues ?? [];
    if (rescues.length === 0) errors.push(`${at}: sem respostas de socorro`);
    for (const id of duplicates(rescues.map((r) => r.kind))) {
      errors.push(`${at}: socorro repetido (${id})`);
    }
    for (const rescue of rescues) {
      if (!RESCUE_KINDS.includes(rescue.kind)) {
        errors.push(`${at}: tipo de socorro inválido (${rescue.kind})`);
      }
      if (!isNonEmptyString(rescue.answer)) {
        errors.push(`${at}/${rescue.kind}: socorro sem resposta`);
      }
    }
  }
}

/**
 * Corre todas as regras. Devolve `{ ok, errors }` em vez de atirar, para que
 * o chamador decida — o teste quer a lista toda, o arranque quer só falhar.
 *
 * `inheritedSkills` são competências ensinadas noutro trilho — as do trilho
 * fundacional, quando se valida um trilho especializado. Contam como
 * conhecidas para pré-requisitos, mas não são obrigadas a ser praticadas
 * numa missão deste trilho: quem as ensina é que responde por isso.
 */
/**
 * A ordem do trilho: do mais fácil para o mais difícil, e com receitas
 * suficientes para haver percurso.
 *
 * O desbloqueio das lições segue a ORDEM DO ARRAY, não o `dayNumber`. Quando
 * os dois divergem — foi o que aconteceu no trilho italiano, onde a carbonara
 * dizia "dia 6" e só abria depois da pizza do dia 15 — o utilizador vê uma
 * numeração e recebe outra sequência. Exigir `dayNumber` sempre a subir é o
 * que obriga as duas a concordarem, e é também a forma de dizer, em dados,
 * "as unidades estão da mais fácil para a mais difícil".
 */
function validateProgression(curriculum, errors) {
  const units = curriculum.units ?? [];
  const missions = curriculum.missions ?? [];
  const lessons = units.flatMap((unit) => unit.lessons ?? []);

  for (const lesson of lessons) {
    if (!LESSON_DIFFICULTIES.includes(lesson.difficulty)) {
      errors.push(`lição ${lesson.id}: dificuldade inválida (${lesson.difficulty})`);
    }
  }

  if (lessons.length > 0 && lessons[0].difficulty !== "facil") {
    errors.push(
      `a primeira lição do trilho (${lessons[0].id}) é ${lessons[0].difficulty}: um trilho começa no fácil`,
    );
  }

  // Estritamente a subir, não só ordenado: dois dias iguais em unidades
  // diferentes deixam de dizer qual vem primeiro.
  for (let i = 1; i < lessons.length; i += 1) {
    const anterior = lessons[i - 1];
    const atual = lessons[i];
    if (!(atual.dayNumber > anterior.dayNumber)) {
      errors.push(
        `lição ${atual.id}: dayNumber ${atual.dayNumber} não vem depois de ${anterior.id} (${anterior.dayNumber}) — as unidades estão fora de ordem`,
      );
    }
  }

  // A missão é o que fecha a unidade. Uma unidade sem missão é um quiz, e uma
  // missão sem unidade não aparece em percurso nenhum: `buildPath` procura-a
  // por `unit.missionId` e nunca a encontra.
  const missionIds = new Set(missions.map((mission) => mission.id));
  const apontadas = new Set();
  for (const unit of units) {
    if (!isNonEmptyString(unit.missionId)) {
      errors.push(`unidade ${unit.id}: sem missão que a feche`);
      continue;
    }
    if (!missionIds.has(unit.missionId)) {
      errors.push(`unidade ${unit.id}: missionId inexistente (${unit.missionId})`);
      continue;
    }
    if (apontadas.has(unit.missionId)) {
      errors.push(`missão ${unit.missionId}: apontada por mais do que uma unidade`);
    }
    apontadas.add(unit.missionId);
  }
  for (const mission of missions) {
    if (!apontadas.has(mission.id)) {
      errors.push(`missão ${mission.id}: nenhuma unidade a aponta, logo não aparece no percurso`);
    }
    const unit = units.find((u) => u.id === mission.unitId);
    if (!unit) {
      errors.push(`missão ${mission.id}: unitId inexistente (${mission.unitId})`);
    } else if (unit.missionId !== mission.id) {
      errors.push(
        `missão ${mission.id}: diz ser de ${mission.unitId}, mas essa unidade fecha com ${unit.missionId}`,
      );
    }
  }

  if (missions.length < MIN_MISSIONS_PER_TRAIL) {
    errors.push(
      `o trilho só tem ${missions.length} receita(s): o mínimo é ${MIN_MISSIONS_PER_TRAIL}`,
    );
  }

  // As duas pontas do percurso. A primeira unidade é o que alguém sem
  // experiência nenhuma encontra à entrada — o trilho italiano abria em massa
  // fresca amassada à mão, o português em bacalhau com um dia de demolha — e a
  // última é onde a subida tem de chegar. Sem estas duas, "do fácil para o
  // difícil" fica a depender de alguém se lembrar de ir ver.
  if (units.length > 0) {
    const primeira = units[0].lessons ?? [];
    for (const lesson of primeira) {
      if (lesson.difficulty === "dificil") {
        errors.push(
          `lição ${lesson.id}: é difícil e está na primeira unidade — a entrada do trilho é para quem nunca cozinhou`,
        );
      }
    }

    const maxIndice = Math.max(
      ...lessons.map((lesson) => LESSON_DIFFICULTIES.indexOf(lesson.difficulty)),
    );
    const ultima = units[units.length - 1].lessons ?? [];
    const chegaAoFim = ultima.some(
      (lesson) => LESSON_DIFFICULTIES.indexOf(lesson.difficulty) === maxIndice,
    );
    if (maxIndice >= 0 && !chegaAoFim) {
      errors.push(
        `a última unidade (${units[units.length - 1].id}) não tem nenhuma lição ${LESSON_DIFFICULTIES[maxIndice]}: o trilho tem de acabar no mais difícil, não no meio`,
      );
    }
  }
}

export function validateCurriculum(curriculum, { inheritedSkills = [] } = {}) {
  const errors = [];

  if (!curriculum || typeof curriculum !== "object") {
    return { ok: false, errors: ["currículo ausente ou malformado"] };
  }

  const inherited = new Set(inheritedSkills);
  const knownSkills = validateSkills(curriculum, errors, inherited);
  const units = curriculum.units ?? [];
  const missions = curriculum.missions ?? [];

  if (units.length === 0) errors.push("o currículo não tem unidades");

  const lessons = units.flatMap((unit) => unit.lessons ?? []);
  for (const id of duplicates(units.map((u) => u.id))) errors.push(`unidade duplicada: ${id}`);
  for (const id of duplicates(lessons.map((l) => l.id))) errors.push(`lição duplicada: ${id}`);
  for (const id of duplicates(lessons.flatMap((l) => (l.questions ?? []).map((q) => q.id)))) {
    errors.push(`exercício duplicado: ${id}`);
  }
  for (const id of duplicates(missions.map((m) => m.id))) errors.push(`missão duplicada: ${id}`);

  // `taughtAt` guarda o índice da PRIMEIRA lição que ensina cada competência.
  // É contra isto que se mede se uma lição exige algo que ainda não foi dado.
  const taughtAt = new Map();
  lessons.forEach((lesson, index) => {
    for (const skillId of lesson.teaches ?? []) {
      if (!taughtAt.has(skillId)) taughtAt.set(skillId, index);
    }
  });

  lessons.forEach((lesson, index) => {
    if (!isNonEmptyString(lesson.title)) errors.push(`lição ${lesson.id}: sem título`);
    if (!(lesson.xpReward > 0)) errors.push(`lição ${lesson.id}: sem XP`);

    const questions = lesson.questions ?? [];
    if (questions.length === 0) errors.push(`lição ${lesson.id}: sem exercícios`);

    for (const skillId of lesson.teaches ?? []) {
      if (!knownSkills.has(skillId)) {
        errors.push(`lição ${lesson.id}: ensina competência inexistente (${skillId})`);
      }
    }

    for (const skillId of lesson.requires ?? []) {
      if (!knownSkills.has(skillId)) {
        errors.push(`lição ${lesson.id}: exige competência inexistente (${skillId})`);
        continue;
      }
      const taught = taughtAt.get(skillId);
      if (taught === undefined) {
        // Uma competência herdada já foi ensinada no trilho de base: exigi-la
        // sem a ensinar outra vez é o que torna um trilho especializado possível.
        if (!inherited.has(skillId)) {
          errors.push(`lição ${lesson.id}: exige ${skillId}, que nenhuma lição ensina`);
        }
      } else if (taught >= index) {
        errors.push(
          `lição ${lesson.id}: exige ${skillId}, que só é ensinada mais à frente (${lessons[taught].id})`,
        );
      }
    }

    for (const question of questions) {
      validateQuestion(lesson, question, knownSkills, errors);
    }

    // As dicas não valem corações: é onde fica o que é bom saber mas técnico
    // de mais para se perguntar a quem está a começar.
    (lesson.tips ?? []).forEach((tip, i) => {
      if (!isNonEmptyString(tip?.title) || !isNonEmptyString(tip?.text)) {
        errors.push(`lição ${lesson.id}: a dica ${i + 1} precisa de título e texto`);
      }
    });
  });

  validateProgression(curriculum, errors);

  // Toda a competência ensinada tem de ser praticada numa missão: é a regra
  // que impede o currículo de virar um quiz sobre cozinha.
  const practised = new Set(missions.flatMap((m) => m.practices ?? []));
  for (const mission of missions) {
    if (!isNonEmptyString(mission.title)) errors.push(`missão ${mission.id}: sem título`);
    for (const skillId of mission.practices ?? []) {
      if (!knownSkills.has(skillId)) {
        errors.push(`missão ${mission.id}: pratica competência inexistente (${skillId})`);
        continue;
      }
      // O outro lado da regra de baixo, e o que apanha a missão que pede o que
      // o trilho nunca explicou: o ragù italiano praticava `ragu-brasear` e
      // nenhuma lição ensinava a brasear. Herdada é diferente — essa foi
      // ensinada no trilho fundacional.
      if (!taughtAt.has(skillId) && !inherited.has(skillId)) {
        errors.push(
          `missão ${mission.id}: pratica ${skillId}, que nenhuma lição deste trilho ensina`,
        );
      }
    }
    validateMissionSteps(mission, errors);
    validateMissionTags(mission, errors);
  }
  for (const skillId of taughtAt.keys()) {
    if (!practised.has(skillId)) {
      errors.push(`competência ${skillId} é ensinada mas nunca praticada numa missão`);
    }
  }
  // Uma competência declarada que nenhuma lição ensina é conteúdo prometido e
  // nunca escrito. Fica no painel de competências do trilho como uma linha que
  // nunca acende.
  for (const skill of curriculum.skills ?? []) {
    if (!taughtAt.has(skill.id)) {
      errors.push(`competência ${skill.id}: declarada mas nenhuma lição a ensina`);
    }
  }

  return { ok: errors.length === 0, errors };
}
