import { describe, expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviewSession } from "@/components/learning/ReviewSession";
import { renderWithProviders } from "@/test/utils";
import type { AnswerValue, Question, ReviewCompletion, ReviewItem } from "@/types/learning";

/**
 * A sessão de revisão é a lição sem a primeira vez: sem apresentação, sem
 * preparação e — o que mais importa — **sem corações**. Errar numa revisão é a
 * razão pela qual ela existe; se custasse vidas, a revisão ensinava a evitar a
 * revisão.
 */

function pergunta(overrides: Partial<Question> = {}): Question {
  return {
    id: "q1",
    type: "choice",
    prompt: "A que temperatura se sela a carne?",
    options: ["Lume baixo", "Lume forte", "Tanto faz"],
    ...overrides,
  };
}

function item(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    lessonId: "l1",
    lessonTitle: "Selar carne",
    question: pergunta(),
    ...overrides,
  };
}

function revisao(overrides: Record<string, unknown> = {}) {
  return {
    due: 12,
    isLoadingDue: false,
    isOpen: true,
    item: item(),
    index: 0,
    total: 8,
    progress: 0,
    selectedAnswer: null as AnswerValue | null,
    showFeedback: false,
    isCorrect: false,
    correctAnswer: null as AnswerValue | null,
    explanation: null as string | null,
    explainWrong: null as string | null,
    isChecking: false,
    isFinishing: false,
    completion: null as ReviewCompletion | null,
    open: vi.fn(),
    close: vi.fn(),
    submitAnswer: vi.fn(),
    next: vi.fn(),
    ...overrides,
  } as unknown as Parameters<typeof ReviewSession>[0]["review"];
}

function conclusao(overrides: Partial<ReviewCompletion> = {}): ReviewCompletion {
  return {
    total: 8,
    correct: 8,
    xpEarned: 25,
    paid: true,
    totalXp: 1200,
    level: 7,
    streak: 4,
    ...overrides,
  };
}

describe("a sessão de revisão", () => {
  test("sem pergunta não desenha nada", () => {
    const { container } = renderWithProviders(<ReviewSession review={revisao({ item: null })} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("não há corações na revisão — não há nada a perder", () => {
    renderWithProviders(<ReviewSession review={revisao()} />);

    expect(screen.queryByRole("status", { name: /lives/i })).not.toBeInTheDocument();
    // No lugar deles está a contagem da sessão.
    expect(screen.getByText("1/8")).toBeInTheDocument();
  });

  test("diz de que lição vem a pergunta", () => {
    renderWithProviders(<ReviewSession review={revisao()} />);
    expect(screen.getByText(/From: Selar carne/i)).toBeInTheDocument();
  });

  test("o enunciado é o cabeçalho, e as opções são botões", async () => {
    const submitAnswer = vi.fn();
    renderWithProviders(<ReviewSession review={revisao({ submitAnswer })} />);

    expect(
      screen.getByRole("heading", { name: "A que temperatura se sela a carne?" }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Lume forte" }));
    expect(submitAnswer).toHaveBeenCalledWith("Lume forte");
  });

  test("o gabarito não está no ecrã antes de se responder", () => {
    renderWithProviders(<ReviewSession review={revisao()} />);
    expect(screen.queryByText(/Correct answer/i)).not.toBeInTheDocument();
  });

  test("a correção é anunciada a quem ouve a página", () => {
    renderWithProviders(
      <ReviewSession
        review={revisao({
          showFeedback: true,
          isCorrect: false,
          selectedAnswer: "Lume baixo",
          explainWrong: "A lume baixo a carne cozinha em vez de selar.",
          explanation: "Selar é a reação de Maillard, e essa precisa de calor.",
        })}
      />,
    );

    // `role="status"` com `aria-live`: a explicação aparece sem mudar o foco.
    const aviso = screen.getByRole("status");
    expect(aviso).toHaveTextContent("A lume baixo a carne cozinha em vez de selar.");
    expect(aviso).toHaveTextContent("Selar é a reação de Maillard");
  });

  test("na última pergunta o botão fala de acabar, não de continuar", () => {
    renderWithProviders(
      <ReviewSession
        review={revisao({ index: 7, total: 8, showFeedback: true, isCorrect: true })}
      />,
    );

    expect(screen.getByRole("button", { name: /Finish review/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Continue$/i })).not.toBeInTheDocument();
  });

  test("enquanto a sessão está a fechar não se carrega duas vezes", () => {
    renderWithProviders(
      <ReviewSession
        review={revisao({ index: 7, total: 8, showFeedback: true, isFinishing: true })}
      />,
    );

    expect(screen.getByRole("button", { name: /Finish review/i })).toBeDisabled();
  });

  test("sair tem nome, não é só um X", () => {
    renderWithProviders(<ReviewSession review={revisao()} />);
    expect(screen.getByRole("button", { name: /Leave the review/i })).toBeInTheDocument();
  });

  describe("o fim", () => {
    test("mostra o acerto e o XP", () => {
      renderWithProviders(
        <ReviewSession review={revisao({ completion: conclusao({ correct: 6, total: 8 }) })} />,
      );

      expect(screen.getByRole("heading", { name: /Review done/i })).toBeInTheDocument();
      expect(screen.getByText(/6 of 8 right/i)).toBeInTheDocument();
      expect(screen.getByText(/\+25 XP/)).toBeInTheDocument();
    });

    test("uma segunda revisão no mesmo dia explica-se em vez de mostrar +0 XP", () => {
      renderWithProviders(
        <ReviewSession review={revisao({ completion: conclusao({ paid: false, xpEarned: 0 }) })} />,
      );

      expect(screen.queryByText(/\+0 XP/)).not.toBeInTheDocument();
      expect(screen.getByText(/already paid/i)).toBeInTheDocument();
      // E diz o que continuou a valer: o calendário mexeu-se.
      expect(screen.getByText(/still count towards what comes back/i)).toBeInTheDocument();
    });

    test("com mais perguntas em atraso, oferece continuar", async () => {
      const open = vi.fn();
      renderWithProviders(
        <ReviewSession review={revisao({ due: 12, total: 8, completion: conclusao(), open })} />,
      );

      await userEvent.click(screen.getByRole("button", { name: /Review 4 more/i }));
      expect(open).toHaveBeenCalled();
    });

    test("sem mais nada em atraso, não oferece continuar", () => {
      renderWithProviders(
        <ReviewSession review={revisao({ due: 8, total: 8, completion: conclusao() })} />,
      );

      expect(screen.queryByRole("button", { name: /Review .* more/i })).not.toBeInTheDocument();
    });
  });
});
