/**
 * Espelha os currículos de **todos** os trilhos nas tabelas `skills`,
 * `skill_prerequisites` e `lesson_skills`.
 *
 * O JSON é a fonte de verdade. Este script faz upsert do que lá está e apaga
 * o que já lá não está — correr duas vezes seguidas tem de dar exatamente o
 * mesmo resultado, e há um teste no CI a exigi-lo.
 *
 * Tem de cobrir os trilhos todos, não só o fundacional: `skill_practice` tem
 * chave estrangeira para `skills`, por isso uma competência italiana que não
 * chegasse aqui rebentava a primeira missão italiana concluída — e a limpeza
 * no fim apagava-a a cada arranque.
 *
 * As competências são globais de propósito: `calor.niveis` é a mesma coisa em
 * qualquer trilho, e é isso que permite a um trilho especializado apoiar-se
 * nos fundamentos em vez de os repetir.
 */
import { getAllTrailIds, curriculumFor, DEFAULT_LANGUAGE } from "../domain/curriculum.js";

export async function syncCurriculum(pool) {
  // `curriculumFor` já validou cada trilho ao carregá-lo — um inválido nem
  // deixa o módulo importar.
  const trilhos = getAllTrailIds().map((id) => curriculumFor(DEFAULT_LANGUAGE, id));

  // Um Map por id deduplica as competências partilhadas entre trilhos.
  const skills = [
    ...new Map(trilhos.flatMap((t) => t.skills).map((skill) => [skill.id, skill])).values(),
  ];
  const prerequisites = [
    ...new Map(
      skills.flatMap((skill) =>
        (skill.requires ?? []).map((requiresId) => [
          `${skill.id}\u0000${requiresId}`,
          [skill.id, requiresId],
        ]),
      ),
    ).values(),
  ];
  const lessonSkills = [
    ...new Map(
      trilhos
        .flatMap((t) =>
          t.lessons.flatMap((lesson) => [
            ...(lesson.teaches ?? []).map((skillId) => [lesson.id, skillId, "teaches"]),
            ...(lesson.requires ?? []).map((skillId) => [lesson.id, skillId, "requires"]),
          ]),
        )
        .map((row) => [row.join("\u0000"), row]),
    ).values(),
  ];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const skill of skills) {
      await client.query(
        `INSERT INTO skills (id, name, category, description)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE
           SET name = EXCLUDED.name,
               category = EXCLUDED.category,
               description = EXCLUDED.description`,
        [skill.id, skill.name, skill.category, skill.description],
      );
    }

    // Os pré-requisitos e o mapa lição↔competência são substituídos por
    // inteiro: são relações pequenas, e reconstruí-las evita ter de detetar
    // arestas removidas uma a uma.
    await client.query("DELETE FROM skill_prerequisites");
    for (const [skillId, requiresId] of prerequisites) {
      await client.query(
        `INSERT INTO skill_prerequisites (skill_id, requires_id) VALUES ($1, $2)`,
        [skillId, requiresId],
      );
    }

    await client.query("DELETE FROM lesson_skills");
    for (const [lessonId, skillId, role] of lessonSkills) {
      await client.query(
        `INSERT INTO lesson_skills (lesson_id, skill_id, role) VALUES ($1, $2, $3)`,
        [lessonId, skillId, role],
      );
    }

    // Competências que saíram do JSON saem também da base. O ON DELETE CASCADE
    // trata das linhas dependentes.
    const { rowCount: orphans } = await client.query(
      `DELETE FROM skills WHERE id <> ALL($1::text[])`,
      [skills.map((s) => s.id)],
    );

    await client.query("COMMIT");

    return {
      skills: skills.length,
      prerequisites: prerequisites.length,
      lessonSkills: lessonSkills.length,
      removed: orphans,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
