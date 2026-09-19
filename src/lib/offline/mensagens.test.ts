import { describe, expect, test } from "vitest";
import { avisoDoEnvio, avisoDoResumo } from "./mensagens";
import type { ResultadoDeEnvio } from "./sync";

/**
 * Depois de uma lição respondida sem rede, este aviso é a única altura em que
 * a pessoa fica a saber o que aconteceu. Se disser apenas "enviado", ficou
 * sem saber o que mais lhe interessa: passou ou não.
 */

const envio = (
  extra: Partial<ResultadoDeEnvio> & { resposta?: unknown } = {},
): ResultadoDeEnvio => ({
  estado: "enviado",
  item: {
    id: "1",
    criadoEm: 1,
    descricao: "Lesson: Massa fresca",
    path: "/learning/lessons/massa/complete",
    method: "POST",
    tipo: "licao",
  },
  ...extra,
});

describe("o que se diz depois de sincronizar", () => {
  test("passou: diz que passou e quanto XP rendeu", () => {
    const aviso = avisoDoEnvio(
      envio({ resposta: { passed: true, xpEarned: 40, streakBonus: 10 } }),
    );

    expect(aviso.tom).toBe("sucesso");
    expect(aviso.texto).toBe('"Massa fresca": you passed! +50 XP.');
  });

  test("chumbou: diz que chumbou, quantas falhou, e que pode repetir", () => {
    const aviso = avisoDoEnvio(
      envio({
        resposta: {
          passed: false,
          results: [{ correct: true }, { correct: false }, { correct: false }],
        },
      }),
    );

    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toMatch(/didn't pass/i);
    expect(aviso.texto).toMatch(/2 wrong answers/);
    expect(aviso.texto).toMatch(/stays open/i);
    // Um chumbo precisa de tempo para ser lido.
    expect(aviso.demorado).toBe(true);
  });

  test("uma só resposta errada não fica no plural", () => {
    const aviso = avisoDoEnvio(
      envio({ resposta: { passed: false, results: [{ correct: false }] } }),
    );
    expect(aviso.texto).toMatch(/one wrong answer/);
  });

  test("uma fotografia de missão diz apenas que seguiu", () => {
    const aviso = avisoDoEnvio(
      envio({
        item: {
          id: "2",
          criadoEm: 2,
          descricao: "Photo for step 3",
          path: "/missions/runs/7/checkpoint",
          method: "POST",
          tipo: "foto",
        },
      }),
    );

    expect(aviso.tom).toBe("sucesso");
    expect(aviso.texto).toBe("Photo for step 3 sent.");
  });

  test("uma recusa do servidor diz o motivo que o servidor deu", () => {
    const aviso = avisoDoEnvio(
      envio({ estado: "recusado", erro: "Finish the earlier lessons first" }),
    );

    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toMatch(/earlier lessons/i);
  });

  test("muitos de uma vez: um resumo com quantas passaram", () => {
    const aviso = avisoDoResumo([
      envio({ resposta: { passed: true, xpEarned: 40 } }),
      envio({ resposta: { passed: false, results: [{ correct: false }] } }),
      envio({ resposta: { passed: true, xpEarned: 30 } }),
    ]);

    expect(aviso.texto).toMatch(/2 of 3 lessons passed/);
    expect(aviso.texto).toMatch(/\+70 XP/);
  });
});
