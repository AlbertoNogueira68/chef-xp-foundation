import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import {
  closeDatabase,
  createClient,
  publishRecipe,
  registerUser,
  skipWithoutDatabase,
  startTestServer,
} from "./helpers.js";

describe("notificações", skipWithoutDatabase, () => {
  let server;
  let autor;
  let visita;
  let visitaUser;

  before(async () => {
    server = await startTestServer();
    autor = server.client;
    await registerUser(autor);

    visita = createClient(server.baseUrl);
    visitaUser = await registerUser(visita, { username: "quempassa" });
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  const caixa = async (client) => (await client.get("/api/notifications")).body;

  test("um gosto notifica o autor da receita", async () => {
    const { recipe } = await publishRecipe(autor, { title: "Bolo de cenoura" });
    await visita.post(`/api/recipes/${recipe.id}/like`);

    const { notifications, unread } = await caixa(autor);

    assert.equal(unread, 1);
    assert.equal(notifications[0].kind, "like");
    assert.equal(notifications[0].read, false);
    assert.equal(notifications[0].actor.username, visitaUser.username);
    assert.equal(notifications[0].recipe.title, "Bolo de cenoura");
  });

  test("gostar, desgostar e voltar a gostar é uma notificação, não três", async () => {
    const { recipe } = await publishRecipe(autor, { title: "Pudim" });

    for (let i = 0; i < 3; i += 1) {
      await visita.post(`/api/recipes/${recipe.id}/like`);
      await visita.delete(`/api/recipes/${recipe.id}/like`);
    }
    await visita.post(`/api/recipes/${recipe.id}/like`);

    const { notifications } = await caixa(autor);
    const doPudim = notifications.filter((n) => n.recipe?.title === "Pudim");
    assert.equal(doPudim.length, 1);
  });

  test("cada comentário é uma notificação, e traz o texto", async () => {
    const { recipe } = await publishRecipe(autor, { title: "Tarte de maçã" });

    await visita.post(`/api/recipes/${recipe.id}/comments`, { body: "isto tem bom ar" });
    await visita.post(`/api/recipes/${recipe.id}/comments`, { body: "já fiz, resultou" });

    const { notifications } = await caixa(autor);
    const comentarios = notifications.filter(
      (n) => n.kind === "comment" && n.recipe?.title === "Tarte de maçã",
    );

    assert.equal(comentarios.length, 2);
    assert.equal(comentarios[0].commentBody, "já fiz, resultou");
  });

  test("seguir notifica uma vez, mesmo que se siga e deixe de seguir", async () => {
    const eu = (await autor.get("/api/users/me")).body.user;

    await visita.post(`/api/users/${eu.id}/follow`);
    await visita.delete(`/api/users/${eu.id}/follow`);
    await visita.post(`/api/users/${eu.id}/follow`);

    const { notifications } = await caixa(autor);
    assert.equal(notifications.filter((n) => n.kind === "follow").length, 1);
  });

  test("gostar da própria receita não notifica ninguém", async () => {
    const { recipe } = await publishRecipe(autor, { title: "Sozinho" });
    const antes = (await caixa(autor)).notifications.length;

    await autor.post(`/api/recipes/${recipe.id}/like`);
    await autor.post(`/api/recipes/${recipe.id}/comments`, { body: "comento-me a mim próprio" });

    assert.equal((await caixa(autor)).notifications.length, antes);
  });

  test("a caixa de cada um só tem o que é seu", async () => {
    const dele = await caixa(visita);
    assert.equal(dele.notifications.length, 0);
    assert.equal(dele.unread, 0);
  });

  test("marcar tudo como lido zera a contagem", async () => {
    const antes = await caixa(autor);
    assert.ok(antes.unread > 0);

    const resposta = await autor.post("/api/notifications/read");
    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.unread, 0);

    const depois = await caixa(autor);
    assert.equal(depois.unread, 0);
    assert.ok(depois.notifications.every((n) => n.read));
  });

  test("marcar uma só", async () => {
    const { recipe } = await publishRecipe(autor, { title: "Mais uma" });
    await visita.post(`/api/recipes/${recipe.id}/comments`, { body: "boa" });

    const { notifications } = await caixa(autor);
    const nova = notifications.find((n) => !n.read);

    assert.equal((await autor.post(`/api/notifications/${nova.id}/read`)).status, 204);
    assert.equal((await caixa(autor)).unread, 0);
  });

  test("não se marca como lida a notificação de outra pessoa", async () => {
    const { recipe } = await publishRecipe(autor, { title: "Privada" });
    await visita.post(`/api/recipes/${recipe.id}/comments`, { body: "olá" });

    const { notifications } = await caixa(autor);
    const minha = notifications.find((n) => !n.read);

    assert.equal((await visita.post(`/api/notifications/${minha.id}/read`)).status, 404);
    assert.equal((await caixa(autor)).unread, 1, "continua por ler para quem é dela");
  });

  test("só o que está por ler, quando se pede", async () => {
    const resposta = await autor.get("/api/notifications?unreadOnly=true");
    assert.equal(resposta.status, 200);
    assert.ok(resposta.body.notifications.every((n) => !n.read));
  });

  test("apagar a receita leva as notificações dela", async () => {
    const { recipe } = await publishRecipe(autor, { title: "Vai-se embora" });
    await visita.post(`/api/recipes/${recipe.id}/like`);
    await visita.post(`/api/recipes/${recipe.id}/comments`, { body: "pena" });

    assert.ok((await caixa(autor)).notifications.some((n) => n.recipe?.title === "Vai-se embora"));

    await autor.delete(`/api/recipes/${recipe.id}`);

    const depois = await caixa(autor);
    assert.ok(!depois.notifications.some((n) => n.recipe?.title === "Vai-se embora"));
  });

  test("a contagem tem rota própria, para o sino não puxar a lista toda", async () => {
    const resposta = await autor.get("/api/notifications/unread-count");
    assert.equal(resposta.status, 200);
    assert.equal(typeof resposta.body.unread, "number");
    assert.ok(!("notifications" in resposta.body));
  });

  test("sem sessão não há caixa", async () => {
    const anonimo = createClient(server.baseUrl);
    assert.equal((await anonimo.get("/api/notifications")).status, 401);
  });
});
