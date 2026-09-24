#!/usr/bin/env node
/**
 * Gera o README de cada pasta de imagens a partir de `lesson-images.brief.json`,
 * para que quem abre a pasta veja logo que foto vai em que ficheiro.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brief = JSON.parse(readFileSync(join(root, 'scripts/lesson-images.brief.json'), 'utf8'));

const titles = {
  'main-course': 'Main Course (curso base)',
  gymbro: 'Trilho Gymbro',
  healthy: 'Trilho Saudável',
  italian: 'Trilho Italiano',
  japanese: 'Trilho Japonês',
  mexican: 'Trilho Mexicano',
  portuguese: 'Trilho Português',
  university: 'Trilho Universitário',
  vegan: 'Trilho Vegan',
};

const folders = [...new Set(brief.map((b) => b.folder))];

for (const folder of folders) {
  const rows = brief.filter((b) => b.folder === folder);
  const lines = [
    `# Imagens — ${titles[folder] ?? folder}`,
    '',
    'Coloque cada foto nesta pasta com o nome da coluna **Ficheiro** e corra:',
    '',
    '```bash',
    'node scripts/wire-lesson-images.mjs',
    '```',
    '',
    'Aceita `.jpg`, `.jpeg`, `.png`, `.webp` e `.avif`. Pode acrescentar um sufixo',
    'descritivo a seguir a `--` — `u1-l5--cebola.jpg` liga igual a `u1-l5.jpg`.',
    '',
    'Formato sugerido: 1200×800 px (3:2), horizontal.',
    '',
  ];
  for (const r of rows) {
    lines.push(`## \`${r.slug}.jpg\` — ${r.title}`);
    lines.push('');
    lines.push(`**Tipo:** ${r.kind}`);
    lines.push('');
    lines.push(`**A foto mostra:** ${r.brief}`);
    if (r.must) lines.push('', `**Obrigatório:** ${r.must}`);
    lines.push('');
  }
  const dir = join(root, 'public/lessons', folder);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'README.md'), `${lines.join('\n')}\n`);
  console.log(`public/lessons/${folder}/README.md  (${rows.length} imagens)`);
}
