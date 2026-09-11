import test, { beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { query } from "../db/index.js";
import { MAX_ATTEMPTS } from "../domain/accountCodes.js";
import {
  createClient,
  lastCodeFor,
  outbox,
  resetDatabase,
  skipWithoutDatabase,
  useServer,
} from "./harness.js";

const origin = useServer();

describe("confirmar a conta", { skip: skipWithoutDatabase }, () => {
  let client;

  beforeEach(async () => {
    await resetDatabase();
    client = createClient(origin);
  });

  test("registar envia um código e a conta entra logo", async () => {
    await client.get("/api/auth/csrf");
    const response = await client.post("/api/auth/register", {
      username: "novata",
      email: "novata@example.com",
      password: "password-de-teste",
    });

    assert.equal(response.status, 201);
    assert.equal(response.data.needsEmailConfirmation, true);
    assert.equal(response.data.user.emailVerified, false);

    // A conta funciona por confirmar: o código prova o endereço, não guarda
    // a porta.
    assert.equal((await client.get("/api/feed")).status, 200);
    assert.ok(lastCodeFor("novata@example.com"), "devia ter saído um código");
  });

  test("o código nunca fica em claro na base de dados", async () => {
    const user = await client.register("guardada");
    const code = lastCodeFor(user.email);

    const rows = await query(`SELECT code_hash FROM email_codes WHERE user_id = $1`, [user.id]);
    assert.equal(rows.rowCount, 1);
    assert.notEqual(rows.rows[0].code_hash, code);
    assert.match(rows.rows[0].code_hash, /^[0-9a-f]{64}$/);
  });

  test("o código certo confirma a conta", async () => {
    const user = await client.register("confirmada");
    const code = lastCodeFor(user.email);

    const response = await client.post("/api/auth/verify", { code });
    assert.equal(response.status, 200);
    assert.equal(response.data.user.emailVerified, true);

    const rows = await query(`SELECT email_verified_at FROM users WHERE id = $1`, [user.id]);
    assert.notEqual(rows.rows[0].email_verified_at, null);
  });

  test("o mesmo código não serve duas vezes", async () => {
    const user = await client.register("repetente");
    const code = lastCodeFor(user.email);

    await client.post("/api/auth/verify", { code });
    const segunda = await client.post("/api/auth/verify", { code });
    assert.equal(segunda.status, 400);
  });

  test("um código errado é recusado sem dizer porquê", async () => {
    const user = await client.register("enganada");
    const certo = lastCodeFor(user.email);
    const errado = certo === "000000" ? "111111" : "000000";

    const response = await client.post("/api/auth/verify", { code: errado });
    assert.equal(response.status, 400);
    // A mesma mensagem de um código expirado ou inexistente: distingui-las
    // dizia a quem adivinha se vale a pena insistir.
    assert.match(response.data.error, /inválido ou expirado/i);
  });

  test("ao fim de cinco tentativas nem o código certo entra", async () => {
    const user = await client.register("forcada");
    const certo = lastCodeFor(user.email);
    const errado = certo === "000000" ? "111111" : "000000";

    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      await client.post("/api/auth/verify", { code: errado });
    }

    // Seis dígitos são cem mil hipóteses; é o limite que faz disto um segredo.
    const response = await client.post("/api/auth/verify", { code: certo });
    assert.equal(response.status, 400);

    const rows = await query(`SELECT email_verified_at FROM users WHERE id = $1`, [user.id]);
    assert.equal(rows.rows[0].email_verified_at, null);
  });

  test("um código expirado não vale, nem estando certo", async () => {
    const user = await client.register("atrasada");
    const code = lastCodeFor(user.email);

    await query(`UPDATE email_codes SET expires_at = now() - interval '1 minute'
                  WHERE user_id = $1`, [user.id]);

    const response = await client.post("/api/auth/verify", { code });
    assert.equal(response.status, 400);
  });

  test("pedir outro código logo a seguir é travado", async () => {
    await client.register("ansiosa");

    const response = await client.post("/api/auth/verify/request");
    assert.equal(response.status, 429);
    assert.ok(response.data.retryAfter > 0);
  });

  test("passado o intervalo, o código novo invalida o anterior", async () => {
    const user = await client.register("paciente");
    const antigo = lastCodeFor(user.email);

    await query(`UPDATE email_codes SET created_at = now() - interval '5 minutes'
                  WHERE user_id = $1`, [user.id]);

    const pedido = await client.post("/api/auth/verify/request");
    assert.equal(pedido.status, 200);

    const novo = lastCodeFor(user.email);
    assert.notEqual(novo, antigo);

    // Dois códigos vivos ao mesmo tempo duplicavam as hipóteses de quem adivinha.
    assert.equal((await client.post("/api/auth/verify", { code: antigo })).status, 400);
    assert.equal((await client.post("/api/auth/verify", { code: novo })).status, 200);
  });

  test("quem já está confirmado não recebe mais códigos", async () => {
    const user = await client.register("feita");
    await client.post("/api/auth/verify", { code: lastCodeFor(user.email) });
    outbox.length = 0;

    const response = await client.post("/api/auth/verify/request");
    assert.equal(response.data.alreadyVerified, true);
    assert.equal(outbox.length, 0);
  });
});

describe("recuperar a password", { skip: skipWithoutDatabase }, () => {
  let client;
  let user;

  beforeEach(async () => {
    await resetDatabase();
    client = createClient(origin);
    user = await client.register("esquecida");
    outbox.length = 0;
  });

  test("pedir o código responde o mesmo exista ou não a conta", async () => {
    const anonimo = createClient(origin);
    await anonimo.get("/api/auth/csrf");

    const existe = await anonimo.post("/api/auth/password/forgot", { email: user.email });
    const naoExiste = await anonimo.post("/api/auth/password/forgot", {
      email: "ninguem@example.com",
    });

    // Distingui-las transformava esta rota num verificador de emails registados.
    assert.equal(existe.status, naoExiste.status);
    assert.deepEqual(existe.data, naoExiste.data);

    assert.ok(lastCodeFor(user.email));
    assert.equal(lastCodeFor("ninguem@example.com"), null);
  });

  test("o código define a password nova e a antiga deixa de entrar", async () => {
    const anonimo = createClient(origin);
    await anonimo.get("/api/auth/csrf");
    await anonimo.post("/api/auth/password/forgot", { email: user.email });

    const reset = await anonimo.post("/api/auth/password/reset", {
      email: user.email,
      code: lastCodeFor(user.email),
      password: "password-novinha",
    });
    assert.equal(reset.status, 200);

    const antiga = await anonimo.post("/api/auth/login", {
      email: user.email,
      password: "password-de-teste",
    });
    assert.equal(antiga.status, 401);

    const nova = await anonimo.post("/api/auth/login", {
      email: user.email,
      password: "password-novinha",
    });
    assert.equal(nova.status, 200);
  });

  test("recuperar a password expulsa as sessões que já estavam abertas", async () => {
    // É o ponto todo da recuperação: quem tenha entrado na conta sai dela.
    assert.equal((await client.get("/api/feed")).status, 200);

    const anonimo = createClient(origin);
    await anonimo.get("/api/auth/csrf");
    await anonimo.post("/api/auth/password/forgot", { email: user.email });
    await anonimo.post("/api/auth/password/reset", {
      email: user.email,
      code: lastCodeFor(user.email),
      password: "password-novinha",
    });

    assert.equal((await client.get("/api/feed")).status, 401);
  });

  test("recuperar a password também confirma o email", async () => {
    // Receber o código no endereço prova que é dela tanto como o de registo.
    const anonimo = createClient(origin);
    await anonimo.get("/api/auth/csrf");
    await anonimo.post("/api/auth/password/forgot", { email: user.email });
    await anonimo.post("/api/auth/password/reset", {
      email: user.email,
      code: lastCodeFor(user.email),
      password: "password-novinha",
    });

    const rows = await query(`SELECT email_verified_at FROM users WHERE id = $1`, [user.id]);
    assert.notEqual(rows.rows[0].email_verified_at, null);
  });

  test("um código de confirmação não serve para recuperar a password", async () => {
    // Os propósitos não se misturam: um código pedido para confirmar o email
    // não pode valer para trocar a password.
    const codigoDeConfirmacao = lastCodeFor(user.email) ?? "000000";

    const anonimo = createClient(origin);
    await anonimo.get("/api/auth/csrf");
    const response = await anonimo.post("/api/auth/password/reset", {
      email: user.email,
      code: codigoDeConfirmacao,
      password: "password-novinha",
    });

    assert.equal(response.status, 400);
  });

  test("uma password curta de mais é recusada", async () => {
    const anonimo = createClient(origin);
    await anonimo.get("/api/auth/csrf");
    await anonimo.post("/api/auth/password/forgot", { email: user.email });

    const response = await anonimo.post("/api/auth/password/reset", {
      email: user.email,
      code: lastCodeFor(user.email),
      password: "curta",
    });
    assert.equal(response.status, 400);
  });
});

describe("mudar a password autenticado", { skip: skipWithoutDatabase }, () => {
  let client;
  let user;

  beforeEach(async () => {
    await resetDatabase();
    client = createClient(origin);
    user = await client.register("atenta");
  });

  test("é preciso saber a password actual", async () => {
    // Sem isto, um computador deixado aberto trancava o dono fora da conta.
    const response = await client.post("/api/auth/password", {
      currentPassword: "palpite-errado",
      password: "password-novinha",
    });
    assert.equal(response.status, 403);
  });

  test("com a password actual certa, muda", async () => {
    const response = await client.post("/api/auth/password", {
      currentPassword: "password-de-teste",
      password: "password-novinha",
    });
    assert.equal(response.status, 200);

    const anonimo = createClient(origin);
    await anonimo.get("/api/auth/csrf");
    const login = await anonimo.post("/api/auth/login", {
      email: user.email,
      password: "password-novinha",
    });
    assert.equal(login.status, 200);
  });

  test("quem muda a password não é expulso, mas as outras sessões caem", async () => {
    const outraSessao = createClient(origin);
    await outraSessao.get("/api/auth/csrf");
    await outraSessao.post("/api/auth/login", {
      email: user.email,
      password: "password-de-teste",
    });
    assert.equal((await outraSessao.get("/api/feed")).status, 200);

    await client.post("/api/auth/password", {
      currentPassword: "password-de-teste",
      password: "password-novinha",
    });

    assert.equal((await client.get("/api/feed")).status, 200, "a sessão que mudou continua");
    assert.equal((await outraSessao.get("/api/feed")).status, 401, "as outras saem");
  });

  test("uma conta sem password define a primeira sem provar nenhuma", async () => {
    // É o caso de quem entrou pela Google: não há password actual para provar.
    await query(`UPDATE users SET password_hash = NULL WHERE id = $1`, [user.id]);

    const response = await client.post("/api/auth/password", { password: "password-primeira" });
    assert.equal(response.status, 200);
    assert.equal(response.data.user.hasPassword, true);
  });

  test("a password nova vai cifrada para a base", async () => {
    await client.post("/api/auth/password", {
      currentPassword: "password-de-teste",
      password: "password-novinha",
    });

    const rows = await query(`SELECT password_hash FROM users WHERE id = $1`, [user.id]);
    assert.notEqual(rows.rows[0].password_hash, "password-novinha");
    assert.match(rows.rows[0].password_hash, /^\$2[aby]\$/);
  });
});
