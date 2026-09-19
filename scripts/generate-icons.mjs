/**
 * Os ícones da app e as imagens do mascote, gerados a partir de um desenho só.
 *
 * A fonte é `public/mascot/chef-frog.png` — o chef sapo, 512×512, com o fundo
 * escuro e o círculo laranja. Tudo o resto sai daqui por código: os ícones que
 * o manifesto pede, o favicon, e os recortes redondos que a app usa quando o
 * chef aparece a falar durante as lições.
 *
 *   node scripts/generate-icons.mjs
 *
 * Gerar em vez de guardar seis ficheiros à mão tem uma razão prática: quando o
 * desenho mudar, muda-se um PNG e corre-se isto — e não fica no repositório um
 * conjunto de binários que ninguém sabe se ainda são a mesma imagem.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crop, decodePng, encodePng, padrao, posterizar, resize } from "./lib/png.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FONTE = path.join(RAIZ, "public/mascot/chef-frog.png");
const ICONS = path.join(RAIZ, "public/icons");
const MASCOTE = path.join(RAIZ, "public/mascot");

/**
 * As caras do chef para cada momento da lição. Os originais vivem em
 * `design/mascot/` e não em `public/`: são uns 200 kB cada e a app só usa os
 * recortes pequenos que saem daqui.
 */
const HUMORES = ["aprovar", "celebrar", "erro", "triste"];
const DESENHOS = path.join(RAIZ, "design/mascot");

/**
 * O fundo do desenho, usado onde o ícone não pode ter transparência. É lido do
 * canto da própria imagem: à mão, bastava um tom de diferença para se ver o
 * quadrado do desenho recortado contra a margem.
 */
const corDoFundo = (imagem) => [imagem.pixels[0], imagem.pixels[1], imagem.pixels[2]];

/* ---------------------------------------------------------------- */
/* O recorte redondo                                                */
/* ---------------------------------------------------------------- */

/**
 * Onde está o círculo laranja: a caixa do que não é fundo escuro. Medir em vez
 * de fixar números à mão é o que faz isto continuar a funcionar se o desenho
 * for substituído por outro com o mesmo enquadramento.
 */
function encontrarCirculo(imagem) {
  const { width, height, pixels } = imagem;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const luz = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      if (luz <= 40) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    raio: Math.min(maxX - minX, maxY - minY) / 2,
  };
}

/**
 * Os desenhos dos humores têm fundo branco e enfeites que saem do círculo (os
 * confettis, a nuvem), por isso a caixa do que não é fundo não serve. Mede-se
 * o círculo pela linha e pela coluna do meio, onde só há círculo, e recua-se
 * dois pixels para não apanhar a franja branca da borda.
 */
function circuloAoCentro(imagem) {
  const { width, height, pixels } = imagem;
  const branco = (x, y) => {
    const i = (y * width + x) * 4;
    return Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) > 235;
  };
  const meioY = Math.floor(height / 2);
  const meioX = Math.floor(width / 2);

  let esquerda = 0;
  while (esquerda < meioX && branco(esquerda, meioY)) esquerda++;
  let direita = width - 1;
  while (direita > meioX && branco(direita, meioY)) direita--;
  let cima = 0;
  while (cima < meioY && branco(meioX, cima)) cima++;
  let baixo = height - 1;
  while (baixo > meioY && branco(meioX, baixo)) baixo--;

  return {
    cx: (esquerda + direita) / 2,
    cy: (cima + baixo) / 2,
    raio: Math.min(direita - esquerda, baixo - cima) / 2 - 2,
  };
}

/**
 * O chef sozinho, redondo, com o resto transparente — é assim que ele entra
 * nos balões de fala sem levar um quadrado escuro atrás.
 */
function recorteRedondo(imagem, destino, circulo = encontrarCirculo(imagem)) {
  const { cx, cy, raio } = circulo;
  const lado = Math.round(raio * 2);
  const quadrado = crop(imagem, Math.round(cx - raio), Math.round(cy - raio), lado);
  const pequeno = resize(quadrado, destino);

  // A borda é suavizada num pixel: sem isto, o círculo fica serrilhado.
  const centro = (destino - 1) / 2;
  const limite = destino / 2;
  for (let y = 0; y < destino; y++) {
    for (let x = 0; x < destino; x++) {
      const d = Math.hypot(x - centro, y - centro);
      const i = (y * destino + x) * 4;
      const peso = Math.min(1, Math.max(0, limite - d));
      pequeno.pixels[i + 3] = Math.round(pequeno.pixels[i + 3] * peso);
    }
  }

  return pequeno;
}

/* ---------------------------------------------------------------- */
/* O favicon                                                        */
/* ---------------------------------------------------------------- */

/**
 * Um .ico é um índice com imagens lá dentro, e desde o IE11 que essas imagens
 * podem ser PNG — o que poupa escrever o formato antigo com máscara de bits.
 */
function encodeIco(imagens) {
  const cabecalho = Buffer.alloc(6);
  cabecalho.writeUInt16LE(0, 0); // reservado
  cabecalho.writeUInt16LE(1, 2); // 1 = ícone
  cabecalho.writeUInt16LE(imagens.length, 4);

  let offset = 6 + imagens.length * 16;
  const entradas = [];
  for (const { size, png } of imagens) {
    const entrada = Buffer.alloc(16);
    entrada[0] = size >= 256 ? 0 : size; // 0 quer dizer 256
    entrada[1] = size >= 256 ? 0 : size;
    entrada.writeUInt16LE(1, 4); // planos
    entrada.writeUInt16LE(32, 6); // bits por pixel
    entrada.writeUInt32BE(0, 8);
    entrada.writeUInt32LE(png.length, 8);
    entrada.writeUInt32LE(offset, 12);
    entradas.push(entrada);
    offset += png.length;
  }

  return Buffer.concat([cabecalho, ...entradas, ...imagens.map(({ png }) => png)]);
}

/* ---------------------------------------------------------------- */

const fonte = decodePng(await readFile(FONTE));
const FUNDO = corDoFundo(fonte);
await mkdir(ICONS, { recursive: true });
await mkdir(MASCOTE, { recursive: true });

const escrever = async (ficheiro, imagem) => {
  const png = encodePng(posterizar(imagem));
  await writeFile(ficheiro, png);
  console.log(
    `[icons] ${path.relative(RAIZ, ficheiro)} — ${imagem.width}×${imagem.height}, ${(png.length / 1024).toFixed(1)} kB`,
  );
  return png;
};

/* Os ícones do manifesto: o desenho inteiro, tal e qual. */
await escrever(path.join(ICONS, "icon-192.png"), resize(fonte, 192));
await escrever(path.join(ICONS, "icon-512.png"), resize(fonte, 512));

/* Maskable: o sistema recorta à forma dele (círculo, gota, quadrado), por isso
   o desenho encolhe e o fundo enche o quadrado até às bordas. */
await escrever(
  path.join(ICONS, "icon-maskable-512.png"),
  padrao(fonte, 512, { escala: 0.78, fundo: FUNDO }),
);

/* O iOS põe os cantos redondos por si e não gosta de transparência. */
await escrever(path.join(ICONS, "apple-touch-icon.png"), padrao(fonte, 180, { fundo: FUNDO }));

/* O favicon leva os três tamanhos que os browsers pedem (separador, barra de
   favoritos, atalho no ambiente de trabalho). */
const ico = encodeIco(
  [16, 32, 48].map((size) => ({
    size,
    png: encodePng(posterizar(padrao(fonte, size, { fundo: FUNDO }))),
  })),
);
await writeFile(path.join(RAIZ, "public/favicon.ico"), ico);
console.log(`[icons] public/favicon.ico — 16/32/48, ${(ico.length / 1024).toFixed(1)} kB`);

/* O mascote para dentro da app: redondo e leve, que aparece em cada lição. */
await escrever(path.join(MASCOTE, "chef-frog-avatar.png"), recorteRedondo(fonte, 256));
await escrever(path.join(MASCOTE, "chef-frog-avatar-96.png"), recorteRedondo(fonte, 96));

/* Os humores: a mesma ideia, um por cada momento da lição (acertar, errar,
   chumbar, ganhar XP). */
for (const humor of HUMORES) {
  const desenho = decodePng(await readFile(path.join(DESENHOS, `chef-frog-${humor}.png`)));
  const circulo = circuloAoCentro(desenho);
  await escrever(
    path.join(MASCOTE, `chef-frog-${humor}.png`),
    recorteRedondo(desenho, 256, circulo),
  );
  await escrever(
    path.join(MASCOTE, `chef-frog-${humor}-96.png`),
    recorteRedondo(desenho, 96, circulo),
  );
}
