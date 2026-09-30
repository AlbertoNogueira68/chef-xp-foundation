import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import curriculum from "../../shared/curriculum.json" with { type: "json" };
import { query } from "../db/index.js";
import {
  closeDatabase,
  createClient,
  publishRecipe,
  registerUser,
  skipWithoutDatabase,
  startTestServer,
} from "./helpers.js";

const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const UNIDADE = curriculum.units[0];
const MISSAO = curriculum.missions.find((m) => m.id === UNIDADE.missionId);
const ULTIMO = MISSAO.steps.length - 1;

const respostasCertas = (lesson) =>
  lesson.questions.map((q) => ({
    questionId: q.id,
    answer: q.type === "order" ? q.correctOrder : q.correctAnswer,
  }));

describe("robustez", skipWithoutDatabase, () => {
  let server;
  let eu;
  let outro;

  before(async () => {
    server = await startTestServer();
    eu = server.client;
    await registerUser(eu, { username: "robusto" });
    outro = createClient(server.baseUrl);
    await registerUser(outro, { username: "vizinho" });
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  test("não se corrige matéria trancada (não sai o gabarito)", async () => {
    const trancada = curriculum.units.flatMap((u) => u.lessons)[1];
    const q = trancada.questions[0];
    const resposta = await eu.post(`/api/learning/lessons/${trancada.id}/answer`, {
      questionId: q.id,
      answer: "qualquer",
    });
    assert.equal(resposta.status, 403);
    assert.equal(resposta.body.correctAnswer, undefined);
  });

  test("a missão só se conclui a chegar ao último passo, com a foto lá", async () => {
    for (const lesson of UNIDADE.lessons) {
      const r = await eu.post(`/api/learning/lessons/${lesson.id}/complete`, {
        answers: respostasCertas(lesson),
      });
      assert.equal(r.status, 200, `lição ${lesson.id}`);
    }

    const inicio = await eu.post(`/api/missions/${MISSAO.id}/start`);
    assert.equal(inicio.status, 201);
    const runId = inicio.body.run.id;

    // Concluir sem andar os passos é recusado.
    const semPassos = await eu.post(`/api/missions/runs/${runId}/complete`, { share: false });
    assert.equal(semPassos.status, 400);

    for (let i = 1; i <= ULTIMO; i += 1) {
      const passo = await eu.patch(`/api/missions/runs/${runId}/step`, { stepIndex: i });
      assert.equal(passo.status, 200);
    }

    // No último passo mas sem foto: continua recusado.
    const semFoto = await eu.post(`/api/missions/runs/${runId}/complete`, { share: false });
    assert.equal(semFoto.status, 400);

    const foto = await eu.post(`/api/missions/runs/${runId}/checkpoint`, {
      stepIndex: ULTIMO,
      imageDataUrl: PNG_1X1,
    });
    assert.equal(foto.status, 201);

    const fim = await eu.post(`/api/missions/runs/${runId}/complete`, { share: false });
    assert.equal(fim.status, 200);
    assert.ok(fim.body.xpEarned > 0);
  });

  test("a lista de missões vem na língua do pedido", async () => {
    const pt = await eu.get("/api/missions?lang=pt");
    const en = await eu.get("/api/missions?lang=en");
    assert.equal(pt.status, 200);
    assert.notEqual(pt.body.missions[0].title, en.body.missions[0].title);
  });

  test("só as primeiras receitas do dia pagam XP", async () => {
    const antes = process.env.RECIPES_PAID_PER_DAY;
    process.env.RECIPES_PAID_PER_DAY = "2";
    try {
      const ganhos = [];
      for (let i = 0; i < 3; i += 1) {
        const { xp } = await publishRecipe(outro, { title: `Receita ${i}` });
        ganhos.push(xp.earned);
      }
      assert.deepEqual(ganhos, [25, 25, 0]);
    } finally {
      process.env.RECIPES_PAID_PER_DAY = antes;
    }
  });

  test("procurar '%' não devolve tudo", async () => {
    await publishRecipe(eu, { title: "Bolo simples" });
    const resposta = await eu.get(`/api/recipes?q=${encodeURIComponent("%")}`);
    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.recipes.length, 0);
  });

  test("os comentários mostrados são os mais recentes, por ordem", async () => {
    const { recipe } = await publishRecipe(eu, { title: "Muito comentada" });
    await query(
      `INSERT INTO comments (recipe_id, author_id, body, created_at)
       SELECT $1, $2, 'c' || g, now() - (300 - g) * interval '1 minute'
         FROM generate_series(1, 205) g`,
      [recipe.id, (await eu.get("/api/users/me")).body.user.id],
    );

    const { body } = await eu.get(`/api/recipes/${recipe.id}/comments`);
    assert.equal(body.comments.length, 200);
    assert.equal(body.comments[0].body, "c6");
    assert.equal(body.comments.at(-1).body, "c205");
  });

  test("um bloqueio tira a pessoa do ranking, nos dois sentidos", async () => {
    const meuId = (await eu.get("/api/users/me")).body.user.id;
    const delesId = (await outro.get("/api/users/me")).body.user.id;
    await eu.post(`/api/users/${delesId}/block`);

    const meu = await eu.get("/api/leaderboard");
    assert.ok(!meu.body.entries.some((e) => e.user.id === delesId));
    const dele = await outro.get("/api/leaderboard");
    assert.ok(!dele.body.entries.some((e) => e.user.id === meuId));
  });
});
