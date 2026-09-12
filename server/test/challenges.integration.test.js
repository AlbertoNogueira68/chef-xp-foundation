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

describe("desafios", skipWithoutDatabase, () => {
  let server;
  let client;
  let outro;

  before(async () => {
    server = await startTestServer();
    client = server.client;
    outro = createClient(server.baseUrl);
    await registerUser(outro);
    await registerUser(client);
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  test("participar paga o XP do desafio e conta a participação", async () => {
    const desafio = await createChallenge({ xpReward: 100 });
    const { recipe } = await publishRecipe(client, { title: "Para o desafio" });

    const antes = (await client.get("/api/users/me")).body.user.xp;
    const resposta = await client.post(`/api/challenges/${desafio.id}/entries`, {
      recipeId: recipe.id,
    });

    assert.equal(resposta.status, 201);
    assert.equal(resposta.body.xp.earned, 100);
    assert.equal(resposta.body.xp.total, antes + 100);
    assert.equal(resposta.body.challenge.entriesCount, 1);
    assert.equal(resposta.body.challenge.myEntry.recipeId, recipe.id);
  });

  test("participar duas vezes no mesmo desafio dá 409", async () => {
    const desafio = await createChallenge();
    const { recipe } = await publishRecipe(client, { title: "Uma vez só" });

    await client.post(`/api/challenges/${desafio.id}/entries`, { recipeId: recipe.id });
    const segunda = await client.post(`/api/challenges/${desafio.id}/entries`, {
      recipeId: recipe.id,
    });

    assert.equal(segunda.status, 409);
  });

  test("submeter a receita de outra pessoa dá 403", async () => {
    const desafio = await createChallenge();
    const { recipe } = await publishRecipe(outro, { title: "Não é minha" });

    const resposta = await client.post(`/api/challenges/${desafio.id}/entries`, {
      recipeId: recipe.id,
    });
    assert.equal(resposta.status, 403);
  });

  test("a mesma receita não entra em dois desafios", async () => {
    const primeiro = await createChallenge();
    const segundo = await createChallenge();
    const { recipe } = await publishRecipe(client, { title: "Só num" });

    await client.post(`/api/challenges/${primeiro.id}/entries`, { recipeId: recipe.id });
    const resposta = await client.post(`/api/challenges/${segundo.id}/entries`, {
      recipeId: recipe.id,
    });

    assert.equal(resposta.status, 409);
  });

  test("um desafio terminado não aceita participações", async () => {
    const desafio = await createChallenge({ endsInDays: -1 });
    const { recipe } = await publishRecipe(client, { title: "Tarde demais" });

    const resposta = await client.post(`/api/challenges/${desafio.id}/entries`, {
      recipeId: recipe.id,
    });
    assert.equal(resposta.status, 409);
  });

  test("sair e voltar a entrar não volta a pagar", async () => {
    const desafio = await createChallenge({ xpReward: 100 });
    const { recipe } = await publishRecipe(client, { title: "Ida e volta" });

    await client.post(`/api/challenges/${desafio.id}/entries`, { recipeId: recipe.id });
    const depoisDaPrimeira = (await client.get("/api/users/me")).body.user.xp;

    await client.delete(`/api/challenges/${desafio.id}/entries`);
    const regresso = await client.post(`/api/challenges/${desafio.id}/entries`, {
      recipeId: recipe.id,
    });

    assert.equal(regresso.status, 201);
    assert.equal(regresso.body.xp.earned, 0, "não se paga duas vezes pelo mesmo desafio");
    assert.equal((await client.get("/api/users/me")).body.user.xp, depoisDaPrimeira);

    // Só os deste desafio: os outros testes desta bateria também participam.
    const { rows } = await query(
      `SELECT count(*)::int AS eventos
         FROM xp_events WHERE source = 'challenge' AND source_ref = $1::text`,
      [desafio.id],
    );
    assert.equal(rows[0].eventos, 1);
  });

  test("retirar uma participação que não existe dá 404", async () => {
    const desafio = await createChallenge();
    assert.equal((await client.delete(`/api/challenges/${desafio.id}/entries`)).status, 404);
  });

  test("o detalhe mostra as participações de toda a gente", async () => {
    const desafio = await createChallenge();
    const minha = await publishRecipe(client, { title: "A minha" });
    const dele = await publishRecipe(outro, { title: "A dele" });

    await client.post(`/api/challenges/${desafio.id}/entries`, { recipeId: minha.recipe.id });
    await outro.post(`/api/challenges/${desafio.id}/entries`, { recipeId: dele.recipe.id });

    const resposta = await client.get(`/api/challenges/${desafio.id}`);
    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.challenge.entriesCount, 2);
    assert.deepEqual(resposta.body.entries.map((entry) => entry.recipe.title).sort(), [
      "A dele",
      "A minha",
    ]);
  });

  test("apagar a receita retira a participação", async () => {
    const desafio = await createChallenge();
    const { recipe } = await publishRecipe(client, { title: "Vai desaparecer" });
    await client.post(`/api/challenges/${desafio.id}/entries`, { recipeId: recipe.id });

    await client.delete(`/api/recipes/${recipe.id}`);

    const resposta = await client.get(`/api/challenges/${desafio.id}`);
    assert.equal(resposta.body.challenge.entriesCount, 0);
    assert.equal(resposta.body.challenge.myEntry, null);
  });

  test("um desafio que não existe dá 404", async () => {
    const { recipe } = await publishRecipe(client, { title: "Sem desafio" });
    const resposta = await client.post(
      "/api/challenges/00000000-0000-0000-0000-000000000000/entries",
      { recipeId: recipe.id },
    );
    assert.equal(resposta.status, 404);
  });
});
