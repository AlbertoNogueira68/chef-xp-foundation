import test from "node:test";
import assert from "node:assert/strict";

import { saveRemoteImage } from "./imageStore.js";

/**
 * O que aqui se prova é a porta, não o download.
 *
 * `saveRemoteImage` vai à rede buscar um endereço que veio de fora, e é isso
 * que a torna perigosa: sem lista de anfitriões, era o nosso servidor a fazer
 * o pedido que lhe mandassem — a um endereço interno, ao serviço de metadados
 * da máquina, ao que fosse. Estes testes não tocam na rede: todos eles têm de
 * ser recusados antes de haver pedido nenhum.
 */

const hosts = ["googleusercontent.com"];

test("sem lista de anfitriões, nem sequer tenta", async () => {
  await assert.rejects(
    () => saveRemoteImage("https://lh3.googleusercontent.com/a/x"),
    /lista de anfitriões/,
  );
  await assert.rejects(
    () => saveRemoteImage("https://lh3.googleusercontent.com/a/x", { hosts: [] }),
    /lista de anfitriões/,
  );
});

test("um anfitrião fora da lista é recusado", async () => {
  await assert.rejects(
    () => saveRemoteImage("https://exemplo.pt/foto.png", { hosts }),
    /Anfitrião não permitido/,
  );
});

test("um domínio que só acaba parecido não engana a lista", async () => {
  await assert.rejects(
    () => saveRemoteImage("https://googleusercontent.com.exemplo.pt/foto.png", { hosts }),
    /Anfitrião não permitido/,
  );
});

test("um subdomínio do anfitrião permitido passa a porta", async () => {
  // Chega à rede, e é aí que falha (o caminho não existe) — mas já não é a
  // porta a recusá-lo, que é o que este teste quer distinguir.
  await assert.rejects(
    () => saveRemoteImage("https://lh3.googleusercontent.com/nao-existe-de-certeza", { hosts }),
    (erro) => !/Anfitrião não permitido/.test(erro.message),
  );
});

test("só https", async () => {
  for (const endereco of [
    "http://lh3.googleusercontent.com/a/x",
    "http://169.254.169.254/latest/meta-data/",
    "file:///etc/passwd",
  ]) {
    await assert.rejects(() => saveRemoteImage(endereco, { hosts }), /https/);
  }
});

test("o que não é endereço nenhum é recusado", async () => {
  await assert.rejects(() => saveRemoteImage("isto não é um URL", { hosts }), /inválido/);
});
