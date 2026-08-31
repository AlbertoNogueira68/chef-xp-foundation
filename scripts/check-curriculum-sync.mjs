/**
 * Prova que o sync do currículo é idempotente.
 *
 * Correr duas vezes e não rebentar não prova nada: um sync que duplicasse
 * linhas passava à mesma. O que se compara é o conteúdo das três tabelas
 * antes e depois da segunda passagem — tem de ser byte a byte igual.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { getPool, closePool } from "../server/db/index.js";
import { syncCurriculum } from "../server/scripts/sync-curriculum.js";

async function snapshot(pool) {
  const { rows } = await pool.query(`
    SELECT
      (SELECT coalesce(json_agg(s ORDER BY s.id), '[]') FROM (
         SELECT id, name, category, description FROM skills) s)               AS skills,
      (SELECT coalesce(json_agg(p ORDER BY p.skill_id, p.requires_id), '[]') FROM (
         SELECT skill_id, requires_id FROM skill_prerequisites) p)            AS prerequisites,
      (SELECT coalesce(json_agg(l ORDER BY l.lesson_id, l.skill_id, l.role), '[]') FROM (
         SELECT lesson_id, skill_id, role FROM lesson_skills) l)              AS lesson_skills
  `);
  return JSON.stringify(rows[0]);
}

const pool = getPool();
try {
  const first = await syncCurriculum(pool);
  const before = await snapshot(pool);

  const second = await syncCurriculum(pool);
  const after = await snapshot(pool);

  assert.equal(after, before, "a segunda passagem do sync mudou a base de dados");
  assert.deepEqual(second, first, "a segunda passagem reportou números diferentes");

  console.log(
    `[db] sync idempotente: ${first.skills} competências, ` +
      `${first.prerequisites} pré-requisitos, ${first.lessonSkills} ligações — ` +
      "estado igual nas duas passagens",
  );
} finally {
  await closePool();
}
