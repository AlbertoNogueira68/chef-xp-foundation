import test from "node:test";
import assert from "node:assert/strict";

import {
  MISSIONS,
  checkpointIndexes,
  findRescueAnswer,
  getMission,
  getUnitOfMission,
  missionXp,
  toClientMission,
  validateStepMove,
} from "./missions.js";
import { RESCUE_KINDS } from "./curriculumValidation.js";

const mission = getMission("mission.ovo-estrelado");

test("as cinco missões carregam e têm passos", () => {
  assert.equal(MISSIONS.length, 5);
  for (const m of MISSIONS) {
    assert.ok(m.steps.length >= 3, `${m.id} com poucos passos`);
    assert.ok(m.ingredients.length > 0, `${m.id} sem ingredientes`);
  }
});

test("a missão de uma unidade escrita resolve-se; a das que faltam não", () => {
  // Só a unidade 1 está escrita. As missões 2 a 5 existem no currículo mas
  // ainda não têm unidade — e é isso que as mantém trancadas, sem precisar
  // de nenhuma regra extra na rota.
  assert.ok(getUnitOfMission("mission.ovo-estrelado"));
  assert.equal(getUnitOfMission("mission.omelete"), null);
  assert.equal(getUnitOfMission("nao-existe"), null);
});

test("cada missão tem pelo menos um passo que pede foto", () => {
  for (const m of MISSIONS) {
    assert.ok(checkpointIndexes(m).length > 0, `${m.id} sem verificação`);
  }
});

test("todos os socorros são de um tipo conhecido e têm resposta", () => {
  for (const m of MISSIONS) {
    for (const step of m.steps) {
      assert.ok(step.rescues.length > 0, `${m.id}/${step.id} sem socorros`);
      for (const rescue of step.rescues) {
        assert.ok(RESCUE_KINDS.includes(rescue.kind));
        assert.ok(rescue.answer.trim().length > 0);
      }
    }
  }
});

test("uma missão vale mais XP do que uma lição", () => {
  assert.ok(missionXp(mission) > 100);
});

test("toClientMission não deixa escapar as respostas de socorro", () => {
  for (const m of MISSIONS) {
    const payload = JSON.stringify(toClientMission(m));
    assert.ok(!payload.includes('"answer"'), `${m.id}: resposta de socorro no payload`);
  }
  // Mas os tipos ficam, senão o painel não sabe que botões desenhar.
  const client = toClientMission(mission);
  assert.deepEqual(client.steps[0].rescues, [{ kind: "falta" }, { kind: "pronto" }]);
});

test("toClientMission numera os passos", () => {
  const client = toClientMission(mission);
  assert.deepEqual(
    client.steps.map((s) => s.index),
    [0, 1, 2, 3, 4, 5],
  );
});

test("findRescueAnswer devolve o texto guionado e nada mais", () => {
  assert.ok(findRescueAnswer(mission, 4, "cola").length > 20);
  assert.equal(findRescueAnswer(mission, 0, "queimei"), null, "socorro que este passo não tem");
  assert.equal(findRescueAnswer(mission, 99, "cola"), null, "passo fora da missão");
});

test("não se saltam passos", () => {
  assert.equal(validateStepMove(mission, 0, 1).ok, true, "o passo seguinte é sempre permitido");
  assert.equal(validateStepMove(mission, 0, 2).ok, false, "saltar um passo não");
  assert.equal(validateStepMove(mission, 3, 5).ok, false);
});

test("recuar é sempre permitido — quem cozinha precisa de reler", () => {
  assert.equal(validateStepMove(mission, 5, 0).ok, true);
  assert.equal(validateStepMove(mission, 3, 2).ok, true);
});

test("não se sai da missão pelas pontas", () => {
  assert.equal(validateStepMove(mission, 0, -1).ok, false);
  assert.equal(validateStepMove(mission, 5, 6).ok, false);
  assert.equal(validateStepMove(mission, 0, 1.5).ok, false);
  assert.equal(validateStepMove(mission, 0, NaN).ok, false);
});
