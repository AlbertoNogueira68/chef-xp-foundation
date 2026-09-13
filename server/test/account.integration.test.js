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

describe("a minha conta", skipWithoutDatabase, () => {
  let server;
  let eu;
  let outro;

  before(async () => {
    server = await startTestServer();
    eu = server.client;
    outro = createClient(server.baseUrl);
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  test("a exportação traz os dados todos, livro-razão incluído", async () => {
    const cliente = createClient(server.baseUrl);
    const user = await registerUser(cliente, { username: "exportador" });
    const { recipe } = await publishRecipe(cliente, { title: "Para exportar" });

    const vizinho = createClient(server.baseUrl);
    await registerUser(vizinho);
    await vizinho.post(`/api/users/${user.id}/follow`);
    await cliente.post(`/api/recipes/${recipe.id}/comments`, { body: "um comentário meu" });

    const resposta = await cliente.get("/api/users/me/export");

    assert.equal(resposta.status, 200);
    assert.match(resposta.headers.get("content-disposition"), /attachment; filename=/);

    const dados = resposta.body;
    assert.equal(dados.perfil.username, "exportador");
    assert.equal(dados.receitas.length, 1);
    assert.equal(dados.comentarios.length, 1);
    assert.equal(dados.seguidores.length, 1);
    assert.ok(dados.livroRazaoXp.some((evento) => evento.source === "recipe"));
    assert.ok(dados.atividadeDiaria.length > 0);
  });

  test("a exportação não inclui a password", async () => {
    const dados = (await eu.get("/api/users/me/export")).body;
    assert.ok(!JSON.stringify(dados).includes("password"), "a hash não pode sair daqui");
  });

  test("apagar exige o nome de utilizador escrito", async () => {
    const cliente = createClient(server.baseUrl);
    const user = await registerUser(cliente);

    const errado = await cliente.delete("/api/users/me", {
      confirmUsername: "outra-coisa",
      password: user.password,
    });
    assert.equal(errado.status, 400);

    // A conta continua lá.
    assert.equal((await cliente.get("/api/users/me")).status, 200);
  });

  test("apagar exige a password, quando a conta tem uma", async () => {
    const cliente = createClient(server.baseUrl);
    const user = await registerUser(cliente);

    const semPassword = await cliente.delete("/api/users/me", { confirmUsername: user.username });
    // 403 e não 401: a sessão é boa, o que falta é a confirmação. Um 401 aqui
    // fazia o cliente achar que a sessão tinha caído e expulsava para o login
    // quem só se enganou na password.
    assert.equal(semPassword.status, 403);
    assert.equal((await cliente.get("/api/users/me")).status, 200, "a sessão tem de sobreviver");

    const errada = await cliente.delete("/api/users/me", {
      confirmUsername: user.username,
      password: "nao-e-esta",
    });
    assert.equal(errada.status, 403);
  });

  test("apagar leva tudo atrás e termina a sessão", async () => {
    const cliente = createClient(server.baseUrl);
    const user = await registerUser(cliente, { username: "vaisair" });
    const { recipe } = await publishRecipe(cliente, { title: "Também desaparece" });

    const vizinho = createClient(server.baseUrl);
    const vizinhoUser = await registerUser(vizinho);
    await vizinho.post(`/api/recipes/${recipe.id}/like`);
    await cliente.post(`/api/users/${vizinhoUser.id}/follow`);

    const resposta = await cliente.delete("/api/users/me", {
      confirmUsername: "vaisair",
      password: user.password,
    });
    assert.equal(resposta.status, 204);

    const { rows } = await query(
      `SELECT
         (SELECT count(*)::int FROM users          WHERE id = $1)        AS utilizador,
         (SELECT count(*)::int FROM recipes        WHERE author_id = $1) AS receitas,
         (SELECT count(*)::int FROM xp_events      WHERE user_id = $1)   AS xp,
         (SELECT count(*)::int FROM follows        WHERE follower_id = $1) AS segue,
         (SELECT count(*)::int FROM notifications  WHERE actor_id = $1)  AS notificou`,
      [user.id],
    );
    assert.deepEqual(rows[0], { utilizador: 0, receitas: 0, xp: 0, segue: 0, notificou: 0 });

    // O cookie foi limpo: a sessão morreu com a conta.
    assert.equal((await cliente.get("/api/users/me")).status, 401);
  });

  test("ninguém apaga a conta de outra pessoa", async () => {
    const vitima = createClient(server.baseUrl);
    const user = await registerUser(vitima, { username: "sobrevivente" });

    // `DELETE /me` é sempre sobre quem está autenticado: o atacante só se
    // apaga a si próprio, e nem isso sem o nome dele.
    const atacante = createClient(server.baseUrl);
    await registerUser(atacante);

    const resposta = await atacante.delete("/api/users/me", {
      confirmUsername: "sobrevivente",
      password: user.password,
    });

    assert.equal(resposta.status, 400);
    assert.equal((await vitima.get("/api/users/me")).status, 200);
  });

  test("sem sessão não se exporta nem se apaga", async () => {
    const anonimo = createClient(server.baseUrl);
    assert.equal((await anonimo.get("/api/users/me/export")).status, 401);
  });
});

describe("listas de seguidores", skipWithoutDatabase, () => {
  let server;
  let eu;
  let euUser;
  let fa;
  let faUser;

  before(async () => {
    server = await startTestServer();
    eu = server.client;
    euUser = await registerUser(eu, { username: "seguido" });

    fa = createClient(server.baseUrl);
    faUser = await registerUser(fa, { username: "seguidor" });

    await fa.post(`/api/users/${euUser.id}/follow`);
    await eu.post(`/api/users/${faUser.id}/follow`);
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  test("quem me segue", async () => {
    const resposta = await eu.get(`/api/users/${euUser.id}/followers`);

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.users.length, 1);
    assert.equal(resposta.body.users[0].username, "seguidor");
    assert.equal(resposta.body.users[0].isFollowing, true, "eu também o sigo de volta");
  });

  test("quem eu sigo", async () => {
    const resposta = await eu.get(`/api/users/${euUser.id}/following`);
    assert.equal(resposta.body.users.length, 1);
    assert.equal(resposta.body.users[0].username, "seguidor");
  });

  test("a lista de outra pessoa mostra o meu estado, não o dela", async () => {
    const terceiro = createClient(server.baseUrl);
    await registerUser(terceiro, { username: "estranho" });

    const resposta = await terceiro.get(`/api/users/${euUser.id}/followers`);
    assert.equal(resposta.body.users[0].username, "seguidor");
    assert.equal(resposta.body.users[0].isFollowing, false, "o estranho não segue ninguém");
  });

  test("eu próprio apareço marcado, e sem botão de me seguir", async () => {
    const resposta = await fa.get(`/api/users/${faUser.id}/followers`);
    const eu_ = resposta.body.users.find((u) => u.username === "seguido");
    assert.ok(eu_);

    const minha = await eu.get(`/api/users/${faUser.id}/followers`);
    const euNaLista = minha.body.users.find((u) => u.isMe);
    assert.ok(euNaLista, "devia marcar-me a mim próprio");
    assert.equal(euNaLista.isFollowing, false);
  });

  test("as listas exigem um id válido", async () => {
    assert.equal((await eu.get("/api/users/nao-e-uuid/followers")).status, 400);
  });
});
