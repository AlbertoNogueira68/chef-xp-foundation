import "dotenv/config";
import { createApp } from "./app.js";
import { getPool, closePool } from "./db/index.js";
import { runMigrations } from "./db/runMigrations.js";
import { syncCurriculum } from "./scripts/sync-curriculum.js";
import { ensureUploadDir } from "./lib/imageStore.js";
import { startChallengeScheduler } from "./lib/challengeScheduler.js";
import { startHousekeeping } from "./lib/housekeeping.js";
import { log } from "./lib/logger.js";

const port = Number(process.env.PORT || 3010);

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
  log.info(
    { skills: sync.skills, lessonSkills: sync.lessonSkills },
    "currículo sincronizado com a base",
  );

  await ensureUploadDir();

  const app = createApp();

  /**
   * Os desafios fecham-se sozinhos: o prazo que quem os cria escolheu tem de
   * valer sem depender de alguém se lembrar de carregar num botão.
   */
  const stopChallengeScheduler = startChallengeScheduler(getPool());

  const stopHousekeeping = startHousekeeping(getPool());

  const server = app.listen(port, "0.0.0.0", () => {
    log.info({ port, env: process.env.NODE_ENV ?? "development" }, "servidor a escutar");
  });

  // Encerramento limpo: o Docker envia SIGTERM e não queremos ligações
  // a meio nem o pool pendurado.
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.on(signal, () => {
      log.info({ signal }, "sinal recebido, a encerrar");
      stopChallengeScheduler();
      stopHousekeeping();
      server.close(async () => {
        await closePool();
        process.exit(0);
      });
    });
  }
}

boot().catch((error) => {
  log.error({ err: error }, "falha no arranque do servidor");
  process.exit(1);
});
