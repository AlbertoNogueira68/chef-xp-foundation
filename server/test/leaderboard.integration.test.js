import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { query } from "../db/index.js";
import {
  closeDatabase,
  createChallenge,
  createClient,
  publishRecipe,
  registerUser,
  skipWithoutDatabase,
  startTestServer,
} from "./helpers.js";

describe("rankings", skipWithoutDatabase, () => {
  let server;
  let eu;
  let outro;
  let terceiro;

  before(async () => {
    server = await startTestServer();

    eu = server.client;
    await registerUser(eu, { username: "primeiro" });

    outro = createClient(server.baseUrl);
    await registerUser(outro, { username: "segundo" });

    terceiro = createClient(server.baseUrl);
    await registerUser(terceiro, { username: "terceiro" });

    // Três receitas para mim, duas para o segundo, nenhuma para o terceiro:
    // 75, 50 e 0 XP, uma ordem que não deixa dúvidas.
    for (let i = 0; i < 3; i += 1) await publishRecipe(eu, { title: `Minha ${i}` });
    for (let i = 0; i < 2; i += 1) await publishRecipe(outro, { title: `Dele ${i}` });
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  test("o ranking global vem ordenado e diz quem sou eu", async () => {
    const resposta = await eu.get("/api/leaderboard");

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.scope, "global");

    const [primeiro, segundo] = resposta.body.entries;
    assert.equal(primeiro.user.username, "primeiro");
    assert.equal(primeiro.score, 75);
    assert.equal(primeiro.rank, 1);
    assert.equal(primeiro.isMe, true);

    assert.equal(segundo.user.username, "segundo");
    assert.equal(segundo.score, 50);
    assert.equal(segundo.rank, 2);
    assert.equal(segundo.isMe, false);
  });

  test("a minha posição vem à parte, para quem está fora do top a ver", async () => {
    const resposta = await terceiro.get("/api/leaderboard?limit=1");

    assert.equal(resposta.body.entries.length, 1);
    assert.equal(resposta.body.entries[0].user.username, "primeiro");

    assert.ok(resposta.body.me, "a minha linha tem de vir mesmo fora do top");
    assert.equal(resposta.body.me.user.username, "terceiro");
    assert.equal(resposta.body.me.isMe, true);
    assert.equal(resposta.body.me.score, 0);
  });

  test("quem empata fica na mesma posição", async () => {
    // O terceiro publica duas receitas: fica com 50, igual ao segundo.
    for (let i = 0; i < 2; i += 1) await publishRecipe(terceiro, { title: `Terceira ${i}` });

    const { entries } = (await eu.get("/api/leaderboard")).body;
    const empatados = entries.filter((entry) => entry.score === 50);

    assert.equal(empatados.length, 2);
    assert.deepEqual([...new Set(empatados.map((e) => e.rank))], [2], "empate é a mesma posição");
  });

  test("o ranking semanal conta os últimos sete dias, não o total", async () => {
    // XP antigo: entra no total, não na semana.
    const { rows } = await query(`SELECT id FROM users WHERE username = 'segundo'`);
    await query(
      `UPDATE daily_activity SET day = current_date - INTERVAL '30 days'
        WHERE user_id = $1`,
      [rows[0].id],
    );

    const semanal = (await eu.get("/api/leaderboard?scope=weekly")).body;
    const global = (await eu.get("/api/leaderboard?scope=global")).body;

    assert.ok(
      !semanal.entries.some((entry) => entry.user.username === "segundo"),
      "o XP de há 30 dias não conta para a semana",
    );
    assert.ok(global.entries.some((entry) => entry.user.username === "segundo"));
  });

  test("um scope inventado é recusado", async () => {
    assert.equal((await eu.get("/api/leaderboard?scope=mensal")).status, 400);
  });

  test("sem sessão não há ranking", async () => {
    const anonimo = createClient(server.baseUrl);
    assert.equal((await anonimo.get("/api/leaderboard")).status, 401);
  });

  test("as participações de um desafio vêm ordenadas por gostos", async () => {
    const desafio = await createChallenge();

    const primeira = await publishRecipe(eu, { title: "Submetida cedo" });
    const segunda = await publishRecipe(outro, { title: "Submetida depois" });

    await eu.post(`/api/challenges/${desafio.id}/entries`, { recipeId: primeira.recipe.id });
    await outro.post(`/api/challenges/${desafio.id}/entries`, { recipeId: segunda.recipe.id });

    // A segunda recebe dois gostos, a primeira nenhum.
    await eu.post(`/api/recipes/${segunda.recipe.id}/like`);
    await terceiro.post(`/api/recipes/${segunda.recipe.id}/like`);

    const { entries } = (await eu.get(`/api/challenges/${desafio.id}`)).body;

    assert.deepEqual(
      entries.map((entry) => entry.recipe.title),
      ["Submetida depois", "Submetida cedo"],
      "quem tem mais gostos vem primeiro, independentemente da ordem de chegada",
    );
    assert.equal(entries[0].recipe.likesCount, 2);
  });
});
