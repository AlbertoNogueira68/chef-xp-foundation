/**
 * Uma base migrada mas não semeada tem de ficar utilizável.
 *
 * Foi exatamente este o estado que rebentou: as migrations criavam
 * `skills` e `skill_practice` (com chave estrangeira entre elas), mas as
 * competências só chegavam à base pelo `db:seed`. Concluir a primeira
 * missão dava 500 com violação de chave estrangeira.
 *
 * O arranque do servidor passou a sincronizar o currículo. Este script
 * corre a seguir ao arranque, ANTES do seed, e falha se a tabela estiver
 * vazia.
 */
import "dotenv/config";
import { getPool, closePool } from "../server/db/index.js";

try {
  const { rows } = await getPool().query(`
    SELECT
      (SELECT count(*)::int FROM skills)        AS skills,
      (SELECT count(*)::int FROM lesson_skills) AS lesson_skills
  `);
  const { skills, lesson_skills: lessonSkills } = rows[0];

  if (skills === 0 || lessonSkills === 0) {
    console.error(
      `[db] o arranque não sincronizou o currículo: ${skills} competências, ` +
        `${lessonSkills} ligações. Concluir uma missão iria falhar.`,
    );
    process.exit(1);
  }

  console.log(
    `[db] arranque sincronizou o currículo: ${skills} competências, ${lessonSkills} ligações`,
  );
} finally {
  await closePool();
}
