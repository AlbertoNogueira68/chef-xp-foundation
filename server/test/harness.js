import { after, before } from "node:test";
import { createApp } from "../app.js";
import { closePool, getPool, query } from "../db/index.js";
import { runMigrations } from "../db/runMigrations.js";
import { codeStore, loginStore, registerStore } from "../routes/auth.js";
import { outbox } from "../lib/mailer.js";
import { getMission, getUnitOfMission } from "../domain/missions.js";
import { syncCurriculum } from "../scripts/sync-curriculum.js";

/**
 * Arnês dos testes de rota.
 *
 * Estes testes falam com um Postgres a sério. Não é preciosismo: o que eles
 * cobrem — transações, o UNIQUE que torna o XP idempotente, cursores compostos,
 * `ON CONFLICT` — é precisamente o que um duplo em memória não reproduz. Um
 * teste que finge a base não testa nada do que aqui pode partir.
 *
 * Sem `DATABASE_URL` os testes saltam com uma mensagem em vez de falharem:
 * quem clona o projeto e corre `npm test` não tem de ter um Postgres à mão,
 * e o CI, que tem, corre-os na mesma.
 *
 * Os ficheiros correm em série (`--test-concurrency=1`), porque partilham uma
 * base só e cada um a esvazia entre casos: em paralelo, um ficheiro apagava os
 * utilizadores que o outro tinha acabado de criar. É uma base por execução e
 * não por ficheiro para não se pagar as migrations vezes sem conta; se um dia
 * a suite crescer ao ponto de a série pesar, o passo seguinte é um schema por
 * ficheiro, não desligar a limpeza.
 */
export const DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
export const hasDatabase = Boolean(DATABASE_URL);

/**
 * O CI põe `REQUIRE_TEST_DATABASE=1`.
 *
 * Sem isto, uma configuração que perdesse o `DATABASE_URL` corria zero testes
 * e ficava verde — um falso positivo pior do que não ter testes nenhuns, por
 * dar a impressão de que estão a correr. Com a bandeira ligada, faltar a base
 * é um erro em vez de um silêncio.
 */
if (!hasDatabase && process.env.REQUIRE_TEST_DATABASE === "1") {
  throw new Error(
    "REQUIRE_TEST_DATABASE=1 mas não há DATABASE_URL: os testes de rota não correriam.",
  );
}

if (!hasDatabase) {
  console.log(
    "\n  ⚠  Sem DATABASE_URL: os testes de rota vão ser saltados." +
      "\n     Para os correr:  TEST_DATABASE_URL=postgres://… npm run test:api\n",
  );
}

export const skipWithoutDatabase = hasDatabase
  ? false
  : "sem DATABASE_URL — testes de rota saltados (o CI corre-os)";

/** Tabelas por onde os testes escrevem, pela ordem em que podem ser esvaziadas. */
const TABLES = [
  "email_codes",
  "mission_events",
  "mission_checkpoints",
  "post_comments",
  "post_likes",
  "posts",
  "cooking_sessions",
  "cooking_plans",
  "skill_practice",
  "mission_runs",
  "comments",
  "recipe_likes",
  "recipes",
  "follows",
  "lesson_progress",
  "daily_activity",
  "xp_events",
  "auth_identities",
  "users",
];

/**
 * Deixa a base como se ninguém a tivesse usado, sem lhe destruir a estrutura.
 *
 * Esvazia também os contadores de tentativas: uma suite inteira vem do mesmo
 * endereço, e sem isto os testes do fim falhavam por causa dos do princípio —
 * uma falha que não diz nada sobre o código a ser testado.
 */
export async function resetDatabase() {
  await query(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);
  await Promise.all([loginStore.resetAll?.(), registerStore.resetAll?.(), codeStore.resetAll?.()]);
  outbox.length = 0;
}

let server = null;
let origin = null;

/**
 * Levanta a app numa porta efémera. Porta 0 e não uma fixa: dois ficheiros de
 * teste a correr ao mesmo tempo não podem disputar o mesmo número.
 */
export function useServer() {
  before(async () => {
    if (!hasDatabase) return;

    process.env.DATABASE_URL = DATABASE_URL;
    process.env.JWT_SECRET ||= "test-only-secret-with-at-least-32-characters!!";
    process.env.NODE_ENV = "test";

    getPool();
    await runMigrations();
    // As missões exigem competências em `skills`; sem o sync, concluir uma
    // rebenta na chave estrangeira de `skill_practice`.
    await syncCurriculum(getPool());
    await resetDatabase();

    const app = createApp({ isProd: false });
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (hasDatabase) await closePool();
  });

  return () => origin;
}

/**
 * Um cliente com cookies e CSRF, como o browser faz.
 *
 * Guarda os cookies entre pedidos e reenvia o token de CSRF no header, senão
 * qualquer pedido mutante autenticado levaria 403 — que é o comportamento
 * certo do servidor e seria só ruído em todos os testes.
 */
export function createClient(getOrigin) {
  const cookies = new Map();

  function cookieHeader() {
    return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  function absorb(response) {
    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const index = pair.indexOf("=");
      if (index > 0) cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
  }

  async function request(method, path, body, { raw = false } = {}) {
    const headers = { Cookie: cookieHeader() };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    if (method !== "GET" && method !== "HEAD") {
      const token = cookies.get("csrf") ?? cookies.get("__Host-csrf");
      if (token) headers["X-CSRF-Token"] = token;
    }

    const response = await fetch(`${getOrigin()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    absorb(response);

    if (raw) return response;

    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { status: response.status, data, headers: response.headers };
  }

  return {
    cookies,
    get: (path, options) => request("GET", path, undefined, options),
    post: (path, body, options) => request("POST", path, body, options),
    put: (path, body, options) => request("PUT", path, body, options),
    patch: (path, body, options) => request("PATCH", path, body, options),
    del: (path, body, options) => request("DELETE", path, body, options),

    /** Regista uma conta nova e fica com a sessão. */
    async register(username) {
      await request("GET", "/api/auth/csrf");
      const response = await request("POST", "/api/auth/register", {
        username,
        email: `${username}@example.com`,
        password: "password-de-teste",
      });
      if (response.status !== 201 && response.status !== 200) {
        throw new Error(`registo falhou: ${response.status} ${JSON.stringify(response.data)}`);
      }
      return response.data.user;
    },
  };
}

/** PNG de 1×1 válido — a validação de imagens olha para os bytes, não para o nome. */
export const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** Abre uma missão pela via legítima: as lições da unidade dadas como feitas. */
export async function unlockMission(userId, missionId) {
  const unit = getUnitOfMission(missionId);
  for (const lesson of unit.lessons) {
    await query(
      `INSERT INTO lesson_progress (user_id, lesson_id, xp_earned, hearts_left)
       VALUES ($1, $2, 20, 3) ON CONFLICT DO NOTHING`,
      [userId, lesson.id],
    );
  }
}

/**
 * Cozinha uma missão do princípio ao fim, pela API.
 *
 * Para as suites que precisam do efeito de ter cozinhado — o compromisso, o
 * feed — e não de testar a conclusão em si, que tem os seus próprios testes.
 */
export async function cookOnce(client, userId, missionId, { share = false } = {}) {
  await unlockMission(userId, missionId);
  const start = await client.post(`/api/missions/${missionId}/start`);
  const runId = start.data.run.id;

  const checkpoint = getMission(missionId).steps.findIndex((step) => step.checkpoint);
  await client.post(`/api/missions/runs/${runId}/checkpoint`, {
    stepIndex: checkpoint,
    imageDataUrl: PNG_1PX,
  });

  const done = await client.post(`/api/missions/runs/${runId}/complete`, { share });
  if (done.status !== 200) {
    throw new Error(`conclusão falhou: ${done.status} ${JSON.stringify(done.data)}`);
  }
  return done.data;
}

/**
 * O último código que o servidor enviou.
 *
 * Sem SMTP configurado o mailer guarda as mensagens em memória, e os testes
 * correm a app no mesmo processo — por isso lê-se o código daqui em vez de se
 * espiar a base de dados, que só guarda o hash.
 */
export function lastCodeFor(email) {
  for (let i = outbox.length - 1; i >= 0; i -= 1) {
    if (outbox[i].to === email) {
      const match = outbox[i].text.match(/\b(\d{6})\b/);
      if (match) return match[1];
    }
  }
  return null;
}

export { outbox };
