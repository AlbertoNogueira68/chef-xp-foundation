import "dotenv/config";
import { getPool, closePool } from "../server/db/index.js";
import { syncCurriculum } from "../server/scripts/sync-curriculum.js";

try {
  const result = await syncCurriculum(getPool());
  console.log(
    `[db] currículo sincronizado: ${result.skills} competências, ` +
      `${result.prerequisites} pré-requisitos, ${result.lessonSkills} ligações lição↔competência` +
      (result.removed > 0 ? `, ${result.removed} removidas` : ""),
  );
} finally {
  await closePool();
}
