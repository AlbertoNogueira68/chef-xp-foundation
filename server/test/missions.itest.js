import test, { beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { query } from "../db/index.js";
import { getMission, getUnitOfMission, missionXp } from "../domain/missions.js";
import {
  PNG_1PX,
  createClient,
  resetDatabase,
  skipWithoutDatabase,
  useServer,
} from "./harness.js";

const MISSION = "mission.ovo-estrelado";
const origin = useServer();

/** Abre a missão pela via legítima: as lições da unidade dadas como feitas. */
async function unlock(userId) {
  const unit = getUnitOfMission(MISSION);
  for (const lesson of unit.lessons) {
    await query(
      `INSERT INTO lesson_progress (user_id, lesson_id, xp_earned, hearts_left)
       VALUES ($1, $2, 20, 3) ON CONFLICT DO NOTHING`,
      [userId, lesson.id],
    );
  }
}

/** Leva uma run até ao ponto em que só falta concluir. */
async function runReadyToFinish(client) {
  const start = await client.post(`/api/missions/${MISSION}/start`);
  const runId = start.data.run.id;

  const mission = getMission(MISSION);
  const checkpoint = mission.steps.findIndex((step) => step.checkpoint);
  await client.post(`/api/missions/runs/${runId}/checkpoint`, {
    stepIndex: checkpoint,
    imageDataUrl: PNG_1PX,
  });

  return runId;
}

describe("conclusão de missão", { skip: skipWithoutDatabase }, () => {
  let client;
  let user;

  beforeEach(async () => {
    await resetDatabase();
    client = createClient(origin);
    user = await client.register("cozinheira");
    await unlock(user.id);
  });

  test("uma missão fechada exige as lições da unidade", async () => {
    const outro = createClient(origin);
    await outro.register("apressado");

    const response = await outro.post(`/api/missions/${MISSION}/start`);
    assert.equal(response.status, 403);
  });

  test("recomeçar uma missão a decorrer retoma-a em vez de dar conflito", async () => {
    const primeira = await client.post(`/api/missions/${MISSION}/start`);
    assert.equal(primeira.status, 201);
    assert.equal(primeira.data.resumed, false);

    // Quem fechou a app a meio de cozinhar quer continuar, não recomeçar.
    const segunda = await client.post(`/api/missions/${MISSION}/start`);
    assert.equal(segunda.status, 200);
    assert.equal(segunda.data.resumed, true);
    assert.equal(segunda.data.run.id, primeira.data.run.id);
  });

  test("sem a foto do passo de verificação não se conclui", async () => {
    const start = await client.post(`/api/missions/${MISSION}/start`);
    const response = await client.post(
      `/api/missions/runs/${start.data.run.id}/complete`,
      { share: false },
    );

    // A foto é o que separa "cozinhei" de "carreguei em seguinte seis vezes".
    assert.equal(response.status, 400);

    const runs = await query(`SELECT status FROM mission_runs WHERE id = $1`, [start.data.run.id]);
    assert.equal(runs.rows[0].status, "in_progress");
  });

  test("concluir dá XP, regista prática e fecha a run", async () => {
    const runId = await runReadyToFinish(client);
    const response = await client.post(`/api/missions/runs/${runId}/complete`, { share: false });

    assert.equal(response.status, 200);
    assert.equal(response.data.xpEarned, missionXp(getMission(MISSION)));

    const events = await query(`SELECT amount FROM xp_events WHERE user_id = $1`, [user.id]);
    assert.equal(events.rowCount, 1);

    // `skill_practice` só cresce ao cozinhar. Acertar num quiz nunca conta.
    const practice = await query(`SELECT skill_id FROM skill_practice WHERE user_id = $1`, [
      user.id,
    ]);
    assert.equal(practice.rowCount, getMission(MISSION).practices.length);
  });

  test("concluir duas vezes não paga a dobrar", async () => {
    const runId = await runReadyToFinish(client);
    await client.post(`/api/missions/runs/${runId}/complete`, { share: false });

    const repetida = await client.post(`/api/missions/runs/${runId}/complete`, { share: false });
    assert.equal(repetida.status, 409);

    // Concluir é uma transação única e irrepetível — e o livro-razão prova-o.
    const events = await query(
      `SELECT count(*)::int AS n, sum(amount)::int AS total FROM xp_events WHERE user_id = $1`,
      [user.id],
    );
    assert.equal(events.rows[0].n, 1);
    assert.equal(events.rows[0].total, missionXp(getMission(MISSION)));
  });

  test("partilhar cria o post; não partilhar não cria nenhum", async () => {
    const runId = await runReadyToFinish(client);
    await client.post(`/api/missions/runs/${runId}/complete`, { share: true, caption: "olha" });

    const posts = await query(`SELECT caption, level_at FROM posts WHERE user_id = $1`, [user.id]);
    assert.equal(posts.rowCount, 1);
    assert.equal(posts.rows[0].caption, "olha");

    const outra = createClient(origin);
    const outroUser = await outra.register("reservado");
    await unlock(outroUser.id);
    const outroRun = await runReadyToFinish(outra);
    await outra.post(`/api/missions/runs/${outroRun}/complete`, { share: false });

    const nenhum = await query(`SELECT 1 FROM posts WHERE user_id = $1`, [outroUser.id]);
    assert.equal(nenhum.rowCount, 0);
  });

  test("a run de outra pessoa não se conclui", async () => {
    const runId = await runReadyToFinish(client);

    const intruso = createClient(origin);
    await intruso.register("intrusa");
    const response = await intruso.post(`/api/missions/runs/${runId}/complete`, { share: false });

    assert.equal(response.status, 404);
  });
});

describe("telemetria das missões", { skip: skipWithoutDatabase }, () => {
  let client;

  beforeEach(async () => {
    await resetDatabase();
    client = createClient(origin);
    const user = await client.register("medida");
    await unlock(user.id);
  });

  test("o cliente regista temporizador e voz, e mais nada", async () => {
    const start = await client.post(`/api/missions/${MISSION}/start`);
    const runId = start.data.run.id;

    assert.equal((await client.post(`/api/missions/runs/${runId}/events`, {
      kind: "timer",
      stepIndex: 1,
      detail: "90",
    })).status, 204);

    // Forjar um abandono corromperia a análise de onde as pessoas desistem.
    const forjado = await client.post(`/api/missions/runs/${runId}/events`, {
      kind: "abandon",
      stepIndex: 1,
    });
    assert.equal(forjado.status, 400);

    const rows = await query(`SELECT kind FROM mission_events WHERE run_id = $1`, [runId]);
    assert.deepEqual(
      rows.rows.map((r) => r.kind),
      ["timer"],
    );
  });

  test("uma run de outra pessoa responde 204 e não escreve nada", async () => {
    const start = await client.post(`/api/missions/${MISSION}/start`);
    const runId = start.data.run.id;

    const intruso = createClient(origin);
    await intruso.register("bisbilhoteiro");
    const response = await intruso.post(`/api/missions/runs/${runId}/events`, {
      kind: "timer",
      stepIndex: 0,
    });

    // 204 e não 404: a resposta a uma métrica não é sítio para dizer a
    // ninguém que runs existem.
    assert.equal(response.status, 204);
    const rows = await query(`SELECT 1 FROM mission_events WHERE run_id = $1`, [runId]);
    assert.equal(rows.rowCount, 0);
  });

  test("pedir socorro fica registado com o passo e o tipo", async () => {
    const start = await client.post(`/api/missions/${MISSION}/start`);
    const runId = start.data.run.id;

    await client.post(`/api/missions/runs/${runId}/rescue`, { stepIndex: 1, kind: "queimei" });

    const rows = await query(
      `SELECT step_index, kind, detail FROM mission_events WHERE run_id = $1`,
      [runId],
    );
    assert.equal(rows.rows[0].kind, "rescue");
    assert.equal(rows.rows[0].detail, "queimei");
    assert.equal(rows.rows[0].step_index, 1);
  });
});
