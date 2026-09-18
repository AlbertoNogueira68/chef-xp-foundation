import { afterEach, describe, expect, test } from "vitest";
import { clearOutbox, enqueue, outboxCount, outboxItems, removeFromOutbox } from "./outbox";

/**
 * Sem IndexedDB — e o jsdom não tem — a fila vive em memória. É o mesmo
 * código a decidir tudo o que aqui se prova: ordem, substituição por `ref` e
 * limites. Que o IndexedDB a sério funciona prova-o o `check:offline-lesson`,
 * num Chrome com a rede cortada.
 */

afterEach(async () => clearOutbox());

const licao = (ref: string, respostas: unknown = []) => ({
  descricao: `Lição: ${ref}`,
  path: `/learning/lessons/${ref}/complete`,
  method: "POST" as const,
  body: { answers: respostas },
  tipo: "licao" as const,
  ref,
});

describe("caixa de saída", () => {
  test("guarda pela ordem de entrada", async () => {
    await enqueue(licao("massa"));
    await enqueue(licao("sopa"));
    await enqueue(licao("arroz"));

    expect((await outboxItems()).map((item) => item.ref)).toEqual(["massa", "sopa", "arroz"]);
  });

  test("guarda o corpo inteiro, para ser enviado tal e qual", async () => {
    await enqueue(licao("massa", [{ questionId: "q1", answer: "a" }]));

    const guardado = await outboxItems();
    expect(guardado).toHaveLength(1);
    expect(guardado[0].body).toEqual({ answers: [{ questionId: "q1", answer: "a" }] });
  });

  test("a mesma lição outra vez substitui a tentativa anterior", async () => {
    await enqueue(licao("massa", [{ questionId: "q1", answer: "errada" }]));
    await enqueue(licao("massa", [{ questionId: "q1", answer: "certa" }]));

    // Duas entradas para a mesma lição davam dois envios e duas correções,
    // quando o que a pessoa fez foi repetir a lição.
    expect(outboxCount()).toBe(1);
    expect((await outboxItems())[0].body).toEqual({
      answers: [{ questionId: "q1", answer: "certa" }],
    });
  });

  test("lições diferentes não se atropelam", async () => {
    await enqueue(licao("massa"));
    await enqueue(licao("sopa"));
    expect(outboxCount()).toBe(2);
  });

  test("uma fotografia de missão cabe — era o que faltava à versão anterior", async () => {
    // Um megabyte de imagem: recusado enquanto a fila viveu no localStorage,
    // que tem cinco megabytes para tudo.
    const foto = await enqueue({
      descricao: "Foto: passo 2",
      path: "/missions/runs/7/checkpoint",
      method: "POST" as const,
      body: { stepIndex: 2, imageDataUrl: `data:image/jpeg;base64,${"A".repeat(1_000_000)}` },
      tipo: "foto" as const,
      ref: "7-2",
    });

    expect(foto).not.toBeNull();
    expect(outboxCount()).toBe(1);
  });

  test("um corpo grande demais na mesma não entra", async () => {
    // Dez megabytes não são uma fotografia redimensionada: são um erro algures.
    const enorme = await enqueue({
      ...licao("foto"),
      body: { imagem: "x".repeat(10_000_000) },
    });

    expect(enorme).toBeNull();
    expect(outboxCount()).toBe(0);
  });

  test("uma fila esquecida não cresce sem fim", async () => {
    for (let i = 0; i < 55; i++) await enqueue(licao(`licao-${i}`));
    expect(outboxCount()).toBe(50);
  });

  test("remover tira só o que se pediu", async () => {
    await enqueue(licao("massa"));
    const sopa = (await enqueue(licao("sopa")))!;
    await removeFromOutbox(sopa.id);

    expect((await outboxItems()).map((item) => item.ref)).toEqual(["massa"]);
  });
});
