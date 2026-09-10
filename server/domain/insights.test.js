import test from "node:test";
import assert from "node:assert/strict";
import {
  MIN_SAMPLE,
  asPercent,
  describeRate,
  median,
  rankRescues,
  rankSteps,
  rate,
  summarizeAdherence,
  summarizeRuns,
} from "./insights.js";

test("uma taxa sem denominador não é zero, é nada", () => {
  // Zero seria uma afirmação sobre o mundo; não haver dados não é uma.
  assert.equal(rate(0, 0), null);
  assert.equal(rate(3, 0), null);
  assert.equal(rate(1, 4), 0.25);
  assert.equal(asPercent(null), "—");
  assert.equal(asPercent(0.25), "25%");
});

test("toda a percentagem sai acompanhada do número de onde veio", () => {
  assert.equal(describeRate(1, 4).text, "25% (1/4)");
  assert.equal(describeRate(0, 0).text, "— (0/0)");
});

test("uma amostra pequena de mais vem marcada", () => {
  assert.equal(describeRate(2, 2).thin, true);
  assert.equal(describeRate(2, MIN_SAMPLE).thin, false);
});

test("desistir e desaparecer são coisas diferentes", () => {
  // Quem fecha a app a cozinhar não carrega em "abandonar". Juntar os dois
  // escondia o caso mais comum.
  const summary = summarizeRuns([
    { status: "completed", runs: 6 },
    { status: "abandoned", runs: 1 },
    { status: "in_progress", runs: 3 },
  ]);

  assert.equal(summary.total, 10);
  assert.equal(summary.completion.text, "60% (6/10)");
  assert.equal(summary.unfinished.text, "40% (4/10)");
  assert.equal(summary.declared.text, "25% (1/4)");
});

test("sem runs nenhumas o resumo não inventa taxas", () => {
  const summary = summarizeRuns([]);
  assert.equal(summary.total, 0);
  assert.equal(summary.completion.value, null);
  assert.equal(summary.declared.value, null);
});

test("desistir num passo pesa mais do que pedir socorro nele", () => {
  const ranked = rankSteps([
    { mission_id: "m1", step_index: 1, kind: "back", events: 9, runs: 10 },
    { mission_id: "m1", step_index: 3, kind: "abandon", events: 2, runs: 10 },
  ]);

  // Sem pesos, o passo com nove "voltar atrás" tapava aquele onde as pessoas
  // se vão mesmo embora.
  assert.equal(ranked[0].stepIndex, 3);
  assert.equal(ranked[0].friction, 10);
  assert.equal(ranked[1].friction, 9);
});

test("os eventos do mesmo passo juntam-se numa linha só", () => {
  const ranked = rankSteps([
    { mission_id: "m1", step_index: 2, kind: "rescue", events: 3, runs: 8 },
    { mission_id: "m1", step_index: 2, kind: "back", events: 1, runs: 8 },
    { mission_id: "m1", step_index: 2, kind: "timer", events: 6, runs: 8 },
  ]);

  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].rescue, 3);
  assert.equal(ranked[0].timer, 6);
  assert.equal(ranked[0].friction, 7); // 3*2 + 1*1 — o temporizador não é atrito
});

test("passos de missões diferentes não se misturam", () => {
  const ranked = rankSteps([
    { mission_id: "m1", step_index: 0, kind: "rescue", events: 1, runs: 3 },
    { mission_id: "m2", step_index: 0, kind: "rescue", events: 1, runs: 3 },
  ]);
  assert.equal(ranked.length, 2);
});

test("empates desempatam pelo passo, para o relatório ser estável", () => {
  const ranked = rankSteps([
    { mission_id: "m1", step_index: 4, kind: "back", events: 2, runs: 5 },
    { mission_id: "m1", step_index: 1, kind: "back", events: 2, runs: 5 },
  ]);
  assert.deepEqual(
    ranked.map((r) => r.stepIndex),
    [1, 4],
  );
});

test("os socorros ordenam-se por procura e trazem a fatia", () => {
  const ranked = rankRescues([
    { detail: "queimei", events: 2 },
    { detail: "falta", events: 6 },
  ]);

  assert.equal(ranked.total, 8);
  assert.equal(ranked.kinds[0].kind, "falta");
  assert.equal(ranked.kinds[0].share, 0.75);
});

test("a mediana aguenta listas pares, ímpares e vazias", () => {
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
  assert.equal(median(["x", null, 2, 4]), 3);
});

test("a adesão mede-se só sobre dias que já passaram", () => {
  // Contar um dia que ainda não chegou como falhado dava uma adesão que
  // melhora ao domingo à noite e piora à segunda de manhã sozinha.
  const summary = summarizeAdherence([
    { done: 3, missed: 1, spontaneous: 2 },
    { done: 1, missed: 3, spontaneous: 0 },
  ]);

  assert.equal(summary.settled, 8);
  assert.equal(summary.adherence.text, "50% (4/8)");
  assert.equal(summary.spontaneous, 2);
});

test("sem compromissos ninguém é acusado de faltar", () => {
  const summary = summarizeAdherence([]);
  assert.equal(summary.adherence.value, null);
  assert.equal(summary.settled, 0);
});
