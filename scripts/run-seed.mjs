import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, closePool } from "../server/db/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, "../server/db/seed.sql");

try {
  const sql = await fs.readFile(seedPath, "utf8");
  await getPool().query(sql);
  console.log("[db] seed applied");
} finally {
  await closePool();
}
