import test, { after, afterEach, before, describe } from "node:test";
import assert from "node:assert/strict";
import { query } from "../db/index.js";
import {
  closeDatabase,
  createClient,
  lastEmail,
  outbox,
  registerUser,
  skipWithoutDatabase,
  startTestServer,
} from "./helpers.js";

/**
 * Recuperação de password e verificação de email, de ponta a ponta.
 *
 * O token nunca é lido da base de dados: sai do link que está no email, como
 * sairia para uma pessoa. Um teste que fosse buscar o token à tabela passaria
 * na mesma com um email que levasse o link errado.
 */
describe("recuperação de password", skipWithoutDatabase, () => {
  let server;
  let client;
  let utilizador;

  before(async () => {
    server = await startTestServer();
    client = server.client;
    utilizador = await registerUser(client, { password: "Password-antiga1" });
    // Sessão fechada: quem recupera a password não está autenticado.
    await client.post("/api/auth/logout");
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  afterEach(() => {
    outbox.length = 0;
  });

  /** Pede o link e devolve o token que chegou ao email. */
  async function pedirLink(email = utilizador.email) {
    const resposta = await client.post("/api/auth/forgot-password", { email });
    assert.equal(resposta.status, 200);
    return lastEmail()?.token ?? null;
  }

  test("o ecrã de entrada sabe que a recuperação existe", async () => {
    const { body } = await client.get("/api/auth/providers");
    assert.equal(body.passwordRecovery, true);
  });

  test("pedir o link manda um email com um token", async () => {
    const token = await pedirLink();

    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].to, utilizador.email);
    assert.match(outbox[0].subject, /password/i);
    assert.match(token, /^[0-9a-f]{64}$/);
    assert.match(lastEmail().link, /^http:\/\/localhost:5173\/reset-password\?token=/);
  });

  test("um email desconhecido recebe a mesma resposta e nenhum email", async () => {
    const resposta = await client.post("/api/auth/forgot-password", {
      email: "ninguem@chef-xp.test",
    });

    assert.equal(resposta.status, 200);
    assert.deepEqual(resposta.body, { ok: true });
    assert.equal(outbox.length, 0);
  });

  test("uma conta de SSO não recebe link nenhum — não tem password para redefinir", async () => {
    await query(`INSERT INTO users (username, email, password_hash) VALUES ($1, $2, NULL)`, [
      "sopelagoogle",
      "sso@chef-xp.test",
    ]);

    const resposta = await client.post("/api/auth/forgot-password", {
      email: "sso@chef-xp.test",
    });

    assert.equal(resposta.status, 200);
    assert.equal(outbox.length, 0);
  });

  test("o token do email redefine a password", async () => {
    const token = await pedirLink();

    const resposta = await client.post("/api/auth/reset-password", {
      token,
      password: "Password-nova-1!",
    });
    assert.equal(resposta.status, 200);

    const antiga = await client.post("/api/auth/login", {
      email: utilizador.email,
      password: "Password-antiga1",
    });
    assert.equal(antiga.status, 401);

    const nova = await client.post("/api/auth/login", {
      email: utilizador.email,
      password: "Password-nova-1!",
    });
    assert.equal(nova.status, 200);
    await client.post("/api/auth/logout");
  });

  test("redefinir confirma o email de caminho — quem o leu, leu-o", async () => {
    const token = await pedirLink();
    await client.post("/api/auth/reset-password", { token, password: "Password-nova-2!" });

    const { rows } = await query(`SELECT email_verified_at FROM users WHERE id = $1`, [
      utilizador.id,
    ]);
    assert.notEqual(rows[0].email_verified_at, null);
  });

  test("o mesmo token não serve duas vezes", async () => {
    const token = await pedirLink();
    await client.post("/api/auth/reset-password", { token, password: "Password-nova-3!" });

    const segunda = await client.post("/api/auth/reset-password", {
      token,
      password: "Outra-qualquer1",
    });
    assert.equal(segunda.status, 400);
  });

  test("pedir outro link invalida o anterior", async () => {
    const primeiro = await pedirLink();
    outbox.length = 0;
    const segundo = await pedirLink();

    assert.notEqual(primeiro, segundo);

    const velho = await client.post("/api/auth/reset-password", {
      token: primeiro,
      password: "Password-nova-4!",
    });
    assert.equal(velho.status, 400);

    const novo = await client.post("/api/auth/reset-password", {
      token: segundo,
      password: "Password-nova-4!",
    });
    assert.equal(novo.status, 200);
  });

  test("um token expirado é recusado", async () => {
    const token = await pedirLink();
    await query(`UPDATE auth_tokens SET expires_at = now() - interval '1 minute'`);

    const resposta = await client.post("/api/auth/reset-password", {
      token,
      password: "Password-nova-5!",
    });
    assert.equal(resposta.status, 400);
    assert.match(resposta.body.error, /[Ii]nvalid or expired/);
  });

  test("um token inventado é recusado sem dizer porquê", async () => {
    const resposta = await client.post("/api/auth/reset-password", {
      token: "f".repeat(64),
      password: "Password-nova-6!",
    });
    assert.equal(resposta.status, 400);
    assert.match(resposta.body.error, /[Ii]nvalid or expired/);
  });

  test("uma password curta é recusada e o token continua a valer", async () => {
    const token = await pedirLink();

    const curta = await client.post("/api/auth/reset-password", { token, password: "abc" });
    assert.equal(curta.status, 400);

    const boa = await client.post("/api/auth/reset-password", {
      token,
      password: "Password-nova-7!",
    });
    assert.equal(boa.status, 200);
  });

  test("o token guardado na base não é o token do email", async () => {
    const token = await pedirLink();
    const { rows } = await query(`SELECT token_hash FROM auth_tokens WHERE kind = $1`, [
      "password_reset",
    ]);

    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].token_hash, token);
  });
});

describe("verificação de email", skipWithoutDatabase, () => {
  let server;
  let client;
  let utilizador;

  before(async () => {
    server = await startTestServer();
    client = server.client;
    utilizador = await registerUser(client);
  });

  after(async () => {
    await server.close();
    await closeDatabase();
  });

  afterEach(() => {
    outbox.length = 0;
  });

  test("uma conta criada pelo link já nasce confirmada", async () => {
    // O endereço foi provado antes de a conta existir: pedir a confirmação
    // outra vez não teria o que confirmar.
    const { body } = await client.get("/api/auth/me");
    assert.equal(body.user.emailVerified, true);

    const resposta = await client.post("/api/auth/verify-email/send");
    assert.equal(resposta.status, 409);
  });

  test("pedir a confirmação manda o email com o link", async () => {
    // Por confirmar ficam as contas anteriores a este fluxo, as criadas sem
    // SMTP e as que mudarem de endereço. É esse o caso que se prova daqui
    // para baixo.
    await query(`UPDATE users SET email_verified_at = NULL WHERE id = $1`, [utilizador.id]);

    const resposta = await client.post("/api/auth/verify-email/send");
    assert.equal(resposta.status, 200);
    assert.equal(outbox[0].to, utilizador.email);
    assert.match(lastEmail().link, /\/verify-email\?token=/);
  });

  test("é preciso sessão para pedir a confirmação", async () => {
    const anonimo = createClient(server.baseUrl);
    const resposta = await anonimo.post("/api/auth/verify-email/send");
    assert.equal(resposta.status, 401);
  });

  test("o link confirma o email, e abri-lo outra vez não dá erro", async () => {
    await client.post("/api/auth/verify-email/send");
    const token = lastEmail().token;

    // Sem sessão de propósito: o email costuma abrir-se noutro dispositivo.
    const anonimo = createClient(server.baseUrl);

    const primeira = await anonimo.post("/api/auth/verify-email", { token });
    assert.equal(primeira.status, 200);
    assert.equal(primeira.body.alreadyVerified, false);

    // O React monta o ecrã duas vezes em desenvolvimento, e há clientes de
    // email que seguem os links por si.
    const segunda = await anonimo.post("/api/auth/verify-email", { token });
    assert.equal(segunda.status, 200);
    assert.equal(segunda.body.alreadyVerified, true);

    const { body } = await client.get("/api/auth/me");
    assert.equal(body.user.emailVerified, true);
  });

  test("quem já confirmou não pede outra vez", async () => {
    const resposta = await client.post("/api/auth/verify-email/send");
    assert.equal(resposta.status, 409);
    assert.equal(outbox.length, 0);
  });

  test("um token de recuperação não confirma o email", async () => {
    const outro = createClient(server.baseUrl);
    const outroUtilizador = await registerUser(outro, { username: "outrochef" });
    await query(`UPDATE users SET email_verified_at = NULL WHERE id = $1`, [outroUtilizador.id]);
    await outro.post("/api/auth/logout");

    const utilizadorDoOutro = (
      await query(`SELECT email FROM users WHERE username = $1`, ["outrochef"])
    ).rows[0];

    await outro.post("/api/auth/forgot-password", { email: utilizadorDoOutro.email });
    const tokenDeRecuperacao = lastEmail().token;

    const resposta = await outro.post("/api/auth/verify-email", { token: tokenDeRecuperacao });
    assert.equal(resposta.status, 400);
  });
});
