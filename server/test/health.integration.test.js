import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { closeDatabase, skipWithoutDatabase, startTestServer } from "./helpers.js";

/**
 * O health check.
 *
 * Respondia `{status:"ok"}` sem verificar nada — um valor constante com forma
 * de diagnóstico. Quem vigia o serviço ficava a saber que o processo do Node
 * estava vivo, que é a única coisa que nunca é o problema: o processo continua
 * de pé com o Postgres em baixo, e o reinício que resolveria isso nunca era
 * accionado porque a sonda dizia que estava tudo bem.
 */
describe("health check", skipWithoutDatabase, () => {
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

  test("com a base a responder, diz que está bem — e diz da base também", async () => {
    const resposta = await client.get("/api/health");

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.status, "ok");
    assert.equal(resposta.body.db, "ok", "o estado da base faz parte da resposta");
  });

  test("não precisa de sessão: quem vigia o serviço não tem conta", async () => {
    // O cliente do harness não está autenticado neste ficheiro, e mesmo assim
    // a resposta é 200 — se fosse 401, a sonda dizia que o serviço está mal
    // por uma razão que não tem nada a ver com o serviço.
    const resposta = await client.get("/api/health");
    assert.equal(resposta.status, 200);
  });

  test("responde depressa: uma sonda que demora é uma sonda que mente", async () => {
    const inicio = Date.now();
    await client.get("/api/health");
    const ms = Date.now() - inicio;

    // O limite interno é de 2s; isto é a folga para não ser um teste frágil.
    assert.ok(ms < 2500, `o health check demorou ${ms}ms`);
  });
});

/**
 * CORS e a aplicação servida pelo próprio Express.
 *
 * Um módulo marcado com `crossorigin` — que é como o Vite emite os da build —
 * leva cabeçalho `Origin` **mesmo sendo do mesmo sítio**. Com a verificação a
 * assumir que same-origin não traz `Origin`, a aplicação era recusada a si
 * própria: cada `/assets/*.js` dava 500 e a página ficava em branco. O
 * `npm run preview`, que é a maneira documentada de ver a app instalável,
 * mostrava um ecrã vazio sem nada a explicar porquê.
 */
describe("CORS", skipWithoutDatabase, () => {
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

  test("um pedido do mesmo sítio é aceite, mesmo trazendo Origin", async () => {
    const origem = new URL(server.baseUrl).origin;
    const resposta = await client.get("/api/health", { headers: { Origin: origem } });

    assert.equal(resposta.status, 200, "a aplicação tem de poder falar consigo própria");
  });

  test("uma origem de fora continua recusada", async () => {
    const resposta = await client.get("/api/health", {
      headers: { Origin: "http://origem-que-nao-devia.example" },
    });

    assert.equal(resposta.status, 500, "o CORS continua fechado ao que vem de fora");
  });

  test("sem Origin continua a passar — é o caso de uma ferramenta local", async () => {
    const resposta = await client.get("/api/health");
    assert.equal(resposta.status, 200);
  });
});
