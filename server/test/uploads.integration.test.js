import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "../lib/imageStore.js";
import {
  closeDatabase,
  createClient,
  registerUser,
  skipWithoutDatabase,
  startTestServer,
} from "./helpers.js";

/** Um PNG de 1x1 verdadeiro — os bytes iniciais são mesmo os de um PNG. */
const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** Um script disfarçado: o MIME diz imagem, os bytes dizem outra coisa. */
const SCRIPT_DISFARCADO = `data:image/png;base64,${Buffer.from(
  '<?php system($_GET["c"]); ?>',
  "utf8",
).toString("base64")}`;

describe("imagens carregadas", skipWithoutDatabase, () => {
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

  const publish = (imageDataUrl) =>
    client.post("/api/recipes", {
      title: "Com fotografia",
      description: "Uma receita que traz uma imagem consigo.",
      ingredients: "sal grosso\npimenta",
      cookTimeMin: 10,
      difficulty: "facil",
      imageDataUrl,
    });

  test("um PNG verdadeiro é aceite e gravado com um nome escolhido pelo servidor", async () => {
    const resposta = await publish(PNG_1X1);

    assert.equal(resposta.status, 201);
    const { imageUrl } = resposta.body.recipe;
    assert.match(imageUrl, /^\/uploads\/[0-9a-f-]{36}\.png$/);

    // O ficheiro existe mesmo, e o nome não veio do cliente.
    const gravado = path.join(UPLOAD_DIR, path.basename(imageUrl));
    const bytes = await fs.readFile(gravado);
    assert.equal(bytes[0], 0x89, "não é um PNG em disco");
    await fs.unlink(gravado);
  });

  test("o que o MIME diz não conta: um script com MIME de imagem é recusado", async () => {
    const resposta = await publish(SCRIPT_DISFARCADO);

    assert.equal(resposta.status, 400);
    assert.match(JSON.stringify(resposta.body), /image/i);
  });

  test("um URL externo é recusado — a fotografia tem de ficar em nossa casa", async () => {
    assert.equal((await publish("https://exemplo.pt/foto.jpg")).status, 400);
    assert.equal((await publish("nem parece nada")).status, 400);
  });

  test("um caminho nosso é aceite tal e qual, sem regravar nada", async () => {
    const primeira = await publish(PNG_1X1);
    const { imageUrl } = primeira.body.recipe;

    const segunda = await publish(imageUrl);
    assert.equal(segunda.status, 201);
    assert.equal(segunda.body.recipe.imageUrl, imageUrl);

    await fs.unlink(path.join(UPLOAD_DIR, path.basename(imageUrl)));
  });

  test("a imagem servida vem com o cabeçalho de cache imutável", async () => {
    const resposta = await publish(PNG_1X1);
    const { imageUrl } = resposta.body.recipe;

    const ficheiro = await client.get(imageUrl);
    assert.equal(ficheiro.status, 200);
    assert.match(ficheiro.headers.get("cache-control"), /immutable/);

    await fs.unlink(path.join(UPLOAD_DIR, path.basename(imageUrl)));
  });

  test("uma fotografia de perfil segue o mesmo caminho", async () => {
    const resposta = await client.patch("/api/users/me", { photoUrl: PNG_1X1 });

    assert.equal(resposta.status, 200);
    assert.match(resposta.body.user.photoUrl, /^\/uploads\/[0-9a-f-]{36}\.png$/);
    await fs.unlink(path.join(UPLOAD_DIR, path.basename(resposta.body.user.photoUrl)));
  });

  test("um script disfarçado também não passa por fotografia de perfil", async () => {
    assert.equal(
      (await client.patch("/api/users/me", { photoUrl: SCRIPT_DISFARCADO })).status,
      400,
    );
  });
});

describe("perfil", skipWithoutDatabase, () => {
  let server;
  let client;
  let outro;

  before(async () => {
    server = await startTestServer();
    client = server.client;
    outro = createClient(server.baseUrl);
    await registerUser(outro, { username: "jaexiste" });
    await registerUser(client);
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  test("o email só aparece no próprio perfil", async () => {
    const meu = await client.get("/api/users/me");
    assert.ok(meu.body.user.email);

    const dele = (await outro.get("/api/users/me")).body.user;
    const publico = await client.get(`/api/users/${dele.id}`);

    assert.equal(publico.status, 200);
    assert.ok(!("email" in publico.body.user), "o email de outra pessoa não pode sair daqui");
  });

  test("um nome de utilizador já usado dá 409", async () => {
    assert.equal((await client.patch("/api/users/me", { username: "jaexiste" })).status, 409);
  });

  test("um nome com maiúsculas ou espaços é recusado", async () => {
    assert.equal((await client.patch("/api/users/me", { username: "Com Espaços" })).status, 400);
  });

  test("a meta diária tem limites", async () => {
    assert.equal((await client.patch("/api/users/me", { dailyXpGoal: 5 })).status, 400);
    assert.equal((await client.patch("/api/users/me", { dailyXpGoal: 5000 })).status, 400);
    assert.equal((await client.patch("/api/users/me", { dailyXpGoal: 100 })).status, 200);
  });

  test("seguir é idempotente e não me deixa seguir a mim próprio", async () => {
    const dele = (await outro.get("/api/users/me")).body.user;
    const eu = (await client.get("/api/users/me")).body.user;

    await client.post(`/api/users/${dele.id}/follow`);
    await client.post(`/api/users/${dele.id}/follow`);

    const stats = await client.get(`/api/users/${dele.id}/stats`);
    assert.equal(stats.body.stats.followers, 1);
    assert.equal(stats.body.stats.isFollowing, true);

    assert.equal((await client.post(`/api/users/${eu.id}/follow`)).status, 400);
  });
});
