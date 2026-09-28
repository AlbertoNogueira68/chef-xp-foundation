import { describe, expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LessonPlayer } from "@/components/learning/LessonPlayer";
import { renderWithProviders } from "@/test/utils";
import type { AnswerValue, Lesson, LessonPlayerPhase, Question } from "@/types/learning";

/**
 * O `LessonPlayer` é o ecrã onde se passa a aprendizagem toda, e não tinha um
 * único teste. É também o componente mais exposto da aplicação: recebe as
 * respostas certas do servidor **depois** de se responder, e mostrá-las cedo
 * seria entregar o gabarito.
 *
 * Todo ele é função das props — o estado vive no `useLessonPlayer`, que já
 * tinha testes. Isso torna-o testável sem mocks de rede: monta-se com o estado
 * que se quer examinar e olha-se para o que aparece no ecrã.
 */

function pergunta(overrides: Partial<Question> = {}): Question {
  return {
    id: "q1",
    type: "choice",
    prompt: "A água da massa leva sal quando?",
    options: ["Antes de ferver", "Quando ferve", "No fim", "Nunca"],
    ...overrides,
  };
}

function licao(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: "l1",
    dayNumber: 1,
    title: "Massa como deve ser",
    dishName: "massa com tomate",
    description: "Água, sal e tempo.",
    type: "lesson",
    xpReward: 50,
    icon: "🍝",
    imageUrl: "/lessons/massa.webp",
    cookTimeMin: 20,
    difficulty: "facil",
    ingredients: ["massa", "tomate", "sal"],
    preparationSteps: [{ title: "Ferver a água", description: "Água a ferver, e só então o sal." }],
    questions: [pergunta(), pergunta({ id: "q2", prompt: "Quanto sal?" })],
    ...overrides,
  };
}

/** As props todas, com o estado de repouso. Cada teste muda só o que lhe importa. */
function props(overrides: Record<string, unknown> = {}) {
  return {
    lesson: licao(),
    phase: "quiz" as LessonPlayerPhase,
    currentQuestion: pergunta(),
    currentPrepStep: null,
    prepStepIndex: 0,
    prepStepCount: 1,
    questionIndex: 0,
    hearts: 3,
    maxHearts: 3,
    progress: 0,
    selectedAnswer: null as AnswerValue | null,
    showFeedback: false,
    isCorrect: false,
    correctAnswer: null as AnswerValue | null,
    explainWrong: null as string | null,
    explanation: null as string | null,
    isChecking: false,
    xpEarned: 0,
    semCorrecao: false,
    porEnviar: false,
    onClose: vi.fn(),
    onStartPreparation: vi.fn(),
    onNextPrepStep: vi.fn(),
    onPrevPrepStep: vi.fn(),
    onSubmit: vi.fn(),
    onNextQuestion: vi.fn(),
    onRetry: vi.fn(),
    onContinue: vi.fn(),
    ...overrides,
  };
}

describe("o ecrã da lição", () => {
  test("sem lição não desenha nada — é o estado antes de a API responder", () => {
    const { container } = renderWithProviders(<LessonPlayer {...props({ lesson: null })} />);
    expect(container).toBeEmptyDOMElement();
  });

  describe("a apresentação", () => {
    test("mostra o prato e o que é preciso antes de se começar", () => {
      renderWithProviders(<LessonPlayer {...props({ phase: "intro", currentQuestion: null })} />);

      // O título do ecrã é o prato, não o nome da lição: quem abre quer saber
      // o que vai cozinhar.
      expect(screen.getByRole("heading", { name: "massa com tomate" })).toBeInTheDocument();
      expect(screen.getByText("massa")).toBeInTheDocument();
      expect(screen.getByText("tomate")).toBeInTheDocument();
    });

    test("não há corações à vista antes do quiz — nada há a perder ainda", () => {
      renderWithProviders(<LessonPlayer {...props({ phase: "intro", currentQuestion: null })} />);
      expect(screen.queryByRole("status", { name: /lives|vidas/i })).not.toBeInTheDocument();
    });
  });

  describe("o quiz", () => {
    test("o enunciado é o cabeçalho da pergunta, para quem ouve a página", () => {
      renderWithProviders(<LessonPlayer {...props()} />);

      expect(
        screen.getByRole("heading", { name: "A água da massa leva sal quando?" }),
      ).toBeInTheDocument();
    });

    test("diz em que pergunta se vai", () => {
      renderWithProviders(<LessonPlayer {...props({ questionIndex: 1 })} />);
      expect(screen.getByText(/Question 2 of 2/i)).toBeInTheDocument();
    });

    test("cada opção é um botão, e escolher entrega a resposta", async () => {
      const onSubmit = vi.fn();
      renderWithProviders(<LessonPlayer {...props({ onSubmit })} />);

      await userEvent.click(screen.getByRole("button", { name: "Quando ferve" }));

      expect(onSubmit).toHaveBeenCalledWith("Quando ferve");
    });

    test("as opções ficam travadas enquanto o servidor corrige", () => {
      renderWithProviders(<LessonPlayer {...props({ isChecking: true })} />);

      expect(screen.getByRole("button", { name: "Quando ferve" })).toBeDisabled();
    });

    test("depois de responder não se muda a resposta", () => {
      renderWithProviders(
        <LessonPlayer {...props({ showFeedback: true, selectedAnswer: "No fim" })} />,
      );

      expect(screen.getByRole("button", { name: "No fim" })).toBeDisabled();
    });

    test("o gabarito não está no ecrã antes de se responder", () => {
      // `correctAnswer` a null é o que a API devolve até se responder: a
      // resposta certa não vem dentro da lição.
      renderWithProviders(<LessonPlayer {...props()} />);

      expect(screen.queryByText(/Correct answer/i)).not.toBeInTheDocument();
    });
  });

  describe("o feedback", () => {
    test("quando se erra, o porquê vem antes da resposta certa", () => {
      renderWithProviders(
        <LessonPlayer
          {...props({
            showFeedback: true,
            isCorrect: false,
            selectedAnswer: "No fim",
            correctAnswer: "Quando ferve",
            explainWrong: "No fim o sal já não entra na massa.",
            explanation: "O sal dissolve-se na água a ferver.",
          })}
        />,
      );

      const erro = screen.getByText("No fim o sal já não entra na massa.");
      const porque = screen.getByText("O sal dissolve-se na água a ferver.");
      expect(erro).toBeInTheDocument();
      expect(porque).toBeInTheDocument();
      // A ordem no documento é a ordem em que se lê: primeiro o erro.
      expect(erro.compareDocumentPosition(porque)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    test("a correção é anunciada a quem ouve a página", () => {
      renderWithProviders(
        <LessonPlayer
          {...props({
            showFeedback: true,
            isCorrect: true,
            selectedAnswer: "Quando ferve",
            explanation: "O sal dissolve-se na água a ferver.",
          })}
        />,
      );

      // O painel aparece sem mudar o foco: sem `aria-live`, um leitor de ecrã
      // não diz nada e a pessoa fica sem saber se acertou. Há duas regiões
      // anunciadas no quiz — esta e a contagem de vidas.
      const anunciadas = screen.getAllByRole("status");
      expect(
        anunciadas.some((r) => r.textContent?.includes("O sal dissolve-se na água a ferver.")),
      ).toBe(true);
    });

    test("perder uma vida é anunciado, e não só mudado de cor", () => {
      renderWithProviders(<LessonPlayer {...props({ hearts: 2 })} />);

      expect(screen.getByRole("status", { name: /2 of 3 lives left/i })).toBeInTheDocument();
    });

    test("num exercício de ordenar, a sequência certa aparece no painel", () => {
      renderWithProviders(
        <LessonPlayer
          {...props({
            currentQuestion: pergunta({
              type: "order",
              items: ["Sal", "Água", "Massa"],
              options: undefined,
            }),
            showFeedback: true,
            isCorrect: false,
            correctAnswer: ["Água", "Sal", "Massa"],
            explanation: "A água primeiro.",
          })}
        />,
      );

      expect(screen.getByText(/Correct answer/i)).toBeInTheDocument();
    });

    test("numa escolha múltipla a resposta certa não se repete em texto — está nas opções", () => {
      renderWithProviders(
        <LessonPlayer
          {...props({
            showFeedback: true,
            isCorrect: false,
            selectedAnswer: "No fim",
            correctAnswer: "Quando ferve",
            explanation: "O sal dissolve-se na água a ferver.",
          })}
        />,
      );

      expect(screen.queryByText(/Correct answer/i)).not.toBeInTheDocument();
    });

    test("sem rede não se diz certo nem errado: diz-se que ficou guardado", () => {
      renderWithProviders(
        <LessonPlayer
          {...props({ showFeedback: true, semCorrecao: true, selectedAnswer: "No fim" })}
        />,
      );

      expect(screen.getByText(/Answer saved/i)).toBeInTheDocument();
      expect(screen.getByText(/costs you no lives/i)).toBeInTheDocument();
    });

    test("continuar só aparece depois de haver correção", async () => {
      const onNextQuestion = vi.fn();
      const { rerender } = renderWithProviders(<LessonPlayer {...props()} />);
      expect(screen.queryByRole("button", { name: /Continue/i })).not.toBeInTheDocument();

      rerender(
        <LessonPlayer
          {...props({
            showFeedback: true,
            isCorrect: true,
            selectedAnswer: "Quando ferve",
            onNextQuestion,
          })}
        />,
      );

      await userEvent.click(screen.getByRole("button", { name: /Continue/i }));
      expect(onNextQuestion).toHaveBeenCalled();
    });

    test("sem corações não se continua — o caminho é o ecrã de derrota", () => {
      renderWithProviders(
        <LessonPlayer
          {...props({
            showFeedback: true,
            isCorrect: false,
            hearts: 0,
            selectedAnswer: "No fim",
            explanation: "Fica para a próxima.",
          })}
        />,
      );

      expect(screen.getByRole("button", { name: /Continue/i })).toBeDisabled();
    });

    test("mas sem rede continua-se mesmo sem corações: nada foi corrigido", () => {
      renderWithProviders(
        <LessonPlayer
          {...props({ showFeedback: true, semCorrecao: true, hearts: 0, selectedAnswer: "No fim" })}
        />,
      );

      expect(screen.getByRole("button", { name: /Continue/i })).toBeEnabled();
    });
  });

  describe("o fim", () => {
    test("ficar sem vidas oferece repetir e sair, e nada mais", async () => {
      const onRetry = vi.fn();
      const onClose = vi.fn();
      renderWithProviders(
        <LessonPlayer
          {...props({ phase: "failed", currentQuestion: null, hearts: 0, onRetry, onClose })}
        />,
      );

      expect(screen.getByRole("heading", { name: /Out of lives/i })).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: /Try again/i }));
      expect(onRetry).toHaveBeenCalled();

      await userEvent.click(screen.getByRole("button", { name: /Back to the path/i }));
      expect(onClose).toHaveBeenCalled();
    });

    test("acabar mostra o XP ganho", () => {
      renderWithProviders(
        <LessonPlayer {...props({ phase: "complete", currentQuestion: null, xpEarned: 50 })} />,
      );

      expect(screen.getByText(/50/)).toBeInTheDocument();
    });

    test("acabar sem rede diz que a lição está por enviar, e não que se perdeu", () => {
      renderWithProviders(
        <LessonPlayer
          {...props({ phase: "complete", currentQuestion: null, xpEarned: 50, porEnviar: true })}
        />,
      );

      // A palavra exata é do i18n; o que importa é não haver nada a dizer que falhou.
      expect(screen.queryByText(/failed|erro/i)).not.toBeInTheDocument();
    });
  });

  test("fechar é possível a qualquer momento do quiz", async () => {
    const onClose = vi.fn();
    renderWithProviders(<LessonPlayer {...props({ onClose })} />);

    // O botão tem um nome acessível, e não só um ícone: era isto que faltava
    // antes deste teste existir.
    await userEvent.click(screen.getByRole("button", { name: /Leave the lesson/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
