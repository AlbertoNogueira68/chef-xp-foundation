import "dotenv/config";
import { validateEnv } from "./lib/validateEnv.js";
import { getPool, closePool } from "./db/index.js";
import { runMigrations } from "./db/runMigrations.js";
import { syncCurriculum } from "./scripts/sync-curriculum.js";
import { ensureUploadDir } from "./lib/imageStore.js";
import { createApp } from "./app.js";

const port = Number(process.env.PORT || 3010);

validateEnv();

const app = createApp();

async function boot() {
  getPool();
  await runMigrations();

  /**
   * O sync do currículo corre no arranque, logo a seguir às migrations.
   *
   * Antes só corria no `db:seed`, e isso deixava um estado inteiro por
   * cobrir: base migrada mas não semeada tinha as tabelas de competências
   * vazias, e a primeira missão concluída rebentava com violação de chave
   * estrangeira em `skill_practice`. O currículo é código versionado — a
   * base tem de ficar coerente com ele sem depender de alguém se lembrar
   * de correr um comando.
   *
   * É idempotente e valida antes de escrever, por isso arrancar mil vezes
   * dá o mesmo resultado que arrancar uma.
   */
  const sync = await syncCurriculum(getPool());
  console.log(
    `[db] currículo sincronizado: ${sync.skills} competências, ${sync.lessonSkills} ligações`,
  );

  await ensureUploadDir();

  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`[server] a escutar em http://0.0.0.0:${port}`);
  });

  // Encerramento limpo: o Docker envia SIGTERM e não queremos ligações
  // a meio nem o pool pendurado.
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.on(signal, () => {
      console.log(`[server] ${signal} recebido, a encerrar…`);
      server.close(async () => {
        await closePool();
        process.exit(0);
      });
    });
  }
}

boot().catch((error) => {
  console.error("[server] falha no arranque:", error.message);
  process.exit(1);
});
