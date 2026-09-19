import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useLessonPlayer } from "./useLessonPlayer";
import { clearOutbox, outboxItems } from "@/lib/offline/outbox";
import { offlineMessage } from "@/services/api";

/**
 * A lição sem rede: continua até ao fim, guarda tudo, e não inventa correções.
 *
 * O `openLesson` e a leitura da lição vão pela rede como sempre (offline, o
 * service worker serve a cópia guardada). O que estes testes provam é o que
 * acontece a partir do momento em que a resposta não pode ser corrigida.
 */

const licao = {
  id: "massa-fresca",
  dishName: "Massa fresca",
  preparationSteps: [],
  questions: [
    { id: "q1", type: "choice", prompt: "Quanta farinha?", options: ["100g", "200g"] },
    { id: "q2", type: "choice", prompt: "Quantos ovos?", options: ["1", "2"] },
  ],
  xpReward: 40,
};

const servico = vi.hoisted(() => ({
  getLesson: vi.fn(),
  checkAnswer: vi.fn(),
  completeLesson: vi.fn(),
}));

vi.mock("../services/learningService", () => ({ learningService: servico }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock("./useLearningPath", () => ({
  useInvalidateLearningPath: () => vi.fn(),
  useSetLearningPath: () => vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

/** O erro que o `apiFetch` dá quando não há rede: `status` a zero. */
function erroDeRede() {
  const erro = new Error(offlineMessage()) as Error & { status: number };
  erro.status = 0;
  return erro;
}

beforeEach(async () => {
  await clearOutbox();
  servico.getLesson.mockResolvedValue({ lesson: licao });
  servico.checkAnswer.mockRejectedValue(erroDeRede());
  servico.completeLesson.mockRejectedValue(erroDeRede());
});

afterEach(() => clearOutbox());

async function abrirNoQuiz() {
  const { result } = renderHook(() => useLessonPlayer());
  await act(async () => {
    await result.current.openLesson("massa-fresca");
  });
  act(() => result.current.startPreparation());
  act(() => result.current.nextPrepStep());
  await waitFor(() => expect(result.current.phase).toBe("quiz"));
  return result;
}

describe("responder a uma lição sem rede", () => {
  test("a resposta é aceite e a lição avança", async () => {
    const result = await abrirNoQuiz();

    await act(async () => {
      await result.current.submitAnswer("200g");
    });

    // Aceite, guardada, e sem fingir que foi corrigida.
    expect(result.current.showFeedback).toBe(true);
    expect(result.current.semCorrecao).toBe(true);
    expect(result.current.selectedAnswer).toBe("200g");
  });

  test("não se perdem corações por uma resposta que ninguém corrigiu", async () => {
    const result = await abrirNoQuiz();

    await act(async () => {
      await result.current.submitAnswer("100g");
    });

    // Descontar um coração exigiria saber que a resposta está errada — que é
    // exatamente o que não se sabe sem servidor.
    expect(result.current.hearts).toBe(3);
  });

  test("no fim, a lição inteira fica na caixa de saída", async () => {
    const result = await abrirNoQuiz();

    await act(async () => {
      await result.current.submitAnswer("200g");
    });
    await act(async () => {
      await result.current.nextQuestion();
    });
    await act(async () => {
      await result.current.submitAnswer("2");
    });
    await act(async () => {
      await result.current.nextQuestion();
    });

    await waitFor(() => expect(result.current.phase).toBe("complete"));
    expect(result.current.porEnviar).toBe(true);
    // Sem XP anunciado: quem paga é o servidor, e ele ainda não viu isto.
    expect(result.current.xpEarned).toBe(0);

    const fila = await outboxItems();
    expect(fila).toHaveLength(1);
    expect(fila[0].path).toBe("/learning/lessons/massa-fresca/complete");
    expect(fila[0].body).toEqual({
      answers: [
        { questionId: "q1", answer: "200g" },
        { questionId: "q2", answer: "2" },
      ],
    });
  });

  test("com rede, nada disto muda o caminho normal", async () => {
    servico.checkAnswer.mockResolvedValue({
      correct: true,
      explanation: "Certo.",
      correctAnswer: "200g",
      explainWrong: null,
      skills: [],
    });

    const result = await abrirNoQuiz();
    await act(async () => {
      await result.current.submitAnswer("200g");
    });

    expect(result.current.semCorrecao).toBe(false);
    expect(result.current.isCorrect).toBe(true);
    expect(await outboxItems()).toEqual([]);
  });
});
