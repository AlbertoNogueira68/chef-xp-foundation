import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TRAIL,
  curriculumFor,
  getAllTrailIds,
  getLessonOrder,
  registerTrail,
  trailExists,
  unregisterTrail,
} from "./curriculum.js";
import { validateCurriculum } from "./curriculumValidation.js";

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

  const semHeranca = validateCurriculum(curriculum);
  assert.equal(semHeranca.ok, false, "sem herança, calor.niveis é desconhecida");

  const comHeranca = validateCurriculum(curriculum, { inheritedSkills: ["calor.niveis"] });
  assert.deepEqual(comHeranca.errors, []);
});

test("registar um trilho valida-o como se viesse de ficheiro", () => {
  const { ok, errors } = registerTrail("invalido", { en: { skills: [], units: [] } });
  assert.equal(ok, false);
  assert.ok(errors.length > 0);
  assert.equal(trailExists("invalido"), false, "um trilho recusado não fica instalado");
});

test("dryRun valida sem instalar", () => {
  const italian = curriculumFor("en", "italian").curriculum;
  const copia = estruturaRenomeada(italian, "dry");

  const check = registerTrail("dry-run", copia, { dryRun: true });
  assert.equal(check.ok, true, check.errors.join("; "));
  assert.equal(trailExists("dry-run"), false, "dryRun não pode instalar nada");
});

test("um trilho que repete ids de lição é recusado", () => {
  const italian = curriculumFor("en", "italian").curriculum;
  const { ok, errors } = registerTrail("clone", { en: italian });

  assert.equal(ok, false);
  assert.match(errors[0], /aparece em dois trilhos/);
});

test("o trilho fundacional não se substitui em runtime", () => {
  const { ok } = registerTrail(DEFAULT_TRAIL, { en: {} });
  assert.equal(ok, false);
  assert.equal(unregisterTrail(DEFAULT_TRAIL), false);
  assert.ok(trailExists(DEFAULT_TRAIL), "o fundacional tem de continuar lá");
});

test("registar e depois retirar deixa o resto como estava", () => {
  const antes = getAllTrailIds();
  const copia = estruturaRenomeada(curriculumFor("en", "italian").curriculum, "tmp");

  assert.equal(registerTrail("temporario", copia).ok, true);
  assert.ok(trailExists("temporario"));
  assert.deepEqual(curriculumFor("en", "italian").lessonOrder, getLessonOrder("italian"));

  unregisterTrail("temporario");
  assert.deepEqual(getAllTrailIds(), antes);
});

/** Um clone com todos os ids prefixados, para não colidir com o original. */
function estruturaRenomeada(curriculum, prefixo) {
  const copia = structuredClone(curriculum);
  const p = (id) => `${prefixo}-${id}`;

  for (const unit of copia.units) {
    unit.id = p(unit.id);
    if (unit.missionId) unit.missionId = p(unit.missionId);
    for (const lesson of unit.lessons) {
      lesson.id = p(lesson.id);
      for (const question of lesson.questions) question.id = p(question.id);
    }
  }
  for (const mission of copia.missions ?? []) {
    mission.id = p(mission.id);
    mission.unitId = p(mission.unitId);
  }
  return { en: copia };
}
