import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import curriculum from "../../shared/curriculum.json" with { type: "json" };
import { REVIEW_XP } from "../domain/review.js";
import { query } from "../db/index.js";
import { closeDatabase, registerUser, skipWithoutDatabase, startTestServer } from "./helpers.js";

const LESSONS = curriculum.units.flatMap((unit) => unit.lessons);
const PRIMEIRA = LESSONS[0];

/** As respostas certas, lidas do currículo — o mesmo sítio de onde o servidor as lê. */
function respostasCertas(lesson) {
  return lesson.questions.map((question) => ({
    questionId: question.id,
    answer: question.type === "order" ? question.correctOrder : question.correctAnswer,
  }));
}

/** A resposta certa de uma pergunta, na forma que a API aceita. */
function respostaCerta(question) {
  return question.type === "order" ? question.correctOrder : question.correctAnswer;
}

/**
 * Empurra as tentativas de uma pessoa para trás no tempo.
 *
 * A revisão conta em dias de calendário, e um teste não pode esperar três. É
 * a única maneira honesta de testar um calendário: mexer no passado, nunca no
 * relógio do código que está a ser testado.
 */
async function envelhecerTentativas(userId, dias) {
  await query(
    `UPDATE question_attempts
        SET created_at = created_at - ($2 || ' days')::interval
      WHERE user_id = $1`,
    [userId, String(dias)],
  );
}

describe("revisão espaçada", skipWithoutDatabase, () => {
  let server;
  let client;
  let userId;

  before(async () => {
    server = await startTestServer();
    client = server.client;
    const user = await registerUser(client);
    userId = user.id ?? user.user?.id;
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  test("responder ao quiz deixa rasto — é o que torna o funil mensurável", async () => {
    const pergunta = PRIMEIRA.questions[0];

    await client.post(`/api/learning/lessons/${PRIMEIRA.id}/answer`, {
      questionId: pergunta.id,
      answer: respostaCerta(pergunta),
    });

    const { rows } = await query(
      `SELECT lesson_id, question_id, correct, origin
         FROM question_attempts
        WHERE user_id = $1 AND question_id = $2`,
      [userId, pergunta.id],
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0].lesson_id, PRIMEIRA.id);
    assert.equal(rows[0].correct, true);
    assert.equal(rows[0].origin, "lesson", "uma resposta do quiz é do quiz");
  });

  test("sem lições concluídas não há nada para rever", async () => {
    const resposta = await client.get("/api/learning/review");
    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.due, 0);
    assert.deepEqual(resposta.body.questions, []);
  });

  test("uma lição acabada hoje ainda não volta hoje", async () => {
    // Responde a tudo (fica o rasto) e conclui.
    for (const pergunta of PRIMEIRA.questions) {
      await client.post(`/api/learning/lessons/${PRIMEIRA.id}/answer`, {
        questionId: pergunta.id,
        answer: respostaCerta(pergunta),
      });
    }
    const feita = await client.post(`/api/learning/lessons/${PRIMEIRA.id}/complete`, {
      answers: respostasCertas(PRIMEIRA),
    });
    assert.equal(feita.body.passed, true);

    const resposta = await client.get("/api/learning/review");
    assert.equal(resposta.body.due, 0, "acabou agora: rever agora não consolidava nada");
  });

  test("passados dias, as perguntas dessa lição estão à espera", async () => {
    await envelhecerTentativas(userId, 5);

    const resposta = await client.get("/api/learning/review");
    assert.equal(resposta.status, 200);
    assert.ok(resposta.body.due > 0, "cinco dias depois havia de haver o que rever");
    assert.ok(resposta.body.questions.length > 0);

    for (const item of resposta.body.questions) {
      assert.equal(item.lessonId, PRIMEIRA.id);
      assert.ok(item.question.id, "cada pergunta vem identificada");
    }
  });

  test("a fila de revisão não leva o gabarito", async () => {
    const resposta = await client.get("/api/learning/review");
    const texto = JSON.stringify(resposta.body);
    for (const chave of ["correctAnswer", "correctOrder", "explainWrong", "explanation"]) {
      assert.ok(!texto.includes(chave), `${chave} não podia sair do servidor`);
    }
  });

  test("é o servidor que corrige a revisão, e a tentativa fica marcada como revisão", async () => {
    const fila = await client.get("/api/learning/review");
    const item = fila.body.questions[0];
    const original = PRIMEIRA.questions.find((q) => q.id === item.question.id);

    const certa = await client.post("/api/learning/review/answer", {
      lessonId: item.lessonId,
      questionId: item.question.id,
      answer: respostaCerta(original),
    });
    assert.equal(certa.status, 200);
    assert.equal(certa.body.correct, true);
    assert.ok(certa.body.explanation, "a revisão também ensina");

    const { rows } = await query(
      `SELECT origin FROM question_attempts
        WHERE user_id = $1 AND question_id = $2
        ORDER BY created_at DESC LIMIT 1`,
      [userId, item.question.id],
    );
    assert.equal(rows[0].origin, "review");
  });

  test("uma resposta errada na revisão traz a pergunta de volta para a frente da fila", async () => {
    const fila = await client.get("/api/learning/review");
    const item = fila.body.questions.find((i) => i.question.type === "choice");
    if (!item) return; // o currículo não tem escolha múltipla na primeira lição

    const original = PRIMEIRA.questions.find((q) => q.id === item.question.id);
    const errada =
      (original.options ?? []).find((o) => o !== original.correctAnswer) ?? "isto-está-errado";

    const resposta = await client.post("/api/learning/review/answer", {
      lessonId: item.lessonId,
      questionId: item.question.id,
      answer: errada,
    });
    assert.equal(resposta.body.correct, false);
    assert.ok(resposta.body.explainWrong, "errar na revisão explica o erro");

    const depois = await client.get("/api/learning/review");
    assert.equal(
      depois.body.questions[0].question.id,
      item.question.id,
      "o que se errou agora é o primeiro a voltar",
    );
  });

  test("não se revê uma lição que não se concluiu", async () => {
    const outra = LESSONS[LESSONS.length - 1];
    const resposta = await client.post("/api/learning/review/answer", {
      lessonId: outra.id,
      questionId: outra.questions[0].id,
      answer: respostaCerta(outra.questions[0]),
    });
    assert.equal(resposta.status, 403);
  });

  test("fechar a sessão paga XP, e a pontuação é a do servidor", async () => {
    const fila = await client.get("/api/learning/review");
    const respondidas = [];

    for (const item of fila.body.questions) {
      const original = PRIMEIRA.questions.find((q) => q.id === item.question.id);
      await client.post("/api/learning/review/answer", {
        lessonId: item.lessonId,
        questionId: item.question.id,
        answer: respostaCerta(original),
      });
      respondidas.push({ lessonId: item.lessonId, questionId: item.question.id });
    }

    const fim = await client.post("/api/learning/review/complete", { answered: respondidas });
    assert.equal(fim.status, 200);
    assert.equal(fim.body.total, respondidas.length);
    assert.equal(fim.body.correct, respondidas.length, "respondeu tudo certo");
    assert.equal(fim.body.paid, true);
    assert.equal(fim.body.xpEarned, REVIEW_XP.session + REVIEW_XP.perfect);
  });

  test("a revisão paga uma vez por dia — oito perguntas em ciclo não sobem de nível", async () => {
    await envelhecerTentativas(userId, 40);

    const fila = await client.get("/api/learning/review");
    const respondidas = [];
    for (const item of fila.body.questions) {
      const original = PRIMEIRA.questions.find((q) => q.id === item.question.id);
      await client.post("/api/learning/review/answer", {
        lessonId: item.lessonId,
        questionId: item.question.id,
        answer: respostaCerta(original),
      });
      respondidas.push({ lessonId: item.lessonId, questionId: item.question.id });
    }

    const segunda = await client.post("/api/learning/review/complete", { answered: respondidas });
    assert.equal(segunda.status, 200);
    assert.equal(segunda.body.paid, false, "o dia já estava pago");
    assert.equal(segunda.body.xpEarned, 0);

    const { rows } = await query(
      `SELECT COUNT(*)::int AS n FROM xp_events WHERE user_id = $1 AND source = 'review'`,
      [userId],
    );
    assert.equal(rows[0].n, 1, "um evento de XP de revisão por dia e por trilho");
  });

  test("fechar uma sessão que não foi respondida não paga nada", async () => {
    const resposta = await client.post("/api/learning/review/complete", {
      answered: [{ lessonId: PRIMEIRA.id, questionId: "pergunta-que-nunca-foi-respondida" }],
    });
    assert.equal(resposta.status, 400);
  });
});
