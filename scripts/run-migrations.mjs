import "dotenv/config";
import { runMigrations } from "../server/db/runMigrations.js";
import { closePool } from "../server/db/index.js";

try {
  await runMigrations();
  console.log("[db] migrations complete");
} finally {
  await closePool();
}
