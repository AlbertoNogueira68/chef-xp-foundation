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
    descricao: "Lição: Massa fresca",
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
    expect(aviso.texto).toBe('"Massa fresca": passaste! +50 XP.');
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
    expect(aviso.texto).toMatch(/não passaste/i);
    expect(aviso.texto).toMatch(/2 respostas erradas/);
    expect(aviso.texto).toMatch(/repetires/i);
    // Um chumbo precisa de tempo para ser lido.
    expect(aviso.demorado).toBe(true);
  });

  test("uma só resposta errada não fica no plural", () => {
    const aviso = avisoDoEnvio(
      envio({ resposta: { passed: false, results: [{ correct: false }] } }),
    );
    expect(aviso.texto).toMatch(/uma resposta errada/);
  });

  test("uma fotografia de missão diz apenas que seguiu", () => {
    const aviso = avisoDoEnvio(
      envio({
        item: {
          id: "2",
          criadoEm: 2,
          descricao: "Foto do passo 3",
          path: "/missions/runs/7/checkpoint",
          method: "POST",
          tipo: "foto",
        },
      }),
    );

    expect(aviso.tom).toBe("sucesso");
    expect(aviso.texto).toBe("Foto do passo 3 enviada.");
  });

  test("uma recusa do servidor diz o motivo que o servidor deu", () => {
    const aviso = avisoDoEnvio(
      envio({ estado: "recusado", erro: "Termina as lições anteriores primeiro" }),
    );

    expect(aviso.tom).toBe("erro");
    expect(aviso.texto).toMatch(/lições anteriores/i);
  });

  test("muitos de uma vez: um resumo com quantas passaram", () => {
    const aviso = avisoDoResumo([
      envio({ resposta: { passed: true, xpEarned: 40 } }),
      envio({ resposta: { passed: false, results: [{ correct: false }] } }),
      envio({ resposta: { passed: true, xpEarned: 30 } }),
    ]);

    expect(aviso.texto).toMatch(/2 de 3 lições passaram/);
    expect(aviso.texto).toMatch(/\+70 XP/);
  });
});
