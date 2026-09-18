/**
 * Os ícones da app instalada, gerados por código.
 *
 * Um PNG à mão, sem dependências: o Node já traz o `zlib`, e um PNG é pouco
 * mais do que os pixels comprimidos com um cabeçalho à frente. Vale a pena
 * porque assim o ícone é reproduzível — muda-se a cor aqui, corre-se o
 * script, e não há um ficheiro binário no repositório que ninguém sabe de
 * onde veio nem como voltar a fazer.
 *
 *   node scripts/generate-icons.mjs
 *
 * Gera o que o manifesto pede: 192 e 512 para o Android, 512 "maskable" (com
 * margem, porque o sistema recorta o ícone à forma dele), e 180 para o iOS.
 */

import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/icons");

/* ---------------------------------------------------------------- */
/* PNG                                                              */
/* ---------------------------------------------------------------- */

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** `pixels` é RGBA, 4 bytes por pixel, em ordem de leitura. */
function encodePng(size, pixels) {
  // Cada linha leva à frente o byte do filtro. Zero = sem filtro: o ganho de
  // compressão dos outros não compensa a complexidade para um ícone destes.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  // 10, 11, 12 = compressão, filtro e entrelaçamento: os únicos valores que o
  // formato permite.

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------------------------------------------------------------- */
/* O desenho                                                        */
/* ---------------------------------------------------------------- */

// As mesmas três cores do logótipo (amber 500 → orange 600 → rose 500).
const GRADIENTE = [
  [245, 158, 11],
  [234, 88, 12],
  [244, 63, 94],
];

function corDoFundo(t) {
  const escala = t * (GRADIENTE.length - 1);
  const i = Math.min(Math.floor(escala), GRADIENTE.length - 2);
  const f = escala - i;
  return GRADIENTE[i].map((valor, canal) => Math.round(valor + (GRADIENTE[i + 1][canal] - valor) * f));
}

const dentroDoCirculo = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

/** Retângulo de cantos redondos, em coordenadas de 0 a 1. */
function dentroDoRetangulo(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 1e-9;
}

/**
 * O chapéu: três bolas por cima e a banda por baixo, que é o que torna um
 * chapéu de cozinheiro reconhecível a 48 pixels no ecrã de um telemóvel.
 *
 * `escala` encolhe o desenho à volta do centro — é assim que o ícone
 * "maskable" ganha a margem que o Android corta.
 */
function dentroDoChapeu(x, y, escala) {
  const px = 0.5 + (x - 0.5) / escala;
  const py = 0.5 + (y - 0.5) / escala;

  const puff =
    dentroDoCirculo(px, py, 0.5, 0.4, 0.2) ||
    dentroDoCirculo(px, py, 0.34, 0.46, 0.145) ||
    dentroDoCirculo(px, py, 0.66, 0.46, 0.145) ||
    dentroDoRetangulo(px, py, 0.345, 0.44, 0.655, 0.57, 0.02);

  const banda = dentroDoRetangulo(px, py, 0.325, 0.555, 0.675, 0.73, 0.03);

  return puff || banda;
}

/** Fora do quadrado arredondado não se pinta nada: fica transparente. */
function dentroDaMoldura(x, y, raio) {
  return raio === 0 ? true : dentroDoRetangulo(x, y, 0, 0, 1, 1, raio);
}

function desenhar(size, { raio, escalaDoChapeu }) {
  const pixels = Buffer.alloc(size * size * 4);
  // Duas amostras por eixo: sem isto, as curvas ficam em degraus visíveis.
  const AMOSTRAS = 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dentro = 0;
      let chapeu = 0;

      for (let sy = 0; sy < AMOSTRAS; sy++) {
        for (let sx = 0; sx < AMOSTRAS; sx++) {
          const fx = (x + (sx + 0.5) / AMOSTRAS) / size;
          const fy = (y + (sy + 0.5) / AMOSTRAS) / size;
          if (!dentroDaMoldura(fx, fy, raio)) continue;
          dentro++;
          if (dentroDoChapeu(fx, fy, escalaDoChapeu)) chapeu++;
        }
      }

      const total = AMOSTRAS * AMOSTRAS;
      const i = (y * size + x) * 4;
      if (dentro === 0) continue;

      const [r, g, b] = corDoFundo((x + y) / (2 * size));
      const peso = chapeu / dentro;
      pixels[i] = Math.round(r + (255 - r) * peso);
      pixels[i + 1] = Math.round(g + (255 - g) * peso);
      pixels[i + 2] = Math.round(b + (255 - b) * peso);
      pixels[i + 3] = Math.round((dentro / total) * 255);
    }
  }

  return encodePng(size, pixels);
}

const ICONES = [
  // Cantos redondos como qualquer ícone de app; o chapéu à vontade.
  { ficheiro: "icon-192.png", size: 192, raio: 0.18, escalaDoChapeu: 1 },
  { ficheiro: "icon-512.png", size: 512, raio: 0.18, escalaDoChapeu: 1 },
  // Maskable: quadrado inteiro e desenho encolhido, porque o sistema recorta
  // à forma dele (círculo, gota, quadrado) e come as bordas.
  { ficheiro: "icon-maskable-512.png", size: 512, raio: 0, escalaDoChapeu: 0.72 },
  // O iOS põe os cantos redondos por si e não gosta de transparência.
  { ficheiro: "apple-touch-icon.png", size: 180, raio: 0, escalaDoChapeu: 0.86 },
];

await mkdir(OUT_DIR, { recursive: true });
for (const { ficheiro, size, raio, escalaDoChapeu } of ICONES) {
  const png = desenhar(size, { raio, escalaDoChapeu });
  await writeFile(path.join(OUT_DIR, ficheiro), png);
  console.log(`[icons] ${ficheiro} — ${size}×${size}, ${(png.length / 1024).toFixed(1)} kB`);
}
