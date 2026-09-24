import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";

import { query } from "../db/index.js";
import { DEFAULT_TRAIL, getLessonOrder } from "../domain/curriculum.js";
import {
  closeDatabase,
  createClient,
  registerUser,
  skipWithoutDatabase,
  startTestServer,
} from "./helpers.js";

/**
 * Marca todas as lições do fundacional como feitas, direto na base. Os
 * testes deste ficheiro são sobre trilhos especializados, não sobre a
 * mecânica de responder a uma lição — passar por ela lição a lição só
 * tornaria estes testes lentos e frágeis sem cobrir nada de novo.
 */
async function completarFundacional(userId) {
  for (const lessonId of getLessonOrder(DEFAULT_TRAIL)) {
    await query(
      `INSERT INTO lesson_progress (user_id, lesson_id, trail_id, xp_earned, hearts_left)
       VALUES ($1, $2, $3, 0, 3)
       ON CONFLICT (user_id, lesson_id) DO NOTHING`,
      [userId, lessonId, DEFAULT_TRAIL],
    );
  }
}

/**
 * Trilhos, pela API.
 *
 * A regressão que isto guarda é a que já aconteceu: pedir um trilho que não
 * existe devolvia o currículo fundacional em silêncio, e um rascunho por
 * publicar era servido a quem soubesse adivinhar o id. As duas coisas
 * pareciam funcionar — davam 200 com o conteúdo errado.
 *
 * Os trilhos especializados também têm um pré-requisito: o fundacional
 * completo. `aluno` já o tem feito no `before`, porque estes testes são sobre
 * o comportamento de "italian", não sobre esse bloqueio — que tem os seus
 * próprios testes, com um estudante que ainda não o completou.
 */
describe("trilhos", skipWithoutDatabase, () => {
  let server;
  let aluno;
  let admin;

  before(async () => {
    server = await startTestServer();

    aluno = server.client;
    const { id: alunoId } = await registerUser(aluno);
    await completarFundacional(alunoId);

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

  test("um trilho especializado só aparece depois do fundacional completo", async () => {
    const novato = createClient(server.baseUrl);
    await registerUser(novato);

    const lista = await novato.get("/api/learning/trails");
    assert.equal(lista.status, 200);
    assert.deepEqual(
      lista.body.trails.map((trail) => trail.id),
      [DEFAULT_TRAIL],
      "sem o fundacional feito, só ele aparece na lista",
    );

    assert.equal((await novato.get("/api/learning/path?trailId=italian")).status, 404);
    assert.equal((await novato.post("/api/learning/trails/italian/start", {})).status, 404);

    // O administrador continua a pré-visualizar tudo, feito o fundacional ou não.
    assert.ok((await admin.get("/api/learning/trails")).body.trails.some((t) => t.id === "italian"));
  });

  test("completar o fundacional destranca os trilhos especializados", async () => {
    const formado = createClient(server.baseUrl);
    const { id } = await registerUser(formado);

    assert.equal((await formado.get("/api/learning/path?trailId=italian")).status, 404);

    await completarFundacional(id);

    const lista = await formado.get("/api/learning/trails");
    assert.ok(lista.body.trails.some((trail) => trail.id === "italian"));
    assert.equal((await formado.get("/api/learning/path?trailId=italian")).status, 200);
    assert.equal((await formado.post("/api/learning/trails/italian/start", {})).status, 200);
  });
});
