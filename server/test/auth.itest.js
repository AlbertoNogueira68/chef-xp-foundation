import test, { beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { query } from "../db/index.js";
import { createClient, resetDatabase, skipWithoutDatabase, useServer } from "./harness.js";

const origin = useServer();

describe("sessão e CSRF", { skip: skipWithoutDatabase }, () => {
  let client;

  beforeEach(async () => {
    await resetDatabase();
    client = createClient(origin);
  });

  test("o registo devolve o utilizador sem a password", async () => {
    const user = await client.register("nova");

    assert.equal(user.username, "nova");
    assert.equal(user.email, "nova@example.com");
    assert.ok(!("passwordHash" in user), "o hash nunca sai do servidor");
    assert.ok(!("password_hash" in user));
  });

  test("a password vai para a base cifrada", async () => {
    await client.register("cifrada");
    const rows = await query(`SELECT password_hash FROM users WHERE username = 'cifrada'`);

    assert.notEqual(rows.rows[0].password_hash, "password-de-teste");
    assert.match(rows.rows[0].password_hash, /^\$2[aby]\$/);
  });

  test("registar e entrar acontecem antes de existir token de CSRF", async () => {
    // Decisão deliberada: sem cookie de sessão não há autoridade ambiente para
    // roubar, e exigir o token aqui impedia o primeiro pedido de todos.
    const virgem = createClient(origin);
    const response = await virgem.post("/api/auth/register", {
      username: "semtoken",
      email: "semtoken@example.com",
      password: "password-de-teste",
    });
    assert.equal(response.status, 201);
  });

  test("um pedido mutante autenticado sem o header de CSRF leva 403", async () => {
    await client.register("protegida");

    // O cookie de sessão viaja na mesma; o que falta é a prova de que o pedido
    // partiu da nossa página e não de outra.
    const response = await fetch(`${origin()}/api/recipes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: [...client.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; "),
      },
      body: JSON.stringify({
        title: "Receita forjada",
        description: "vinda de outro sítio qualquer",
        ingredients: "x, y",
        cookTimeMin: 10,
        difficulty: "facil",
      }),
    });

    assert.equal(response.status, 403);
    const rows = await query(`SELECT 1 FROM recipes`);
    assert.equal(rows.rowCount, 0);
  });

  test("um token de CSRF que não bate certo com o cookie é recusado", async () => {
    await client.register("desalinhada");

    const response = await fetch(`${origin()}/api/recipes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": "a".repeat(64),
        Cookie: [...client.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; "),
      },
      body: JSON.stringify({
        title: "Outra forjada",
        description: "com um token inventado",
        ingredients: "x, y",
        cookTimeMin: 10,
        difficulty: "facil",
      }),
    });

    assert.equal(response.status, 403);
  });

  test("sem sessão, as rotas protegidas respondem 401", async () => {
    const anonimo = createClient(origin);
    assert.equal((await anonimo.get("/api/feed")).status, 401);
    assert.equal((await anonimo.get("/api/plan")).status, 401);
    assert.equal((await anonimo.get("/api/missions")).status, 401);
  });

  test("terminar sessão fecha mesmo o acesso", async () => {
    await client.register("saiu");
    assert.equal((await client.get("/api/feed")).status, 200);

    await client.post("/api/auth/logout");
    assert.equal((await client.get("/api/feed")).status, 401);
  });

  test("o mesmo email não regista duas contas", async () => {
    await client.register("repetida");

    const outro = createClient(origin);
    await outro.get("/api/auth/csrf");
    const response = await outro.post("/api/auth/register", {
      username: "outronome",
      email: "repetida@example.com",
      password: "password-de-teste",
    });

    assert.equal(response.status, 409);
  });

  test("credenciais erradas não dizem qual dos dois campos falhou", async () => {
    await client.register("discreta");

    const outro = createClient(origin);
    await outro.get("/api/auth/csrf");
    const semConta = await outro.post("/api/auth/login", {
      email: "naoexiste@example.com",
      password: "password-de-teste",
    });
    const passwordMa = await outro.post("/api/auth/login", {
      email: "discreta@example.com",
      password: "password-errada",
    });

    // A mesma resposta nos dois casos: distingui-los dizia a um atacante que
    // endereços existem.
    assert.equal(semConta.status, 401);
    assert.equal(passwordMa.status, 401);
    assert.equal(semConta.data.error, passwordMa.data.error);
  });

  test("o limitador de registos existe e dispara", async () => {
    // O comentário no `auth.js` diz que o limitador corre em teste como em
    // produção. Este é o teste que o prova, e não vale nada se não esgotar.
    const rajada = createClient(origin);
    await rajada.get("/api/auth/csrf");

    let bloqueado = null;
    for (let i = 0; i < 12 && bloqueado === null; i += 1) {
      const response = await rajada.post("/api/auth/register", {
        username: `rajada${i}`,
        email: `rajada${i}@example.com`,
        password: "password-de-teste",
      });
      if (response.status === 429) bloqueado = i;
    }

    assert.equal(bloqueado, 10, "o 11.º registo é que devia ser travado");
  });
});
