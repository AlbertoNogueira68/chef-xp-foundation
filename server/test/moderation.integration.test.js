import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { query } from "../db/index.js";
import {
  closeDatabase,
  createClient,
  publishRecipe,
  registerUser,
  resetDatabase,
  skipWithoutDatabase,
  startTestServer,
} from "./helpers.js";

/**
 * Moderação: bloquear, denunciar, e alguém do outro lado.
 *
 * Três sessões separadas, como no resto da bateria — provar que uma regra é do
 * servidor exige que quem a tenta furar seja mesmo outro browser, e não a
 * mesma sessão com outro payload.
 */
describe("moderação", skipWithoutDatabase, () => {
  let server;
  let ana;
  let bruno;
  let carla;
  let anaId;
  let brunoId;

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();

    ana = createClient(server.baseUrl);
    bruno = createClient(server.baseUrl);
    carla = createClient(server.baseUrl);

    anaId = (await registerUser(ana)).id;
    brunoId = (await registerUser(bruno)).id;
    await registerUser(carla);
  });

  /* -------------------------------------------------------------- *
   * Apagar comentários
   * -------------------------------------------------------------- */

  test("o dono da receita apaga um comentário de outra pessoa na sua receita", async () => {
    const { recipe } = await publishRecipe(ana, { title: "Bacalhau" });
    const comentario = await bruno.post(`/api/recipes/${recipe.id}/comments`, { body: "lixo" });

    const apagar = await ana.delete(
      `/api/recipes/${recipe.id}/comments/${comentario.body.comment.id}`,
    );
    assert.equal(apagar.status, 204);

    const restantes = await ana.get(`/api/recipes/${recipe.id}/comments`);
    assert.equal(restantes.body.comments.length, 0);
  });

  test("o autor continua a poder apagar o que escreveu", async () => {
    const { recipe } = await publishRecipe(ana);
    const comentario = await bruno.post(`/api/recipes/${recipe.id}/comments`, { body: "enganei-me" });

    const apagar = await bruno.delete(
      `/api/recipes/${recipe.id}/comments/${comentario.body.comment.id}`,
    );
    assert.equal(apagar.status, 204);
  });

  test("um comentário que não existe é 404, e um sem direito é 403", async () => {
    const { recipe } = await publishRecipe(ana);
    const comentario = await bruno.post(`/api/recipes/${recipe.id}/comments`, { body: "olá" });

    const inexistente = await ana.delete(
      `/api/recipes/${recipe.id}/comments/00000000-0000-0000-0000-000000000000`,
    );
    assert.equal(inexistente.status, 404);

    const semDireito = await carla.delete(
      `/api/recipes/${recipe.id}/comments/${comentario.body.comment.id}`,
    );
    assert.equal(semDireito.status, 403);
  });

  test("um identificador malformado no URL dá 400 e não um erro de Postgres", async () => {
    const { recipe } = await publishRecipe(ana);
    const resposta = await ana.delete(`/api/recipes/${recipe.id}/comments/isto-nao-e-uuid`);
    assert.equal(resposta.status, 400);
  });

  /* -------------------------------------------------------------- *
   * Bloquear
   * -------------------------------------------------------------- */

  test("bloquear tira a pessoa do feed, da pesquisa e da página dela", async () => {
    const { recipe } = await publishRecipe(bruno, { title: "Polvo do Bruno" });

    const antes = await ana.get("/api/recipes");
    assert.equal(antes.body.recipes.length, 1);

    assert.equal((await ana.post(`/api/users/${brunoId}/block`)).status, 200);

    assert.equal((await ana.get("/api/recipes")).body.recipes.length, 0);
    assert.equal((await ana.get("/api/recipes?q=Polvo")).body.recipes.length, 0);
    assert.equal((await ana.get(`/api/recipes?authorId=${brunoId}`)).body.recipes.length, 0);
    assert.equal((await ana.get(`/api/recipes/${recipe.id}`)).status, 404);
  });

  test("o bloqueio vale nos dois sentidos — quem bloqueia também deixa de ser visto", async () => {
    const { recipe } = await publishRecipe(ana, { title: "Migas da Ana" });
    await ana.post(`/api/users/${brunoId}/block`);

    assert.equal((await bruno.get("/api/recipes")).body.recipes.length, 0);
    assert.equal((await bruno.get(`/api/recipes/${recipe.id}`)).status, 404);
  });

  test("um terceiro não é afetado pelo bloqueio de outros", async () => {
    await publishRecipe(bruno);
    await ana.post(`/api/users/${brunoId}/block`);

    assert.equal((await carla.get("/api/recipes")).body.recipes.length, 1);
  });

  test("os comentários de quem está bloqueado desaparecem da receita", async () => {
    const { recipe } = await publishRecipe(carla);
    await bruno.post(`/api/recipes/${recipe.id}/comments`, { body: "do bruno" });
    await carla.post(`/api/recipes/${recipe.id}/comments`, { body: "da carla" });

    assert.equal((await ana.get(`/api/recipes/${recipe.id}/comments`)).body.comments.length, 2);

    await ana.post(`/api/users/${brunoId}/block`);

    const depois = await ana.get(`/api/recipes/${recipe.id}/comments`);
    assert.equal(depois.body.comments.length, 1);
    assert.equal(depois.body.comments[0].body, "da carla");
  });

  test("bloquear desfaz os dois sentidos do seguir e limpa o sino", async () => {
    await ana.post(`/api/users/${brunoId}/follow`);
    await bruno.post(`/api/users/${anaId}/follow`);

    const { rows: antes } = await query(
      `SELECT count(*)::int AS n FROM notifications WHERE user_id = $1`,
      [anaId],
    );
    assert.equal(antes[0].n, 1, "o seguir do Bruno tinha de ter notificado a Ana");

    await ana.post(`/api/users/${brunoId}/block`);

    const { rows: depois } = await query(
      `SELECT
         (SELECT count(*)::int FROM follows
           WHERE (follower_id = $1 AND followee_id = $2)
              OR (follower_id = $2 AND followee_id = $1)) AS seguir,
         (SELECT count(*)::int FROM notifications
           WHERE (user_id = $1 AND actor_id = $2)
              OR (user_id = $2 AND actor_id = $1)) AS sino`,
      [anaId, brunoId],
    );
    assert.deepEqual(depois[0], { seguir: 0, sino: 0 });
  });

  test("não se segue nem se notifica através de um bloqueio", async () => {
    const { recipe } = await publishRecipe(ana);
    await ana.post(`/api/users/${brunoId}/block`);

    assert.equal((await bruno.post(`/api/users/${anaId}/follow`)).status, 403);
    assert.equal((await ana.post(`/api/users/${brunoId}/follow`)).status, 403);

    // O gosto do Bruno nem chega a acontecer: a receita não existe para ele.
    assert.equal((await bruno.post(`/api/recipes/${recipe.id}/like`)).status, 404);
    assert.equal((await bruno.post(`/api/recipes/${recipe.id}/comments`, { body: "oi" })).status, 404);

    const { rows } = await query(`SELECT count(*)::int AS n FROM notifications`);
    assert.equal(rows[0].n, 0);
  });

  test("quem está bloqueado não aparece nas sugestões", async () => {
    assert.ok(
      (await ana.get("/api/users/suggestions")).body.users.some((u) => u.id === brunoId),
      "o Bruno tinha de estar nas sugestões antes do bloqueio",
    );

    await ana.post(`/api/users/${brunoId}/block`);

    assert.equal(
      (await ana.get("/api/users/suggestions")).body.users.some((u) => u.id === brunoId),
      false,
    );
  });

  test("a lista de bloqueados é o caminho de volta, e desbloquear repõe tudo", async () => {
    await publishRecipe(bruno);
    await ana.post(`/api/users/${brunoId}/block`);

    const lista = await ana.get("/api/users/me/blocks");
    assert.equal(lista.body.users.length, 1);
    assert.equal(lista.body.users[0].id, brunoId);

    // Só o meu lado: o Bruno não sabe que foi bloqueado.
    assert.equal((await bruno.get("/api/users/me/blocks")).body.users.length, 0);
    assert.equal((await bruno.get(`/api/users/${anaId}/stats`)).body.stats.isBlocked, false);
    assert.equal((await ana.get(`/api/users/${brunoId}/stats`)).body.stats.isBlocked, true);

    assert.equal((await ana.delete(`/api/users/${brunoId}/block`)).status, 200);
    assert.equal((await ana.get("/api/recipes")).body.recipes.length, 1);
  });

  test("bloquear é idempotente e não me posso bloquear a mim próprio", async () => {
    assert.equal((await ana.post(`/api/users/${brunoId}/block`)).status, 200);
    assert.equal((await ana.post(`/api/users/${brunoId}/block`)).status, 200);
    assert.equal((await ana.get("/api/users/me/blocks")).body.users.length, 1);

    assert.equal((await ana.post(`/api/users/${anaId}/block`)).status, 400);
  });

  /* -------------------------------------------------------------- *
   * Denunciar
   * -------------------------------------------------------------- */

  test("denunciar guarda uma linha, e denunciar outra vez não guarda outra", async () => {
    const { recipe } = await publishRecipe(bruno);

    const primeira = await ana.post("/api/reports", {
      subjectType: "recipe",
      subjectId: recipe.id,
      reason: "perigoso",
      details: "crua por dentro",
    });
    assert.equal(primeira.status, 201);

    const segunda = await ana.post("/api/reports", {
      subjectType: "recipe",
      subjectId: recipe.id,
      reason: "spam",
    });
    assert.equal(segunda.status, 201, "a resposta é a mesma — não se diz quem já denunciou");

    const { rows } = await query(`SELECT reason, details FROM reports`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].reason, "perigoso", "vale a primeira, não a última");
  });

  test("não se denuncia o que é meu, nem o que não existe, nem com um motivo inventado", async () => {
    const { recipe } = await publishRecipe(ana);

    const meu = await ana.post("/api/reports", {
      subjectType: "recipe",
      subjectId: recipe.id,
      reason: "spam",
    });
    assert.equal(meu.status, 400);

    const fantasma = await ana.post("/api/reports", {
      subjectType: "recipe",
      subjectId: "00000000-0000-0000-0000-000000000000",
      reason: "spam",
    });
    assert.equal(fantasma.status, 404);

    const motivo = await ana.post("/api/reports", {
      subjectType: "recipe",
      subjectId: recipe.id,
      reason: "porque sim",
    });
    assert.equal(motivo.status, 400);

    assert.equal((await query(`SELECT count(*)::int AS n FROM reports`)).rows[0].n, 0);
  });

  test("denunciar uma pessoa e um comentário usa a mesma rota", async () => {
    const { recipe } = await publishRecipe(carla);
    const comentario = await bruno.post(`/api/recipes/${recipe.id}/comments`, { body: "insulto" });

    assert.equal(
      (
        await ana.post("/api/reports", {
          subjectType: "comment",
          subjectId: comentario.body.comment.id,
          reason: "ofensivo",
        })
      ).status,
      201,
    );

    assert.equal(
      (await ana.post("/api/reports", { subjectType: "user", subjectId: brunoId, reason: "spam" }))
        .status,
      201,
    );

    assert.equal((await query(`SELECT count(*)::int AS n FROM reports`)).rows[0].n, 2);
  });

  /* -------------------------------------------------------------- *
   * A fila
   * -------------------------------------------------------------- */

  async function tornarModerador(userId) {
    await query(`UPDATE users SET role = 'moderator' WHERE id = $1`, [userId]);
  }

  test("a fila é fechada a quem não é moderador", async () => {
    assert.equal((await ana.get("/api/moderation/reports")).status, 403);
    assert.equal((await ana.post("/api/moderation/reports/1/resolve", { action: "arquivar" })).status, 403);
  });

  test("o moderador vê a denúncia com o conteúdo ao lado", async () => {
    const { recipe } = await publishRecipe(bruno, { title: "Frango cru" });
    await ana.post("/api/reports", {
      subjectType: "recipe",
      subjectId: recipe.id,
      reason: "perigoso",
    });
    await carla.post("/api/reports", {
      subjectType: "recipe",
      subjectId: recipe.id,
      reason: "perigoso",
    });

    await tornarModerador(anaId);

    const fila = await ana.get("/api/moderation/reports");
    assert.equal(fila.status, 200);
    assert.equal(fila.body.open, 2);
    assert.equal(fila.body.reports[0].subject.title, "Frango cru");
    assert.equal(fila.body.reports[0].reportsOnSubject, 2);
  });

  test("remover uma receita pela fila apaga-a e retira-lhe o XP", async () => {
    const { recipe } = await publishRecipe(bruno);
    const xpAntes = (await bruno.get("/api/users/me")).body.user.xp;

    await ana.post("/api/reports", {
      subjectType: "recipe",
      subjectId: recipe.id,
      reason: "copia",
    });
    await carla.post("/api/reports", {
      subjectType: "recipe",
      subjectId: recipe.id,
      reason: "copia",
    });

    await tornarModerador(anaId);
    const fila = await ana.get("/api/moderation/reports");
    const id = fila.body.reports[0].id;

    const resolver = await ana.post(`/api/moderation/reports/${id}/resolve`, { action: "remover" });
    assert.equal(resolver.status, 200);
    assert.equal(resolver.body.resolved, 2, "as duas denúncias do mesmo alvo fecham juntas");

    assert.equal((await bruno.get(`/api/recipes/${recipe.id}`)).status, 404);
    assert.equal((await bruno.get("/api/users/me")).body.user.xp, xpAntes - 25);

    const { rows } = await query(`SELECT status, resolution FROM reports`);
    assert.deepEqual(
      rows.map((r) => `${r.status}/${r.resolution}`),
      ["resolved/removido", "resolved/removido"],
    );
  });

  test("arquivar fecha a denúncia sem tocar no conteúdo", async () => {
    const { recipe } = await publishRecipe(bruno);
    await ana.post("/api/reports", {
      subjectType: "recipe",
      subjectId: recipe.id,
      reason: "spam",
    });

    await tornarModerador(anaId);
    const id = (await ana.get("/api/moderation/reports")).body.reports[0].id;

    assert.equal(
      (await ana.post(`/api/moderation/reports/${id}/resolve`, { action: "arquivar" })).status,
      200,
    );
    assert.equal((await bruno.get(`/api/recipes/${recipe.id}`)).status, 200);

    // Tratada é tratada: voltar a fechá-la é 409, não uma segunda decisão.
    assert.equal(
      (await ana.post(`/api/moderation/reports/${id}/resolve`, { action: "arquivar" })).status,
      409,
    );
    assert.equal((await ana.get("/api/moderation/reports")).body.open, 0);
  });

  test("a denúncia sobrevive ao conteúdo que a originou", async () => {
    const { recipe } = await publishRecipe(bruno);
    await ana.post("/api/reports", {
      subjectType: "recipe",
      subjectId: recipe.id,
      reason: "ofensivo",
    });

    await bruno.delete(`/api/recipes/${recipe.id}`);
    await tornarModerador(anaId);

    const fila = await ana.get("/api/moderation/reports");
    assert.equal(fila.body.reports.length, 1);
    assert.equal(fila.body.reports[0].subject, null, "o conteúdo já não existe, a denúncia sim");
  });

  test("uma conta não se apaga pela fila", async () => {
    await ana.post("/api/reports", { subjectType: "user", subjectId: brunoId, reason: "spam" });
    await tornarModerador(anaId);

    const id = (await ana.get("/api/moderation/reports")).body.reports[0].id;
    const resposta = await ana.post(`/api/moderation/reports/${id}/resolve`, { action: "remover" });

    assert.equal(resposta.status, 400);
    assert.equal((await query(`SELECT count(*)::int AS n FROM users WHERE id = $1`, [brunoId])).rows[0].n, 1);
  });

  test("os bloqueios e as denúncias que fiz saem na exportação dos meus dados", async () => {
    const { recipe } = await publishRecipe(bruno);
    await ana.post(`/api/users/${brunoId}/block`);
    await ana.post("/api/reports", {
      subjectType: "recipe",
      subjectId: recipe.id,
      reason: "spam",
    });

    const dados = (await ana.get("/api/users/me/export")).body;
    assert.equal(dados.bloqueados.length, 1);
    assert.equal(dados.denunciasQueFiz.length, 1);
    assert.equal(dados.denunciasQueFiz[0].reason, "spam");
  });
});
