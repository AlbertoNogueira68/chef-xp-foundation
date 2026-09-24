#!/usr/bin/env node
/**
 * Liga as imagens de `public/lessons/<trilho>/` às lições e quizzes.
 *
 * Coloca o ficheiro na pasta do trilho com o nome indicado em
 * `scripts/lesson-images.brief.json` (coluna `slug`) e corre este script:
 * cada `imageUrl` cujo ficheiro exista passa a apontar para o caminho local.
 *
 * O nome pode levar um sufixo descritivo a seguir a `--`, que é ignorado:
 * `u1-l5.jpg` e `u1-l5--cebola-em-cubos.jpg` ligam ambos à mesma lição.
 *
 * Slots sem ficheiro ficam intocados, por isso pode correr-se as vezes que
 * forem precisas à medida que as fotos vão chegando.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

const brief = JSON.parse(readFileSync(join(root, 'scripts/lesson-images.brief.json'), 'utf8'));
const byId = new Map(brief.map((b) => [b.id, b]));

/** Indexa os ficheiros presentes por (pasta, slug), tolerando o sufixo `--…`. */
function indexFiles(folder) {
  const dir = join(root, 'public/lessons', folder);
  if (!existsSync(dir)) return new Map();
  const found = new Map();
  for (const name of readdirSync(dir)) {
    const ext = extname(name).toLowerCase();
    if (!EXTS.includes(ext)) continue;
    const slug = basename(name, ext).split('--')[0];
    if (found.has(slug)) {
      console.warn(`aviso: ${folder}/${slug} tem mais do que um ficheiro; fica ${found.get(slug)}`);
      continue;
    }
    found.set(slug, name);
  }
  return found;
}

const indexes = new Map();
for (const b of brief) {
  if (!indexes.has(b.folder)) indexes.set(b.folder, indexFiles(b.folder));
}

const stats = { wired: 0, missing: [], unknown: [], dangling: [], files: 0 };

/** Devolve o caminho público da imagem de `id`, ou null se ainda não existir. */
function localPath(id) {
  const b = byId.get(id);
  if (!b) return null;
  const name = indexes.get(b.folder)?.get(b.slug);
  return name ? `/lessons/${b.folder}/${name}` : null;
}

const targets = [
  'shared/curriculum.json',
  'shared/curriculum.pt.json',
  ...readdirSync(join(root, 'shared/trails')).map((f) => `shared/trails/${f}`),
];

for (const rel of targets) {
  const file = join(root, rel);
  const data = JSON.parse(readFileSync(file, 'utf8'));
  let touched = false;

  for (const unit of data.units ?? []) {
    for (const lesson of unit.lessons ?? []) {
      for (const node of [lesson, ...(lesson.questions ?? [])]) {
        if (!node.imageUrl) continue;
        // Lições acrescentadas depois do brief ainda não têm entrada nem nome
        // de ficheiro definido, por isso são listadas à parte em vez de falhar.
        if (!byId.has(node.id)) {
          stats.unknown.push(node.id);
          continue;
        }
        const next = localPath(node.id);
        if (!next) {
          // Apagar a imagem da pasta deixaria o caminho local a apontar para o
          // vazio, por isso é o momento de avisar: o ficheiro tem de voltar, ou
          // o `imageUrl` tem de ser reposto à mão.
          if (node.imageUrl.startsWith('/lessons/')) stats.dangling.push(`${rel}  ${node.id}  ->  ${node.imageUrl}`);
          stats.missing.push(node.id);
          continue;
        }
        if (node.imageUrl !== next) {
          node.imageUrl = next;
          touched = true;
        }
        stats.wired += 1;
      }
    }
  }

  if (touched) {
    writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
    console.log(`escrito  ${rel}`);
  }
}

// `curriculum.pt.json` repete os ids de `curriculum.json`, por isso cada slot em
// falta é contado uma vez por ficheiro. Contar os únicos evita reportar o dobro.
const missing = [...new Set(stats.missing)];
console.log(`\nligados: ${stats.wired} slots`);
if (missing.length) {
  console.log(`por ligar: ${missing.length} imagens ainda não colocadas`);
  for (const id of missing) {
    const b = byId.get(id);
    console.log(`  public/lessons/${b.folder}/${b.slug}.jpg  — ${b.title}`);
  }
} else {
  console.log('todas as imagens do brief estão ligadas.');
}

if (stats.dangling.length) {
  console.log(`\nAVISO: ${stats.dangling.length} caminhos locais sem ficheiro:`);
  for (const d of stats.dangling) console.log(`  ${d}`);
}

const unknown = [...new Set(stats.unknown)];
if (unknown.length) {
  console.log(`\nsem entrada no brief: ${unknown.length} lições novas`);
  for (const id of unknown) console.log(`  ${id}`);
  console.log('Corra `npm run images:index` depois de as acrescentar ao brief.');
}
