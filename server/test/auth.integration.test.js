import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import {
  closeDatabase,
  lastEmail,
  registerUser,
  signupThroughEmail,
  skipWithoutDatabase,
  startTestServer,
} from "./helpers.js";

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

  test("criar conta pelo link do email dá sessão e utilizador sem password", async () => {
    const response = await signupThroughEmail(client, {
      email: "novo@chef-xp.test",
      username: "chefnovo",
      password: "Chef12345!",
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
      password: "Chef12345!",
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
      password: "Chef12345!",
    });
    assert.equal(inexistente.status, 401);
  });

  test("um email já registado não recebe link — e a resposta é a mesma", async () => {
    // A resposta não pode distinguir os dois casos: se um email em uso desse
    // erro, o formulário de registo era um verificador de quem tem conta.
    const resposta = await client.post("/api/auth/signup", { email: "novo@chef-xp.test" });
    assert.equal(resposta.status, 200);
    assert.deepEqual(resposta.body, { ok: true });

    // O que muda é o email que sai: um aviso, sem link de criação de conta.
    const email = lastEmail();
    assert.match(email.subject, /already have/i);
    assert.match(email.link, /\/forgot-password$/);
  });

  test("um nome de utilizador tomado devolve 409 e não gasta o link", async () => {
    const pedido = await client.post("/api/auth/signup", { email: "renovo@chef-xp.test" });
    assert.equal(pedido.status, 200);
    const { token } = lastEmail();

    const tomado = await client.post("/api/auth/signup/complete", {
      token,
      username: "chefnovo",
      password: "Chef12345!",
    });
    assert.equal(tomado.status, 409);

    // O mesmo link outra vez, com outro nome: quem se enganou no nome não
    // tem de voltar à caixa de correio.
    const segunda = await client.post("/api/auth/signup/complete", {
      token,
      username: "chefrenovo",
      password: "Chef12345!",
    });
    assert.equal(segunda.status, 201);
  });

  test("o link só serve uma vez", async () => {
    const pedido = await client.post("/api/auth/signup", { email: "umavez@chef-xp.test" });
    assert.equal(pedido.status, 200);
    const { token } = lastEmail();

    const primeira = await client.post("/api/auth/signup/complete", {
      token,
      username: "chefumavez",
      password: "Chef12345!",
    });
    assert.equal(primeira.status, 201);

    const segunda = await client.post("/api/auth/signup/complete", {
      token,
      username: "chefoutravez",
      password: "Chef12345!",
    });
    assert.equal(segunda.status, 400);
  });

  test("o formulário pergunta pelo link antes de se desenhar", async () => {
    await client.post("/api/auth/signup", { email: "pergunta@chef-xp.test" });
    const { token } = lastEmail();

    const valido = await client.get(`/api/auth/signup?token=${token}`);
    assert.equal(valido.status, 200);
    assert.equal(valido.body.email, "pergunta@chef-xp.test");

    const invalido = await client.get(`/api/auth/signup?token=${"0".repeat(64)}`);
    assert.equal(invalido.status, 400);
  });

  test("com email configurado, o registo de uma vez só não existe", async () => {
    const response = await client.post("/api/auth/register", {
      email: "atalho@chef-xp.test",
      password: "Chef12345!",
      username: "chefatalho",
    });
    assert.equal(response.status, 404);
  });

  test("sem email configurado, o registo de uma vez só é a única porta", async () => {
    // `isMailConfigured()` é lido a cada pedido, e é isso que permite provar
    // aqui o que acontece a quem clona o projeto sem SMTP nenhum.
    const guardado = process.env.SMTP_USER;
    delete process.env.SMTP_USER;

    try {
      const providers = await client.get("/api/auth/providers");
      assert.equal(providers.body.signupFlow, "direct");

      const semEmail = await client.post("/api/auth/signup", { email: "sem@chef-xp.test" });
      assert.equal(semEmail.status, 404);

      const response = await client.post("/api/auth/register", {
        email: "semsmtp@chef-xp.test",
        password: "Chef12345!",
        username: "chefsemsmtp",
      });
      assert.equal(response.status, 201);
      assert.equal(response.body.user.username, "chefsemsmtp");
    } finally {
      process.env.SMTP_USER = guardado;
    }
  });

  // A regra é a mesma do formulário, mas quem faz o pedido pode ignorar o
  // formulário: cada caso aqui é uma password que passaria se o servidor
  // confiasse no cliente.
  for (const [nome, password] of [
    ["curta", "Ab1!"],
    ["sem maiúscula", "chef12345!"],
    ["sem número", "ChefChef!"],
    ["sem caractere especial", "Chef12345"],
  ]) {
    test(`password ${nome} é recusada pela validação`, async () => {
      const response = await client.post("/api/auth/register", {
        email: `fraca-${nome.replace(/[^a-z]/g, "")}@chef-xp.test`,
        password,
        username: `chef${nome.replace(/[^a-z]/g, "")}`,
      });
      assert.equal(response.status, 400);
      assert.ok(response.body.details.some((detail) => detail.field === "password"));
    });
  }

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
      { email: "novo@chef-xp.test", password: "Chef12345!" },
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
