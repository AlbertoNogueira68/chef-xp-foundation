import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AnswerValue, ReviewCompletion, ReviewItem, ReviewQueue } from "@/types/learning";
import { learningService } from "../services/learningService";
import { useInvalidateLearningPath } from "./useLearningPath";
import { currentUserQueryKey } from "@/features/profile/hooks/useCurrentUser";
import { t } from "@/i18n";

/**
 * A sessão de revisão.
 *
 * O percurso tem um fim; aprender a cozinhar não tem. Quando as lições de um
 * trilho acabam, é isto que sobra para voltar — as perguntas que já se
 * respondeu, outra vez, com a matéria em que se errou a aparecer mais cedo.
 *
 * O desenho é de propósito mais simples do que o do `useLessonPlayer`:
 *
 * - **Não há corações.** Errar numa revisão não é falhar uma lição: é a razão
 *   pela qual a revisão existe. Perder vidas aqui ensinava a evitar a revisão.
 * - **Não há fase de preparação.** Já se fez a lição uma vez.
 * - **Não há caixa de saída.** A revisão não avança o percurso e não tem
 *   pressa: sem rede, fica para outro dia. O que se ganharia com uma fila
 *   offline aqui era complexidade, não valor.
 *
 * O XP vem do servidor e é pago uma vez por dia e por trilho — o `paid: false`
 * é o que permite ao ecrã dizer "a revisão de hoje já estava feita" em vez de
 * mostrar "+0 XP" e deixar a pessoa a pensar que perdeu o que fez.
 */
export function useReview(trailId?: string) {
  const queryClient = useQueryClient();
  const invalidatePath = useInvalidateLearningPath(trailId);

  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerValue | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState<AnswerValue | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explainWrong, setExplainWrong] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [completion, setCompletion] = useState<ReviewCompletion | null>(null);

  /** A sessão que está a ser jogada. Fixa-se ao abrir: a fila muda com as respostas. */
  const [sessao, setSessao] = useState<ReviewItem[]>([]);
  const respondidas = useRef<Array<{ lessonId: string; questionId: string }>>([]);

  /**
   * Quantas estão em atraso. É o que o cartão do percurso mostra, e por isso
   * não pode ser uma leitura caríssima: o servidor conta com um índice.
   *
   * `staleTime` de um minuto porque a dívida de revisão muda em dias, não em
   * segundos — pedir isto a cada montagem do percurso era pura cerimónia.
   */
  const fila = useQuery<ReviewQueue>({
    queryKey: ["review", trailId ?? "default"],
    queryFn: () => learningService.getReview(trailId),
    staleTime: 60_000,
  });

  const item: ReviewItem | null = sessao[index] ?? null;
  const total = sessao.length;

  const limparPergunta = useCallback(() => {
    setSelectedAnswer(null);
    setShowFeedback(false);
    setIsCorrect(false);
    setCorrectAnswer(null);
    setExplanation(null);
    setExplainWrong(null);
  }, []);

  const open = useCallback(async () => {
    // Pede a fila de novo ao abrir: a que está em cache pode ser de ontem, e
    // começar uma sessão com perguntas que já não estão em atraso seria
    // trabalho a fingir.
    try {
      const fresca = await learningService.getReview(trailId);
      queryClient.setQueryData(["review", trailId ?? "default"], fresca);

      if (fresca.questions.length === 0) {
        toast.info(t("Nothing to review right now — come back in a day or two."));
        return;
      }

      setSessao(fresca.questions);
      respondidas.current = [];
      setIndex(0);
      setCompletion(null);
      limparPergunta();
      setIsOpen(true);
    } catch {
      toast.error(t("Could not load the review."));
    }
  }, [limparPergunta, queryClient, trailId]);

  const close = useCallback(() => {
    setIsOpen(false);
    setSessao([]);
    setCompletion(null);
    limparPergunta();
    // A fila mudou: o que se acertou foi para mais longe no calendário.
    void fila.refetch();
  }, [fila, limparPergunta]);

  const submitAnswer = useCallback(
    async (answer: AnswerValue) => {
      if (!item || showFeedback || isChecking) return;

      setSelectedAnswer(answer);
      setIsChecking(true);

      try {
        const resultado = await learningService.checkReviewAnswer(
          item.lessonId,
          item.question.id,
          answer,
          trailId,
        );

        setIsCorrect(resultado.correct);
        setCorrectAnswer(resultado.correctAnswer);
        setExplanation(resultado.explanation);
        setExplainWrong(resultado.explainWrong);
        setShowFeedback(true);
        respondidas.current.push({ lessonId: item.lessonId, questionId: item.question.id });
      } catch {
        // Sem correção não há feedback para mostrar: a revisão fica por aqui, e
        // o que ficou respondido até agora conta quando se fechar a sessão.
        setSelectedAnswer(null);
        toast.error(t("No connection — the review can wait."));
      } finally {
        setIsChecking(false);
      }
    },
    [isChecking, item, showFeedback, trailId],
  );

  const next = useCallback(async () => {
    if (index + 1 < total) {
      setIndex((i) => i + 1);
      limparPergunta();
      return;
    }

    // Última pergunta: fechar a sessão é o que paga o XP.
    if (respondidas.current.length === 0) {
      close();
      return;
    }

    setIsFinishing(true);
    try {
      const resultado = await learningService.completeReview(respondidas.current, trailId);
      setCompletion(resultado);
      // O XP mudou o nível e o objetivo do dia: quem mostra esses números tem
      // de os voltar a pedir.
      void queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
      invalidatePath();
    } catch {
      toast.error(t("Could not save the review. Your answers are safe."));
    } finally {
      setIsFinishing(false);
    }
  }, [close, index, invalidatePath, limparPergunta, queryClient, total, trailId]);

  return {
    /** Quantas perguntas estão em atraso, para o cartão do percurso. */
    due: fila.data?.due ?? 0,
    isLoadingDue: fila.isLoading,

    isOpen,
    item,
    index,
    total,
    /** Quanto da sessão já foi feito, em percentagem. */
    progress: total > 0 ? (index / total) * 100 : 0,

    selectedAnswer,
    showFeedback,
    isCorrect,
    correctAnswer,
    explanation,
    explainWrong,
    isChecking,
    isFinishing,
    completion,

    open,
    close,
    submitAnswer,
    next,
  };
}
