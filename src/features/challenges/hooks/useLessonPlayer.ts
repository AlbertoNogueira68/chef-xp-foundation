import { useCallback, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AnswerValue, Lesson, LessonPlayerPhase, Question } from "@/types/learning";
import { enqueue } from "@/lib/offline/outbox";
import type { ApiError } from "@/services/api";
import { learningService } from "../services/learningService";
import { useInvalidateLearningPath, useSetLearningPath } from "./useLearningPath";
import { currentUserQueryKey } from "@/features/profile/hooks/useCurrentUser";

const MAX_HEARTS = 3;

type GivenAnswer = { questionId: string; answer: AnswerValue };

/** Um ecrã da fase de preparação: um passo ou uma dica do Chef. */
export type PrepItem = { title: string; description: string; isTip: boolean };

/**
 * O leitor de lições mantém o ritmo do Duolingo (feedback imediato a cada
 * resposta) mas nenhuma correção acontece no browser: cada resposta é
 * validada pelo servidor, e o XP só é atribuído quando o servidor volta a
 * corrigir tudo no fim.
 *
 * **Sem rede, a lição continua.** As respostas ficam guardadas e a lição vai
 * até ao fim; o que não há é correção pergunta a pergunta, porque o gabarito
 * vive no servidor e é para lá que fica. Ao chegar ao fim, a lição inteira
 * entra na caixa de saída e é enviada quando a rede voltar — é aí que o
 * servidor corrige tudo e paga o XP. Repetir o envio é seguro: o XP da lição
 * está preso ao `sourceRef` e nunca é pago duas vezes.
 *
 * Os corações também ficam intactos offline. Descontá-los exigiria saber se a
 * resposta estava certa, que é exatamente o que não se sabe.
 */
export function useLessonPlayer() {
  const queryClient = useQueryClient();
  const invalidatePath = useInvalidateLearningPath();
  const setPath = useSetLearningPath();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [phase, setPhase] = useState<LessonPlayerPhase>("intro");
  const [prepStepIndex, setPrepStepIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerValue | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<AnswerValue | null>(null);
  const [explainWrong, setExplainWrong] = useState<string | null>(null);
  const [xpEarned, setXpEarned] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  /** Esta resposta ficou por corrigir — não havia rede. */
  const [semCorrecao, setSemCorrecao] = useState(false);
  /** A lição terminou, mas está na caixa de saída em vez de enviada. */
  const [porEnviar, setPorEnviar] = useState(false);

  const answers = useRef<GivenAnswer[]>([]);

  const currentQuestion: Question | null = lesson?.questions[questionIndex] ?? null;

  // As dicas do Chef passam-se como os passos de preparação, logo a seguir a
  // eles: lêem-se, não se respondem.
  const prepItems = useMemo<PrepItem[]>(() => {
    if (!lesson) return [];
    return [
      ...lesson.preparationSteps.map((step) => ({ ...step, isTip: false })),
      ...(lesson.tips ?? []).map((tip) => ({
        title: tip.title,
        description: tip.text,
        isTip: true,
      })),
    ];
  }, [lesson]);
  const currentPrepStep = prepItems[prepStepIndex] ?? null;

  const totalSteps = useMemo(() => {
    if (!lesson) return 1;
    return 1 + prepItems.length + lesson.questions.length;
  }, [lesson, prepItems]);

  const progress = useMemo(() => {
    if (!lesson) return 0;
    if (phase === "intro") return (1 / totalSteps) * 100;
    if (phase === "complete") return 100;

    let done = 0;
    if (phase === "prep") done = 1 + prepStepIndex + 1;
    if (phase === "quiz") {
      done = 1 + prepItems.length + questionIndex + (showFeedback ? 1 : 0);
    }
    return (done / totalSteps) * 100;
  }, [lesson, phase, prepStepIndex, questionIndex, showFeedback, totalSteps, prepItems]);

  const resetSession = useCallback((loaded: Lesson) => {
    answers.current = [];
    setLesson(loaded);
    setPhase("intro");
    setPrepStepIndex(0);
    setQuestionIndex(0);
    setHearts(MAX_HEARTS);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setIsCorrect(false);
    setExplanation(null);
    setCorrectAnswer(null);
    setExplainWrong(null);
    setXpEarned(0);
    setSemCorrecao(false);
    setPorEnviar(false);
  }, []);

  const openLesson = useCallback(
    async (lessonId: string) => {
      try {
        const { lesson: loaded } = await learningService.getLesson(lessonId);
        resetSession(loaded);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível abrir a lição");
      }
    },
    [resetSession],
  );

  const closeLesson = useCallback(() => {
    setLesson(null);
    setPhase("intro");
  }, []);

  const startPreparation = useCallback(() => {
    setPhase("prep");
    setPrepStepIndex(0);
  }, []);

  const nextPrepStep = useCallback(() => {
    if (!lesson) return;
    if (prepStepIndex >= prepItems.length - 1) {
      setPhase("quiz");
      setQuestionIndex(0);
      return;
    }
    setPrepStepIndex((i) => i + 1);
  }, [lesson, prepStepIndex, prepItems]);

  const prevPrepStep = useCallback(() => {
    if (prepStepIndex <= 0) {
      setPhase("intro");
      return;
    }
    setPrepStepIndex((i) => i - 1);
  }, [prepStepIndex]);

  const submitAnswer = useCallback(
    async (answer: AnswerValue) => {
      if (!lesson || !currentQuestion || showFeedback || phase !== "quiz" || isChecking) return;

      setSelectedAnswer(answer);
      setIsChecking(true);
      setSemCorrecao(false);

      const guardar = () => {
        answers.current = [
          ...answers.current.filter((a) => a.questionId !== currentQuestion.id),
          { questionId: currentQuestion.id, answer },
        ];
      };

      try {
        const result = await learningService.checkAnswer(lesson.id, currentQuestion.id, answer);

        guardar();

        setIsCorrect(result.correct);
        setExplanation(result.explanation);
        setCorrectAnswer(result.correctAnswer);
        setExplainWrong(result.explainWrong);
        setShowFeedback(true);

        if (!result.correct) {
          const remaining = hearts - 1;
          setHearts(remaining);
          if (remaining <= 0) {
            setTimeout(() => setPhase("failed"), 800);
          }
        }
      } catch (error) {
        // `status: 0` é falha de rede. A resposta fica guardada e a lição
        // segue: o que não dá é dizer se está certa, e dizer que sim ou que
        // não sem saber era pior do que não dizer nada.
        if ((error as ApiError).status === 0) {
          guardar();
          setSemCorrecao(true);
          setShowFeedback(true);
          setIsCorrect(false);
          setExplanation(null);
          setCorrectAnswer(null);
          setExplainWrong(null);
          return;
        }

        setSelectedAnswer(null);
        toast.error(error instanceof Error ? error.message : "Não foi possível validar a resposta");
      } finally {
        setIsChecking(false);
      }
    },
    [lesson, currentQuestion, showFeedback, phase, hearts, isChecking],
  );

  const nextQuestion = useCallback(async () => {
    if (!lesson || phase !== "quiz" || isFinishing) return;

    const isLast = questionIndex >= lesson.questions.length - 1;

    if (!isLast) {
      setQuestionIndex((i) => i + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setSemCorrecao(false);
      setExplanation(null);
      setCorrectAnswer(null);
      setExplainWrong(null);
      return;
    }

    if (hearts <= 0) return;

    setIsFinishing(true);
    try {
      const result = await learningService.completeLesson(lesson.id, answers.current);

      if (!result.passed) {
        setPhase("failed");
        return;
      }

      setXpEarned(result.xpEarned + (result.streakBonus ?? 0));
      if (result.path) setPath(result.path);
      else invalidatePath();

      // O XP e o nível mudaram: o perfil e o cabeçalho têm de saber.
      queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
      queryClient.invalidateQueries({ queryKey: ["userStats"] });

      if (result.streakBonus) {
        toast.success(`Streak de ${result.streak} dias! +${result.streakBonus} XP extra`);
      }

      setPhase("complete");
    } catch (error) {
      if ((error as ApiError).status === 0) {
        // A lição inteira para a caixa de saída, com as respostas todas. O
        // `ref` é a lição: se a mesma lição for feita outra vez offline, fica
        // a última tentativa em vez de duas.
        const guardado = await enqueue({
          descricao: `Lição: ${lesson.dishName}`,
          path: `/learning/lessons/${lesson.id}/complete`,
          method: "POST",
          body: { answers: answers.current },
          tipo: "licao",
          ref: lesson.id,
        });

        if (guardado) {
          setPorEnviar(true);
          setXpEarned(0);
          setPhase("complete");
          return;
        }
      }

      toast.error(error instanceof Error ? error.message : "Não foi possível concluir a lição");
    } finally {
      setIsFinishing(false);
    }
  }, [lesson, phase, questionIndex, hearts, isFinishing, setPath, invalidatePath, queryClient]);

  const retryLesson = useCallback(() => {
    if (!lesson) return;
    resetSession(lesson);
    setPhase("quiz");
  }, [lesson, resetSession]);

  return {
    lesson,
    phase,
    currentQuestion,
    currentPrepStep,
    prepStepIndex,
    prepStepCount: prepItems.length,
    questionIndex,
    hearts,
    maxHearts: MAX_HEARTS,
    selectedAnswer,
    showFeedback,
    isCorrect,
    explanation,
    correctAnswer,
    explainWrong,
    progress,
    xpEarned,
    isChecking,
    isFinishing,
    semCorrecao,
    porEnviar,
    openLesson,
    closeLesson,
    startPreparation,
    nextPrepStep,
    prevPrepStep,
    submitAnswer,
    nextQuestion,
    retryLesson,
    isOpen: lesson !== null,
  };
}
