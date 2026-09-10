import test from "node:test";
import assert from "node:assert/strict";
import {
  bannerMessage,
  isoWeekday,
  nextCookingDate,
  normalizeWeekdays,
  overdueSessions,
  plannedDatesForWeek,
  resolveTarget,
  startOfWeek,
  summarizeWeek,
  todayFor,
  weekDates,
} from "./plan.js";

/* 2026-09-07 é uma segunda-feira; 2026-09-10 é a quinta dessa mesma semana. */
const SEGUNDA = "2026-09-07";
const QUINTA = "2026-09-10";

test("a semana começa à segunda, não ao domingo", () => {
  assert.equal(isoWeekday(SEGUNDA), 1);
  assert.equal(isoWeekday("2026-09-13"), 7); // domingo
  assert.equal(startOfWeek(QUINTA), SEGUNDA);
  assert.equal(startOfWeek(SEGUNDA), SEGUNDA);
  // O domingo pertence à semana que começou na segunda anterior.
  assert.equal(startOfWeek("2026-09-13"), SEGUNDA);
});

test("a semana atravessa a viragem do mês", () => {
  assert.equal(startOfWeek("2026-10-01"), "2026-09-28");
  assert.deepEqual(weekDates("2026-09-28").at(-1), "2026-10-04");
});

test("dias repetidos, desordenados ou fora do intervalo não passam", () => {
  assert.deepEqual(normalizeWeekdays([4, 2, 4, 2]), [2, 4]);
  assert.deepEqual(normalizeWeekdays([0, 8, -1, 3]), [3]);
  assert.deepEqual(normalizeWeekdays("terça"), []);
  assert.deepEqual(normalizeWeekdays(null), []);
});

test("com dias fixos o alvo são os dias, não o número à parte", () => {
  // Dizer "às terças e quintas" e "uma vez por semana" ao mesmo tempo é
  // incoerente: mandam os dias.
  assert.equal(resolveTarget({ weekdays: [2, 4], targetWeek: 1 }), 2);
  assert.equal(resolveTarget({ weekdays: [], targetWeek: 3 }), 3);
  assert.equal(resolveTarget({ weekdays: [], targetWeek: 99 }), 7);
  assert.equal(resolveTarget({ weekdays: [], targetWeek: 0 }), 1);
  assert.equal(resolveTarget({}), 2);
});

test("os dias planeados caem nas datas certas da semana", () => {
  assert.deepEqual(plannedDatesForWeek([2, 4], SEGUNDA), ["2026-09-08", "2026-09-10"]);
});

test("o próximo dia de cozinhar inclui hoje", () => {
  assert.equal(nextCookingDate([4], QUINTA), QUINTA);
  assert.equal(nextCookingDate([1], QUINTA), "2026-09-14"); // a segunda seguinte
  // No modo "quando calhar" não há um dia seguinte, há uma semana por cumprir.
  assert.equal(nextCookingDate([], QUINTA), null);
});

test("falhar antes de prometer não é falhar", () => {
  const plan = { weekdays: [2, 4], startedOn: QUINTA };
  const summary = summarizeWeek({ plan, sessions: [], today: QUINTA });

  assert.equal(summary.missed, 0);
  assert.equal(summary.todayIsPlanned, true);
  assert.equal(summary.days.find((d) => d.date === "2026-09-08").status, "free");
});

test("um dia prometido que passou em branco fica falhado", () => {
  const plan = { weekdays: [2, 4], startedOn: "2026-09-01" };
  const summary = summarizeWeek({ plan, sessions: [], today: QUINTA });

  assert.equal(summary.missed, 1);
  assert.equal(summary.days.find((d) => d.date === "2026-09-08").status, "missed");
});

test("hoje nunca está falhado — o dia ainda não acabou", () => {
  const plan = { weekdays: [4], startedOn: "2026-09-01" };
  const summary = summarizeWeek({ plan, sessions: [], today: QUINTA });

  assert.equal(summary.missed, 0);
  assert.equal(summary.days.find((d) => d.isToday).status, "planned");
});

test("cozinhar fora do dia conta na semana e não apaga o dia falhado", () => {
  // As duas coisas são verdade: cozinhou mesmo, e faltou ao que prometeu.
  const plan = { weekdays: [2, 4], startedOn: "2026-09-01" };
  const sessions = [{ plannedOn: "2026-09-09", status: "done" }]; // quarta
  const summary = summarizeWeek({ plan, sessions, today: QUINTA });

  assert.equal(summary.done, 1);
  assert.equal(summary.missed, 1);
  assert.equal(summary.remaining, 1);
});

test("no modo quando calhar contam-se cozinhados, não dias da semana", () => {
  const plan = { weekdays: [], targetWeek: 2, startedOn: "2026-09-01" };
  const sessions = [
    { plannedOn: "2026-09-07", status: "done" },
    { plannedOn: "2026-09-09", status: "done" },
  ];
  const summary = summarizeWeek({ plan, sessions, today: QUINTA });

  assert.equal(summary.done, 2);
  assert.equal(summary.missed, 0);
  assert.equal(summary.complete, true);
  assert.equal(summary.remaining, 0);
});

test("cozinhar mais do que o prometido não passa o alvo para negativo", () => {
  const plan = { weekdays: [], targetWeek: 1, startedOn: "2026-09-01" };
  const sessions = [
    { plannedOn: "2026-09-07", status: "done" },
    { plannedOn: "2026-09-09", status: "done" },
  ];
  const summary = summarizeWeek({ plan, sessions, today: QUINTA });

  assert.equal(summary.remaining, 0);
  assert.equal(summary.complete, true);
});

test("só as sessões passadas por cumprir estão em atraso", () => {
  const sessions = [
    { plannedOn: "2026-09-08", status: "planned" },
    { plannedOn: QUINTA, status: "planned" },
    { plannedOn: "2026-09-11", status: "planned" },
    { plannedOn: "2026-09-07", status: "done" },
  ];
  assert.deepEqual(
    overdueSessions(sessions, QUINTA).map((s) => s.plannedOn),
    ["2026-09-08"],
  );
});

test("a faixa diz a coisa certa em cada estado", () => {
  const base = { weekdays: [2, 4], startedOn: "2026-09-01" };

  const hoje = summarizeWeek({ plan: base, sessions: [], today: QUINTA });
  assert.equal(bannerMessage(hoje), "Hoje é dia de cozinhar.");

  const jaHoje = summarizeWeek({
    plan: base,
    sessions: [{ plannedOn: QUINTA, status: "done" }],
    today: QUINTA,
  });
  assert.equal(bannerMessage(jaHoje), "Já cozinhaste hoje. Falta 1 para fechar a semana.");

  const jaHojeDuas = summarizeWeek({
    plan: { weekdays: [], targetWeek: 3, startedOn: "2026-09-01" },
    sessions: [{ plannedOn: QUINTA, status: "done" }],
    today: QUINTA,
  });
  assert.equal(bannerMessage(jaHojeDuas), "Já cozinhaste hoje. Faltam 2 para fechar a semana.");

  const cumprida = summarizeWeek({
    plan: { weekdays: [], targetWeek: 1, startedOn: "2026-09-01" },
    sessions: [{ plannedOn: "2026-09-09", status: "done" }],
    today: QUINTA,
  });
  assert.match(bannerMessage(cumprida), /Cumpriste/);

  const proximo = summarizeWeek({
    plan: { weekdays: [1, 5], startedOn: "2026-09-01" },
    sessions: [{ plannedOn: "2026-09-07", status: "done" }],
    today: QUINTA,
  });
  assert.match(bannerMessage(proximo), /O próximo dia é sexta/);

  assert.equal(bannerMessage(null), null);
});

test("o dia é o do fuso do utilizador, não o do servidor", () => {
  // 23:30 em Lisboa é já o dia seguinte em Tóquio.
  const instante = new Date("2026-09-10T22:30:00Z");
  assert.equal(todayFor("Europe/Lisbon", instante), "2026-09-10");
  assert.equal(todayFor("Asia/Tokyo", instante), "2026-09-11");
  assert.equal(todayFor("fuso-que-nao-existe", instante), "2026-09-10");
});

test("a linha gravada manda sobre a derivação do plano", () => {
  // A pessoa prometeu terças e quintas, falhou a terça, e depois mudou o plano
  // para só sextas. A terça falhada tem de continuar falhada.
  const plan = { weekdays: [5], startedOn: "2026-09-01" };
  const sessions = [{ plannedOn: "2026-09-08", status: "missed" }];
  const summary = summarizeWeek({ plan, sessions, today: QUINTA });

  assert.equal(summary.missed, 1);
  assert.equal(summary.days.find((d) => d.date === "2026-09-08").status, "missed");
});

test("uma sessão adiada não conta como falhada nem como feita", () => {
  const plan = { weekdays: [2, 4], startedOn: "2026-09-01" };
  const sessions = [{ plannedOn: "2026-09-08", status: "moved" }];
  const summary = summarizeWeek({ plan, sessions, today: QUINTA });

  assert.equal(summary.missed, 0);
  assert.equal(summary.done, 0);
});
