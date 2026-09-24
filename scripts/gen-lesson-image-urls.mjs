#!/usr/bin/env node
/**
 * Gera `docs/IMAGENS-LICOES-URLS.md`: lista plana das 78 imagens com o caminho
 * local a criar e a URL que está em uso hoje, para consulta rápida.
 *
 * O estado (viva/morta) vem de `scripts/lesson-images.dead.json`, escrito por
 * `check-lesson-image-urls.mjs`. Sem esse ficheiro a coluna fica por verificar.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brief = JSON.parse(readFileSync(join(root, 'scripts/lesson-images.brief.json'), 'utf8'));
const byId = new Map(brief.map((b) => [b.id, b]));

const deadFile = join(root, 'scripts/lesson-images.dead.json');
const dead = existsSync(deadFile) ? new Set(JSON.parse(readFileSync(deadFile, 'utf8'))) : null;

const targets = ['shared/curriculum.json', ...['gymbro','healthy','italian','japanese','mexican','portuguese','university','vegan'].map((t) => `shared/trails/${t}.json`)];

const rows = [];
for (const rel of targets) {
  const data = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  for (const unit of data.units ?? []) {
    for (const lesson of unit.lessons ?? []) {
      for (const node of [lesson, ...(lesson.questions ?? [])]) {
        if (!node.imageUrl) continue;
        const b = byId.get(node.id);
        rows.push({ ...b, url: node.imageUrl, source: rel });
      }
    }
  }
}

const status = (url) => {
  if (!/^https?:/.test(url)) return 'já local';
  if (!dead) return '?';
  const id = url.match(/photo-([^?]+)/)?.[1];
  return dead.has(id) ? '**MORTA (404)**' : 'viva';
};

const out = [
  '# Todas as imagens — caminhos e URLs',
  '',
  `${rows.length} imagens. **Ficheiro a criar** é o nome que a foto tem de ter;`,
  'depois corre `npm run images:wire`.',
  '**URL atual** é o que está no código hoje (a substituir).',
  '',
  '| # | Ficheiro a criar | Lição | Tipo | URL atual | Estado |',
  '| --- | --- | --- | --- | --- | --- |',
];
rows.forEach((r, i) => {
  const c = (s) => String(s ?? '').replace(/\|/g, '\\|');
  out.push(`| ${i + 1} | \`public/lessons/${r.folder}/${r.slug}.jpg\` | ${c(r.title)} | ${c(r.kind)} | ${c(r.url)} | ${status(r.url)} |`);
});

writeFileSync(join(root, 'docs/IMAGENS-LICOES-URLS.md'), `${out.join('\n')}\n`);
console.log(`docs/IMAGENS-LICOES-URLS.md (${rows.length} linhas)`);
