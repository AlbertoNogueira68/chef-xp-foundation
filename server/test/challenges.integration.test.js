import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { query } from "../db/index.js";
import {
  closeDatabase,
  createChallenge,
  createClient,
  endChallengeNow,
  enterChallenge,
  likeRecipeAs,
  publishRecipe,
  registerUser,
  setRole,
  skipWithoutDatabase,
  startTestServer,
} from "./helpers.js";

describe("desafios", skipWithoutDatabase, () => {
  let server;
  let client;
  let outro;
  let staff;

  before(async () => {
    server = await startTestServer();
    client = server.client;
    outro = createClient(server.baseUrl);
    staff = createClient(server.baseUrl);
    await registerUser(outro);
    const moderador = await registerUser(staff);
    await setRole(moderador.id, "moderator");
    await registerUser(client);
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  test("participar publica a receita e paga os dois XP de uma vez", async () => {
    const desafio = await createChallenge({ xpReward: 100 });

    const antes = (await client.get("/api/users/me")).body.user.xp;
    const resposta = await enterChallenge(client, desafio.id, { title: "Feito para o desafio" });

    assert.equal(resposta.status, 201);
    assert.equal(resposta.body.challenge.title, "Desafio de teste");
    // 100 do desafio mais o XP de publicar uma receita.
    assert.ok(resposta.body.xp.earned > 100);
    assert.equal(resposta.body.xp.total, antes + resposta.body.xp.earned);

    // A receita é uma receita como as outras, e sabe a que desafio pertence.
    assert.equal(resposta.body.recipe.challenge.id, desafio.id);
    assert.equal(resposta.body.recipe.challenge.title, "Desafio de teste");

    const detalhe = await client.get(`/api/challenges/${desafio.id}`);
    assert.equal(detalhe.body.challenge.entriesCount, 1);
    assert.equal(detalhe.body.challenge.myEntriesCount, 1);
  });

  test("a receita do desafio aparece no feed, com o selo", async () => {
    const desafio = await createChallenge();
    const { body } = await enterChallenge(client, desafio.id, { title: "No feed com selo" });

    const feed = await client.get("/api/recipes?limit=50");
    const noFeed = feed.body.recipes.find((receita) => receita.id === body.recipe.id);

    assert.ok(noFeed, "a receita do desafio é uma receita normal do feed");
    assert.equal(noFeed.challenge.title, "Desafio de teste");

    // E uma receita publicada fora de um desafio não inventa selo nenhum.
    const solta = await publishRecipe(client, { title: "Sem desafio" });
    assert.equal(solta.recipe.challenge, null);
  });

  test("participar duas vezes num desafio de uma submissão dá 409", async () => {
    const desafio = await createChallenge();

    await enterChallenge(client, desafio.id, { title: "Uma vez só" });
    const segunda = await enterChallenge(client, desafio.id, { title: "Outra vez" });

    assert.equal(segunda.status, 409);
  });

  test("a receita recusada não fica publicada", async () => {
    const desafio = await createChallenge({ endsInDays: -1 });

    const resposta = await enterChallenge(client, desafio.id, { title: "Tarde demais" });
    assert.equal(resposta.status, 409);

    const { rows } = await query(`SELECT count(*)::int AS n FROM recipes WHERE title = $1`, [
      "Tarde demais",
    ]);
    assert.equal(rows[0].n, 0, "a transação leva a receita atrás");
  });

  test("um desafio que não existe dá 404 e não publica nada", async () => {
    const resposta = await enterChallenge(client, "00000000-0000-0000-0000-000000000000", {
      title: "Desafio inventado",
    });
    assert.equal(resposta.status, 404);

    const { rows } = await query(`SELECT count(*)::int AS n FROM recipes WHERE title = $1`, [
      "Desafio inventado",
    ]);
    assert.equal(rows[0].n, 0);
  });

  test("sair e voltar a entrar não volta a pagar o XP do desafio", async () => {
    const desafio = await createChallenge({ xpReward: 100 });

    await enterChallenge(client, desafio.id, { title: "Ida" });
    const depoisDaPrimeira = (await client.get("/api/users/me")).body.user.xp;

    await client.delete(`/api/challenges/${desafio.id}/entries`);
    const regresso = await enterChallenge(client, desafio.id, { title: "Volta" });

    assert.equal(regresso.status, 201);
    // Ganha o XP da receita nova, mas não outra vez o do desafio.
    const ganho = regresso.body.xp.total - depoisDaPrimeira;
    assert.ok(ganho > 0 && ganho < 100, "o desafio não paga segunda vez");

    // Só os deste desafio: os outros testes desta bateria também participam.
    const { rows } = await query(
      `SELECT count(*)::int AS eventos
         FROM xp_events WHERE source = 'challenge' AND source_ref = $1::text`,
      [desafio.id],
    );
    assert.equal(rows[0].eventos, 1);
  });

  test("retirar a participação deixa a receita publicada, sem selo", async () => {
    const desafio = await createChallenge();
    const { body } = await enterChallenge(client, desafio.id, { title: "Fica sem selo" });

    await client.delete(`/api/challenges/${desafio.id}/entries`);

    const receita = await client.get(`/api/recipes/${body.recipe.id}`);
    assert.equal(receita.status, 200, "a receita é dela, não do desafio");
    assert.equal(receita.body.recipe.challenge, null);
  });

  test("retirar uma participação que não existe dá 404", async () => {
    const desafio = await createChallenge();
    assert.equal((await client.delete(`/api/challenges/${desafio.id}/entries`)).status, 404);
  });

  test("o detalhe mostra as participações de toda a gente", async () => {
    const desafio = await createChallenge();
    await enterChallenge(client, desafio.id, { title: "A minha" });
    await enterChallenge(outro, desafio.id, { title: "A dele" });

    const resposta = await client.get(`/api/challenges/${desafio.id}`);
    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.challenge.entriesCount, 2);
    assert.deepEqual(resposta.body.entries.map((entry) => entry.recipe.title).sort(), [
      "A dele",
      "A minha",
    ]);
  });

  test("apagar a receita retira a participação", async () => {
    const desafio = await createChallenge();
    const { body } = await enterChallenge(client, desafio.id, { title: "Vai desaparecer" });

    await client.delete(`/api/recipes/${body.recipe.id}`);

    const resposta = await client.get(`/api/challenges/${desafio.id}`);
    assert.equal(resposta.body.challenge.entriesCount, 0);
    assert.equal(resposta.body.challenge.myEntriesCount, 0);
  });
  /* -------------------------------------------------------------- *
   * Criar e gerir
   * -------------------------------------------------------------- */

  test("um utilizador comum não cria desafios", async () => {
    const resposta = await client.post("/api/challenges", {
      title: "O meu desafio",
      description: "Uma descrição com tamanho suficiente.",
    });
    assert.equal(resposta.status, 403);
  });

  test("um moderador cria um desafio com as regras que escolhe", async () => {
    const resposta = await staff.post("/api/challenges", {
      title: "Três fotos da tua semana",
      description: "Publica até três pratos que tenhas feito esta semana.",
      xpReward: 60,
      maxEntriesPerUser: 3,
      durationDays: 10,
      firstPlaceXp: 500,
      secondPlaceXp: 250,
      thirdPlaceXp: 50,
    });

    assert.equal(resposta.status, 201);
    const desafio = resposta.body.challenge;
    assert.equal(desafio.xpReward, 60);
    assert.equal(desafio.maxEntriesPerUser, 3);
    assert.equal(desafio.durationDays, 10);
    assert.deepEqual(desafio.podiumXp, [500, 250, 50]);
    assert.equal(desafio.settledAt, null);
    assert.ok(desafio.active);
  });

  test("os números do desafio têm limites", async () => {
    const resposta = await staff.post("/api/challenges", {
      title: "Desafio sem fim",
      description: "Uma descrição com tamanho suficiente.",
      durationDays: 5000,
    });
    assert.equal(resposta.status, 400);

    const fotos = await staff.post("/api/challenges", {
      title: "Cem fotos",
      description: "Uma descrição com tamanho suficiente.",
      maxEntriesPerUser: 100,
    });
    assert.equal(fotos.status, 400);
  });

  test("as regras não mudam depois de alguém participar", async () => {
    const desafio = await createChallenge();
    await enterChallenge(client, desafio.id, { title: "Já cá está" });

    const regras = await staff.patch(`/api/challenges/${desafio.id}`, { xpReward: 999 });
    assert.equal(regras.status, 409);

    const texto = await staff.patch(`/api/challenges/${desafio.id}`, { title: "Outro título" });
    assert.equal(texto.status, 200);
    assert.equal(texto.body.challenge.title, "Outro título");
  });

  test("o prazo estica-se, e um desafio com participações não se apaga", async () => {
    const desafio = await createChallenge({ endsInDays: 2 });
    await enterChallenge(client, desafio.id, { title: "Com prazo" });

    const daquiA20 = new Date(Date.now() + 20 * 86_400_000).toISOString();
    const esticar = await staff.patch(`/api/challenges/${desafio.id}`, { endsAt: daquiA20 });
    assert.equal(esticar.status, 200);

    const encurtar = await staff.patch(`/api/challenges/${desafio.id}`, {
      endsAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    assert.equal(encurtar.status, 409);

    assert.equal((await staff.delete(`/api/challenges/${desafio.id}`)).status, 409);
  });

  test("um desafio sem participações apaga-se", async () => {
    const desafio = await createChallenge();
    assert.equal((await staff.delete(`/api/challenges/${desafio.id}`)).status, 204);
    assert.equal((await client.get(`/api/challenges/${desafio.id}`)).status, 404);
  });

  /* -------------------------------------------------------------- *
   * Mais do que uma submissão
   * -------------------------------------------------------------- */

  test("com três submissões permitidas entram três, e a quarta é recusada", async () => {
    const desafio = await createChallenge({ xpReward: 40, maxEntriesPerUser: 3 });

    const antes = (await client.get("/api/users/me")).body.user.xp;

    for (const titulo of ["Foto 1", "Foto 2", "Foto 3"]) {
      const resposta = await enterChallenge(client, desafio.id, { title: titulo });
      assert.equal(resposta.status, 201);
    }

    const quarta = await enterChallenge(client, desafio.id, { title: "Foto 4" });
    assert.equal(quarta.status, 409);

    // O XP de participação é por desafio, não por foto: das três publicações
    // só uma trouxe os 40 do desafio.
    const ganho = (await client.get("/api/users/me")).body.user.xp - antes;
    assert.ok(ganho > 40 && ganho < 3 * 40, "o desafio pagou uma vez, as receitas três");

    const detalhe = await client.get(`/api/challenges/${desafio.id}`);
    assert.equal(detalhe.body.challenge.myEntriesCount, 3);
    assert.equal(detalhe.body.challenge.entriesCount, 3);
    assert.equal(detalhe.body.challenge.participantsCount, 1);
  });

  test("retira-se uma submissão sem levar as outras", async () => {
    const desafio = await createChallenge({ maxEntriesPerUser: 2 });
    await enterChallenge(client, desafio.id, { title: "Fica" });
    await enterChallenge(client, desafio.id, { title: "Sai" });

    const detalhe = await client.get(`/api/challenges/${desafio.id}`);
    const paraTirar = detalhe.body.entries.find((entry) => entry.recipe.title === "Sai");

    const resposta = await client.delete(`/api/challenges/${desafio.id}/entries/${paraTirar.id}`);
    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.challenge.myEntriesCount, 1);
  });

  /* -------------------------------------------------------------- *
   * O fim: ranking e pódio
   * -------------------------------------------------------------- */

  test("no fim, quem tem mais gostos leva o XP do pódio", async () => {
    const desafio = await createChallenge({ xpReward: 10, podium: [300, 200, 100] });

    const meuPrato = (await enterChallenge(client, desafio.id, { title: "Vencedor" })).body.recipe;
    const delePrato = (await enterChallenge(outro, desafio.id, { title: "Segundo" })).body.recipe;

    // Três gostos contra um, dados por gente de fora do desafio.
    for (let i = 0; i < 3; i += 1) {
      const votante = await registerUser(createClient(server.baseUrl));
      await likeRecipeAs(votante.id, meuPrato.id);
    }
    const votante = await registerUser(createClient(server.baseUrl));
    await likeRecipeAs(votante.id, delePrato.id);

    const meuXpAntes = (await client.get("/api/users/me")).body.user.xp;
    const dele = await outro.get("/api/users/me");

    await endChallengeNow(desafio.id);
    const fecho = await staff.post(`/api/challenges/${desafio.id}/settle`, {});
    assert.equal(fecho.status, 200);

    const podio = fecho.body.results;
    assert.equal(podio[0].place, 1);
    assert.equal(podio[0].likes, 3);
    assert.equal(podio[0].xp, 300);
    assert.equal(podio[1].place, 2);
    assert.equal(podio[1].xp, 200);

    assert.equal((await client.get("/api/users/me")).body.user.xp, meuXpAntes + 300);
    assert.equal((await outro.get("/api/users/me")).body.user.xp, dele.body.user.xp + 200);

    // Fechar outra vez não paga nada: o desafio já está liquidado.
    assert.equal((await staff.post(`/api/challenges/${desafio.id}/settle`, {})).status, 409);
    assert.equal((await client.get("/api/users/me")).body.user.xp, meuXpAntes + 300);
  });

  test("um empate paga o mesmo aos dois", async () => {
    const desafio = await createChallenge({ xpReward: 0, podium: [300, 200, 100] });

    const meu = (await enterChallenge(client, desafio.id, { title: "Empate A" })).body.recipe;
    const seu = (await enterChallenge(outro, desafio.id, { title: "Empate B" })).body.recipe;

    for (const receita of [meu, seu]) {
      const votante = await registerUser(createClient(server.baseUrl));
      await likeRecipeAs(votante.id, receita.id);
    }

    const meuAntes = (await client.get("/api/users/me")).body.user.xp;
    const deleAntes = (await outro.get("/api/users/me")).body.user.xp;

    await endChallengeNow(desafio.id);
    const fecho = await staff.post(`/api/challenges/${desafio.id}/settle`, {});

    assert.deepEqual(
      fecho.body.results.map((linha) => [linha.place, linha.xp]),
      [
        [1, 300],
        [1, 300],
      ],
    );
    assert.equal((await client.get("/api/users/me")).body.user.xp, meuAntes + 300);
    assert.equal((await outro.get("/api/users/me")).body.user.xp, deleAntes + 300);
  });

  test("sem um único gosto não há pódio a pagar", async () => {
    const desafio = await createChallenge({ xpReward: 0, podium: [300, 200, 100] });
    await enterChallenge(client, desafio.id, { title: "Ninguém votou" });

    const antes = (await client.get("/api/users/me")).body.user.xp;
    await endChallengeNow(desafio.id);
    const fecho = await staff.post(`/api/challenges/${desafio.id}/settle`, {});

    assert.equal(fecho.body.results[0].xp, 0);
    assert.equal((await client.get("/api/users/me")).body.user.xp, antes);
  });

  test("o resultado fica congelado: gostos que chegam depois não o mudam", async () => {
    const desafio = await createChallenge({ xpReward: 0 });
    const { body } = await enterChallenge(client, desafio.id, { title: "Congelado" });
    const recipe = body.recipe;

    const primeiro = await registerUser(createClient(server.baseUrl));
    await likeRecipeAs(primeiro.id, recipe.id);

    await endChallengeNow(desafio.id);
    await staff.post(`/api/challenges/${desafio.id}/settle`, {});

    const tardio = await registerUser(createClient(server.baseUrl));
    await likeRecipeAs(tardio.id, recipe.id);

    const detalhe = await client.get(`/api/challenges/${desafio.id}`);
    assert.equal(detalhe.body.results[0].likes, 1, "o pódio guarda os gostos do fecho");
    assert.ok(detalhe.body.challenge.settledAt);
  });

  test("um desafio a decorrer não se fecha à mão", async () => {
    const desafio = await createChallenge({ endsInDays: 5 });
    assert.equal((await staff.post(`/api/challenges/${desafio.id}/settle`, {})).status, 409);
  });

  test("fechar desafios é coisa de moderador", async () => {
    const desafio = await createChallenge({ endsInDays: -1 });
    assert.equal((await client.post(`/api/challenges/${desafio.id}/settle`, {})).status, 403);
  });
});
