import "dotenv/config";
import { createApp } from "../app.js";
import { closePool, getPool, query } from "../db/index.js";
import { runMigrations } from "../db/runMigrations.js";
import { syncCurriculum } from "../scripts/sync-curriculum.js";

/**
 * Testes de integração: a API de verdade, contra uma base de dados de verdade.
 *
 * Os testes de domínio (`xp`, `curriculum`, `missions`) provam as regras puras.
 * Estes provam o que só existe quando tudo está ligado: o CSRF, o cookie de
 * sessão, os códigos de estado, as transações e o livro-razão. Foi por não
 * haver nenhum destes que o `\n` do seed e o `patchRecipeEverywhere` chegaram
 * tão longe.
 *
 * Sem `DATABASE_URL` os testes saltam em vez de falhar, para quem clona o
 * repositório poder correr `npm test` sem levantar um Postgres. No CI a base
 * existe sempre, portanto lá correm mesmo.
 */
export const hasDatabase = Boolean(process.env.DATABASE_URL);

export const skipWithoutDatabase = hasDatabase
  ? {}
  : { skip: "sem DATABASE_URL — levanta um Postgres para correr os testes de integração" };

/** Tabelas que cada teste limpa. A ordem não importa: é um TRUNCATE em cascata. */
const TABLES = [
  "notifications",
  "challenge_entries",
  "comments",
  "recipe_likes",
  "follows",
  "xp_events",
  "daily_activity",
  "lesson_progress",
  "skill_practice",
  "mission_events",
  "mission_checkpoints",
  "mission_runs",
  "recipes",
  "challenges",
  "auth_identities",
  "users",
];

let migrated = false;

/**
 * Recusa-se a correr contra uma base que não seja de teste.
 *
 * Isto existe porque aconteceu: correr a bateria com `DATABASE_URL` a apontar
 * para a base de desenvolvimento apagou os dados de demonstração — o
 * `resetDatabase` faz TRUNCATE em tudo, e faz o que promete. Um teste
 * destrutivo não deve depender de quem o corre se lembrar de trocar a variável.
 *
 * A regra é o nome da base: tem de conter "test". Em CI a base chama-se
 * `chef_xp` mas `CI=true` está sempre definido, e aí é seguro — o Postgres do
 * workflow é descartável.
 */
function exigirBaseDeTeste() {
  const url = process.env.DATABASE_URL ?? "";
  if (process.env.CI === "true" || process.env.ALLOW_DESTRUCTIVE_TESTS === "true") return;

  // O nome da base é o último segmento do caminho, sem query string.
  const nome = decodeURIComponent(url.split("?")[0].split("/").pop() ?? "");

  if (!/test/i.test(nome)) {
    throw new Error(
      `Os testes de integração apagam as tabelas todas e a base "${nome}" não parece ser de teste.\n` +
        `Aponta DATABASE_URL para uma base cujo nome contenha "test" (por exemplo chef_xp_test),\n` +
        `ou define ALLOW_DESTRUCTIVE_TESTS=true se é mesmo isso que queres.`,
    );
  }
}

/**
 * Levanta a API numa porta efémera e devolve um cliente já ligado a ela.
 * Cada chamada começa com a base vazia.
 */
export async function startTestServer() {
  exigirBaseDeTeste();

  process.env.JWT_SECRET ||= "segredo-de-teste-com-mais-de-32-caracteres";
  process.env.NODE_ENV = "test";
  // Uma bateria de testes faz mais pedidos do que o limite normal permite.
  process.env.RATE_LIMIT_MAX ||= "100000";
  process.env.RATE_LIMIT_AUTH_MAX ||= "100000";

  if (!migrated) {
    await runMigrations();
    await syncCurriculum(getPool());
    migrated = true;
  }

  await resetDatabase();

  const server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    client: createClient(`http://127.0.0.1:${port}`),
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

export async function resetDatabase() {
  await query(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);
}

export async function closeDatabase() {
  await closePool();
}

/**
 * Um cliente HTTP com o que o browser faz por si: guarda cookies e reenvia-os,
 * e põe o cabeçalho de CSRF a partir do cookie. Sem isto cada teste teria de
 * repetir a dança do double-submit.
 */
export function createClient(baseUrl) {
  const cookies = new Map();

  const readSetCookie = (response) => {
    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const index = pair.indexOf("=");
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (value === "") cookies.delete(name);
      else cookies.set(name, value);
    }
  };

  const cookieHeader = () =>
    [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");

  async function request(method, path, body, options = {}) {
    const headers = new Headers(options.headers);
    if (cookies.size) headers.set("Cookie", cookieHeader());

    if (method !== "GET" && method !== "HEAD" && !options.omitCsrf) {
      if (!cookies.has("csrf")) await request("GET", "/api/auth/csrf");
      headers.set("X-CSRF-Token", cookies.get("csrf") ?? "");
      headers.set("Cookie", cookieHeader());
    }

    if (body !== undefined) headers.set("Content-Type", "application/json");

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    readSetCookie(response);

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    return { status: response.status, body: data, headers: response.headers };
  }

  return {
    get: (path, options) => request("GET", path, undefined, options),
    post: (path, body, options) => request("POST", path, body, options),
    patch: (path, body, options) => request("PATCH", path, body, options),
    // DELETE com corpo não é comum, mas `DELETE /users/me` precisa dele: a
    // confirmação do nome e a password viajam no corpo, não no URL, para não
    // ficarem em registos de servidor nem no histórico do browser.
    delete: (path, body, options) => request("DELETE", path, body, options),
    cookies,
    /** Esquece a sessão sem falar com o servidor — simula outro browser. */
    forget: () => cookies.clear(),
  };
}

/** Regista e deixa a sessão aberta. Devolve o utilizador criado. */
export async function registerUser(client, overrides = {}) {
  const suffix = Math.random().toString(36).slice(2, 8);
  const payload = {
    email: `${suffix}@chef-xp.test`,
    password: "chef12345",
    username: `chef${suffix}`,
    ...overrides,
  };

  const response = await client.post("/api/auth/register", payload);
  if (response.status !== 201 && response.status !== 200) {
    throw new Error(`registo falhou: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return { ...response.body.user, password: payload.password, email: payload.email };
}

/** Uma receita publicada pelo utilizador da sessão atual. */
export async function publishRecipe(client, overrides = {}) {
  const response = await client.post("/api/recipes", {
    title: "Arroz de tomate",
    description: "Tomate maduro, arroz solto e nada mais.",
    ingredients: "arroz\ntomate\ncebola",
    cookTimeMin: 25,
    difficulty: "facil",
    ...overrides,
  });
  if (response.status !== 201) {
    throw new Error(`publicação falhou: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body;
}

/** Um desafio a decorrer, criado diretamente porque não há rota que os crie. */
export async function createChallenge({ xpReward = 100, endsInDays = 7 } = {}) {
  const { rows } = await query(
    `INSERT INTO challenges (title, description, xp_reward, ends_at)
     VALUES ($1, $2, $3, now() + ($4 || ' days')::interval)
     RETURNING id, xp_reward, ends_at`,
    ["Desafio de teste", "Um desafio criado por um teste.", xpReward, String(endsInDays)],
  );
  return rows[0];
}
