import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";

/* O módulo lê UPLOAD_DIR no momento da importação. */
const dir = await fs.mkdtemp(path.join(os.tmpdir(), "chefxp-uploads-"));
process.env.UPLOAD_DIR = dir;
const { MAX_IMAGE_BYTES, isAllowedRemoteImage, saveRemoteImage } = await import("./imageStore.js");

/* PNG de 1×1 válido — a validação olha para os bytes, não para o nome. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let server;
let base;

before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === "/foto.png") {
      res.writeHead(200, { "content-type": "image/png" });
      return res.end(PNG);
    }
    if (req.url === "/script") {
      // Um script a dizer que é uma imagem.
      res.writeHead(200, { "content-type": "image/png" });
      return res.end(Buffer.from("<script>alert(1)</script>", "utf8"));
    }
    if (req.url === "/enorme") {
      res.writeHead(200, { "content-type": "image/png" });
      return res.end(Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE_BYTES, 0x00)]));
    }
    if (req.url === "/vazia") {
      res.writeHead(200, { "content-type": "image/png" });
      return res.end();
    }
    res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(dir, { recursive: true, force: true });
});

/**
 * O servidor de teste fala http. A política vai explícita nestes casos para o
 * transporte poder ser exercitado; que o valor por omissão recusa http é o que
 * os testes da política a seguir garantem.
 */
const local = { hosts: [/^127\.0\.0\.1$/], protocols: ["http:"] };

async function contarFicheiros() {
  return (await fs.readdir(dir).catch(() => [])).length;
}

/* ------------------------------------------------------------------ */
/* A política                                                         */
/* ------------------------------------------------------------------ */

test("por omissão só passa https", () => {
  assert.equal(isAllowedRemoteImage("http://lh3.googleusercontent.com/a/b"), null);
  assert.ok(isAllowedRemoteImage("https://lh3.googleusercontent.com/a/b"));
});

test("só os anfitriões da lista, e a verificação é do fim do nome", () => {
  // `googleusercontent.com.mau.pt` não é a Google: um "contém" deixava passar.
  assert.equal(isAllowedRemoteImage("https://googleusercontent.com.mau.pt/f.png"), null);
  assert.equal(isAllowedRemoteImage("https://naogoogleusercontent.com/f.png"), null);
  assert.ok(isAllowedRemoteImage("https://googleusercontent.com/f.png"));
  assert.ok(isAllowedRemoteImage("https://lh3.googleusercontent.com/f.png"));
});

test("endereços internos não são alcançáveis a partir de um `picture` forjado", () => {
  // Sem a lista, um servidor que vai buscar o que lhe mandam é um mensageiro
  // para a rede interna de quem o hospeda.
  assert.equal(isAllowedRemoteImage("https://localhost/f.png"), null);
  assert.equal(isAllowedRemoteImage("https://127.0.0.1/f.png"), null);
  assert.equal(isAllowedRemoteImage("https://169.254.169.254/latest/meta-data/"), null);
  assert.equal(isAllowedRemoteImage("https://10.0.0.1/f.png"), null);
});

test("lixo à entrada não rebenta", () => {
  assert.equal(isAllowedRemoteImage(null), null);
  assert.equal(isAllowedRemoteImage(""), null);
  assert.equal(isAllowedRemoteImage("nem-sequer-e-um-url"), null);
  assert.equal(isAllowedRemoteImage("ftp://algures/f.png"), null);
  assert.equal(isAllowedRemoteImage("file:///etc/passwd"), null);
});

/* ------------------------------------------------------------------ */
/* O transporte                                                       */
/* ------------------------------------------------------------------ */

test("uma imagem válida fica guardada com um nome escolhido pelo servidor", async () => {
  const caminho = await saveRemoteImage(`${base}/foto.png`, local);

  assert.match(caminho, /^\/uploads\/[0-9a-f-]{36}\.png$/);
  const gravado = await fs.readFile(path.join(dir, path.basename(caminho)));
  assert.deepEqual(gravado, PNG);
});

test("um script disfarçado de imagem não entra na pasta pública", async () => {
  // Mesma regra do upload: o tipo vem dos bytes e não do `content-type`.
  const antes = await contarFicheiros();
  assert.equal(await saveRemoteImage(`${base}/script`, local), null);
  assert.equal(await contarFicheiros(), antes, "nada devia ter sido escrito");
});

test("uma imagem demasiado grande é descartada", async () => {
  const antes = await contarFicheiros();
  assert.equal(await saveRemoteImage(`${base}/enorme`, local), null);
  assert.equal(await contarFicheiros(), antes);
});

test("uma resposta vazia é descartada", async () => {
  assert.equal(await saveRemoteImage(`${base}/vazia`, local), null);
});

test("falhar a ir buscar a fotografia não é um erro", async () => {
  // Ninguém pode ficar impedido de entrar porque a foto não veio: sem ela o
  // avatar mostra as iniciais, que é o que já fazia.
  assert.equal(await saveRemoteImage(`${base}/nao-existe`, local), null);
  assert.equal(
    await saveRemoteImage("http://127.0.0.1:1/f.png", local),
    null,
    "ligação recusada também devolve null",
  );
});
