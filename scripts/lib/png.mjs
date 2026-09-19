/**
 * PNG a sério, sem dependências: ler, encolher e escrever.
 *
 * O Node já traz o `zlib`, e um PNG é pouco mais do que as linhas de pixels
 * comprimidas com um cabeçalho à frente. Vale a pena tê-lo aqui porque é o que
 * permite que os ícones da app sejam *gerados* a partir de uma imagem única
 * guardada no repositório — muda-se o desenho do chef, corre-se o script, e
 * saem todos os tamanhos iguais entre si.
 *
 * O que suporta: 8 bits por canal, RGB ou RGBA, sem entrelaçamento. É o que o
 * exportador de qualquer ferramenta de desenho dá por omissão.
 */

import { deflateSync, inflateSync } from "node:zlib";

/* ---------------------------------------------------------------- */
/* Escrever                                                         */
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
export function encodePng({ width, height, pixels }) {
  // Cada linha leva à frente o byte do filtro. Zero = sem filtro: o ganho de
  // compressão dos outros não compensa a complexidade para imagens destas.
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
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
/* Ler                                                              */
/* ---------------------------------------------------------------- */

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Devolve `{ width, height, pixels }` em RGBA. */
export function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error("isto não é um PNG");

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  for (let offset = 8; offset < buffer.length;) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error("PNG entrelaçado não é suportado");
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }

    offset += 12 + length;
  }

  if (bitDepth !== 8) throw new Error(`só 8 bits por canal (este tem ${bitDepth})`);
  if (colorType !== 2 && colorType !== 6) throw new Error("só RGB ou RGBA");

  const canais = colorType === 6 ? 4 : 3;
  const stride = width * canais;
  const raw = inflateSync(Buffer.concat(idat));

  // Desfazer o filtro, linha a linha: cada byte foi guardado como a diferença
  // para um vizinho, e só se recupera com a linha anterior já resolvida.
  const linhas = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filtro = raw[y * (stride + 1)];
    const entrada = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const saida = linhas.subarray(y * stride, (y + 1) * stride);
    const anterior = y === 0 ? null : linhas.subarray((y - 1) * stride, y * stride);

    for (let i = 0; i < stride; i++) {
      const a = i >= canais ? saida[i - canais] : 0;
      const b = anterior ? anterior[i] : 0;
      const c = anterior && i >= canais ? anterior[i - canais] : 0;
      const x = entrada[i];
      saida[i] =
        (filtro === 0
          ? x
          : filtro === 1
            ? x + a
            : filtro === 2
              ? x + b
              : filtro === 3
                ? x + ((a + b) >> 1)
                : x + paeth(a, b, c)) & 0xff;
    }
  }

  const pixels = Buffer.alloc(width * height * 4);
  for (let i = 0, j = 0; i < width * height; i++, j += canais) {
    pixels[i * 4] = linhas[j];
    pixels[i * 4 + 1] = linhas[j + 1];
    pixels[i * 4 + 2] = linhas[j + 2];
    pixels[i * 4 + 3] = canais === 4 ? linhas[j + 3] : 255;
  }

  return { width, height, pixels };
}

/* ---------------------------------------------------------------- */
/* Transformar                                                      */
/* ---------------------------------------------------------------- */

/**
 * Encolher com média de área: cada pixel de saída é a média de todos os de
 * entrada que lhe calham. Mais lento do que apanhar o pixel do meio, e é a
 * diferença entre um ícone limpo e um ícone às escadinhas.
 *
 * A média é feita com a cor já multiplicada pelo alfa, senão o preto das
 * zonas transparentes escorre para as bordas.
 */
export function resize(imagem, destino) {
  const { width: sw, height: sh, pixels: src } = imagem;
  const out = Buffer.alloc(destino * destino * 4);
  const escalaX = sw / destino;
  const escalaY = sh / destino;

  for (let y = 0; y < destino; y++) {
    const y0 = Math.floor(y * escalaY);
    const y1 = Math.max(y0 + 1, Math.ceil((y + 1) * escalaY));

    for (let x = 0; x < destino; x++) {
      const x0 = Math.floor(x * escalaX);
      const x1 = Math.max(x0 + 1, Math.ceil((x + 1) * escalaX));

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;

      for (let sy = y0; sy < Math.min(y1, sh); sy++) {
        for (let sx = x0; sx < Math.min(x1, sw); sx++) {
          const i = (sy * sw + sx) * 4;
          const alfa = src[i + 3] / 255;
          r += src[i] * alfa;
          g += src[i + 1] * alfa;
          b += src[i + 2] * alfa;
          a += src[i + 3];
          n++;
        }
      }

      const i = (y * destino + x) * 4;
      const alfaMedio = a / n;
      const peso = alfaMedio === 0 ? 0 : n / (a / 255);
      out[i] = Math.round((r / n) * peso);
      out[i + 1] = Math.round((g / n) * peso);
      out[i + 2] = Math.round((b / n) * peso);
      out[i + 3] = Math.round(alfaMedio);
    }
  }

  return { width: destino, height: destino, pixels: out };
}

/** Recorta um quadrado a partir do canto `(x, y)`. */
export function crop(imagem, x, y, lado) {
  const out = Buffer.alloc(lado * lado * 4);
  for (let dy = 0; dy < lado; dy++) {
    const sy = y + dy;
    if (sy < 0 || sy >= imagem.height) continue;
    for (let dx = 0; dx < lado; dx++) {
      const sx = x + dx;
      if (sx < 0 || sx >= imagem.width) continue;
      imagem.pixels.copy(
        out,
        (dy * lado + dx) * 4,
        (sy * imagem.width + sx) * 4,
        (sy * imagem.width + sx) * 4 + 4,
      );
    }
  }
  return { width: lado, height: lado, pixels: out };
}

/** Desenha `imagem` (quadrada) centrada e à escala dentro de um quadrado de `lado`. */
export function padrao(imagem, lado, { escala = 1, fundo = null } = {}) {
  const interior = Math.round(lado * escala);
  const pequena = resize(imagem, interior);
  const margem = Math.round((lado - interior) / 2);
  const out = Buffer.alloc(lado * lado * 4);

  if (fundo) {
    for (let i = 0; i < lado * lado; i++) {
      out[i * 4] = fundo[0];
      out[i * 4 + 1] = fundo[1];
      out[i * 4 + 2] = fundo[2];
      out[i * 4 + 3] = 255;
    }
  }

  for (let y = 0; y < interior; y++) {
    for (let x = 0; x < interior; x++) {
      const s = (y * interior + x) * 4;
      const d = ((y + margem) * lado + (x + margem)) * 4;
      const alfa = pequena.pixels[s + 3] / 255;
      for (let c = 0; c < 3; c++) {
        out[d + c] = Math.round(pequena.pixels[s + c] * alfa + out[d + c] * (1 - alfa));
      }
      out[d + 3] = Math.max(out[d + 3], pequena.pixels[s + 3]);
    }
  }

  return { width: lado, height: lado, pixels: out };
}

/**
 * Arredonda cada canal a 5 bits. Num desenho chapado não se vê diferença, e
 * corta o ficheiro a um terço — o encolhimento inventa centenas de tons quase
 * iguais nas bordas, e é isso que o deflate não consegue comprimir.
 */
export function posterizar(imagem) {
  for (let i = 0; i < imagem.pixels.length; i += 4) {
    for (let c = 0; c < 3; c++) imagem.pixels[i + c] = (imagem.pixels[i + c] & 0xf8) | 4;
  }
  return imagem;
}
