/**
 * Validação de integridade do currículo.
 *
 * Módulo puro: recebe um objeto de currículo e devolve a lista de problemas.
 * Não lê ficheiros nem toca na base de dados, para que os testes possam
 * alimentá-lo com currículos inválidos de propósito e provar que as regras
 * apanham mesmo o erro — um validador que só corre sobre conteúdo bom não
 * prova nada.
 */

// `organizacao` não estava no plano, mas mise en place, sequenciar e empratar
// não são faca nem calor nem tempero nem ponto — e enfiá-las em "seguranca"
// tornava a categoria uma gaveta de tudo.
export const SKILL_CATEGORIES = [
  "faca",
  "calor",
  "tempero",
  "ponto",
  "seguranca",
  "organizacao",
];
export const QUESTION_TYPES = ["choice", "order", "judge", "estimate"];

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

function validateSkills(curriculum, errors) {
  const skills = curriculum.skills ?? [];
  if (skills.length === 0) errors.push("o currículo não declara competências");

  for (const id of duplicates(skills.map((s) => s.id))) {
    errors.push(`competência duplicada: ${id}`);
  }

  const known = new Set(skills.map((s) => s.id));

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
 */
export function validateCurriculum(curriculum) {
  const errors = [];

  if (!curriculum || typeof curriculum !== "object") {
    return { ok: false, errors: ["currículo ausente ou malformado"] };
  }

  const knownSkills = validateSkills(curriculum, errors);
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
        errors.push(`lição ${lesson.id}: exige ${skillId}, que nenhuma lição ensina`);
      } else if (taught >= index) {
        errors.push(
          `lição ${lesson.id}: exige ${skillId}, que só é ensinada mais à frente (${lessons[taught].id})`,
        );
      }
    }

    for (const question of questions) {
      validateQuestion(lesson, question, knownSkills, errors);
    }
  });

  // Toda a competência ensinada tem de ser praticada numa missão: é a regra
  // que impede o currículo de virar um quiz sobre cozinha.
  const practised = new Set(missions.flatMap((m) => m.practices ?? []));
  for (const mission of missions) {
    if (!isNonEmptyString(mission.title)) errors.push(`missão ${mission.id}: sem título`);
    for (const skillId of mission.practices ?? []) {
      if (!knownSkills.has(skillId)) {
        errors.push(`missão ${mission.id}: pratica competência inexistente (${skillId})`);
      }
    }
    validateMissionSteps(mission, errors);
  }
  for (const skillId of taughtAt.keys()) {
    if (!practised.has(skillId)) {
      errors.push(`competência ${skillId} é ensinada mas nunca praticada numa missão`);
    }
  }

  return { ok: errors.length === 0, errors };
}
