import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { closeDatabase, registerUser, skipWithoutDatabase, startTestServer } from "./helpers.js";

describe("autenticação e CSRF", skipWithoutDatabase, () => {
  let server;
  let client;

  before(async () => {
    server = await startTestServer();
    client = server.client;
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  test("registar cria sessão e devolve o utilizador sem password", async () => {
    const response = await client.post("/api/auth/register", {
      email: "novo@chef-xp.test",
      password: "chef12345",
      username: "chefnovo",
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.user.username, "chefnovo");
    assert.equal(response.body.user.level, 1);
    assert.ok(!("password" in response.body.user));
    assert.ok(!("passwordHash" in response.body.user));
  });

  test("o cookie de sessão é HttpOnly e não é legível por script", async () => {
    const response = await client.post("/api/auth/login", {
      email: "novo@chef-xp.test",
      password: "chef12345",
    });

    assert.equal(response.status, 200);
    const setCookie = response.headers.getSetCookie();
    const session = setCookie.find((value) => value.includes("token="));
    assert.ok(session, "não veio cookie de sessão");
    assert.match(session, /HttpOnly/i);
    assert.match(session, /SameSite/i);
  });

  test("o cookie de CSRF é legível — é essa a metade do double-submit", async () => {
    const response = await client.get("/api/auth/csrf");
    const csrf = response.headers.getSetCookie().find((value) => value.startsWith("csrf="));
    assert.ok(csrf);
    assert.doesNotMatch(csrf, /HttpOnly/i);
  });

  test("password errada não diz qual dos dois campos falhou", async () => {
    const response = await client.post("/api/auth/login", {
      email: "novo@chef-xp.test",
      password: "erradissima",
    });

    assert.equal(response.status, 401);
    assert.doesNotMatch(JSON.stringify(response.body), /password|email/i);
  });

  test("email inexistente responde como password errada", async () => {
    const inexistente = await client.post("/api/auth/login", {
      email: "ninguem@chef-xp.test",
      password: "chef12345",
    });
    assert.equal(inexistente.status, 401);
  });

  test("email duplicado é recusado", async () => {
    const response = await client.post("/api/auth/register", {
      email: "novo@chef-xp.test",
      password: "outrapass1",
      username: "outronome",
    });
    assert.equal(response.status, 409);
  });

  test("password curta é recusada pela validação", async () => {
    const response = await client.post("/api/auth/register", {
      email: "curta@chef-xp.test",
      password: "123",
      username: "chefcurto",
    });
    assert.equal(response.status, 400);
    assert.ok(response.body.details.some((detail) => detail.field === "password"));
  });

  test("um pedido de escrita sem cabeçalho de CSRF é recusado", async () => {
    await registerUser(client);
    const response = await client.post(
      "/api/recipes",
      {
        title: "Sem CSRF",
        description: "Isto não devia passar de maneira nenhuma.",
        ingredients: "nada",
        cookTimeMin: 10,
        difficulty: "facil",
      },
      { omitCsrf: true },
    );

    assert.equal(response.status, 403);
  });

  test("um cabeçalho de CSRF que não bate com o cookie é recusado", async () => {
    const response = await client.post(
      "/api/recipes",
      { title: "Token trocado", description: "Não passa.", ingredients: "x", cookTimeMin: 10 },
      { omitCsrf: true, headers: { "X-CSRF-Token": "inventado" } },
    );
    assert.equal(response.status, 403);
  });

  test("o login não exige CSRF — e isso é deliberado", async () => {
    // Sem cookie de sessão não há autoridade ambiente para roubar, e o
    // registo tem de poder acontecer antes de existir token nenhum. O teste
    // está aqui para a decisão não se perder e ninguém a "corrigir" sem saber.
    client.forget();
    const resposta = await client.post(
      "/api/auth/login",
      { email: "novo@chef-xp.test", password: "chef12345" },
      { omitCsrf: true },
    );
    assert.equal(resposta.status, 200);
  });

  test("sem sessão, as rotas protegidas respondem 401", async () => {
    client.forget();
    for (const path of ["/api/users/me", "/api/recipes", "/api/challenges", "/api/learning/path"]) {
      const response = await client.get(path);
      assert.equal(response.status, 401, `${path} devia exigir sessão`);
    }
  });

  test("terminar sessão apaga o cookie", async () => {
    await registerUser(client);
    assert.equal((await client.get("/api/users/me")).status, 200);

    await client.post("/api/auth/logout");
    const depois = await client.get("/api/users/me");
    assert.equal(depois.status, 401);
  });
});
