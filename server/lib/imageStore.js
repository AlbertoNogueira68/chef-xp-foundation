import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(rootDir, "uploads");

export const UPLOAD_ROUTE = "/uploads";
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export class InvalidImageError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidImageError";
    this.status = 400;
  }
}

/**
 * O tipo é decidido pelos bytes iniciais do ficheiro, não pelo MIME declarado
 * no data URL — o cliente pode mentir sobre o segundo, não sobre o primeiro.
 * É isto que impede que um script com extensão .jpg entre na pasta pública.
 */
const SIGNATURES = [
  {
    ext: "jpg",
    test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: "png",
    test: (b) => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    ext: "webp",
    test: (b) =>
      b.length >= 12 &&
      b.subarray(0, 4).toString("ascii") === "RIFF" &&
      b.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

export function detectImageType(buffer) {
  return SIGNATURES.find((sig) => sig.test(buffer))?.ext ?? null;
}

export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

/**
 * Aceita um data URL (o cliente já redimensiona no canvas antes de enviar),
 * valida-o e grava-o em disco. Devolve o caminho público.
 * O nome é um UUID gerado no servidor: o cliente nunca escolhe o caminho.
 */
export async function saveDataUrlImage(dataUrl) {
  if (typeof dataUrl !== "string") {
    throw new InvalidImageError("Imagem inválida");
  }

  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) {
    throw new InvalidImageError("Só são aceites imagens PNG, JPEG ou WebP em base64");
  }

  const buffer = Buffer.from(match[2], "base64");

  if (buffer.length === 0) {
    throw new InvalidImageError("Imagem vazia");
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new InvalidImageError(
      `Imagem demasiado grande (máximo ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB)`,
    );
  }

  const ext = detectImageType(buffer);
  if (!ext) {
    throw new InvalidImageError("O conteúdo não é uma imagem PNG, JPEG ou WebP");
  }

  await ensureUploadDir();
  const filename = `${crypto.randomUUID()}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return `${UPLOAD_ROUTE}/${filename}`;
}

/**
 * Aceita um data URL (que grava) ou um caminho já nosso (que devolve tal e
 * qual).
 *
 * URLs externos eram aceites aqui com a justificação de servirem o seed, mas o
 * seed é SQL puro e nunca passa por esta função: só as rotas passam. Ou seja,
 * a única coisa que isso permitia era um cliente apontar a fotografia de uma
 * receita para um servidor de terceiros — que carrega no browser de toda a
 * gente que vê o feed, e que em produção a CSP bloqueia na mesma.
 */
export async function resolveImageInput(input) {
  if (input == null || input === "") return null;
  if (typeof input !== "string") throw new InvalidImageError("Imagem inválida");

  if (input.startsWith("data:")) return saveDataUrlImage(input);
  if (input.startsWith(`${UPLOAD_ROUTE}/`)) return input;

  throw new InvalidImageError("Imagem inválida");
}

/**
 * Descarrega uma imagem de um endereço e grava-a como as outras.
 *
 * Existe para a fotografia de perfil da Google. A alternativa era guardar o
 * endereço dela e deixar o browser de quem vê o feed ir buscá-lo — o que
 * obrigava a abrir a CSP ao domínio da Google, dava-lhe a lista de quem vê o
 * quê, e deixava a fotografia à mercê de um URL que um dia deixa de existir.
 *
 * `hosts` não tem valor por omissão de propósito: quem chama tem de dizer de
 * onde aceita descarregar. Uma função que vai à rede buscar um endereço vindo
 * de fora, sem lista de anfitriões, é um pedido forjado à espera de acontecer.
 */
export async function saveRemoteImage(url, { hosts, timeoutMs = 5000 } = {}) {
  if (!Array.isArray(hosts) || hosts.length === 0) {
    throw new Error("saveRemoteImage exige a lista de anfitriões permitidos");
  }

  let alvo;
  try {
    alvo = new URL(String(url));
  } catch {
    throw new InvalidImageError("Endereço de imagem inválido");
  }

  if (alvo.protocol !== "https:") {
    throw new InvalidImageError("Só se descarregam imagens por https");
  }
  if (!hosts.some((host) => alvo.hostname === host || alvo.hostname.endsWith(`.${host}`))) {
    throw new InvalidImageError(`Anfitrião não permitido: ${alvo.hostname}`);
  }

  // Um pedido sem prazo é um pedido que pode ficar pendurado a segurar o
  // início de sessão de alguém.
  const cancelar = AbortSignal.timeout(timeoutMs);
  const resposta = await fetch(alvo, { signal: cancelar, redirect: "follow" });

  if (!resposta.ok) {
    throw new InvalidImageError(`A imagem respondeu ${resposta.status}`);
  }

  // O cabeçalho é uma dica e pode mentir ou faltar; serve para desistir cedo
  // do que é claramente grande de mais. O tamanho a sério é medido a seguir.
  const anunciado = Number(resposta.headers.get("content-length") ?? 0);
  if (anunciado > MAX_IMAGE_BYTES) {
    throw new InvalidImageError("Imagem demasiado grande");
  }

  const buffer = Buffer.from(await resposta.arrayBuffer());
  if (buffer.length === 0) throw new InvalidImageError("Imagem vazia");
  if (buffer.length > MAX_IMAGE_BYTES) throw new InvalidImageError("Imagem demasiado grande");

  // A mesma regra de sempre: o tipo sai dos bytes, não do que o servidor diz.
  const ext = detectImageType(buffer);
  if (!ext) throw new InvalidImageError("O conteúdo não é uma imagem PNG, JPEG ou WebP");

  await ensureUploadDir();
  const filename = `${crypto.randomUUID()}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return `${UPLOAD_ROUTE}/${filename}`;
}
