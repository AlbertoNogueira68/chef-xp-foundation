import test, { beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { query } from "../db/index.js";
import { createClient, resetDatabase, skipWithoutDatabase, useServer } from "./harness.js";

const origin = useServer();

async function publishRecipe(client, title, createdAt = null) {
  const response = await client.post("/api/recipes", {
    title,
    description: "descrição suficientemente longa",
    ingredients: "x, y, z",
    cookTimeMin: 20,
    difficulty: "facil",
  });
  assert.equal(response.status, 201);
  if (createdAt) {
    await query(`UPDATE recipes SET created_at = $1 WHERE id = $2`, [
      createdAt,
      response.data.recipe.id,
    ]);
  }
  return response.data.recipe.id;
}

/**
 * Um cozinhado partilhado, escrito directamente.
 *
 * Passar pela missão inteira em cada caso tornava estes testes sobre a
 * conclusão de missões, que já tem os seus. Aqui o que interessa é o que o
 * feed faz com as linhas.
 */
async function publishCook(userId, { createdAt, shared = true, mission = "mission.omelete" }) {
  const run = await query(
    `INSERT INTO mission_runs
       (user_id, mission_id, status, current_step, started_at, completed_at, result_image, shared)
     VALUES ($1, $2, 'completed', 3, $3::timestamptz - interval '20 minutes', $3, '/uploads/x.png', $4)
     RETURNING id`,
    [userId, mission, createdAt, shared],
  );
  if (!shared) return null;

  const post = await query(
    `INSERT INTO posts (user_id, run_id, mission_id, image_url, level_at, created_at)
     VALUES ($1, $2, $3, '/uploads/x.png', 2, $4) RETURNING id`,
    [userId, run.rows[0].id, mission, createdAt],
  );
  return Number(post.rows[0].id);
}

describe("o feed", { skip: skipWithoutDatabase }, () => {
  let client;
  let user;

  beforeEach(async () => {
    await resetDatabase();
    client = createClient(origin);
    user = await client.register("feedista");
  });

  test("junta cozinhados e receitas na mesma lista", async () => {
    await publishRecipe(client, "Sopa de grão");
    await publishCook(user.id, { createdAt: new Date().toISOString() });

    const response = await client.get("/api/feed?limit=50");
    assert.equal(response.status, 200);

    const kinds = response.data.items.map((item) => item.kind).sort();
    assert.deepEqual(kinds, ["cook", "recipe"]);
  });

  test("um cozinhado não partilhado nunca chega ao feed", async () => {
    await publishCook(user.id, { createdAt: new Date().toISOString(), shared: false });

    const response = await client.get("/api/feed?limit=50");
    assert.equal(response.data.items.length, 0);

    // Mas continua a contar no perfil de quem o fez.
    const perfil = await client.get(`/api/missions/posts?userId=${user.id}`);
    assert.equal(perfil.data.posts.length, 1);
    assert.equal(perfil.data.posts[0].shared, false);
  });

  test("as chaves das duas naturezas nunca colidem", async () => {
    await publishRecipe(client, "Arroz de forno");
    await publishCook(user.id, { createdAt: new Date().toISOString() });

    const response = await client.get("/api/feed?limit=50");
    const keys = response.data.items.map((item) => item.key);
    assert.equal(new Set(keys).size, keys.length);
    assert.ok(keys.every((key) => key.startsWith("cook:") || key.startsWith("recipe:")));
  });

  test("a paginação não perde nem repete com tudo no mesmo instante", async () => {
    // O pior caso do cursor: doze itens das duas naturezas a partilhar o
    // carimbo temporal. A data sozinha não desempata.
    const instante = "2026-09-05T10:00:00.000Z";
    for (let i = 0; i < 6; i += 1) {
      await publishRecipe(client, `Receita ${i}`, instante);
      await publishCook(user.id, { createdAt: instante, mission: `mission.omelete` });
    }

    const deUmaVez = await client.get("/api/feed?limit=50");
    assert.equal(deUmaVez.data.items.length, 12);

    const paginado = [];
    let cursor = null;
    for (let page = 0; page < 20; page += 1) {
      const url = `/api/feed?limit=3${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const response = await client.get(url);
      paginado.push(...response.data.items.map((item) => item.key));
      cursor = response.data.nextCursor;
      if (!cursor) break;
    }

    assert.equal(paginado.length, 12);
    assert.equal(new Set(paginado).size, 12);
    assert.deepEqual(
      paginado,
      deUmaVez.data.items.map((item) => item.key),
    );
  });

  test("um cursor forjado devolve a primeira página em vez de partir o feed", async () => {
    await publishRecipe(client, "Bolo");

    const response = await client.get("/api/feed?cursor=isto-nao-descodifica");
    assert.equal(response.status, 200);
    assert.equal(response.data.items.length, 1);
  });

  test("«a seguir» mostra o próprio e quem se segue, e mais ninguém", async () => {
    const outra = createClient(origin);
    const outroUser = await outra.register("desconhecida");
    await publishRecipe(outra, "Receita alheia");
    await publishRecipe(client, "Receita própria");

    const antes = await client.get("/api/feed?scope=following&limit=50");
    assert.deepEqual(
      antes.data.items.map((i) => i.author.username),
      ["feedista"],
    );

    await client.post(`/api/users/${outroUser.id}/follow`);

    const depois = await client.get("/api/feed?scope=following&limit=50");
    assert.equal(depois.data.items.length, 2);
  });
});

describe("gostos e comentários num cozinhado", { skip: skipWithoutDatabase }, () => {
  let client;
  let postId;

  beforeEach(async () => {
    await resetDatabase();
    client = createClient(origin);
    const user = await client.register("social");
    postId = await publishCook(user.id, { createdAt: new Date().toISOString() });
  });

  test("gostar é idempotente e deixar de gostar não vai a negativo", async () => {
    const primeiro = await client.post(`/api/feed/cooks/${postId}/like`);
    assert.equal(primeiro.data.item.likesCount, 1);

    const repetido = await client.post(`/api/feed/cooks/${postId}/like`);
    assert.equal(repetido.data.item.likesCount, 1);

    await client.del(`/api/feed/cooks/${postId}/like`);
    const outra = await client.del(`/api/feed/cooks/${postId}/like`);
    assert.equal(outra.data.item.likesCount, 0);
    assert.equal(outra.data.item.likedByMe, false);
  });

  test("comentar mexe na contagem que o cartão mostra", async () => {
    await client.post(`/api/feed/cooks/${postId}/comments`, { body: "que bom aspecto" });

    const feed = await client.get("/api/feed?limit=50");
    assert.equal(feed.data.items[0].commentsCount, 1);
  });

  test("um cozinhado que não existe dá 404 e um id que não é número dá 400", async () => {
    assert.equal((await client.post(`/api/feed/cooks/999999/like`)).status, 404);
    assert.equal((await client.post(`/api/feed/cooks/abc/like`)).status, 400);
  });

  test("não se apaga o comentário de outra pessoa", async () => {
    const comentario = await client.post(`/api/feed/cooks/${postId}/comments`, { body: "meu" });

    const intruso = createClient(origin);
    await intruso.register("apagador");
    const response = await intruso.del(
      `/api/feed/cooks/${postId}/comments/${comentario.data.comment.id}`,
    );

    assert.equal(response.status, 404);
    const rows = await query(`SELECT 1 FROM post_comments WHERE post_id = $1`, [postId]);
    assert.equal(rows.rowCount, 1);
  });
});
