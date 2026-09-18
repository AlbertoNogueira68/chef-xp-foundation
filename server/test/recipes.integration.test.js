import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { query } from "../db/index.js";
import {
  closeDatabase,
  createClient,
  publishRecipe,
  registerUser,
  skipWithoutDatabase,
  startTestServer,
} from "./helpers.js";

describe("receitas", skipWithoutDatabase, () => {
  let server;
  let client;
  let outro;

  before(async () => {
    server = await startTestServer();
    client = server.client;

    // Um segundo browser, com sessão própria: é assim que se prova que uma
    // regra de propriedade é mesmo do servidor e não da interface.
    outro = createClient(server.baseUrl);
    await registerUser(outro);

    await registerUser(client);
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  test("publicar paga XP uma vez e devolve a receita", async () => {
    const { recipe, xp } = await publishRecipe(client);

    assert.equal(recipe.title, "Arroz de tomate");
    assert.equal(recipe.likesCount, 0);
    assert.equal(recipe.likedByMe, false);
    assert.equal(xp.earned, 25);

    const { rows } = await query(
      `SELECT count(*)::int AS eventos FROM xp_events WHERE source = 'recipe' AND source_ref = $1`,
      [recipe.id],
    );
    assert.equal(rows[0].eventos, 1);
  });

  test("gostar é idempotente: repetir não conta duas vezes", async () => {
    const { recipe } = await publishRecipe(client, { title: "Sopa de pedra" });

    const primeiro = await outro.post(`/api/recipes/${recipe.id}/like`);
    const segundo = await outro.post(`/api/recipes/${recipe.id}/like`);

    assert.equal(primeiro.status, 200);
    assert.equal(segundo.status, 200);
    assert.equal(segundo.body.recipe.likesCount, 1);
  });

  test("deixar de gostar volta a zero e repetir não vai a negativo", async () => {
    const { recipe } = await publishRecipe(client, { title: "Caldo verde" });
    await outro.post(`/api/recipes/${recipe.id}/like`);

    await outro.delete(`/api/recipes/${recipe.id}/like`);
    const segunda = await outro.delete(`/api/recipes/${recipe.id}/like`);
    assert.equal(segunda.body.recipe.likesCount, 0);
  });

  test("editar uma receita de outra pessoa dá 403", async () => {
    const { recipe } = await publishRecipe(client, { title: "Bacalhau à brás" });

    const resposta = await outro.patch(`/api/recipes/${recipe.id}`, { title: "roubada" });
    assert.equal(resposta.status, 403);

    const inalterada = await client.get(`/api/recipes/${recipe.id}`);
    assert.equal(inalterada.body.recipe.title, "Bacalhau à brás");
  });

  test("apagar uma receita de outra pessoa dá 403", async () => {
    const { recipe } = await publishRecipe(client, { title: "Feijoada" });
    assert.equal((await outro.delete(`/api/recipes/${recipe.id}`)).status, 403);
  });

  test("editar muda só os campos enviados", async () => {
    const { recipe } = await publishRecipe(client, { title: "Migas", difficulty: "dificil" });

    const resposta = await client.patch(`/api/recipes/${recipe.id}`, { cookTimeMin: 45 });
    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.recipe.cookTimeMin, 45);
    assert.equal(resposta.body.recipe.title, "Migas");
    assert.equal(resposta.body.recipe.difficulty, "dificil");
  });

  test("um PATCH vazio é recusado", async () => {
    const { recipe } = await publishRecipe(client, { title: "Rojões" });
    assert.equal((await client.patch(`/api/recipes/${recipe.id}`, {})).status, 400);
  });

  test("apagar revoga o XP e leva gostos e comentários atrás", async () => {
    const { recipe } = await publishRecipe(client, { title: "Açorda" });
    await outro.post(`/api/recipes/${recipe.id}/like`);
    await outro.post(`/api/recipes/${recipe.id}/comments`, { body: "que bom" });

    const antes = await client.get("/api/users/me");
    const resposta = await client.delete(`/api/recipes/${recipe.id}`);

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.xp.revoked, 25);
    assert.equal(resposta.body.xp.total, antes.body.user.xp - 25);

    const { rows } = await query(
      `SELECT
         (SELECT count(*)::int FROM recipes       WHERE id = $1)        AS receita,
         (SELECT count(*)::int FROM recipe_likes  WHERE recipe_id = $1) AS gostos,
         (SELECT count(*)::int FROM comments      WHERE recipe_id = $1) AS comentarios,
         (SELECT count(*)::int FROM xp_events     WHERE source_ref = $1::text) AS xp`,
      [recipe.id],
    );
    assert.deepEqual(rows[0], { receita: 0, gostos: 0, comentarios: 0, xp: 0 });
  });

  test("publicar e apagar em ciclo não acumula XP", async () => {
    const inicio = (await client.get("/api/users/me")).body.user.xp;

    for (let i = 0; i < 3; i += 1) {
      const { recipe } = await publishRecipe(client, { title: `Ciclo ${i}` });
      await client.delete(`/api/recipes/${recipe.id}`);
    }

    const fim = (await client.get("/api/users/me")).body.user.xp;
    assert.equal(fim, inicio, "o XP tinha de voltar ao que era");
  });

  /**
   * O dono da receita passou a poder apagar comentários na sua receita (ver
   * `moderation.integration.test.js`). O que continua a não poder é apagar um
   * comentário numa receita de outra pessoa — que é o que este teste prova,
   * com um terceiro pelo meio.
   */
  test("apagar um comentário numa receita que não é minha dá 403", async () => {
    const terceiro = createClient(server.baseUrl);
    await registerUser(terceiro);

    const { recipe } = await publishRecipe(client, { title: "Tripas" });
    const comentario = await outro.post(`/api/recipes/${recipe.id}/comments`, { body: "meu" });

    const resposta = await terceiro.delete(
      `/api/recipes/${recipe.id}/comments/${comentario.body.comment.id}`,
    );
    assert.equal(resposta.status, 403);

    const comentarios = await client.get(`/api/recipes/${recipe.id}/comments`);
    assert.equal(comentarios.body.comments.length, 1);
  });

  test("a pesquisa e os filtros são aplicados pelo servidor", async () => {
    await publishRecipe(client, { title: "Polvo à lagareiro", cookTimeMin: 90 });

    const porTexto = await client.get("/api/recipes?q=lagareiro");
    assert.equal(porTexto.body.recipes.length, 1);

    const porTempo = await client.get("/api/recipes?maxTime=30&q=lagareiro");
    assert.equal(porTempo.body.recipes.length, 0);
  });

  test("uma receita que não existe dá 404", async () => {
    const resposta = await client.get("/api/recipes/00000000-0000-0000-0000-000000000000");
    assert.equal(resposta.status, 404);
  });

  test("um id que não é UUID dá 400, não 500", async () => {
    assert.equal((await client.get("/api/recipes/isto-nao-e-um-uuid")).status, 400);
  });
});
