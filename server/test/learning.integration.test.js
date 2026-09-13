import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import curriculum from "../../shared/curriculum.json" with { type: "json" };
import { MAX_HEARTS } from "../domain/xp.js";
import { query } from "../db/index.js";
import {
  closeDatabase,
  createClient,
  registerUser,
  skipWithoutDatabase,
  startTestServer,
} from "./helpers.js";

const LESSONS = curriculum.units.flatMap((unit) => unit.lessons);
const PRIMEIRA = LESSONS[0];
const SEGUNDA = LESSONS[1];

/** As respostas certas, lidas do currículo — o mesmo sítio de onde o servidor as lê. */
function respostasCertas(lesson) {
  return lesson.questions.map((question) => ({
    questionId: question.id,
    answer: question.type === "order" ? question.correctOrder : question.correctAnswer,
  }));
}

describe("aprendizagem", skipWithoutDatabase, () => {
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

  test("a lição chega ao cliente sem o gabarito", async () => {
    const resposta = await client.get(`/api/learning/lessons/${PRIMEIRA.id}`);
    assert.equal(resposta.status, 200);

    const texto = JSON.stringify(resposta.body);
    for (const chave of ["correctAnswer", "correctOrder", "explainWrong"]) {
      assert.ok(!texto.includes(chave), `${chave} não podia sair do servidor`);
    }

    // E as respostas também não vão lá dentro com outro nome qualquer.
    for (const question of PRIMEIRA.questions) {
      if (typeof question.correctAnswer === "string" && question.correctAnswer.length > 3) {
        const opcoes = JSON.stringify(question.options ?? []);
        if (!opcoes.includes(question.correctAnswer)) {
          assert.ok(
            !texto.includes(question.correctAnswer),
            `a resposta de ${question.id} está na resposta`,
          );
        }
      }
    }
  });

  test("uma lição trancada dá 403 antes de a anterior estar feita", async () => {
    const ultima = LESSONS[LESSONS.length - 1];
    const resposta = await client.get(`/api/learning/lessons/${ultima.id}`);
    assert.equal(resposta.status, 403);
  });

  test("é o servidor que corrige cada resposta", async () => {
    const question = PRIMEIRA.questions.find((q) => q.type !== "order");

    const errada = await client.post(`/api/learning/lessons/${PRIMEIRA.id}/answer`, {
      questionId: question.id,
      answer: "uma resposta claramente inventada",
    });
    assert.equal(errada.status, 200);
    assert.equal(errada.body.correct, false);
    assert.ok(errada.body.explainWrong, "errar tem de explicar porquê");

    const certa = await client.post(`/api/learning/lessons/${PRIMEIRA.id}/answer`, {
      questionId: question.id,
      answer: question.correctAnswer,
    });
    assert.equal(certa.body.correct, true);
    assert.equal(certa.body.explainWrong, null);
  });

  test("concluir com tudo certo paga o XP e o bónus de lição perfeita", async () => {
    const resposta = await client.post(`/api/learning/lessons/${PRIMEIRA.id}/complete`, {
      answers: respostasCertas(PRIMEIRA),
    });

    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.passed, true);
    assert.equal(resposta.body.xpEarned, PRIMEIRA.xpReward + 10);
  });

  test("repetir a lição não paga outra vez", async () => {
    const antes = (await client.get("/api/users/me")).body.user.xp;

    const resposta = await client.post(`/api/learning/lessons/${PRIMEIRA.id}/complete`, {
      answers: respostasCertas(PRIMEIRA),
    });
    assert.equal(resposta.body.passed, true);

    const depois = (await client.get("/api/users/me")).body.user.xp;
    assert.equal(depois, antes, "o XP da lição é pago uma vez só");

    const { rows } = await query(
      `SELECT count(*)::int AS eventos FROM xp_events WHERE source = 'lesson' AND source_ref = $1`,
      [PRIMEIRA.id],
    );
    assert.equal(rows[0].eventos, 1);
  });

  test("dizer que se acertou não chega: o servidor volta a corrigir", async () => {
    const erradas = SEGUNDA.questions.map((question) => ({
      questionId: question.id,
      answer: question.type === "order" ? [] : "errado de propósito",
    }));

    const resposta = await client.post(`/api/learning/lessons/${SEGUNDA.id}/complete`, {
      answers: erradas,
    });

    assert.equal(resposta.body.passed, false);
    assert.equal(resposta.body.xpEarned, 0);
    assert.equal(resposta.body.heartsLeft, 0);

    const { rows } = await query(
      `SELECT count(*)::int AS eventos FROM xp_events WHERE source = 'lesson' AND source_ref = $1`,
      [SEGUNDA.id],
    );
    assert.equal(rows[0].eventos, 0, "uma lição falhada não pode deixar rasto no livro-razão");
  });

  test("não se salta lições", async () => {
    const quarta = LESSONS[3];
    const resposta = await client.post(`/api/learning/lessons/${quarta.id}/complete`, {
      answers: respostasCertas(quarta),
    });
    assert.equal(resposta.status, 403);
  });

  test("o percurso reflete o que já foi feito", async () => {
    const resposta = await client.get("/api/learning/path");
    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.progress.streak >= 1, true);

    const lessons = resposta.body.units.flatMap((unit) => unit.lessons);
    assert.equal(lessons.find((lesson) => lesson.id === PRIMEIRA.id).status, "completed");
    assert.equal(lessons.find((lesson) => lesson.id === SEGUNDA.id).status, "current");
  });

  test("as 19 lições resolvem-se de ponta a ponta com as respostas do currículo", async () => {
    // O teste que protege o conteúdo, e não o código: percorre o percurso
    // inteiro na ordem, com as respostas que o currículo declara certas. Se
    // alguma pergunta nova tiver uma resposta que o corretor não aceita — um
    // `correctAnswer` que não está nas opções, um `order` com um passo
    // trocado, um `estimate` fora da tolerância — falha aqui, e não no
    // telemóvel de quem está a aprender.
    const outro = createClient(server.baseUrl);
    await registerUser(outro);

    for (const lesson of LESSONS) {
      const resposta = await outro.post(`/api/learning/lessons/${lesson.id}/complete`, {
        answers: respostasCertas(lesson),
      });

      assert.equal(resposta.status, 200, `${lesson.id}: ${JSON.stringify(resposta.body)}`);
      assert.equal(resposta.body.passed, true, `${lesson.id} não passou com as respostas certas`);
      assert.equal(
        resposta.body.heartsLeft,
        MAX_HEARTS,
        `${lesson.id}: o corretor recusou alguma resposta que o currículo dá como certa`,
      );
    }

    // E no fim o percurso está mesmo todo feito.
    const path = (await outro.get("/api/learning/path")).body;
    const estados = path.units.flatMap((unit) => unit.lessons.map((l) => l.status));
    assert.ok(
      estados.every((estado) => estado === "completed"),
      "ficaram lições por concluir",
    );
  });

  test("uma lição que não existe dá 404", async () => {
    assert.equal((await client.get("/api/learning/lessons/nao-existe")).status, 404);
  });
});
