import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";

import { closeDatabase, registerUser, skipWithoutDatabase, startTestServer } from "./helpers.js";

/**
 * Entrada malformada dá 400, não 500.
 *
 * A diferença não é cosmética. Um 500 é o servidor a dizer "parti-me", e
 * escreve um stack trace no registo de erros — que é onde se olha quando há um
 * problema a sério. Qualquer pessoa que consiga provocar um 500 à vontade
 * consegue enterrar o erro que interessa debaixo de mil que não interessam.
 *
 * Estes três casos eram os que restavam: a única rota que lia `req.query` sem
 * passar pelo Zod, o cursor de paginação (que é base64 nosso mas volta pela
 * mão de quem quiser), e o `X-Request-Id`, que era aceite em cru e ia parar
 * dentro de cada linha de log do pedido.
 */
describe("robustez da entrada", skipWithoutDatabase, () => {
  let server;
  let client;

  before(async () => {
    server = await startTestServer();
    client = server.client;
    await registerUser(client);
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  test("um userId que não é UUID dá 400 e não 500", async () => {
    const resposta = await client.get("/api/missions/posts?userId=nao-e-uuid");

    assert.equal(resposta.status, 400);
    assert.equal(resposta.body.details[0].field, "userId");
  });

  test("sem userId, /missions/posts responde pelos meus", async () => {
    const resposta = await client.get("/api/missions/posts");

    assert.equal(resposta.status, 200);
    assert.ok(Array.isArray(resposta.body.posts));
  });

  test("um cursor forjado é tratado como ausente, não rebenta", async () => {
    const forjado = Buffer.from(JSON.stringify({ createdAt: "ontem", id: "eu" })).toString(
      "base64url",
    );

    for (const cursor of ["LIXO", forjado, "eyJvZmZzZXQiOi0xfQ"]) {
      const resposta = await client.get(`/api/recipes?cursor=${cursor}`);
      assert.equal(resposta.status, 200, `cursor "${cursor}" devia ser ignorado`);
    }
  });

  test("um cursor nosso continua a paginar", async () => {
    const primeira = await client.get("/api/recipes?limit=1");
    assert.equal(primeira.status, 200);

    if (primeira.body.nextCursor) {
      const segunda = await client.get(`/api/recipes?limit=1&cursor=${primeira.body.nextCursor}`);
      assert.equal(segunda.status, 200);
    }
  });

  test("o X-Request-Id só é aceite se for mesmo um UUID", async () => {
    const inventado = await client.get("/api/health", {
      headers: { "X-Request-Id": "INJETADO ".repeat(20) },
    });
    const devolvido = inventado.headers.get("x-request-id");

    assert.ok(!/INJETADO/.test(devolvido), `devolveu o que o cliente mandou: ${devolvido}`);
    assert.match(devolvido, /^[0-9a-f-]{36}$/);
  });

  test("um X-Request-Id verdadeiro é respeitado — é para isso que serve", async () => {
    const meu = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
    const resposta = await client.get("/api/health", { headers: { "X-Request-Id": meu } });

    assert.equal(resposta.headers.get("x-request-id"), meu);
  });
});
