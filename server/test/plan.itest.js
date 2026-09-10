import test, { beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { query } from "../db/index.js";
import { cookOnce, createClient, resetDatabase, skipWithoutDatabase, useServer } from "./harness.js";

const origin = useServer();

/** O dia de hoje no fuso do utilizador de teste, no mesmo formato da app. */
function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isoWeekday(day) {
  const [y, m, d] = day.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

function shiftDay(day, amount) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + amount * 86400000).toISOString().slice(0, 10);
}

describe("o compromisso", { skip: skipWithoutDatabase }, () => {
  let client;
  let user;

  beforeEach(async () => {
    await resetDatabase();
    client = createClient(origin);
    user = await client.register("comprometida");
  });

  test("sem compromisso não há semana a contar", async () => {
    const response = await client.get("/api/plan");
    assert.equal(response.status, 200);
    assert.equal(response.data.plan, null);
    assert.equal(response.data.summary, null);
    assert.equal(response.data.message, null);
  });

  test("um plano feito hoje não deve nada aos dias que já passaram", async () => {
    // Prometer hoje uma segunda-feira que já passou não é uma dívida.
    const response = await client.put("/api/plan", { weekdays: [1, 2, 3, 4, 5, 6, 7] });

    assert.equal(response.status, 200);
    assert.equal(response.data.summary.missed, 0);
  });

  test("só se materializam promessas de hoje para a frente", async () => {
    await client.put("/api/plan", { weekdays: [1, 2, 3, 4, 5, 6, 7] });

    const rows = await query(
      `SELECT planned_on FROM cooking_sessions WHERE user_id = $1 ORDER BY planned_on`,
      [user.id],
    );
    const dias = rows.rows.map((r) => r.planned_on.toISOString().slice(0, 10));
    assert.ok(dias.every((dia) => dia >= today()));
    assert.ok(dias.includes(today()));
  });

  test("um dia prometido que passou em branco fica falhado", async () => {
    const hoje = today();
    const ontem = shiftDay(hoje, -1);

    await client.put("/api/plan", { weekdays: [isoWeekday(ontem), isoWeekday(hoje)] });
    // O compromisso é anterior a ontem: agora ontem é mesmo uma falta.
    await query(`UPDATE cooking_plans SET updated_at = now() - interval '30 days' WHERE user_id = $1`, [user.id]);
    await query(
      `INSERT INTO cooking_sessions (user_id, planned_on, status, promised)
       VALUES ($1, $2::date, 'planned', true) ON CONFLICT DO NOTHING`,
      [user.id, ontem],
    );

    const response = await client.get("/api/plan");
    assert.equal(response.data.summary.missed, 1);

    const row = await query(
      `SELECT status FROM cooking_sessions WHERE user_id = $1 AND planned_on = $2::date`,
      [user.id, ontem],
    );
    assert.equal(row.rows[0].status, "missed");
  });

  test("hoje nunca está falhado — o dia ainda não acabou", async () => {
    await client.put("/api/plan", { weekdays: [isoWeekday(today())] });
    await query(`UPDATE cooking_plans SET updated_at = now() - interval '30 days' WHERE user_id = $1`, [user.id]);

    const response = await client.get("/api/plan");
    assert.equal(response.data.summary.missed, 0);
    assert.equal(response.data.summary.todayIsPlanned, true);
  });

  test("cozinhar fecha o dia e a faixa muda", async () => {
    await client.put("/api/plan", { weekdays: [isoWeekday(today())] });

    const resultado = await cookOnce(client, user.id, "mission.ovo-estrelado");
    assert.equal(resultado.cookedOn, today());

    const response = await client.get("/api/plan");
    assert.equal(response.data.summary.done, 1);
    assert.equal(response.data.summary.cookedToday, true);
    assert.match(response.data.message, /Já cozinhaste hoje|Cumpriste/);
  });

  test("um dia prometido cumprido conta como promessa; um espontâneo não", async () => {
    // É esta distinção que torna a adesão mensurável: sem ela, cozinhar fora
    // do plano fazia subir a taxa de promessas cumpridas.
    await client.put("/api/plan", { weekdays: [isoWeekday(shiftDay(today(), 2))] });
    await cookOnce(client, user.id, "mission.ovo-estrelado");

    const row = await query(
      `SELECT promised, status FROM cooking_sessions WHERE user_id = $1 AND planned_on = $2::date`,
      [user.id, today()],
    );
    assert.equal(row.rows[0].status, "done");
    assert.equal(row.rows[0].promised, false);
  });

  test("estreitar o plano apaga promessas futuras e preserva o passado", async () => {
    const hoje = today();
    await client.put("/api/plan", { weekdays: [1, 2, 3, 4, 5, 6, 7] });

    const antes = await query(`SELECT count(*)::int AS n FROM cooking_sessions WHERE user_id = $1`, [user.id]);
    assert.ok(antes.rows[0].n >= 1);

    // Uma falta antiga, que não pode desaparecer só por se mudar de plano.
    await query(
      `INSERT INTO cooking_sessions (user_id, planned_on, status, promised)
       VALUES ($1, $2::date, 'missed', true)`,
      [user.id, shiftDay(hoje, -10)],
    );

    await client.put("/api/plan", { weekdays: [isoWeekday(hoje)] });

    const rows = await query(
      `SELECT planned_on, status FROM cooking_sessions WHERE user_id = $1 ORDER BY planned_on`,
      [user.id],
    );
    const futuras = rows.rows.filter((r) => r.planned_on.toISOString().slice(0, 10) > hoje);
    assert.equal(futuras.length, 0);
    assert.ok(rows.rows.some((r) => r.status === "missed"));
  });

  test("desistir apaga o plano e mantém o historial", async () => {
    await client.put("/api/plan", { weekdays: [isoWeekday(today())] });
    await query(
      `INSERT INTO cooking_sessions (user_id, planned_on, status, promised)
       VALUES ($1, $2::date, 'done', true)`,
      [user.id, shiftDay(today(), -7)],
    );

    const response = await client.del("/api/plan");
    assert.equal(response.status, 200);
    assert.equal(response.data.plan, null);

    const planos = await query(`SELECT 1 FROM cooking_plans WHERE user_id = $1`, [user.id]);
    assert.equal(planos.rowCount, 0);

    const historial = await query(
      `SELECT status FROM cooking_sessions WHERE user_id = $1`,
      [user.id],
    );
    assert.deepEqual(
      historial.rows.map((r) => r.status),
      ["done"],
    );
  });

  test("dias fora do intervalo são recusados", async () => {
    assert.equal((await client.put("/api/plan", { weekdays: [8] })).status, 400);
    assert.equal((await client.put("/api/plan", { weekdays: [0] })).status, 400);
    assert.equal((await client.put("/api/plan", { weekdays: [], targetWeek: 99 })).status, 400);
  });

  test("com dias fixos o alvo são os dias, mesmo que se peça outro número", async () => {
    const response = await client.put("/api/plan", {
      weekdays: [isoWeekday(today()), isoWeekday(shiftDay(today(), 1))],
      targetWeek: 1,
    });
    assert.equal(response.data.plan.targetWeek, 2);
  });
});
