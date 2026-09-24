#!/usr/bin/env node
/**
 * Testa cada URL remota das lições e escreve os ids Unsplash mortos em
 * `scripts/lesson-images.dead.json`, para o índice poder marcá-los.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const targets = [
  'shared/curriculum.json',
  'shared/curriculum.pt.json',
  ...readdirSync(join(root, 'shared/trails')).map((f) => `shared/trails/${f}`),
];

const urls = new Set();
for (const rel of targets) {
  const data = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  for (const unit of data.units ?? []) {
    for (const lesson of unit.lessons ?? []) {
      for (const node of [lesson, ...(lesson.questions ?? [])]) {
        if (node.imageUrl && /^https?:/.test(node.imageUrl)) urls.add(node.imageUrl);
      }
    }
  }
}

const dead = [];
for (const url of [...urls].sort()) {
  const id = url.match(/photo-([^?]+)/)?.[1] ?? url;
  let code = 0;
  try {
    code = (await fetch(url, { method: 'GET' })).status;
  } catch {
    code = 0;
  }
  const ok = code >= 200 && code < 300;
  if (!ok) dead.push(id);
  console.log(`${ok ? 'viva ' : 'MORTA'}  ${code}  ${id}`);
}

writeFileSync(join(root, 'scripts/lesson-images.dead.json'), `${JSON.stringify([...new Set(dead)], null, 2)}\n`);
console.log(`\n${urls.size} URLs distintas, ${new Set(dead).size} mortas`);
