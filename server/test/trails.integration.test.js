import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";

import { query } from "../db/index.js";
import {
  closeDatabase,
  createClient,
  registerUser,
  skipWithoutDatabase,
  startTestServer,
} from "./helpers.js";

/**
 * Trilhos, pela API.
 *
 * A regressão que isto guarda é a que já aconteceu: pedir um trilho que não
 * existe devolvia o currículo fundacional em silêncio, e um rascunho por
 * publicar era servido a quem soubesse adivinhar o id. As duas coisas
 * pareciam funcionar — davam 200 com o conteúdo errado.
 */
describe("trilhos", skipWithoutDatabase, () => {
  let server;
  let aluno;
  let admin;

  before(async () => {
    server = await startTestServer();

    aluno = server.client;
    await registerUser(aluno);

    admin = createClient(server.baseUrl);
    const { id } = await registerUser(admin, {
      email: "chefe@exemplo.pt",
      username: "chefe",
    });
    // O papel nasce por fora, como em produção.
    await query(`UPDATE users SET role = 'admin' WHERE id = $1`, [id]);
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  test("a lista traz os trilhos publicados", async () => {
    const resposta = await aluno.get("/api/learning/trails");
    assert.equal(resposta.status, 200);

    const ids = resposta.body.trails.map((trail) => trail.id);
    assert.ok(ids.includes("main-course"));
    assert.ok(ids.includes("italian"));
  });

  test("um trilho desconhecido dá 404 em vez do currículo fundacional", async () => {
    const resposta = await aluno.get("/api/learning/path?trailId=nao-existe");
    assert.equal(resposta.status, 404);
  });

  test("cada trilho serve as suas lições", async () => {
    const fundacional = await aluno.get("/api/learning/path");
    const italiano = await aluno.get("/api/learning/path?trailId=italian");

    assert.equal(italiano.status, 200);

    const licoesDe = (r) => r.body.units.flatMap((u) => u.lessons).map((l) => l.id);
    const a = new Set(licoesDe(fundacional));
    const b = licoesDe(italiano);

    assert.ok(b.length > 0);
    assert.ok(
      b.every((id) => !a.has(id)),
      "o trilho italiano não pode devolver lições do fundacional",
    );
  });

  test("entrar num trilho põe-no em os-meus, e sair tira-o", async () => {
    assert.equal((await aluno.post("/api/learning/trails/italian/start", {})).status, 200);

    const meus = await aluno.get("/api/learning/my-trails");
    assert.ok(meus.body.trails.some((trail) => trail.id === "italian"));

    assert.equal((await aluno.delete("/api/learning/trails/italian")).status, 200);

    const depois = await aluno.get("/api/learning/my-trails");
    assert.ok(!depois.body.trails.some((trail) => trail.id === "italian"));
  });

  test("um rascunho não é servido nem começado por quem aprende", async () => {
    await admin.post("/api/admin/trails/italian/unpublish", {});

    try {
      assert.equal((await aluno.get("/api/learning/path?trailId=italian")).status, 404);
      assert.equal((await aluno.post("/api/learning/trails/italian/start", {})).status, 404);

      const lista = await aluno.get("/api/learning/trails");
      assert.ok(!lista.body.trails.some((trail) => trail.id === "italian"));

      // O administrador continua a poder vê-lo: é como se pré-visualiza.
      assert.equal((await admin.get("/api/learning/path?trailId=italian")).status, 200);
    } finally {
      await admin.post("/api/admin/trails/italian/publish", {});
    }
  });

  test("quem não é administrador não mexe nos trilhos", async () => {
    const resposta = await aluno.get("/api/admin/trails");
    assert.equal(resposta.status, 403);
  });

  test("um currículo inválido é recusado com a lista de problemas", async () => {
    const resposta = await admin.post("/api/admin/trails", {
      id: "trilho-mau",
      name: "Trilho mau",
      difficulty: "beginner",
      curriculum: { skills: [], units: [] },
    });

    assert.equal(resposta.status, 400);
    assert.ok(resposta.body.details.length > 0, "o painel precisa de saber o que corrigir");

    // E não fica nada para trás.
    const { rows } = await query(`SELECT 1 FROM trails WHERE id = 'trilho-mau'`);
    assert.equal(rows.length, 0);
  });

  test("o currículo de um trilho de ficheiro não se edita pelo painel", async () => {
    const resposta = await admin.put("/api/admin/trails/italian", { curriculum: { units: [] } });
    assert.equal(resposta.status, 409);
  });

  test("um trilho criado pelo painel chega a quem aprende", async () => {
    const criado = await admin.post("/api/admin/trails", {
      id: "teste-painel",
      name: "Trilho de teste",
      difficulty: "beginner",
      curriculum: curriculoMinimo(),
    });
    assert.equal(criado.status, 201);

    // Em rascunho ainda não se vê.
    let lista = await aluno.get("/api/learning/trails");
    assert.ok(!lista.body.trails.some((trail) => trail.id === "teste-painel"));

    assert.equal((await admin.post("/api/admin/trails/teste-painel/publish", {})).status, 200);

    lista = await aluno.get("/api/learning/trails");
    assert.ok(lista.body.trails.some((trail) => trail.id === "teste-painel"));

    const percurso = await aluno.get("/api/learning/path?trailId=teste-painel");
    assert.equal(percurso.status, 200);
    assert.deepEqual(
      percurso.body.units.flatMap((u) => u.lessons).map((l) => l.id),
      ["painel-l1"],
    );

    // A competência tem de ter chegado à tabela: `skill_practice` depende dela.
    const { rows } = await query(`SELECT 1 FROM skills WHERE id = 'painel.competencia'`);
    assert.equal(rows.length, 1);
  });

  test("um trilho com gente lá dentro não se apaga", async () => {
    await aluno.post("/api/learning/trails/teste-painel/start", {});

    const recusa = await admin.delete("/api/admin/trails/teste-painel");
    assert.equal(recusa.status, 409);

    await aluno.delete("/api/learning/trails/teste-painel");
    assert.equal((await admin.delete("/api/admin/trails/teste-painel")).status, 200);

    assert.equal((await aluno.get("/api/learning/path?trailId=teste-painel")).status, 404);
  });
});

/** O mais pequeno currículo que passa na validação. */
function curriculoMinimo() {
  return {
    skills: [
      {
        id: "painel.competencia",
        name: "Competência do painel",
        category: "organizacao",
        description: "Existe para provar que o painel chega ao fim.",
      },
    ],
    units: [
      {
        id: "painel-u1",
        title: "Unidade",
        missionId: "painel.missao",
        lessons: [
          {
            id: "painel-l1",
            title: "Lição",
            xpReward: 10,
            teaches: ["painel.competencia"],
            questions: [
              {
                id: "painel-l1-q1",
                type: "choice",
                skills: ["painel.competencia"],
                prompt: "Qual das duas?",
                options: ["Esta", "A outra"],
                correctAnswer: "Esta",
                explanation: "Porque sim.",
                explainWrong: "Porque a outra não.",
              },
            ],
          },
        ],
      },
    ],
    missions: [
      {
        id: "painel.missao",
        unitId: "painel-u1",
        title: "Missão",
        practices: ["painel.competencia"],
        ingredients: ["Um ingrediente"],
        steps: [
          {
            id: "s1",
            title: "Um",
            description: "Primeiro passo.",
            rescues: [{ kind: "pronto", answer: "Quando estiver." }],
          },
          {
            id: "s2",
            title: "Dois",
            description: "Segundo passo.",
            rescues: [{ kind: "pronto", answer: "Quando estiver." }],
          },
          {
            id: "s3",
            title: "Três",
            description: "Terceiro passo.",
            checkpoint: true,
            rescues: [{ kind: "pronto", answer: "Quando estiver." }],
          },
        ],
      },
    ],
  };
}
