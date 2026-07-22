import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FORBIDDEN = ["cdn.tailwindcss.com", "aistudiocdn.com", "gptengineer", "lovable.app", "lovable.dev"];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

const targets = [
  path.join(ROOT, "index.html"),
  ...walk(path.join(ROOT, "dist")).filter((f) => /\.(html|js|css)$/.test(f)),
];

let failed = false;
for (const file of targets) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, "utf8");
  for (const needle of FORBIDDEN) {
    if (content.toLowerCase().includes(needle.toLowerCase())) {
      console.error(`[hardening] forbidden pattern "${needle}" in ${path.relative(ROOT, file)}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log("[hardening] ok");
