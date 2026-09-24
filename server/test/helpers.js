import "dotenv/config";
import { createApp } from "../app.js";
import { closePool, getPool, query } from "../db/index.js";
import { runMigrations } from "../db/runMigrations.js";
import { syncCurriculum } from "../scripts/sync-curriculum.js";
import { setMailTransport } from "../lib/mailer.js";

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

/**
 * Caixa de saída dos testes.
 *
 * O transporte de email é substituído por este: os fluxos de recuperação e de
 * verificação correm inteiros — token, email, link — sem abrir uma ligação
 * SMTP nem mandar correio a ninguém. Ler o link daqui é o que permite testar
 * o resgate de ponta a ponta, em vez de ir buscar o token à base de dados
 * (que provaria que o teste sabe SQL, não que o email leva o link certo).
 */
export const outbox = [];

/** O último email enviado, e o primeiro link que ele contém. */
export function lastEmail() {
  const mail = outbox[outbox.length - 1];
  if (!mail) return null;
  const match = String(mail.text).match(/https?:\/\/\S+/);
  return {
    ...mail,
    link: match ? match[0] : null,
    token: match ? new URL(match[0]).searchParams.get("token") : null,
  };
}

/** Tabelas que cada teste limpa. A ordem não importa: é um TRUNCATE em cascata. */
const TABLES = [
  "account_deletions",
  "role_changes",
  "reports",
  "user_blocks",
  "auth_tokens",
  "pending_signups",
  "notifications",
  "challenge_results",
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
 * `TRUNCATE users … CASCADE` arrasta `trails` com ele — o Postgres leva
 * consigo tudo o que tenha uma chave estrangeira para a tabela truncada, e
 * `trails.published_by` é uma. Sem isto, o primeiro reset apagava os trilhos
 * semeados pela migração e todos os testes seguintes corriam sem nenhum.
 */
let trilhosSemente = [];

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
  process.env.RATE_LIMIT_MAIL_MAX ||= "100000";

  // Credenciais de fachada: `isMailConfigured()` tem de dizer que sim para as
  // rotas existirem, mas nada nestes valores chega a ser usado — o transporte
  // abaixo substitui o nodemailer inteiro.
  process.env.SMTP_USER ||= "testes@chef-xp.test";
  process.env.SMTP_PASSWORD ||= "password-de-teste";
  process.env.FRONTEND_URL ||= "http://localhost:5173";

  setMailTransport({
    async sendMail(message) {
      outbox.push(message);
      return { messageId: `teste-${outbox.length}` };
    },
  });

  if (!migrated) {
    await runMigrations();
    await syncCurriculum(getPool());
    ({ rows: trilhosSemente } = await query(`SELECT * FROM trails ORDER BY order_index`));
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
  outbox.length = 0;
  await query(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);

  for (const trilho of trilhosSemente) {
    await query(
      `INSERT INTO trails (id, name, description, icon, color, difficulty,
                           published_at, order_index)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [
        trilho.id,
        trilho.name,
        trilho.description,
        trilho.icon,
        trilho.color,
        trilho.difficulty,
        trilho.published_at,
        trilho.order_index,
      ],
    );
  }
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
    put: (path, body, options) => request("PUT", path, body, options),
    // DELETE com corpo não é comum, mas `DELETE /users/me` precisa dele: a
    // confirmação do nome e a password viajam no corpo, não no URL, para não
    // ficarem em registos de servidor nem no histórico do browser.
    delete: (path, body, options) => request("DELETE", path, body, options),
    cookies,
    /** Esquece a sessão sem falar com o servidor — simula outro browser. */
    forget: () => cookies.clear(),
  };
}

/**
 * Os dois passos de criar conta, com a resposta crua do segundo — para os
 * testes que querem inspecionar códigos de estado em vez de uma conta pronta.
 */
export async function signupThroughEmail(client, { email, username, password }) {
  const pedido = await client.post("/api/auth/signup", { email });
  if (pedido.status !== 200) return pedido;

  const { token } = lastEmail() ?? {};
  if (!token) throw new Error("o email com o link de criação de conta não saiu");

  return client.post("/api/auth/signup/complete", { token, username, password });
}

/**
 * Cria conta pelo fluxo a sério — pedir o link, ir buscá-lo à caixa de saída
 * falsa, e só então escolher nome e password — e deixa a sessão aberta.
 *
 * Passar pelo mesmo caminho que um utilizador faz com que qualquer coisa que
 * parta o registo parta também os 100 testes que precisam de uma conta, em
 * vez de ficar escondida atrás de um atalho só dos testes.
 */
export async function registerUser(client, overrides = {}) {
  const suffix = Math.random().toString(36).slice(2, 8);
  const payload = {
    email: `${suffix}@chef-xp.test`,
    password: "Chef12345!",
    username: `chef${suffix}`,
    ...overrides,
  };

  const pedido = await client.post("/api/auth/signup", { email: payload.email });
  if (pedido.status !== 200) {
    throw new Error(`pedido de registo falhou: ${pedido.status} ${JSON.stringify(pedido.body)}`);
  }

  const { token } = lastEmail() ?? {};
  if (!token) throw new Error("o email com o link de criação de conta não saiu");

  const response = await client.post("/api/auth/signup/complete", {
    token,
    username: payload.username,
    password: payload.password,
  });
  if (response.status !== 201 && response.status !== 200) {
    throw new Error(`registo falhou: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return { ...response.body.user, password: payload.password, email: payload.email };
}

/**
 * Uma receita publicada dentro de um desafio — que é o que participar é.
 *
 * Devolve a resposta inteira (receita, XP e desafio) para os testes poderem
 * olhar para o estado, e não atira em caso de recusa: metade destes testes
 * existe precisamente para provar que a recusa acontece.
 */
export async function enterChallenge(client, challengeId, overrides = {}) {
  return client.post("/api/recipes", {
    title: "Prato de desafio",
    description: "Uma receita feita para o desafio.",
    ingredients: "arroz\ntomate\ncebola",
    cookTimeMin: 25,
    difficulty: "facil",
    ...overrides,
    challengeId,
  });
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

/**
 * Um desafio, escrito diretamente na base.
 *
 * A rota de criação existe (POST /api/challenges) e tem testes próprios, mas
 * a maioria dos testes só precisa de um desafio para participar nele — e
 * passar por moderador, sessão e CSRF em cada um deles seria testar a criação
 * cem vezes de borla. `endsInDays` negativo dá um desafio já terminado, que é
 * o que a liquidação precisa.
 */
export async function createChallenge({
  xpReward = 100,
  endsInDays = 7,
  maxEntriesPerUser = 1,
  podium = [300, 200, 100],
  createdBy = null,
} = {}) {
  const { rows } = await query(
    `INSERT INTO challenges
       (title, description, xp_reward, starts_at, ends_at,
        max_entries_per_user, first_place_xp, second_place_xp, third_place_xp, created_by)
     VALUES ($1, $2, $3,
             least(now(), now() + ($4 || ' days')::interval),
             now() + ($4 || ' days')::interval,
             $5, $6, $7, $8, $9)
     RETURNING id, xp_reward, ends_at, max_entries_per_user, settled_at`,
    [
      "Desafio de teste",
      "Um desafio criado por um teste.",
      xpReward,
      String(endsInDays),
      maxEntriesPerUser,
      podium[0],
      podium[1],
      podium[2],
      createdBy,
    ],
  );
  return rows[0];
}

/**
 * Dá um papel a alguém sem passar pela aplicação.
 *
 * A promoção pela API precisa de um administrador, e o primeiro administrador
 * nasce na linha de comandos de propósito (ver migrations/013). Nos testes, a
 * linha de comandos é este UPDATE.
 */
export async function setRole(userId, role) {
  await query(`UPDATE users SET role = $2 WHERE id = $1`, [userId, role]);
}

/** Gostos verdadeiros numa receita, dados por quem se quiser. */
export async function likeRecipeAs(userId, recipeId) {
  await query(
    `INSERT INTO recipe_likes (user_id, recipe_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, recipeId],
  );
}

/** Empurra o fim de um desafio para trás, para ele poder ser liquidado. */
export async function endChallengeNow(challengeId) {
  await query(`UPDATE challenges SET ends_at = now() - interval '1 minute' WHERE id = $1`, [
    challengeId,
  ]);
}
