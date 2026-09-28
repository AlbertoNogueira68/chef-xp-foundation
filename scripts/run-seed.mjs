import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, closePool } from "../server/db/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, "../server/db/seed.sql");

/**
 * Recusa-se a correr contra o que pareça produção.
 *
 * O seed não é conteúdo inofensivo: cria contas cuja password (`chef123`) e
 * cujo hash estão escritos neste repositório, promove uma delas a `admin`, e
 * o `ON CONFLICT (email) DO UPDATE` **sobrescreve a password** de qualquer
 * conta que já exista com um desses endereços.
 *
 * Isto já estava dito no README e num comentário do SQL, e um comentário não
 * trava um `npm run db:seed` com o `.env` errado — só um `throw` é que trava.
 * É a mesma regra que os testes de integração já seguiam: o harness recusa-se
 * a apagar tabelas numa base que não se chame "test".
 *
 * `ALLOW_PRODUCTION_SEED=true` é a saída para quem tem mesmo de o fazer (uma
 * demonstração pública, descartável). Tem de ser escrita à mão, que é o ponto.
 */
function recusarProducao(env = process.env) {
  if (env.ALLOW_PRODUCTION_SEED === "true") return;

  const razoes = [];
  if (env.NODE_ENV === "production") razoes.push("NODE_ENV=production");

  // O nome da base é o último segmento do caminho, sem query string.
  const nome = decodeURIComponent((env.DATABASE_URL ?? "").split("?")[0].split("/").pop() ?? "");
  if (/prod/i.test(nome)) razoes.push(`a base chama-se "${nome}"`);

  if (razoes.length === 0) return;

  throw new Error(
    `O seed não corre aqui (${razoes.join(", ")}).\n\n` +
      `Ele cria contas de demonstração com uma password que está escrita no\n` +
      `repositório, promove uma delas a administrador, e sobrescreve a password\n` +
      `de contas já existentes com os mesmos emails.\n\n` +
      `Se é mesmo isso que queres: ALLOW_PRODUCTION_SEED=true npm run db:seed`,
  );
}

try {
  recusarProducao();

  const sql = await fs.readFile(seedPath, "utf8");
  await getPool().query(sql);
  console.log("[db] seed applied");
} finally {
  await closePool();
}
