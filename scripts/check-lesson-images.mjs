#!/usr/bin/env node
/**
 * Verifica as imagens das lições e dos quizzes.
 *
 * Falha se um `imageUrl` local apontar para um ficheiro que não existe. As URLs
 * remotas que ainda restam são listadas como pendentes: o Unsplash já apagou
 * várias das que este repositório usava, por isso a meta é não ter nenhuma.
 *
 * Com `--strict` também falha enquanto houver URLs remotas, para o CI poder
 * travar regressões depois de a migração estar completa.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');

const targets = [
  'shared/curriculum.json',
  'shared/curriculum.pt.json',
  ...readdirSync(join(root, 'shared/trails')).map((f) => `shared/trails/${f}`),
];

const broken = [];
const remote = new Set();
let local = 0;

for (const rel of targets) {
  const data = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  for (const unit of data.units ?? []) {
    for (const lesson of unit.lessons ?? []) {
      for (const node of [lesson, ...(lesson.questions ?? [])]) {
        const url = node.imageUrl;
        if (!url) continue;
        if (/^https?:/.test(url)) {
          remote.add(`${node.id}  ${url}`);
          continue;
        }
        if (!existsSync(join(root, 'public', url.replace(/^\//, '')))) {
          broken.push(`${rel}  ${node.id}  ->  ${url}`);
          continue;
        }
        local += 1;
      }
    }
  }
}

console.log(`imagens locais ligadas: ${local}`);

if (remote.size) {
  console.log(`\nainda em URL remota: ${remote.size}`);
  for (const r of [...remote].sort()) console.log(`  ${r}`);
}

if (broken.length) {
  console.error(`\nERRO: ${broken.length} imagens locais apontam para ficheiros inexistentes:`);
  for (const b of broken) console.error(`  ${b}`);
  process.exit(1);
}

if (strict && remote.size) {
  console.error('\nERRO: --strict e ainda há imagens remotas.');
  process.exit(1);
}

console.log('\nok');
