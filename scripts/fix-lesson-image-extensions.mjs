#!/usr/bin/env node
/**
 * Corrige extensões erradas em `public/lessons/`: renomeia cada ficheiro para a
 * extensão do seu formato real, detetado pelos bytes iniciais.
 *
 * Por omissão só mostra o que faria. Com `--apply` renomeia mesmo.
 */
import { readdirSync, readFileSync, renameSync, existsSync } from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const apply = process.argv.includes('--apply');
const base = join(root, 'public/lessons');

/** Lê a assinatura do ficheiro e devolve a extensão correta, ou null. */
function realExt(file) {
  const b = readFileSync(file);
  if (b.length < 16) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return '.jpg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return '.webp';
  if (b.subarray(4, 8).toString('latin1') === 'ftyp' && b.subarray(8, 12).toString('latin1').startsWith('avif')) return '.avif';
  return null;
}

let changed = 0;
let ok = 0;
for (const entry of readdirSync(base, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const folder = entry.name;
  const dir = join(base, folder);
  for (const name of readdirSync(dir)) {
    if (name.endsWith('.md') || name.startsWith('.')) continue;
    const file = join(dir, name);
    const want = realExt(file);
    if (!want) {
      console.log(`? ${folder}/${name} — formato não reconhecido`);
      continue;
    }
    const have = extname(name).toLowerCase();
    if (have === want || (want === '.jpg' && have === '.jpeg')) {
      ok += 1;
      continue;
    }
    const next = basename(name, extname(name)) + want;
    if (existsSync(join(dir, next))) {
      console.log(`! ${folder}/${name} -> ${next} (já existe, ignorado)`);
      continue;
    }
    console.log(`${apply ? 'renomeado' : 'renomearia'}  ${folder}/${name}  ->  ${next}`);
    if (apply) renameSync(file, join(dir, next));
    changed += 1;
  }
}

console.log(`\n${ok} já corretos, ${changed} ${apply ? 'renomeados' : 'por renomear'}`);
if (!apply && changed) console.log('Corra outra vez com --apply para aplicar.');
