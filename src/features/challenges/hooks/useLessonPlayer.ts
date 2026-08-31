import { useCallback, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AnswerValue, Lesson, LessonPlayerPhase, Question } from "@/types/learning";
import { learningService } from "../services/learningService";
import { useInvalidateLearningPath, useSetLearningPath } from "./useLearningPath";
import { currentUserQueryKey } from "@/features/profile/hooks/useCurrentUser";

const MAX_HEARTS = 3;

type GivenAnswer = { questionId: string; answer: AnswerValue };

/**
 * O leitor de lições mantém o ritmo do Duolingo (feedback imediato a cada
 * resposta) mas nenhuma correção acontece no browser: cada resposta é
 * validada pelo servidor, e o XP só é atribuído quando o servidor volta a
 * corrigir tudo no fim.
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

  const answers = useRef<GivenAnswer[]>([]);

  const currentQuestion: Question | null = lesson?.questions[questionIndex] ?? null;
  const currentPrepStep = lesson?.preparationSteps[prepStepIndex] ?? null;

  const totalSteps = useMemo(() => {
    if (!lesson) return 1;
    return 1 + lesson.preparationSteps.length + lesson.questions.length;
  }, [lesson]);

  const progress = useMemo(() => {
    if (!lesson) return 0;
    if (phase === "intro") return (1 / totalSteps) * 100;
    if (phase === "complete") return 100;

    let done = 0;
    if (phase === "prep") done = 1 + prepStepIndex + 1;
    if (phase === "quiz") {
      done = 1 + lesson.preparationSteps.length + questionIndex + (showFeedback ? 1 : 0);
    }
    return (done / totalSteps) * 100;
  }, [lesson, phase, prepStepIndex, questionIndex, showFeedback, totalSteps]);

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
    if (prepStepIndex >= lesson.preparationSteps.length - 1) {
      setPhase("quiz");
      setQuestionIndex(0);
      return;
    }
    setPrepStepIndex((i) => i + 1);
  }, [lesson, prepStepIndex]);

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

      try {
        const result = await learningService.checkAnswer(lesson.id, currentQuestion.id, answer);

        answers.current = [
          ...answers.current.filter((a) => a.questionId !== currentQuestion.id),
          { questionId: currentQuestion.id, answer },
        ];

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
