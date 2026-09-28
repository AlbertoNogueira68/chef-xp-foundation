import test, { afterEach, describe } from "node:test";
import assert from "node:assert/strict";

import { CAMPOS_REMOVIDOS, log } from "./logger.js";

/**
 * O log é a única coisa que fica de um pedido que já acabou, e por isso é
 * também a maneira mais fácil de dados pessoais saírem de um sistema sem
 * ninguém ter decidido que saíam. O que este ficheiro protege é sobretudo
 * isso: o que **não** pode aparecer numa linha de log.
 */

/** Apanha o que o logger escreve, sem o deixar chegar ao terminal. */
function capturar(fn, { nivel = "info", producao = false } = {}) {
  const linhas = [];
  const originais = { out: process.stdout.write, err: process.stderr.write };
  const nivelAntes = process.env.LOG_LEVEL;
  const envAntes = process.env.NODE_ENV;

  process.env.LOG_LEVEL = nivel;
  process.env.NODE_ENV = producao ? "production" : "development";
  process.stdout.write = (texto) => (linhas.push(String(texto)), true);
  process.stderr.write = (texto) => (linhas.push(String(texto)), true);

  try {
    fn();
  } finally {
    process.stdout.write = originais.out;
    process.stderr.write = originais.err;
    if (nivelAntes === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = nivelAntes;
    if (envAntes === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = envAntes;
  }

  return linhas;
}

/** A linha, já como objeto. Só serve no modo de produção, que escreve JSON. */
function comoJson(linha) {
  return JSON.parse(linha);
}

afterEach(() => {
  // Um teste que mexa no ambiente e falhe a meio não contamina o seguinte.
  delete process.env.LOG_LEVEL;
});

describe("o log do servidor", () => {
  test("em produção escreve uma linha de JSON por chamada", () => {
    const linhas = capturar(() => log.info({ userId: "u1" }, "olá"), { producao: true });

    assert.equal(linhas.length, 1);
    const linha = comoJson(linhas[0]);
    assert.equal(linha.msg, "olá");
    assert.equal(linha.level, "info");
    assert.equal(linha.userId, "u1");
    assert.ok(Date.parse(linha.ts), "a linha leva um instante legível");
  });

  test("em desenvolvimento escreve para uma pessoa ler", () => {
    const linhas = capturar(() => log.info({ userId: "u1" }, "olá"));

    assert.match(linhas[0], /INFO\s+olá/);
    assert.throws(() => comoJson(linhas[0]), "não é JSON: é para ler ao vivo");
  });

  test("os erros vão para o stderr e o resto para o stdout", () => {
    const saidas = [];
    const originais = { out: process.stdout.write, err: process.stderr.write };
    process.env.LOG_LEVEL = "debug";
    process.stdout.write = () => (saidas.push("stdout"), true);
    process.stderr.write = () => (saidas.push("stderr"), true);

    try {
      log.info("normal");
      log.warn("aviso");
      log.error("problema");
    } finally {
      process.stdout.write = originais.out;
      process.stderr.write = originais.err;
    }

    assert.deepEqual(saidas, ["stdout", "stdout", "stderr"]);
  });

  test("o nível filtra o que se escreve", () => {
    const linhas = capturar(
      () => {
        log.debug("detalhe");
        log.info("informação");
        log.error("problema");
      },
      { nivel: "error" },
    );

    assert.equal(linhas.length, 1);
    assert.match(linhas[0], /problema/);
  });

  test("silent não escreve nada — é o que os testes usam", () => {
    const linhas = capturar(
      () => {
        log.error("isto não devia aparecer");
      },
      { nivel: "silent" },
    );

    assert.deepEqual(linhas, []);
  });

  describe("o que nunca entra no log", () => {
    test("passwords e tokens são removidos", () => {
      const linhas = capturar(
        () => log.info({ password: "Chef12345!", token: "abc.def.ghi" }, "registo"),
        { producao: true },
      );

      const linha = comoJson(linhas[0]);
      assert.equal(linha.password, "[removido]");
      assert.equal(linha.token, "[removido]");
      assert.ok(!linhas[0].includes("Chef12345!"), "a password não está na linha");
      assert.ok(!linhas[0].includes("abc.def.ghi"), "o token não está na linha");
    });

    test("o email também — é o identificador pessoal da aplicação", () => {
      const linhas = capturar(() => log.warn({ email: "alguem@exemplo.pt" }, "falha"), {
        producao: true,
      });

      assert.ok(
        !linhas[0].includes("alguem@exemplo.pt"),
        "um endereço de email nunca devia ficar num log",
      );
      assert.equal(comoJson(linhas[0]).email, "[removido]");
    });

    test("e também quando vêm aninhados", () => {
      const linhas = capturar(
        () => log.info({ pedido: { corpo: { password: "segredo", nome: "Ana" } } }, "pedido"),
        { producao: true },
      );

      const linha = comoJson(linhas[0]);
      assert.equal(linha.pedido.corpo.password, "[removido]");
      assert.equal(linha.pedido.corpo.nome, "Ana", "o que não é segredo continua legível");
    });

    test("a lista de campos removidos cobre o que a aplicação manuseia", () => {
      for (const campo of ["password", "token", "email", "cookie", "authorization"]) {
        assert.ok(CAMPOS_REMOVIDOS.has(campo), `${campo} tinha de estar na lista`);
      }
    });
  });

  test("um Error entra com mensagem e stack, e não como objeto vazio", () => {
    // `JSON.stringify(new Error(...))` dá `{}`, que é a maneira mais comum de
    // um log parecer estar a registar erros e não estar a registar nada.
    const linhas = capturar(() => log.error({ err: new Error("rebentou") }, "falhou"), {
      producao: true,
    });

    const linha = comoJson(linhas[0]);
    assert.equal(linha.err.message, "rebentou");
    assert.ok(linha.err.stack.includes("logger.test.js"), "o stack aponta para a origem");
  });

  test("aceita só uma mensagem, sem campos", () => {
    const linhas = capturar(() => log.info("sem campos"), { producao: true });
    assert.equal(comoJson(linhas[0]).msg, "sem campos");
  });

  test("um filho carrega os campos fixos para todas as suas linhas", () => {
    const pedido = log.child({ requestId: "r-1" });
    const linhas = capturar(
      () => {
        pedido.info({ passo: 1 }, "começou");
        pedido.error("acabou mal");
      },
      { producao: true },
    );

    assert.equal(comoJson(linhas[0]).requestId, "r-1");
    assert.equal(comoJson(linhas[0]).passo, 1);
    assert.equal(comoJson(linhas[1]).requestId, "r-1", "o segundo também");
  });

  test("uma referência circular não rebenta o log", () => {
    const circular = { nome: "ciclo" };
    circular.eu = circular;

    // O que importa é não atirar: um logger que rebenta apaga a informação
    // que existia para dar.
    assert.doesNotThrow(() =>
      capturar(() => log.info({ circular }, "circular"), { producao: true }),
    );
  });
});
