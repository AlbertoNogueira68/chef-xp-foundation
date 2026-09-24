import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TRAIL,
  curriculumFor,
  getAllTrailIds,
  getLessonOrder,
  trailExists,
} from "./curriculum.js";
import { MIN_MISSIONS_PER_TRAIL, validateCurriculum } from "./curriculumValidation.js";

/**
 * O que estes testes protegem é uma regressão que já aconteceu: a descoberta
 * de trilhos tinha uma condição impossível, nenhum trilho além do fundacional
 * chegava a carregar, e `curriculumFor` devolvia o fundacional em silêncio
 * para qualquer id. Tudo parecia funcionar — só servia o currículo errado.
 */

test("os trilhos de ficheiro são descobertos, não só o fundacional", () => {
  const ids = getAllTrailIds();
  assert.ok(ids.includes(DEFAULT_TRAIL), "o fundacional tem de estar lá");
  assert.ok(ids.includes("italian"), "shared/trails/italian.json tem de ser descoberto");
});

test("cada trilho serve o seu currículo, não o do vizinho", () => {
  const italian = curriculumFor("en", "italian");
  const fundacional = curriculumFor("en", DEFAULT_TRAIL);

  assert.notDeepEqual(italian.lessonOrder, fundacional.lessonOrder);
  assert.ok(italian.units.length > 0);
  assert.ok(italian.missions.length > 0, "um trilho sem missões não fecha nenhuma unidade");
});

test("um trilho desconhecido atira em vez de devolver o fundacional", () => {
  assert.throws(() => curriculumFor("en", "nao-existe"), /Trilho desconhecido/);
  assert.equal(trailExists("nao-existe"), false);
});

test("nenhuma lição pertence a dois trilhos", () => {
  const vistos = new Map();
  for (const trailId of getAllTrailIds()) {
    for (const lessonId of getLessonOrder(trailId)) {
      assert.equal(
        vistos.get(lessonId),
        undefined,
        `${lessonId} está em ${vistos.get(lessonId)} e em ${trailId}`,
      );
      vistos.set(lessonId, trailId);
    }
  }
});

test("o trilho italiano apoia-se nas competências dos fundamentos", () => {
  const italian = curriculumFor("en", "italian");
  const fundacionais = new Set(curriculumFor("en", DEFAULT_TRAIL).skills.map((s) => s.id));
  const proprias = new Set(italian.skills.map((s) => s.id));

  const herdadas = italian.lessons
    .flatMap((lesson) => lesson.requires ?? [])
    .filter((id) => !proprias.has(id));

  assert.ok(herdadas.length > 0, "o trilho devia reutilizar competências em vez de as repetir");
  for (const id of herdadas) {
    assert.ok(fundacionais.has(id), `${id} não existe no trilho fundacional`);
  }
});

test("as competências herdadas contam como conhecidas, mas só com a opção", () => {
  const curriculum = {
    skills: [
      {
        id: "x.avancada",
        name: "Avançada",
        category: "calor",
        description: "Depende de uma competência de outro trilho.",
        requires: ["calor.niveis"],
      },
    ],
    units: [
      {
        id: "u1",
        title: "Unidade",
        lessons: [
          {
            id: "u1-l1",
            title: "Lição",
            xpReward: 10,
            teaches: ["x.avancada"],
            requires: ["calor.niveis"],
            questions: [
              {
                id: "u1-l1-q1",
                type: "choice",
                skills: ["x.avancada"],
                prompt: "Pergunta?",
                options: ["Certa", "Errada"],
                correctAnswer: "Certa",
                explanation: "Porque sim.",
                explainWrong: "Porque não.",
              },
            ],
          },
        ],
        missionId: "m1",
      },
    ],
    missions: [
      {
        id: "m1",
        unitId: "u1",
        title: "Missão",
        practices: ["x.avancada"],
        ingredients: ["Um ingrediente"],
        steps: [
          {
            id: "s1",
            title: "Um",
            description: "Passo.",
            rescues: [{ kind: "pronto", answer: "Sim." }],
          },
          {
            id: "s2",
            title: "Dois",
            description: "Passo.",
            rescues: [{ kind: "pronto", answer: "Sim." }],
          },
          {
            id: "s3",
            title: "Três",
            description: "Passo.",
            checkpoint: true,
            rescues: [{ kind: "pronto", answer: "Sim." }],
          },
        ],
      },
    ],
  };

  const erroDeHeranca = (resultado) =>
    resultado.errors.filter((erro) => erro.includes("calor.niveis"));

  const semHeranca = validateCurriculum(curriculum);
  assert.equal(semHeranca.ok, false, "sem herança, calor.niveis é desconhecida");
  assert.ok(erroDeHeranca(semHeranca).length > 0);

  // Só se olha para os erros sobre `calor.niveis`: este currículo é uma
  // unidade só, e as regras de progressão — três receitas, do fácil para o
  // difícil — recusam-no por outros motivos, que aqui não são o assunto.
  const comHeranca = validateCurriculum(curriculum, { inheritedSkills: ["calor.niveis"] });
  assert.deepEqual(erroDeHeranca(comHeranca), []);
});

/**
 * A promessa que o produto faz a quem está a começar: todo o trilho começa no
 * fácil, sobe daí, e tem receitas que cheguem para haver percurso. São regras
 * de conteúdo, por isso o que as prova é o conteúdo real — mais um currículo
 * inventado de propósito para mostrar que o validador as apanha mesmo.
 */
test("todo o trilho tem pelo menos três receitas", () => {
  for (const trailId of getAllTrailIds()) {
    const { missions } = curriculumFor("en", trailId);
    assert.ok(
      missions.length >= MIN_MISSIONS_PER_TRAIL,
      `${trailId} tem ${missions.length} receita(s), mínimo ${MIN_MISSIONS_PER_TRAIL}`,
    );
  }
});

test("todo o trilho começa no fácil e sobe: dayNumber sempre a subir", () => {
  for (const trailId of getAllTrailIds()) {
    const { units } = curriculumFor("en", trailId);
    const licoes = units.flatMap((unit) => unit.lessons);

    assert.equal(licoes[0].difficulty, "facil", `${trailId} não começa numa lição fácil`);

    for (let i = 1; i < licoes.length; i += 1) {
      assert.ok(
        licoes[i].dayNumber > licoes[i - 1].dayNumber,
        `${trailId}: ${licoes[i].id} (dia ${licoes[i].dayNumber}) vem depois de ${licoes[i - 1].id} (dia ${licoes[i - 1].dayNumber})`,
      );
    }
  }
});

test("cada unidade fecha com uma missão, e cada missão pertence à sua unidade", () => {
  for (const trailId of getAllTrailIds()) {
    const { units, missionsById } = curriculumFor("en", trailId);
    for (const unit of units) {
      const missao = missionsById.get(unit.missionId);
      assert.ok(missao, `${trailId}/${unit.id}: missionId ${unit.missionId} não existe`);
      assert.equal(missao.unitId, unit.id, `${missao.id} diz ser de ${missao.unitId}`);
    }
  }
});

test("o validador recusa um trilho desordenado, sem receitas ou que começa no difícil", () => {
  const licao = (id, dia, dificuldade, skill) => ({
    id,
    title: `Lição ${id}`,
    dayNumber: dia,
    difficulty: dificuldade,
    xpReward: 100,
    teaches: [skill],
    questions: [
      {
        id: `${id}-q1`,
        type: "choice",
        skills: [skill],
        prompt: "Pergunta?",
        options: ["Certa", "Errada"],
        correctAnswer: "Certa",
        explanation: "Porque sim.",
        explainWrong: "Porque não.",
      },
    ],
  });

  const missao = (id, unitId, skills) => ({
    id,
    unitId,
    title: `Missão ${id}`,
    practices: skills,
    ingredients: ["Um ingrediente"],
    steps: [
      {
        id: "s1",
        title: "Um",
        description: "Passo.",
        rescues: [{ kind: "pronto", answer: "Sim." }],
      },
      {
        id: "s2",
        title: "Dois",
        description: "Passo.",
        rescues: [{ kind: "pronto", answer: "Sim." }],
      },
      {
        id: "s3",
        title: "Três",
        description: "Passo.",
        checkpoint: true,
        rescues: [{ kind: "pronto", answer: "Sim." }],
      },
    ],
  });

  const skills = ["a", "b"].map((id) => ({
    id: `x.${id}`,
    name: id,
    category: "calor",
    description: "Competência.",
    requires: [],
  }));

  // Duas unidades, a segunda com dias ANTERIORES à primeira: exactamente o que
  // o trilho italiano tinha, e que fazia a carbonara do dia 6 abrir depois da
  // pizza do dia 15.
  const desordenado = {
    skills,
    units: [
      { id: "u1", title: "Um", lessons: [licao("u1-l1", 10, "facil", "x.a")], missionId: "m1" },
      { id: "u2", title: "Dois", lessons: [licao("u2-l1", 2, "medio", "x.b")], missionId: "m2" },
    ],
    missions: [missao("m1", "u1", ["x.a"]), missao("m2", "u2", ["x.b"])],
  };

  const fora = validateCurriculum(desordenado);
  assert.equal(fora.ok, false);
  assert.ok(
    fora.errors.some((e) => e.includes("fora de ordem")),
    `esperava um erro de ordem, vieram: ${fora.errors.join("; ")}`,
  );
  assert.ok(
    fora.errors.some((e) => e.includes(`mínimo é ${MIN_MISSIONS_PER_TRAIL}`)),
    "duas receitas deviam ser recusadas",
  );

  // O mesmo trilho, arrumado e com três receitas, passa.
  const arrumado = {
    skills: [
      ...skills,
      { id: "x.c", name: "c", category: "calor", description: "C.", requires: [] },
    ],
    units: [
      { id: "u1", title: "Um", lessons: [licao("u1-l1", 1, "facil", "x.a")], missionId: "m1" },
      { id: "u2", title: "Dois", lessons: [licao("u2-l1", 2, "medio", "x.b")], missionId: "m2" },
      { id: "u3", title: "Três", lessons: [licao("u3-l1", 3, "dificil", "x.c")], missionId: "m3" },
    ],
    missions: [
      missao("m1", "u1", ["x.a"]),
      missao("m2", "u2", ["x.b"]),
      missao("m3", "u3", ["x.c"]),
    ],
  };
  assert.deepEqual(validateCurriculum(arrumado).errors, []);

  // E começar no difícil é recusado, mesmo com tudo o resto certo.
  const comecaDificil = structuredClone(arrumado);
  comecaDificil.units[0].lessons[0].difficulty = "dificil";
  const inicio = validateCurriculum(comecaDificil);
  assert.equal(inicio.ok, false);
  assert.ok(
    inicio.errors.some((e) => e.includes("começa no fácil")),
    `esperava um erro sobre o início, vieram: ${inicio.errors.join("; ")}`,
  );
});

test("nenhuma missão pede uma competência que nenhuma lição do trilho ensina", () => {
  const fundacionais = new Set(curriculumFor("en", DEFAULT_TRAIL).skills.map((s) => s.id));

  for (const trailId of getAllTrailIds()) {
    const { units, missions } = curriculumFor("en", trailId);
    const ensinadas = new Set(
      units.flatMap((unit) => unit.lessons).flatMap((licao) => licao.teaches ?? []),
    );

    for (const missao of missions) {
      for (const skillId of missao.practices ?? []) {
        assert.ok(
          ensinadas.has(skillId) || fundacionais.has(skillId),
          `${trailId}/${missao.id} pratica ${skillId}, que nenhuma lição ensina`,
        );
      }
    }
  }
});

test("nenhum trilho declara uma competência que nunca chega a ser ensinada", () => {
  for (const trailId of getAllTrailIds()) {
    const { units, skills } = curriculumFor("en", trailId);
    const ensinadas = new Set(
      units.flatMap((unit) => unit.lessons).flatMap((licao) => licao.teaches ?? []),
    );

    for (const skill of skills) {
      assert.ok(
        ensinadas.has(skill.id),
        `${trailId}: ${skill.id} está declarada e nunca é ensinada`,
      );
    }
  }
});

test("o trilho italiano começa em massa seca, não em massa fresca", () => {
  const { units } = curriculumFor("en", "italian");
  const primeira = units[0];

  assert.equal(primeira.id, "unit-italiano-6");
  for (const licao of primeira.lessons) {
    assert.equal(
      licao.difficulty,
      "facil",
      `${licao.id} abre o trilho e não é fácil — a primeira coisa que se cozinha não pode exigir experiência`,
    );
  }

  // A massa fresca é o cartão de visita do trilho, mas não é por onde se entra.
  const massaFresca = units.findIndex((unit) => unit.id === "unit-italiano-1");
  const pizza = units.findIndex((unit) => unit.id === "unit-italiano-4");
  assert.ok(massaFresca > 0, "amassar e esticar massa fresca não pode ser a primeira unidade");
  assert.ok(pizza > massaFresca, "a massa de pizza vem depois de já se ter feito massa à mão");
});

test("a entrada de cada trilho não tem lições difíceis, e a subida chega ao fim", () => {
  const ordem = ["facil", "medio", "dificil"];

  for (const trailId of getAllTrailIds()) {
    const { units } = curriculumFor("en", trailId);
    const licoes = units.flatMap((unit) => unit.lessons);

    for (const licao of units[0].lessons) {
      assert.notEqual(
        licao.difficulty,
        "dificil",
        `${trailId}: ${licao.id} é difícil e é das primeiras coisas que se faz`,
      );
    }

    const maxIndice = Math.max(...licoes.map((l) => ordem.indexOf(l.difficulty)));
    const ultima = units[units.length - 1];
    assert.ok(
      ultima.lessons.some((l) => ordem.indexOf(l.difficulty) === maxIndice),
      `${trailId}: a última unidade (${ultima.id}) não chega a ${ordem[maxIndice]}`,
    );
  }
});

test("o trilho português começa na sopa, não no bacalhau de véspera", () => {
  const { units } = curriculumFor("en", "portuguese");

  assert.equal(units[0].id, "unit-portugues-4");
  for (const licao of units[0].lessons) {
    assert.equal(licao.difficulty, "facil");
  }

  // O bacalhau exige um dia inteiro de demolha antes de se poder cozinhar: é
  // conteúdo do trilho, mas não é a primeira coisa que se pede a alguém.
  const bacalhau = units.findIndex((unit) => unit.id === "unit-portugues-1");
  assert.ok(bacalhau > 0, "a demolha do bacalhau não pode abrir o trilho");
});
