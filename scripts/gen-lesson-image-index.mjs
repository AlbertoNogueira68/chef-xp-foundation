#!/usr/bin/env node
/** Gera `docs/IMAGENS-LICOES.md` — o índice único de todas as 78 imagens. */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const all = JSON.parse(readFileSync(join(root, 'scripts/lesson-images.brief.json'), 'utf8'));

/** Já feita = existe um ficheiro de imagem com esse slug na pasta do trilho. */
function installed(b) {
  const dir = join(root, 'public/lessons', b.folder);
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((f) => {
    if (f.endsWith('.md')) return false;
    return f.replace(/\.[^.]+$/, '').split('--')[0] === b.slug;
  });
}

// Este ficheiro é o que falta fazer, não o inventário: as já colocadas saem.
const brief = all.filter((b) => !installed(b));
const done = all.length - brief.length;

// Lições acrescentadas aos trilhos depois do brief: ainda sem nome de ficheiro.
const known = new Set(all.map((b) => b.id));
const novas = [];
for (const f of readdirSync(join(root, 'shared/trails'))) {
  const d = JSON.parse(readFileSync(join(root, 'shared/trails', f), 'utf8'));
  for (const u of d.units ?? []) {
    for (const l of u.lessons ?? []) {
      for (const node of [l, ...(l.questions ?? [])]) {
        if (node.imageUrl && !known.has(node.id)) novas.push({ trail: d.id, id: node.id, title: l.title });
      }
    }
  }
}

const titles = {
  'main-course': 'Main Course (curso base)',
  gymbro: 'Gymbro', healthy: 'Saudável', italian: 'Italiano', japanese: 'Japonês',
  mexican: 'Mexicano', portuguese: 'Português', university: 'Universitário', vegan: 'Vegan',
};

const out = [
  '# Imagens das lições e dos quizzes',
  '',
  `Faltam **${brief.length}** imagens. ${done} já aprovadas e fora desta lista.`,
  '',
  'O inventário completo, incluindo as aprovadas, está nos `README.md` de cada pasta.',
  '',
  '## Como ligar',
  '',
  '1. Coloque cada foto em `public/lessons/<pasta>/` com o nome da coluna **Ficheiro**.',
  '2. Corra `npm run images:wire`.',
  '3. Confirme com `npm run check:images`.',
  '4. Se a base de dados já foi semeada, corra `npm run db:sync-curriculum`.',
  '',
  'Extensões aceites: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`.',
  'Pode juntar um sufixo a seguir a `--`: `u1-l5--cebola.jpg` liga na mesma.',
  'Pode correr `images:wire` quantas vezes quiser — só liga o que já existe.',
  '',
  '## Nota sobre os quizzes',
  '',
  'As perguntas com foto são do tipo `judge`: o utilizador avalia a imagem.',
  'A maioria tem de mostrar deliberadamente o estado **errado** (a panela em',
  'fervura quando se pergunta se é lume brando, a pega de faca incorreta).',
  'Uma foto bonita do estado certo torna a pergunta impossível de responder.',
  '',
];

for (const folder of [...new Set(brief.map((b) => b.folder))]) {
  const rows = brief.filter((b) => b.folder === folder);
  out.push(`## ${titles[folder] ?? folder} — \`public/lessons/${folder}/\``, '');
  out.push('| Ficheiro | Lição | Tipo | A foto mostra |');
  out.push('| --- | --- | --- | --- |');
  for (const r of rows) {
    const cell = (s) => String(s ?? '').replace(/\|/g, '\\|');
    const must = r.must ? ` **${cell(r.must)}**` : '';
    out.push(`| \`${r.slug}.jpg\` | ${cell(r.title)} | ${cell(r.kind)} | ${cell(r.brief)}${must} |`);
  }
  out.push('');
}

if (novas.length) {
  out.push('## Lições novas, ainda sem brief', '');
  out.push(`Acrescentadas aos trilhos depois desta lista ser feita (${novas.length}).`);
  out.push('Precisam de nome de ficheiro e de brief antes de se poder ligar imagens.', '');
  out.push('| Trilho | Id | Lição |', '| --- | --- | --- |');
  for (const n of novas) out.push(`| ${n.trail} | \`${n.id}\` | ${String(n.title ?? '').replace(/\|/g, '\\|')} |`);
  out.push('');
}

writeFileSync(join(root, 'docs/IMAGENS-LICOES.md'), `${out.join('\n')}\n`);
console.log(`docs/IMAGENS-LICOES.md  (${brief.length} imagens)`);
