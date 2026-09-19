import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { query } from "../db/index.js";
import {
  closeDatabase,
  createClient,
  publishRecipe,
  registerUser,
  resetDatabase,
  skipWithoutDatabase,
  startTestServer,
} from "./helpers.js";

/**
 * Administração: quem decide quem modera, e os números da aplicação.
 *
 * O papel nunca é atribuído por um atalho de teste que a aplicação não tenha:
 * o primeiro admin nasce como nasce em produção — por fora, com um UPDATE,
 * que é o que o `scripts/set-role.mjs` faz.
 */
describe("administração", skipWithoutDatabase, () => {
  let server;
  let admin;
  let moderador;
  let pessoa;
  let adminId;
  let moderadorId;
  let pessoaId;

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();

    admin = createClient(server.baseUrl);
    moderador = createClient(server.baseUrl);
    pessoa = createClient(server.baseUrl);

    adminId = (await registerUser(admin)).id;
    moderadorId = (await registerUser(moderador)).id;
    pessoaId = (await registerUser(pessoa)).id;

    await query(`UPDATE users SET role = 'admin' WHERE id = $1`, [adminId]);
    await query(`UPDATE users SET role = 'moderator' WHERE id = $1`, [moderadorId]);
  });

  /* -------------------------------------------------------------- *
   * A porta
   * -------------------------------------------------------------- */

  test("a administração é fechada a utilizadores e a moderadores", async () => {
    for (const cliente of [pessoa, moderador]) {
      assert.equal((await cliente.get("/api/admin/metrics")).status, 403);
      assert.equal((await cliente.get("/api/admin/users")).status, 403);
      assert.equal(
        (await cliente.patch(`/api/admin/users/${pessoaId}/role`, { role: "moderator" })).status,
        403,
      );
    }
  });

  test("o admin entra na fila de moderação — a escada vale para baixo", async () => {
    assert.equal((await admin.get("/api/moderation/reports")).status, 200);
    assert.equal((await moderador.get("/api/moderation/reports")).status, 200);
    assert.equal((await pessoa.get("/api/moderation/reports")).status, 403);
  });

  test("o admin apaga um comentário que não é dele nem da sua receita", async () => {
    const { recipe } = await publishRecipe(pessoa);
    const comentario = await moderador.post(`/api/recipes/${recipe.id}/comments`, {
      body: "qualquer coisa",
    });

    assert.equal(
      (await admin.delete(`/api/recipes/${recipe.id}/comments/${comentario.body.comment.id}`))
        .status,
      204,
    );
  });

  /* -------------------------------------------------------------- *
   * Papéis
   * -------------------------------------------------------------- */

  test("promover e despromover, com registo de quem o fez", async () => {
    const promover = await admin.patch(`/api/admin/users/${pessoaId}/role`, {
      role: "moderator",
    });
    assert.equal(promover.status, 200);
    assert.equal(promover.body.user.role, "moderator");

    // E o papel vale já: a fila abre-se-lhe sem voltar a entrar.
    assert.equal((await pessoa.get("/api/moderation/reports")).status, 200);

    const tirar = await admin.patch(`/api/admin/users/${pessoaId}/role`, { role: "user" });
    assert.equal(tirar.body.user.role, "user");
    assert.equal((await pessoa.get("/api/moderation/reports")).status, 403);

    const historial = await admin.get(`/api/admin/users/${pessoaId}/role-history`);
    assert.deepEqual(
      historial.body.changes.map((c) => `${c.from}→${c.to}`),
      ["moderator→user", "user→moderator"],
    );
    assert.equal(
      historial.body.changes[0].by,
      (await admin.get("/api/users/me")).body.user.username,
    );
  });

  test("o papel muda na base a cada pedido, e não no token de sessão", async () => {
    await query(`UPDATE users SET role = 'user' WHERE id = $1`, [moderadorId]);

    // A sessão é a mesma de antes da despromoção — e já não serve.
    assert.equal((await moderador.get("/api/moderation/reports")).status, 403);
  });

  test("nenhum admin nasce dentro da aplicação", async () => {
    const resposta = await admin.patch(`/api/admin/users/${pessoaId}/role`, { role: "admin" });
    assert.equal(resposta.status, 403);
    assert.match(resposta.body.error, /linha de comandos/);

    const { rows } = await query(`SELECT role FROM users WHERE id = $1`, [pessoaId]);
    assert.equal(rows[0].role, "user");
  });

  test("um admin não muda o seu próprio papel nem despromove outro admin", async () => {
    const eu = await admin.patch(`/api/admin/users/${adminId}/role`, { role: "user" });
    assert.equal(eu.status, 403);
    assert.match(eu.body.error, /próprio papel/);

    const outroAdmin = createClient(server.baseUrl);
    const outroId = (await registerUser(outroAdmin)).id;
    await query(`UPDATE users SET role = 'admin' WHERE id = $1`, [outroId]);

    const dele = await admin.patch(`/api/admin/users/${outroId}/role`, { role: "user" });
    assert.equal(dele.status, 403);
    assert.match(dele.body.error, /não se despromove/);
  });

  test("um papel que não existe é recusado com 400", async () => {
    assert.equal(
      (await admin.patch(`/api/admin/users/${pessoaId}/role`, { role: "chefe" })).status,
      400,
    );
  });

  test("promover quem já é moderador não escreve uma segunda linha no historial", async () => {
    await admin.patch(`/api/admin/users/${pessoaId}/role`, { role: "moderator" });
    await admin.patch(`/api/admin/users/${pessoaId}/role`, { role: "moderator" });

    const { rows } = await query(
      `SELECT count(*)::int AS n FROM role_changes WHERE target_id = $1`,
      [pessoaId],
    );
    assert.equal(rows[0].n, 1);
  });

  /* -------------------------------------------------------------- *
   * Contas
   * -------------------------------------------------------------- */

  test("a lista de contas traz o que decide uma promoção", async () => {
    await publishRecipe(pessoa);
    await moderador.post("/api/reports", {
      subjectType: "user",
      subjectId: pessoaId,
      reason: "spam",
    });

    const lista = await admin.get("/api/admin/users");
    const alvo = lista.body.users.find((u) => u.id === pessoaId);

    assert.equal(alvo.recipes, 1);
    assert.equal(alvo.reportsReceived, 1);
    assert.equal(alvo.role, "user");
    assert.equal(alvo.emailVerified, true);
  });

  test("a lista filtra por papel e procura por nome ou email", async () => {
    const comPapel = await admin.get("/api/admin/users?role=staff");
    assert.deepEqual(comPapel.body.users.map((u) => u.role).sort(), ["admin", "moderator"]);

    const so = await admin.get("/api/admin/users?role=moderator");
    assert.equal(so.body.users.length, 1);
    assert.equal(so.body.users[0].id, moderadorId);

    const username = (await pessoa.get("/api/users/me")).body.user.username;
    const porNome = await admin.get(`/api/admin/users?q=${username}`);
    assert.equal(porNome.body.users.length, 1);
    assert.equal(porNome.body.users[0].id, pessoaId);
  });

  /* -------------------------------------------------------------- *
   * Números
   * -------------------------------------------------------------- */

  test("os números saem das tabelas reais, sem contadores próprios", async () => {
    await publishRecipe(pessoa);
    await publishRecipe(moderador);
    await moderador.post("/api/reports", {
      subjectType: "user",
      subjectId: pessoaId,
      reason: "spam",
    });
    await pessoa.post(`/api/users/${moderadorId}/block`);

    const { metrics } = (await admin.get("/api/admin/metrics")).body;

    assert.equal(metrics.contas, 3);
    assert.equal(metrics.equipa, 2);
    assert.equal(metrics.receitas, 2);
    assert.equal(metrics.denunciasAbertas, 1);
    assert.equal(metrics.bloqueios, 1);
    // Duas publicações a 25 XP, e o livro-razão é a única fonte.
    assert.equal(metrics.xpDistribuido, 50);
    assert.equal(metrics.ativosUltimos7Dias, 2);
  });

  test("apagar a conta de quem promoveu não apaga o historial da promoção", async () => {
    await admin.patch(`/api/admin/users/${pessoaId}/role`, { role: "moderator" });
    await admin.delete("/api/users/me", {
      confirmUsername: (await admin.get("/api/users/me")).body.user.username,
      password: "Chef12345!",
    });

    const { rows } = await query(
      `SELECT actor_id, from_role, to_role FROM role_changes WHERE target_id = $1`,
      [pessoaId],
    );
    assert.equal(rows.length, 1);
    assert.equal(
      rows[0].actor_id,
      null,
      "o registo fica, sem apontar para uma conta que já não há",
    );
  });

  test("o papel vem em /users/me, e não no perfil público de ninguém", async () => {
    assert.equal((await admin.get("/api/users/me")).body.user.role, "admin");
    assert.equal((await pessoa.get(`/api/users/${adminId}`)).body.user.role, undefined);
  });

  /* -------------------------------------------------------------- *
   * Apagar contas
   * -------------------------------------------------------------- */

  async function nomeDe(id) {
    const { rows } = await query(`SELECT username FROM users WHERE id = $1`, [id]);
    return rows[0]?.username;
  }

  test("um admin apaga a conta de alguém, e tudo o que era dela vai junto", async () => {
    await publishRecipe(pessoa);
    const nome = await nomeDe(pessoaId);

    const resposta = await admin.delete(`/api/admin/users/${pessoaId}`, { confirmUsername: nome });
    assert.equal(resposta.status, 200);
    assert.equal(resposta.body.deleted.username, nome);

    const { rows: contas } = await query(`SELECT 1 FROM users WHERE id = $1`, [pessoaId]);
    assert.equal(contas.length, 0);
    const { rows: receitas } = await query(`SELECT 1 FROM recipes WHERE author_id = $1`, [
      pessoaId,
    ]);
    assert.equal(receitas.length, 0);

    // A sessão que ela tinha aberta deixa de valer.
    assert.equal((await pessoa.get("/api/auth/me")).status, 401);

    const { rows: registo } = await query(
      `SELECT deleted_username, deleted_role, actor_id FROM account_deletions`,
    );
    assert.deepEqual(registo, [
      { deleted_username: nome, deleted_role: "user", actor_id: adminId },
    ]);
  });

  test("um admin apaga um moderador", async () => {
    const resposta = await admin.delete(`/api/admin/users/${moderadorId}`, {
      confirmUsername: await nomeDe(moderadorId),
    });
    assert.equal(resposta.status, 200);
  });

  test("um admin não apaga outro admin nem a si próprio", async () => {
    const outroAdmin = createClient(server.baseUrl);
    const outroId = (await registerUser(outroAdmin)).id;
    await query(`UPDATE users SET role = 'admin' WHERE id = $1`, [outroId]);

    const dele = await admin.delete(`/api/admin/users/${outroId}`, {
      confirmUsername: await nomeDe(outroId),
    });
    assert.equal(dele.status, 403);
    assert.match(dele.body.error, /não se apaga/);

    const eu = await admin.delete(`/api/admin/users/${adminId}`, {
      confirmUsername: await nomeDe(adminId),
    });
    assert.equal(eu.status, 403);
    assert.match(eu.body.error, /perfil/);

    const { rows } = await query(`SELECT count(*)::int AS n FROM users WHERE id = ANY($1)`, [
      [outroId, adminId],
    ]);
    assert.equal(rows[0].n, 2);
  });

  test("moderadores e utilizadores não apagam contas", async () => {
    const nome = await nomeDe(pessoaId);
    for (const cliente of [moderador, pessoa]) {
      const resposta = await cliente.delete(`/api/admin/users/${pessoaId}`, {
        confirmUsername: nome,
      });
      assert.equal(resposta.status, 403);
    }
    assert.equal(await nomeDe(pessoaId), nome);
  });

  test("sem o nome certo, a conta fica", async () => {
    const resposta = await admin.delete(`/api/admin/users/${pessoaId}`, {
      confirmUsername: "outra.pessoa",
    });
    assert.equal(resposta.status, 400);
    assert.ok(await nomeDe(pessoaId));

    const { rows } = await query(`SELECT count(*)::int AS n FROM account_deletions`);
    assert.equal(rows[0].n, 0);
  });

  test("uma conta que não existe dá 404", async () => {
    const resposta = await admin.delete(`/api/admin/users/00000000-0000-0000-0000-000000000000`, {
      confirmUsername: "ninguem",
    });
    assert.equal(resposta.status, 404);
  });
});
