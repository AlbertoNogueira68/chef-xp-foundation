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
    throw new InvalidImageError("Invalid image");
  }

  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) {
    throw new InvalidImageError("Only base64 PNG, JPEG or WebP images are accepted");
  }

  const buffer = Buffer.from(match[2], "base64");

  if (buffer.length === 0) {
    throw new InvalidImageError("Imagem vazia");
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new InvalidImageError(
      `Image too large (max ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB)`,
    );
  }

  const ext = detectImageType(buffer);
  if (!ext) {
    throw new InvalidImageError("The content isn't a PNG, JPEG or WebP image");
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
  if (typeof input !== "string") throw new InvalidImageError("Invalid image");

  if (input.startsWith("data:")) return saveDataUrlImage(input);
  if (isStoredImagePath(input)) return input;

  throw new InvalidImageError("Invalid image");
}

/**
 * É um caminho que esta aplicação gerou?
 *
 * Antes bastava começar por `/uploads/`, e isso aceitava
 * `/uploads/../../qualquer-coisa` — que ficava guardado tal e qual na base de
 * dados. Quem servia o ficheiro recusava-o (o `express.static` bloqueia
 * traversal), portanto nunca leu nada de lado nenhum; o que dava era guardar
 * no perfil de alguém um endereço que aponta para outra rota da aplicação.
 * O nome de um ficheiro nosso é um UUID e uma de três extensões, e é só isso
 * que se aceita — a mesma forma que o `saveDataUrlImage` escreve.
 */
export function isStoredImagePath(value) {
  return (
    typeof value === "string" &&
    new RegExp(
      `^${UPLOAD_ROUTE}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp)$`,
    ).test(value)
  );
}

/**
 * Apaga um ficheiro que esta aplicação gravou.
 *
 * Chamar isto **depois** do COMMIT, nunca dentro da transação: um ROLLBACK
 * deixava a linha viva e o ficheiro morto, que é a única das duas metades que
 * não se consegue recuperar.
 *
 * Nunca atira. Uma receita apagada com sucesso não volta a existir porque o
 * disco recusou apagar a fotografia — o que falha aqui fica no registo e é
 * apanhado pela limpeza periódica.
 */
export async function deleteStoredImage(publicPath) {
  if (!isStoredImagePath(publicPath)) return false;

  const nome = publicPath.slice(UPLOAD_ROUTE.length + 1);
  const destino = path.join(UPLOAD_DIR, nome);

  // Cinto e suspensórios: o nome já passou pela expressão acima, mas quem
  // apaga ficheiros confirma sempre que está dentro da pasta certa.
  const relativo = path.relative(UPLOAD_DIR, destino);
  if (relativo.startsWith("..") || path.isAbsolute(relativo)) return false;

  try {
    await fs.unlink(destino);
    return true;
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`[uploads] não foi possível apagar ${nome}:`, error.message);
    }
    return false;
  }
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
/** Quantos saltos se seguem antes de desistir. */
const MAX_REDIRECTS = 3;

const ehRedirecionamento = (resposta) => resposta.status >= 300 && resposta.status < 400;

const hostPermitido = (hostname, hosts) =>
  hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));

/**
 * Lê o corpo da resposta e desiste assim que passar o tecto.
 *
 * `arrayBuffer()` lia tudo primeiro e media depois — e `content-length` é
 * opcional, portanto uma resposta em `chunked` sem esse cabeçalho entrava
 * inteira na memória por muito grande que fosse. Aqui o tecto é verificado a
 * cada pedaço, e a ligação é cortada no momento em que deixa de valer a pena.
 */
async function lerAteAoTecto(resposta, maximo) {
  if (!resposta.body) return Buffer.alloc(0);

  const pedacos = [];
  let total = 0;

  for await (const pedaco of resposta.body) {
    total += pedaco.length;
    if (total > maximo) {
      await resposta.body.cancel?.().catch(() => {});
      throw new InvalidImageError("Imagem demasiado grande");
    }
    pedacos.push(Buffer.from(pedaco));
  }

  return Buffer.concat(pedacos, total);
}

export async function saveRemoteImage(url, { hosts, timeoutMs = 5000 } = {}) {
  if (!Array.isArray(hosts) || hosts.length === 0) {
    throw new Error("saveRemoteImage requires the allowed hosts list");
  }

  let alvo;
  try {
    alvo = new URL(String(url));
  } catch {
    throw new InvalidImageError("Invalid image address");
  }

  if (alvo.protocol !== "https:") {
    throw new InvalidImageError("Images are only downloaded over https");
  }
  if (!hostPermitido(alvo.hostname, hosts)) {
    throw new InvalidImageError(`Host not allowed: ${alvo.hostname}`);
  }

  // Um pedido sem prazo é um pedido que pode ficar pendurado a segurar o
  // início de sessão de alguém.
  const cancelar = AbortSignal.timeout(timeoutMs);

  /**
   * `redirect: "manual"`, e a lista de anfitriões outra vez a cada salto.
   *
   * Com `follow`, a lista era verificada no endereço que nos deram e mais
   * nunca: um anfitrião permitido que respondesse 302 para um endereço
   * interno levava o servidor lá, e a única porta desta aplicação para a rede
   * passava a estar aberta pelo lado de dentro. Três saltos chegam para o
   * encurtador que a Google usa nas fotografias de perfil.
   */
  let resposta = await fetch(alvo, { signal: cancelar, redirect: "manual" });

  for (let salto = 0; salto < MAX_REDIRECTS && ehRedirecionamento(resposta); salto += 1) {
    const destino = resposta.headers.get("location");
    if (!destino) throw new InvalidImageError("Redirecionamento sem destino");

    let seguinte;
    try {
      seguinte = new URL(destino, alvo);
    } catch {
      throw new InvalidImageError("Redirecionamento para um endereço inválido");
    }

    if (seguinte.protocol !== "https:") {
      throw new InvalidImageError("Images are only downloaded over https");
    }
    if (!hostPermitido(seguinte.hostname, hosts)) {
      throw new InvalidImageError(`Host not allowed: ${seguinte.hostname}`);
    }

    alvo = seguinte;
    resposta = await fetch(alvo, { signal: cancelar, redirect: "manual" });
  }

  if (ehRedirecionamento(resposta)) {
    throw new InvalidImageError("Demasiados redirecionamentos");
  }

  if (!resposta.ok) {
    throw new InvalidImageError(`A imagem respondeu ${resposta.status}`);
  }

  // O cabeçalho é uma dica e pode mentir ou faltar; serve para desistir cedo
  // do que é claramente grande de mais. O tamanho a sério é medido a seguir.
  const anunciado = Number(resposta.headers.get("content-length") ?? 0);
  if (anunciado > MAX_IMAGE_BYTES) {
    throw new InvalidImageError("Imagem demasiado grande");
  }

  const buffer = await lerAteAoTecto(resposta, MAX_IMAGE_BYTES);
  if (buffer.length === 0) throw new InvalidImageError("Imagem vazia");

  // A mesma regra de sempre: o tipo sai dos bytes, não do que o servidor diz.
  const ext = detectImageType(buffer);
  if (!ext) throw new InvalidImageError("The content isn't a PNG, JPEG or WebP image");

  await ensureUploadDir();
  const filename = `${crypto.randomUUID()}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return `${UPLOAD_ROUTE}/${filename}`;
}
